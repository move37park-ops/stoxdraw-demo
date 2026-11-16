import { describe, it, expect } from 'vitest';
import {
  computeTargetDistribution,
  computePercentile,
  findMaxDispersionDay,
  classifyScenario,
  computeScenarioMix,
  computeMarketOverview,
  computeInvestmentBriefing,
  analyzeUserPath,
  computePhaseRegimes,
  computeDrawingIntelligence,
} from './report';
import type { Forecast, MarketBar } from './types';
import type { DailyConsensusBandPoint } from './crowd';

function makeMockForecast(id: string, pathPct: number[], basePrice = 100): Forecast {
  return {
    id,
    authorId: id,
    anonId: id,
    ticker: 'BTC/USDT',
    horizon: '20D',
    mode: 'path',
    comment: '',
    lockedAt: '2026-10-02T10:00:00Z',
    basePrice,
    baseDate: '2026-10-02',
    evalDates: pathPct.map((_, idx) => `2026-10-${String(idx + 3).padStart(2, '0')}`),
    pathPct,
    path: pathPct.map((pct, idx) => ({
      date: `2026-10-${String(idx + 3).padStart(2, '0')}`,
      price: parseFloat((basePrice * (1 + pct)).toFixed(2)),
    })),
    rulesVersion: 'v1',
  };
}

describe('Deep Report & Distribution Engine (report.ts)', () => {
  const sampleForecasts: Forecast[] = [
    makeMockForecast('f1', [0.01, 0.03, 0.06, 0.10]),   // RALLY (+10%)
    makeMockForecast('f2', [-0.02, -0.01, 0.03, 0.08]), // DIP_RALLY (+8%)
    makeMockForecast('f3', [0.03, 0.01, -0.02, -0.04]), // RALLY_FADE (-4%)
    makeMockForecast('f4', [-0.02, -0.04, -0.06, -0.09]), // SLIDE (-9%)
  ];

  it('computes high-to-low target distribution buckets summing to participant count', () => {
    const buckets = computeTargetDistribution(sampleForecasts, 75000, 8, 66000, 86000);
    expect(buckets.length).toBe(8);
    expect(buckets[0].mid).toBeGreaterThan(buckets[buckets.length - 1].mid);
    const sum = buckets.reduce((acc, b) => acc + b.count, 0);
    expect(sum).toBe(sampleForecasts.length);
  });

  it('computes percentile ranking for user target return', () => {
    // 4 forecasts end at +10%, +8%, -4%, -9%
    expect(computePercentile(0.10, sampleForecasts)).toBe(100);
    expect(computePercentile(0.08, sampleForecasts)).toBe(75);
    expect(computePercentile(-0.04, sampleForecasts)).toBe(50);
    expect(computePercentile(-0.09, sampleForecasts)).toBe(25);
  });

  it('finds the day with widest P85-P15 crowd dispersion', () => {
    const band: DailyConsensusBandPoint[] = [
      { day: 5, date: '2026-10-07', p15: 74000, p25: 75000, median: 76000, p75: 77000, p85: 78000, topForecasterMedian: 76500 },
      { day: 14, date: '2026-10-16', p15: 71000, p25: 73000, median: 77000, p75: 80000, p85: 83000, topForecasterMedian: 79500 },
      { day: 20, date: '2026-10-22', p15: 73000, p25: 75000, median: 79000, p75: 81000, p85: 82500, topForecasterMedian: 81500 },
    ];
    const maxDisp = findMaxDispersionDay(band, 75000);
    expect(maxDisp).not.toBeNull();
    expect(maxDisp?.day).toBe(14);
    expect(maxDisp?.widthPrice).toBe(12000);
    expect(maxDisp?.widthPct).toBeCloseTo(16, 1);
  });

  it('classifies trajectories into all 4 scenario archetypes and aggregates mix', () => {
    expect(classifyScenario([0.01, 0.04, 0.08])).toBe('RALLY');
    expect(classifyScenario([-0.03, 0.01, 0.06])).toBe('DIP_RALLY');
    expect(classifyScenario([0.03, -0.01, -0.05])).toBe('RALLY_FADE');
    expect(classifyScenario([-0.01, -0.04, -0.08])).toBe('SLIDE');

    const mix = computeScenarioMix(sampleForecasts);
    expect(mix.length).toBe(4);
    expect(mix.every(m => m.count === 1 && m.pct === 25)).toBe(true);
  });

  it('computes 20-day market overview statistics cleanly', () => {
    const bars: MarketBar[] = Array.from({ length: 20 }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      open: 70000 + i * 200,
      high: 71000 + i * 200,
      low: 69000 + i * 200,
      close: 70200 + i * 200,
    }));
    const overview = computeMarketOverview(bars);
    expect(overview.low20).toBe(69000);
    expect(overview.high20).toBe(71000 + 19 * 200);
    expect(overview.ma20).toBeGreaterThan(70000);
    expect(overview.vsMa20Pct).toBeGreaterThan(0);
    expect(overview.realizedVolPct).toBeGreaterThanOrEqual(0);
    expect(overview.expectedMove20dPct).toBeGreaterThan(0);
  });

  it('computes investment briefing support/resistance, R:R ratio, smart gap, and crowding label', () => {
    const band: DailyConsensusBandPoint[] = [
      { day: 4, date: '2026-10-06', p15: 72000, p25: 73200, median: 75500, p75: 77000, p85: 78500, topForecasterMedian: 74200 },
      { day: 10, date: '2026-10-12', p15: 73000, p25: 74500, median: 77500, p75: 79800, p85: 81500, topForecasterMedian: 79000 },
      { day: 20, date: '2026-10-22', p15: 71000, p25: 73500, median: 78000, p75: 81500, p85: 84000, topForecasterMedian: 82000 },
    ];
    const userPrices = [75200, 77000, 82500];
    const bullishForecasts: Forecast[] = [
      makeMockForecast('b1', [0.02, 0.05, 0.09]),
      makeMockForecast('b2', [-0.01, 0.02, 0.06]),
      makeMockForecast('b3', [0.01, 0.03, 0.04]),
      makeMockForecast('b4', [-0.01, -0.02, -0.04]),
    ];

    const briefing = computeInvestmentBriefing(75000, userPrices, band, bullishForecasts);
    expect(briefing.supportP15).toBe(71000);
    expect(briefing.supportP25).toBe(73500);
    expect(briefing.resistanceP75).toBe(81500);
    expect(briefing.resistanceP85).toBe(84000);
    expect(briefing.crowdMedian).toBe(78000);
    expect(briefing.topMedian).toBe(82000);
    expect(briefing.smartVsCrowdPct).toBeCloseTo(5.33, 2);
    expect(briefing.dipCheckpoint.day).toBe(4);
    expect(briefing.riskRewardRatio).toBeGreaterThan(1);
    expect(briefing.bullishSharePct).toBe(75);
    expect(briefing.crowdingLabel).toBe('상승 쏠림 주의');
  });

  it('extracts multi-dimensional drawing intelligence (2D pivots, 3-phase regimes, path touch probability, and bull max drawdown)', () => {
    const band: DailyConsensusBandPoint[] = [
      { day: 5, date: '2026-10-07', p15: 71500, p25: 72600, median: 73800, p75: 75200, p85: 76500, topForecasterMedian: 72800 },
      { day: 12, date: '2026-10-14', p15: 73000, p25: 74800, median: 77200, p75: 79200, p85: 81000, topForecasterMedian: 78500 },
      { day: 20, date: '2026-10-22', p15: 74000, p25: 76000, median: 79500, p75: 82000, p85: 84500, topForecasterMedian: 82500 },
    ];
    const userPrices = [73800, 72450, 76200, 81000];
    const userAnalysis = analyzeUserPath(75000, userPrices);
    expect(userAnalysis.scenario).toBe('DIP_RALLY');
    expect(userAnalysis.lowestPoint.day).toBe(2);
    expect(userAnalysis.lowestPoint.price).toBe(72450);
    expect(userAnalysis.riskRewardRatio).toBeGreaterThan(1.5);

    const phases = computePhaseRegimes(sampleForecasts);
    expect(phases.length).toBe(3);

    const intel = computeDrawingIntelligence(75000, userPrices, band, sampleForecasts);
    expect(intel.smartBottomPivot.day).toBe(5);
    expect(intel.smartBottomPivot.price).toBe(72800);
    expect(intel.bullMaxDrawdownPrice).toBeLessThanOrEqual(75000);

    const buckets = computeTargetDistribution(sampleForecasts, 75000, 7, 67000, 84000);
    expect(buckets.some(b => b.touchPct >= b.sharePct)).toBe(true);
  });
});
