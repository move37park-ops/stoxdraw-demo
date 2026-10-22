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
 * 현재 Elo 레이팅에 따른 5단계 티어 및 진행률 정보 반환
 */
export function getEloTierInfo(elo: number = DEFAULT_ELO): EloTierInfo {
  const safeElo = Math.max(600, Math.round(elo));

  if (safeElo >= 1900) {
    return {
      tier: 'MASTER',
      title: 'MASTER',
      krTitle: '마스터',
      minElo: 1900,
      nextTierElo: null,
      progressPct: 100,
      badgeClass: 'bg-zinc-100 text-black border-zinc-100',
      accentHex: '#ffffff',
    };
  }

  if (safeElo >= 1650) {
    const progressPct = Math.round(((safeElo - 1650) / (1900 - 1650)) * 100);
    return {
      tier: 'DIAMOND',
      title: 'DIAMOND',
      krTitle: '다이아몬드',
      minElo: 1650,
      nextTierElo: 1900,
      progressPct: clamp(progressPct, 0, 100),
      badgeClass: 'bg-zinc-800 text-zinc-100 border-zinc-700',
      accentHex: '#e4e4e7',
    };
  }

  if (safeElo >= 1350) {
    const progressPct = Math.round(((safeElo - 1350) / (1650 - 1350)) * 100);
    return {
      tier: 'GOLD',
      title: 'GOLD',
      krTitle: '골드',
      minElo: 1350,
      nextTierElo: 1650,
      progressPct: clamp(progressPct, 0, 100),
      badgeClass: 'bg-zinc-900 text-zinc-200 border-zinc-700',
      accentHex: '#a1a1aa',
    };
  }

  if (safeElo >= 1050) {
    const progressPct = Math.round(((safeElo - 1050) / (1350 - 1050)) * 100);
    return {
      tier: 'SILVER',
      title: 'SILVER',
      krTitle: '실버',
      minElo: 1050,
      nextTierElo: 1350,
      progressPct: clamp(progressPct, 0, 100),
      badgeClass: 'bg-zinc-900 text-zinc-300 border-zinc-800',
      accentHex: '#71717a',
    };
  }

  const progressPct = Math.round(((safeElo - 600) / (1050 - 600)) * 100);
  return {
    tier: 'BRONZE',
    title: 'BRONZE',
    krTitle: '브론즈',
    minElo: 600,
    nextTierElo: 1050,
    progressPct: clamp(progressPct, 0, 100),
    badgeClass: 'bg-zinc-950 text-zinc-400 border-zinc-800',
    accentHex: '#52525b',
  };
}

/**
 * 예측 경로의 목표 수익률과 시장 컨센서스(Crowd)/변동성(σ)을 바탕으로
 * 사전 기대 성취 확률(E) 및 예상 LP 변동폭(+Win LP / -Lose LP)을 산출합니다.
 */
export function calculateEloProjection(
  myChangePct: number,
  crowdChangePct?: number,
  dailyVolatility: number = 0.03
): EloProjection {
  const fiveDayVolPct = Math.max(2.0, dailyVolatility * 100 * Math.sqrt(5));
  const referencePct = crowdChangePct !== undefined ? crowdChangePct : 0;

  const divergenceAbs = Math.abs(myChangePct - referencePct);
  const magnitudeAbs = Math.abs(myChangePct);

  const normalizedDifficulty = (divergenceAbs * 0.65 + magnitudeAbs * 0.35) / fiveDayVolPct;

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
  dailyVolatility: number = 0.03
): EloSettlement {
  const projection = calculateEloProjection(myChangePct, crowdChangePct, dailyVolatility);

  // 100점 만점 점수를 [0, 1] 성과 지표 S로 변환
  const performanceRatio = parseFloat(clamp(score.total / 100, 0, 1).toFixed(3));

  const rawDelta = Math.round(K_FACTOR * (performanceRatio - projection.expectedProbability));

  // 방향 적중 및 B등급(58점) 이상이면 최소 +6 LP 보장, 반대로 방향 실패 및 저점수면 음수 보장
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
