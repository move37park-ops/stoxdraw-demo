import { describe, it, expect } from 'vitest';
import { calculateForecastScore } from './scoring';

describe('Scoring Engine (PRD v2.0)', () => {
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
  });

  it('penalizes completely opposite direction', () => {
    const forecast = [98, 96, 95, 93, 90]; // Strongly Down
    const actual = [103, 106, 108, 112, 115]; // Strongly Up

    const res = calculateForecastScore(forecast, actual, basePrice, vol);
    expect(res.directionHit).toBe(false);
    expect(res.directionScore).toBe(0);
    expect(res.total).toBeLessThan(35);
    expect(['D', 'F']).toContain(res.grade);
  });

  it('handles flatline / zero-conviction without crashing', () => {
    const forecast = [100, 100, 100, 100, 100];
    const actual = [102, 104, 103, 105, 107];

    const res = calculateForecastScore(forecast, actual, basePrice, vol);
    expect(res.total).toBeLessThan(50);
    expect(res.directionHit).toBe(false);
  });

  it('demonstrates volatility invariance across low and high vol stocks', () => {
    // When relative errors in vol units are identical, targetScore is invariant
    const forecastLow = [101, 102, 101, 103, 104];
    const actualLow = [101, 102, 101, 103, 104];
    const resLow = calculateForecastScore(forecastLow, actualLow, 100, 0.018);

    const forecastHigh = [102, 104, 102, 106, 108];
    const actualHigh = [102, 104, 102, 106, 108];
    const resHigh = calculateForecastScore(forecastHigh, actualHigh, 100, 0.038);

    expect(resLow.grade).toBe('S');
    expect(resHigh.grade).toBe('S');
  });
});
