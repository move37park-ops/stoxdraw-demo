import { describe, it, expect } from 'vitest';
import { calculateForecastScore, calculateRealizedDailyVolatility } from './scoring';

describe('Scoring Engine (Vol-Normalized + Shape-Disentangled)', () => {
  const basePrice = 100;
  const vol = 0.03;

  it('awards near 100 points for near-perfect prediction', () => {
    const forecast = [102, 105, 104, 107, 110];
    const actual = [102, 105, 104, 107, 110];

    const res = calculateForecastScore(forecast, actual, basePrice, vol);
    expect(res.total).toBeGreaterThanOrEqual(95);
    expect(res.grade).toBe('S');
    expect(res.directionHit).toBe(true);
    expect(res.endErrorPct).toBe(0);
    expect(res.pathScore).toBe(50);
    expect(res.targetScore).toBe(25);
  });

  it('penalizes completely opposite direction with zero shape score', () => {
    const forecast = [98, 96, 95, 93, 90]; // Strongly Down
    const actual = [103, 106, 108, 112, 115]; // Strongly Up

    const res = calculateForecastScore(forecast, actual, basePrice, vol);
    expect(res.directionHit).toBe(false);
    expect(res.directionScore).toBe(0);
    expect(res.total).toBeLessThan(35);
    expect(['D', 'F']).toContain(res.grade);
  });

  it('handles flatline smoothly without discontinuous 0.75x cliff', () => {
    const flat = [100, 100, 100, 100, 100];
    const tinyUp = [100.01, 100.02, 100.03, 100.04, 100.05];
    const actual = [102, 104, 103, 105, 107];

    const resFlat = calculateForecastScore(flat, actual, basePrice, vol);
    const resTiny = calculateForecastScore(tinyUp, actual, basePrice, vol);
    expect(resFlat.total).toBeLessThan(50);
    expect(resFlat.directionHit).toBe(false);
    expect(Math.abs(resTiny.total - resFlat.total)).toBeLessThan(5);
  });

  it('rewards V-shape rebound shape accuracy over straight-line target hit', () => {
    const actual = [96, 93, 97, 102, 106];
    const vShape = [96, 93, 97, 102, 106];
    const straight = [101.2, 102.4, 103.6, 104.8, 106];

    const resV = calculateForecastScore(vShape, actual, basePrice, vol);
    const resStraight = calculateForecastScore(straight, actual, basePrice, vol);
    expect(resV.directionScore).toBeGreaterThan(resStraight.directionScore);
    expect(resV.total).toBeGreaterThan(resStraight.total + 15);
  });

  it('demonstrates volatility invariance across low and high vol assets', () => {
    const forecastLow = [101, 102, 101, 103, 104];
    const actualLow = [101, 102, 101, 103, 104];
    const resLow = calculateForecastScore(forecastLow, actualLow, 100, 0.018);

    const forecastHigh = [102, 104, 102, 106, 108];
    const actualHigh = [102, 104, 102, 106, 108];
    const resHigh = calculateForecastScore(forecastHigh, actualHigh, 100, 0.038);

    expect(resLow.grade).toBe('S');
    expect(resHigh.grade).toBe('S');
  });

  it('computes realized daily volatility within clamped bounds', () => {
    const closes = Array.from({ length: 31 }, (_, i) => 100 * Math.exp((i % 2 === 0 ? 1 : -0.8) * 0.02));
    const sigma = calculateRealizedDailyVolatility(closes, 0.032);
    expect(sigma).toBeGreaterThanOrEqual(0.008);
    expect(sigma).toBeLessThanOrEqual(0.12);
  });
});
