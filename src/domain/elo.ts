import type { EloProjection, EloSettlement, EloTier, ScoreBreakdown } from './types';

export const DEFAULT_ELO = 1200;
const K_FACTOR = 40;

export interface EloTierInfo {
  tier: EloTier;
  title: string;
  krTitle: string;
  minElo: number;
  nextTierElo: number | null;
  progressPct: number;
  badgeClass: string;
  accentHex: string;
}

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

/**
 * 현재 Elo 레이팅에 따른 브론즈 ~ 다이아몬드 5단계 티어 및 진행률 정보 반환
 * (피치덱 02.3 & 05.2: 브론즈 ~ 다이아몬드 실력 등급 체계)
 */
export function getEloTierInfo(elo: number = DEFAULT_ELO): EloTierInfo {
  const safeElo = Math.max(600, Math.round(elo));

  if (safeElo >= 1800) {
    return {
      tier: 'DIAMOND',
      title: 'DIAMOND',
      krTitle: '다이아몬드',
      minElo: 1800,
      nextTierElo: null,
      progressPct: 100,
      badgeClass: 'bg-zinc-100 text-black border-zinc-100',
      accentHex: '#3291ff',
    };
  }

  if (safeElo >= 1600) {
    const progressPct = Math.round(((safeElo - 1600) / (1800 - 1600)) * 100);
    return {
      tier: 'PLATINUM',
      title: 'PLATINUM',
      krTitle: '플래티넘',
      minElo: 1600,
      nextTierElo: 1800,
      progressPct: clamp(progressPct, 0, 100),
      badgeClass: 'bg-zinc-800 text-zinc-100 border-zinc-700',
      accentHex: '#00e599',
    };
  }

  if (safeElo >= 1400) {
    const progressPct = Math.round(((safeElo - 1400) / (1600 - 1400)) * 100);
    return {
      tier: 'GOLD',
      title: 'GOLD',
      krTitle: '골드',
      minElo: 1400,
      nextTierElo: 1600,
      progressPct: clamp(progressPct, 0, 100),
      badgeClass: 'bg-zinc-900 text-zinc-200 border-zinc-700',
      accentHex: '#f5a623',
    };
  }

  if (safeElo >= 1200) {
    const progressPct = Math.round(((safeElo - 1200) / (1400 - 1200)) * 100);
    return {
      tier: 'SILVER',
      title: 'SILVER',
      krTitle: '실버',
      minElo: 1200,
      nextTierElo: 1400,
      progressPct: clamp(progressPct, 0, 100),
      badgeClass: 'bg-zinc-900 text-zinc-300 border-zinc-800',
      accentHex: '#a1a1aa',
    };
  }

  const progressPct = Math.round(((Math.max(1000, safeElo) - 1000) / (1200 - 1000)) * 100);
  return {
    tier: 'BRONZE',
    title: 'BRONZE',
    krTitle: '브론즈',
    minElo: 1000,
    nextTierElo: 1200,
    progressPct: clamp(progressPct, 0, 100),
    badgeClass: 'bg-zinc-950 text-zinc-400 border-zinc-800',
    accentHex: '#71717a',
  };
}

/**
 * 예측 경로의 목표 수익률과 시장 컨센서스(Crowd)/변동성(σ)을 바탕으로
 * 사전 기대 성취 확률(E) 및 예상 LP 변동폭(+Win LP / -Lose LP)을 산출합니다.
 */
export function calculateEloProjection(
  myChangePct: number,
  crowdChangePct?: number,
  dailyVolatility: number = 0.032,
  horizonDays: number = 20
): EloProjection {
  const horizonVolPct = Math.max(2.5, dailyVolatility * 100 * Math.sqrt(horizonDays));
  const referencePct = crowdChangePct !== undefined ? crowdChangePct : 0;

  const divergenceAbs = Math.abs(myChangePct - referencePct);
  const magnitudeAbs = Math.abs(myChangePct);

  const normalizedDifficulty = (divergenceAbs * 0.65 + magnitudeAbs * 0.35) / horizonVolPct;

  const isOppositeSign =
    crowdChangePct !== undefined &&
    Math.abs(crowdChangePct) >= 0.5 &&
    Math.abs(myChangePct) >= 0.5 &&
    Math.sign(myChangePct) !== Math.sign(crowdChangePct);

  const contrarianBonus = isOppositeSign ? 0.08 : 0;
  const expectedProbability = parseFloat(
    clamp(0.58 - normalizedDifficulty * 0.22 - contrarianBonus, 0.24, 0.62).toFixed(2)
  );

  const expectedWinLp = Math.max(12, Math.round(K_FACTOR * (1 - expectedProbability)));
  const expectedLossLp = -Math.max(8, Math.round(K_FACTOR * expectedProbability * 0.72));

  let difficultyLabel = '컨센서스 동조';
  if (isOppositeSign || normalizedDifficulty >= 0.85) {
    difficultyLabel = '역발상 예측';
  } else if (normalizedDifficulty >= 0.45) {
    difficultyLabel = '컨센서스 이탈';
  }

  return {
    expectedWinLp,
    expectedLossLp,
    expectedProbability,
    difficultyLabel,
  };
}

/**
 * 100점 정량 스킬 점수(ScoreBreakdown)와 기대 확률(E)을 대조하여
 * 실제 정산 Elo 변동폭(deltaLp)을 계산합니다.
 */
export function settleEloRating(
  score: ScoreBreakdown,
  myChangePct: number,
  crowdChangePct?: number,
  dailyVolatility: number = 0.032,
  horizonDays: number = 20
): EloSettlement {
  const projection = calculateEloProjection(myChangePct, crowdChangePct, dailyVolatility, horizonDays);

  const performanceRatio = parseFloat(clamp(score.total / 100, 0, 1).toFixed(3));
  const rawDelta = Math.round(K_FACTOR * (performanceRatio - projection.expectedProbability));

  let deltaLp = rawDelta;
  if (score.directionHit && score.total >= 58 && deltaLp < 6) {
    deltaLp = 6;
  } else if (!score.directionHit && score.total < 45 && deltaLp > -6) {
    deltaLp = -6;
  }

  deltaLp = clamp(deltaLp, -28, 36);

  return {
    deltaLp,
    performanceRatio,
    expectedProbability: projection.expectedProbability,
    expectedWinLp: projection.expectedWinLp,
    expectedLossLp: projection.expectedLossLp,
  };
}

export function formatSignedLp(lp: number): string {
  return lp >= 0 ? `+${lp} LP` : `${lp} LP`;
}
