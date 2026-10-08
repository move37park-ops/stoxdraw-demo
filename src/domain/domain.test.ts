import { describe, it, expect } from 'vitest';
import { getNextTradingDays, getHorizonTradingDays } from './tradingCalendar';
import { deriveForecastStatus } from './lifecycle';
import { resolveForecast } from './resolution';
import { aggregateCrowd } from './crowd';
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

