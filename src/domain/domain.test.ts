import { describe, it, expect } from 'vitest';
import { getNextTradingDays, getHorizonTradingDays } from './tradingCalendar';
import { deriveForecastStatus } from './lifecycle';
import { resolveForecast } from './resolution';
import { aggregateCrowd } from './crowd';
import { REPLAY_SCENARIOS, createRandomReplayScenario } from '../data/btcMarket';
import { SEED_COMMUNITY_POSTS, SEED_COMMUNITY_COMMENTS } from '../data/seed';
import { localizeDataText } from '../lib/i18nCore';
import type { Forecast, MarketBar } from './types';

describe('Trading Calendar (§12)', () => {
  it('excludes weekends correctly', () => {
    // 2026-10-02 (금요일) 다음 거래일은 2026-10-05 (월요일)
    const nextDays = getNextTradingDays('2026-10-02', 5);
    expect(nextDays).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
    ]);
  });

  it('maps horizon correctly to trading days', () => {
    expect(getHorizonTradingDays('5D')).toBe(5);
    expect(getHorizonTradingDays('30D')).toBe(21);
  });
});

describe('Forecast Lifecycle (§5, §18, §25, §28)', () => {
  const dummyForecast: Forecast = {
    id: 'fc_test',
    authorId: 'u_test',
    anonId: 'anon_test',
    ticker: 'TSLA',
    horizon: '5D',
    mode: 'path',
    comment: 'test',
    lockedAt: '2026-10-02T10:00:00Z',
    basePrice: 200,
    baseDate: '2026-10-02',
    evalDates: ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'],
    rulesVersion: 'v1',
  };

  it('derives LOCKED when current date is before first eval date', () => {
    expect(deriveForecastStatus(dummyForecast, '2026-10-02')).toBe('LOCKED');
    expect(deriveForecastStatus(dummyForecast, '2026-10-04')).toBe('LOCKED');
  });

  it('derives LIVE during evaluation trading days', () => {
    expect(deriveForecastStatus(dummyForecast, '2026-10-05')).toBe('LIVE');
    expect(deriveForecastStatus(dummyForecast, '2026-10-07')).toBe('LIVE');
  });

  it('derives RESOLVED on or after final evaluation trading day', () => {
    expect(deriveForecastStatus(dummyForecast, '2026-10-09')).toBe('RESOLVED');
    expect(deriveForecastStatus(dummyForecast, '2026-10-15')).toBe('RESOLVED');
  });
});

describe('Resolution Logic (§27)', () => {
  const mockBars: MarketBar[] = [
    { date: '2026-10-05', open: 200, high: 205, low: 198, close: 202 },
    { date: '2026-10-06', open: 202, high: 215, low: 201, close: 212 },
    { date: '2026-10-07', open: 212, high: 220, low: 210, close: 218 },
  ];

  it('correctly resolves Path mode direction and end error', () => {
    const forecast: Forecast = {
      id: 'fc_path',
      authorId: null,
      anonId: 'anon',
      ticker: 'TSLA',
      horizon: '5D',
      mode: 'path',
      comment: '',
      lockedAt: '2026-10-02T10:00:00Z',
      basePrice: 200,
      baseDate: '2026-10-02',
      evalDates: ['2026-10-05', '2026-10-06', '2026-10-07'],
      path: [
        { date: '2026-10-05', price: 205 },
        { date: '2026-10-06', price: 210 },
        { date: '2026-10-07', price: 220 },
      ],
      rulesVersion: 'v1',
    };

    const res = resolveForecast(forecast, mockBars);
    expect(res.directionHit).toBe(true); // Both up
    expect(res.forecastChangePct).toBe(10); // 200 -> 220
    expect(res.actualChangePct).toBe(9); // 200 -> 218
    expect(res.endErrorPct).toBeCloseTo(0.92, 1);
  });

  it('correctly resolves Breakout mode hit and date', () => {
    const forecast: Forecast = {
      id: 'fc_breakout',
      authorId: null,
      anonId: 'anon',
      ticker: 'TSLA',
      horizon: '5D',
      mode: 'breakout',
      comment: '',
      lockedAt: '2026-10-02T10:00:00Z',
      basePrice: 200,
      baseDate: '2026-10-02',
      evalDates: ['2026-10-05', '2026-10-06', '2026-10-07'],
      breakout: { direction: 'up', price: 210 },
      rulesVersion: 'v1',
    };

    const res = resolveForecast(forecast, mockBars);
    expect(res.breakoutHit).toBe(true);
    expect(res.hitDate).toBe('2026-10-06'); // High reached 215 on 10-06
  });
});

describe('Crowd Aggregation & Cold Start (§22, §24)', () => {
  it('triggers Cold Start if participants < 5', () => {
    const fewForecasts: Forecast[] = [
      {
        id: '1',
        authorId: null,
        anonId: '1',
        ticker: 'PLTR',
        horizon: '5D',
        mode: 'path',
        comment: '',
        lockedAt: '2026-10-02T10:00:00Z',
        basePrice: 30,
        baseDate: '2026-10-02',
        evalDates: ['2026-10-05'],
        rulesVersion: 'v1',
      },
    ];

    const crowd = aggregateCrowd(fewForecasts, 'PLTR', '5D', 'path');
    expect(crowd.isColdStart).toBe(true);
    expect(crowd.participantsCount).toBe(1);
    expect(crowd.consensusPath).toBeUndefined();
  });

  it('calculates median consensus when participants >= 5', () => {
    const forecasts: Forecast[] = [1, 2, 3, 4, 5].map(i => ({
      id: `f_${i}`,
      authorId: null,
      anonId: `${i}`,
      ticker: 'AAPL',
      horizon: '5D',
      mode: 'path',
      comment: '',
      lockedAt: '2026-10-02T10:00:00Z',
      basePrice: 100,
      baseDate: '2026-10-02',
      evalDates: ['2026-10-05'],
      path: [{ date: '2026-10-05', price: 100 + i * 2 }], // 102, 104, 106, 108, 110 (중앙값: 106)
      rulesVersion: 'v1',
    }));

    const crowd = aggregateCrowd(forecasts, 'AAPL', '5D', 'path');
    expect(crowd.isColdStart).toBe(false);
    expect(crowd.participantsCount).toBe(5);
    expect(crowd.consensusPath?.[0].price).toBe(106);
  });
});

describe('Arena Domain Metrics', () => {
  const arenaForecasts: Forecast[] = [
    {
      id: 'f_bull_1',
      authorId: 'u_1',
      anonId: 'anon_1',
      ticker: 'NVDA',
      horizon: '5D',
      mode: 'path',
      comment: '',
      lockedAt: '2026-10-02T10:00:00Z',
      basePrice: 100,
      baseDate: '2026-10-02',
      evalDates: ['2026-10-05'],
      path: [{ date: '2026-10-05', price: 110 }], // +10% Bull
      rulesVersion: 'v1',
    },
    {
      id: 'f_bull_2',
      authorId: 'u_2',
      anonId: 'anon_2',
      ticker: 'NVDA',
      horizon: '5D',
      mode: 'path',
      comment: '',
      lockedAt: '2026-10-02T11:00:00Z',
      basePrice: 100,
      baseDate: '2026-10-02',
      evalDates: ['2026-10-05'],
      path: [{ date: '2026-10-05', price: 120 }], // +20% Bull
      rulesVersion: 'v1',
    },
    {
      id: 'f_bear_1',
      authorId: 'u_3',
      anonId: 'anon_3',
      ticker: 'NVDA',
      horizon: '5D',
      mode: 'path',
      comment: '',
      lockedAt: '2026-10-02T12:00:00Z',
      basePrice: 100,
      baseDate: '2026-10-02',
      evalDates: ['2026-10-05'],
      path: [{ date: '2026-10-05', price: 90 }], // -10% Bear
      rulesVersion: 'v1',
    },
  ];

  it('computes bull and bear percentage and counts correctly', async () => {
    const { computeArenaSummary } = await import('./arena');
    const summary = computeArenaSummary('NVDA', arenaForecasts, '2026-10-05', '5D', 'path');
    expect(summary.participantsCount).toBe(3);
    expect(summary.bullCount).toBe(2);
    expect(summary.bearCount).toBe(1);
    expect(summary.bullPct).toBe(67);
    expect(summary.bearPct).toBe(33);
  });

  it('computes price distribution buckets correctly', async () => {
    const { computePriceDistribution } = await import('./arena');
    const buckets = computePriceDistribution('NVDA', arenaForecasts, 100, '5D');
    expect(buckets.length).toBe(6);
    const totalCount = buckets.reduce((acc, b) => acc + b.count, 0);
    expect(totalCount).toBe(3);
  });
});

describe('Skill-Weighted Consensus, Unified Cohort Resolution & Portable Share Payload', () => {
  it('weights high-Elo forecasts more heavily than low-Elo forecasts in consensus median', async () => {
    const { compute20DConsensusBand } = await import('./crowd');
    const baseForecasts: Forecast[] = [
      {
        id: 'f_low_1',
        authorId: 'u_low_1',
        anonId: 'a1',
        ticker: 'BTC/USDT',
        horizon: '7D',
        mode: 'path',
        comment: '',
        lockedAt: '2026-10-02T10:00:00Z',
        basePrice: 100,
        baseDate: '2026-10-02',
        evalDates: ['2026-10-03'],
        path: [{ date: '2026-10-03', price: 90 }],
        rulesVersion: 'v1',
      },
      {
        id: 'f_low_2',
        authorId: 'u_low_2',
        anonId: 'a2',
        ticker: 'BTC/USDT',
        horizon: '7D',
        mode: 'path',
        comment: '',
        lockedAt: '2026-10-02T10:00:00Z',
        basePrice: 100,
        baseDate: '2026-10-02',
        evalDates: ['2026-10-03'],
        path: [{ date: '2026-10-03', price: 95 }],
        rulesVersion: 'v1',
      },
      {
        id: 'f_diamond',
        authorId: 'u_diamond',
        anonId: 'a3',
        ticker: 'BTC/USDT',
        horizon: '7D',
        mode: 'path',
        comment: '',
        lockedAt: '2026-10-02T10:00:00Z',
        basePrice: 100,
        baseDate: '2026-10-02',
        evalDates: ['2026-10-03'],
        path: [{ date: '2026-10-03', price: 112 }],
        rulesVersion: 'v1',
      },
    ];

    const band = compute20DConsensusBand(
      baseForecasts,
      ['2026-10-03'],
      100,
      undefined,
      { u_low_1: 1000, u_low_2: 1000, u_diamond: 1850 }
    );
    expect(band).toHaveLength(1);
    expect(band[0].median).toBeGreaterThan(95);
    expect(band[0].topForecasterMedian).toBe(112);
  });

  it('round-trips portable forecast share payloads cleanly across browsers', async () => {
    const { encodeForecastSharePayload, decodeForecastSharePayload } = await import('./sharePayload');
    const source: Forecast = {
      id: 'fc_portable_1',
      authorId: null,
      anonId: 'anon_abc',
      ticker: 'BTC/USDT',
      horizon: '7D',
      mode: 'path',
      comment: 'D+3 눌림목 지지 후 7일 돌파 전망',
      lockedAt: '2026-10-02T09:00:00Z',
      basePrice: 75000,
      baseDate: '2026-10-02',
      evalDates: [
        '2026-10-03',
        '2026-10-04',
        '2026-10-05',
        '2026-10-06',
        '2026-10-07',
        '2026-10-08',
        '2026-10-09',
      ],
      anchors: [
        { day: 3, price: 73500 },
        { day: 7, price: 79200 },
      ],
      rulesVersion: 'v1',
    };

    const encoded = encodeForecastSharePayload(source, {
      handle: 'quant_craft',
      elo: 1890,
    });
    const decoded = decodeForecastSharePayload(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe('fc_portable_1');
    expect(decoded!.basePrice).toBe(75000);
    expect(decoded!.anchors).toEqual(source.anchors);
    expect(decoded!.path).toHaveLength(7);
    expect(decoded!.comment).toBe(source.comment);
    expect(decoded!.sharedAuthorHandle).toBe('quant_craft');
    expect(decoded!.sharedAuthorElo).toBe(1890);
    expect(decoded!.versions?.[0].digestHash).toBeTruthy();
  });

  it('resolves cohorts symmetrically via resolveForecastsWithCohort', async () => {
    const { resolveForecastsWithCohort } = await import('./resolution');
    const bars: MarketBar[] = [
      { date: '2026-10-01', open: 99, high: 101, low: 98, close: 100 },
      { date: '2026-10-02', open: 100, high: 102, low: 99, close: 100 },
      { date: '2026-10-03', open: 100, high: 103, low: 100, close: 102 },
      { date: '2026-10-04', open: 102, high: 105, low: 101, close: 104 },
      { date: '2026-10-05', open: 104, high: 107, low: 103, close: 106 },
    ];
    const evalDates = ['2026-10-03', '2026-10-04', '2026-10-05'];
    const group: Forecast[] = [
      {
        id: 'c_good',
        authorId: 'u_a',
        anonId: 'a1',
        ticker: 'BTC/USDT',
        horizon: '7D',
        mode: 'path',
        comment: '',
        lockedAt: '2026-10-02T00:00:00Z',
        basePrice: 100,
        baseDate: '2026-10-02',
        evalDates,
        path: [
          { date: '2026-10-03', price: 102 },
          { date: '2026-10-04', price: 104 },
          { date: '2026-10-05', price: 106 },
        ],
        rulesVersion: 'v1',
      },
      {
        id: 'c_mid',
        authorId: 'u_b',
        anonId: 'a2',
        ticker: 'BTC/USDT',
        horizon: '7D',
        mode: 'path',
        comment: '',
        lockedAt: '2026-10-02T00:00:00Z',
        basePrice: 100,
        baseDate: '2026-10-02',
        evalDates,
        path: [
          { date: '2026-10-03', price: 101 },
          { date: '2026-10-04', price: 102 },
          { date: '2026-10-05', price: 103 },
        ],
        rulesVersion: 'v1',
      },
      {
        id: 'c_bad',
        authorId: 'u_c',
        anonId: 'a3',
        ticker: 'BTC/USDT',
        horizon: '7D',
        mode: 'path',
        comment: '',
        lockedAt: '2026-10-02T00:00:00Z',
        basePrice: 100,
        baseDate: '2026-10-02',
        evalDates,
        path: [
          { date: '2026-10-03', price: 98 },
          { date: '2026-10-04', price: 96 },
          { date: '2026-10-05', price: 94 },
        ],
        rulesVersion: 'v1',
      },
    ];

    const settled = resolveForecastsWithCohort(group, bars, { u_a: 1200, u_b: 1200, u_c: 1200 });
    const lpA = settled.get('c_good')!.eloSettlement!.deltaLp;
    const lpB = settled.get('c_mid')!.eloSettlement!.deltaLp;
    const lpC = settled.get('c_bad')!.eloSettlement!.deltaLp;
    expect(lpA).toBeGreaterThan(0);
    expect(lpB).toBe(0);
    expect(lpC).toBeLessThan(0);
    expect(lpA + lpB + lpC).toBe(0);
  });
});

describe('Practice Replay Scenarios i18n', () => {
  it('translates all REPLAY_SCENARIOS copy cleanly between Korean and English with zero leftover Hangul', () => {
    expect(REPLAY_SCENARIOS.length).toBeGreaterThan(0);

    for (const sc of REPLAY_SCENARIOS) {
      const fields = [
        sc.blindLabel,
        sc.title,
        sc.revealTitle,
        sc.subtitle,
        sc.marketHint,
        sc.revealTakeaway,
        ...sc.contextCues.flatMap(cue => [cue.label, cue.value]),
      ];

      for (const koText of fields) {
        const enText = localizeDataText(koText, 'en');
        expect(enText).not.toBe('');
        expect(enText).not.toBe(koText);
        expect(enText).not.toMatch(/[\uAC00-\uD7A3]/);
        expect(localizeDataText(enText, 'ko')).toBe(koText.trim());
        expect(localizeDataText(koText, 'ko')).toBe(koText.trim());
      }
    }
  });

  it('includes balanced bull/bear regimes and generates valid random blind scenarios with KO/EN copy', () => {
    const returns7d = REPLAY_SCENARIOS.map(sc => {
      const d7 = sc.futureBars[6].close;
      return ((d7 - sc.basePrice) / sc.basePrice) * 100;
    });
    expect(returns7d.some(r => r > 5)).toBe(true);
    expect(returns7d.some(r => r < -1)).toBe(true);

    const rnd = createRandomReplayScenario();
    expect(rnd.historyBars.length).toBeGreaterThanOrEqual(120);
    expect(rnd.futureBars.length).toBeGreaterThanOrEqual(7);
    expect(rnd.basePrice).toBeGreaterThan(0);

    for (const koText of [rnd.blindLabel, rnd.title, rnd.revealTitle, rnd.subtitle, rnd.marketHint, rnd.revealTakeaway]) {
      const enText = localizeDataText(koText, 'en');
      expect(enText).not.toBe(koText);
      expect(enText).not.toMatch(/[\uAC00-\uD7A3]/);
      expect(localizeDataText(enText, 'ko')).toBe(koText.trim());
    }
  });

  it('keeps REPLAY_SCENARIOS 7D revealTitle and revealTakeaway aligned with futureBars[0..6]', () => {
    for (const sc of REPLAY_SCENARIOS) {
      const bars7d = sc.futureBars.slice(0, 7);
      expect(bars7d).toHaveLength(7);
      const d7Close = bars7d[6].close;
      const pct7d = ((d7Close - sc.basePrice) / sc.basePrice) * 100;
      const formattedSign = `${pct7d >= 0 ? '+' : ''}${pct7d.toFixed(1)}%`;

      expect(sc.revealTitle).toContain(`(${formattedSign})`);
      expect(sc.revealTakeaway).toContain(formattedSign);
      expect(sc.revealTitle).not.toContain('D+20');
      expect(sc.revealTakeaway).not.toContain('D+20');
    }
  });

  it('translates SEED_COMMUNITY_POSTS and SEED_COMMUNITY_COMMENTS cleanly between KO and EN', () => {
    const texts = [
      ...SEED_COMMUNITY_POSTS.flatMap(p => [p.title, p.body]),
      ...SEED_COMMUNITY_COMMENTS.map(c => c.content),
    ];
    expect(texts.length).toBeGreaterThan(0);

    for (const koText of texts) {
      const enText = localizeDataText(koText, 'en');
      expect(enText).not.toBe('');
      expect(enText).not.toBe(koText);
      expect(enText).not.toMatch(/[\uAC00-\uD7A3]/);
      expect(localizeDataText(enText, 'ko')).toBe(koText.trim());
    }
  });
});

