import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ELO,
  getEloTierInfo,
  calculateEloProjection,
  settleEloRating,
} from './elo';
import { calculateForecastScore } from './scoring';

describe('Elo Rating Engine (elo.ts)', () => {
  it('maps Elo ratings to the correct 5 tiers and progress percentages', () => {
    expect(getEloTierInfo(2020).tier).toBe('MASTER');
    expect(getEloTierInfo(1780).tier).toBe('DIAMOND');
    expect(getEloTierInfo(1490).tier).toBe('GOLD');
    expect(getEloTierInfo(DEFAULT_ELO).tier).toBe('SILVER');
    expect(getEloTierInfo(920).tier).toBe('BRONZE');
  });

  it('grants higher expectedWinLp for contrarian / high-divergence trajectories', () => {
    const safeProj = calculateEloProjection(3.2, 3.0, 0.035);
    const contrarianProj = calculateEloProjection(-6.5, 4.2, 0.035);

    expect(contrarianProj.expectedWinLp).toBeGreaterThan(safeProj.expectedWinLp);
    expect(contrarianProj.expectedProbability).toBeLessThan(safeProj.expectedProbability);
    expect(contrarianProj.difficultyLabel).toBe('역발상 예측');
  });

  it('settles positive LP for accurate trajectories and negative LP for missed trajectories', () => {
    const basePrice = 100;
    const actualPrices = [102, 104, 105, 107, 108];

    const hitForecast = [101.8, 103.5, 105.2, 106.8, 107.9];
    const hitScore = calculateForecastScore(hitForecast, actualPrices, basePrice, 0.03);
    const hitSettlement = settleEloRating(hitScore, 7.9, 3.5, 0.03);

    const missForecast = [98, 96, 95, 94, 92];
    const missScore = calculateForecastScore(missForecast, actualPrices, basePrice, 0.03);
    const missSettlement = settleEloRating(missScore, -8.0, 3.5, 0.03);

    expect(hitSettlement.deltaLp).toBeGreaterThan(0);
    expect(missSettlement.deltaLp).toBeLessThan(0);
  });
});
