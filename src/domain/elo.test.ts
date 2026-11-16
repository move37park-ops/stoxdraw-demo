import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ELO,
  MIN_ELO,
  PROVISIONAL_MIN_ROUNDS,
  isProvisionalAccount,
  getEloTierInfo,
  calculateEloProjection,
  settleEloRating,
  computeCohortPercentile,
} from './elo';
import { calculateForecastScore } from './scoring';

describe('Elo Rating Engine (Zero-Bias Projection & Cohort Percentile Settlement)', () => {
  it('maps Elo ratings to the correct 5 tiers (Bronze ~ Diamond)', () => {
    expect(getEloTierInfo(1920).tier).toBe('DIAMOND');
    expect(getEloTierInfo(1680).tier).toBe('PLATINUM');
    expect(getEloTierInfo(1460).tier).toBe('GOLD');
    expect(getEloTierInfo(DEFAULT_ELO).tier).toBe('SILVER');
    expect(getEloTierInfo(950).tier).toBe('BRONZE');

    const bronzeMid = getEloTierInfo(900);
    expect(bronzeMid.tier).toBe('BRONZE');
    expect(bronzeMid.minElo).toBe(MIN_ELO);
    expect(MIN_ELO).toBe(600);
    expect(bronzeMid.nextTierElo).toBe(1200);
    expect(bronzeMid.progressPct).toBe(50);

    const bronzeFloor = getEloTierInfo(100);
    expect(bronzeFloor.tier).toBe('BRONZE');
    expect(bronzeFloor.minElo).toBe(MIN_ELO);
    expect(bronzeFloor.progressPct).toBe(0);
  });

  it('tracks provisional account status until minimum verified rounds', () => {
    expect(PROVISIONAL_MIN_ROUNDS).toBe(3);
    expect(isProvisionalAccount(0)).toBe(true);
    expect(isProvisionalAccount(2)).toBe(true);
    expect(isProvisionalAccount(3)).toBe(false);
  });

  it('enforces zero pre-submit contrarian bias while preserving descriptive labels', () => {
    const safeProj = calculateEloProjection(3.2, 3.0, 0.032, 7, 'ko', DEFAULT_ELO, DEFAULT_ELO);
    const contrarianProj = calculateEloProjection(-8.5, 5.2, 0.032, 7, 'ko', DEFAULT_ELO, DEFAULT_ELO);

    expect(safeProj.expectedProbability).toBe(0.5);
    expect(contrarianProj.expectedProbability).toBe(0.5);
    expect(safeProj.expectedWinLp).toBe(contrarianProj.expectedWinLp);
    expect(contrarianProj.difficultyLabel).toBe('역발상 예측');
    expect(safeProj.difficultyLabel).toBe('컨센서스 동조');
  });

  it('computes cohort percentile rank cleanly with tie handling', () => {
    expect(computeCohortPercentile(90, [20, 40, 60, 80])).toBe(1);
    expect(computeCohortPercentile(10, [20, 40, 60, 80])).toBe(0);
    expect(computeCohortPercentile(50, [30, 50, 70])).toBe(0.5);
  });

  it('maintains near zero-sum LP across an equal-rated cohort', () => {
    const cohortScores = [22, 41, 55, 68, 89];
    let lpSum = 0;

    for (let i = 0; i < cohortScores.length; i++) {
      const peerScores = cohortScores.filter((_, idx) => idx !== i);
      const mockScore = {
        total: cohortScores[i],
        pathScore: cohortScores[i] * 0.5,
        directionScore: cohortScores[i] * 0.25,
        targetScore: cohortScores[i] * 0.25,
        grade: 'B' as const,
        directionHit: true,
        endErrorPct: 1.5,
      };
      const settlement = settleEloRating(mockScore, 2, 1, 0.032, 7, 'ko', {
        peerScores,
        userElo: DEFAULT_ELO,
        cohortMeanElo: DEFAULT_ELO,
      });
      lpSum += settlement.deltaLp;
    }

    expect(Math.abs(lpSum)).toBeLessThanOrEqual(1);
  });

  it('settles positive LP for top trajectories and negative LP for missed trajectories', () => {
    const basePrice = 68000;
    const actualPrices = [69000, 70000, 71000, 72000, 73000];

    const hitForecast = [68900, 69800, 71100, 71900, 72950];
    const hitScore = calculateForecastScore(hitForecast, actualPrices, basePrice, 0.032);
    const hitSettlement = settleEloRating(hitScore, 7.28, 4.5, 0.032, 7, 'ko', {
      peerScores: [28, 42, 55, 61],
    });

    const missForecast = [67000, 66000, 65000, 64000, 63000];
    const missScore = calculateForecastScore(missForecast, actualPrices, basePrice, 0.032);
    const missSettlement = settleEloRating(missScore, -7.35, 4.5, 0.032, 7, 'ko', {
      peerScores: [58, 66, 74, 88],
    });

    expect(hitSettlement.deltaLp).toBeGreaterThan(0);
    expect(missSettlement.deltaLp).toBeLessThan(0);
  });
});
