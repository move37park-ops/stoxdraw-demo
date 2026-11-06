import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ELO,
  getEloTierInfo,
  calculateEloProjection,
  settleEloRating,
} from './elo';
import { calculateForecastScore } from './scoring';

describe('Elo Rating Engine (elo.ts — Bronze to Diamond)', () => {
  it('maps Elo ratings to the correct 5 tiers (Bronze ~ Diamond) and progress percentages', () => {
    expect(getEloTierInfo(1920).tier).toBe('DIAMOND');
    expect(getEloTierInfo(1680).tier).toBe('PLATINUM');
    expect(getEloTierInfo(1460).tier).toBe('GOLD');
    expect(getEloTierInfo(DEFAULT_ELO).tier).toBe('SILVER');
    expect(getEloTierInfo(950).tier).toBe('BRONZE');
  });

  it('grants higher expectedWinLp for contrarian / high-divergence trajectories', () => {
    const safeProj = calculateEloProjection(3.2, 3.0, 0.032, 20);
    const contrarianProj = calculateEloProjection(-8.5, 5.2, 0.032, 20);

    expect(contrarianProj.expectedWinLp).toBeGreaterThan(safeProj.expectedWinLp);
    expect(contrarianProj.expectedProbability).toBeLessThan(safeProj.expectedProbability);
    expect(contrarianProj.difficultyLabel).toBe('역발상 예측');
  });

  it('settles positive LP for accurate trajectories and negative LP for missed trajectories', () => {
    const basePrice = 68000;
    const actualPrices = [69000, 70000, 71000, 72000, 73000];

    const hitForecast = [68900, 69800, 71100, 71900, 72950];
    const hitScore = calculateForecastScore(hitForecast, actualPrices, basePrice, 0.032);
    const hitSettlement = settleEloRating(hitScore, 7.28, 4.5, 0.032, 20);

    const missForecast = [67000, 66000, 65000, 64000, 63000];
    const missScore = calculateForecastScore(missForecast, actualPrices, basePrice, 0.032);
    const missSettlement = settleEloRating(missScore, -7.35, 4.5, 0.032, 20);

    expect(hitSettlement.deltaLp).toBeGreaterThan(0);
    expect(missSettlement.deltaLp).toBeLessThan(0);
  });
});
