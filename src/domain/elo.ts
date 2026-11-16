import type { EloProjection, EloSettlement, EloTier, ScoreBreakdown } from './types';

export const DEFAULT_ELO = 1200;
export const MIN_ELO = 600;
export const PROVISIONAL_MIN_ROUNDS = 3;
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

export interface EloCohortOptions {
  peerScores?: number[];
  userElo?: number;
  cohortMeanElo?: number;
}

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

/**
 * 공인 랭킹 등재를 위한 최소 라운드 충족 여부 판정
 */
export function isProvisionalAccount(verifiedRounds: number): boolean {
  return verifiedRounds < PROVISIONAL_MIN_ROUNDS;
}

/**
 * 표준 Elo 기대 승률 E = 1 / (1 + 10^((cohortMeanElo - userElo) / 400))
 */
export function calculateExpectedPeerPercentile(
  userElo: number = DEFAULT_ELO,
  cohortMeanElo: number = DEFAULT_ELO
): number {
  const safeUser = Number.isFinite(userElo) ? userElo : DEFAULT_ELO;
  const safeCohort = Number.isFinite(cohortMeanElo) ? cohortMeanElo : DEFAULT_ELO;
  return parseFloat(
    clamp(1 / (1 + Math.pow(10, (safeCohort - safeUser) / 400)), 0.15, 0.85).toFixed(3)
  );
}

/**
 * 동일 라운드 경쟁자 점수 배열 대비 내 점수의 순위 백분위 [0, 1] 계산 (동점자는 mid-rank 처리)
 */
export function computeCohortPercentile(myScore: number, peerScores: number[]): number {
  const validPeers = peerScores.filter((s) => Number.isFinite(s));
  if (validPeers.length === 0) return 0.5;

  let below = 0;
  let equal = 0;
  for (const peer of validPeers) {
    if (peer < myScore - 1e-6) {
      below += 1;
    } else if (Math.abs(peer - myScore) <= 1e-6) {
      equal += 1;
    }
  }
  return parseFloat(clamp((below + 0.5 * equal) / validPeers.length, 0, 1).toFixed(4));
}

/**
 * 현재 Elo 레이팅에 따른 브론즈 ~ 다이아몬드 5단계 티어 및 진행률 정보 반환
 */
export function getEloTierInfo(elo: number = DEFAULT_ELO): EloTierInfo {
  const safeElo = Math.max(MIN_ELO, Math.round(elo));

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

  const progressPct = Math.round(((safeElo - MIN_ELO) / (1200 - MIN_ELO)) * 100);
  return {
    tier: 'BRONZE',
    title: 'BRONZE',
    krTitle: '브론즈',
    minElo: MIN_ELO,
    nextTierElo: 1200,
    progressPct: clamp(progressPct, 0, 100),
    badgeClass: 'bg-zinc-950 text-zinc-400 border-zinc-800',
    accentHex: '#71717a',
  };
}

/**
 * 제로 편향 사전 LP 변동폭 추정기
 * - 기대 성취 백분위 E는 코호트 평균 레이팅 대비 내 Elo 차이로만 결정되어 방향/역발상 편법을 차단합니다.
 * - divergence/변동성 대비 목표 수익률은 시나리오 성격 레이블(Consensus Aligned / Off-Consensus / Contrarian Call) 표시용으로만 사용합니다.
 */
export function calculateEloProjection(
  myChangePct: number,
  crowdChangePct?: number,
  dailyVolatility: number = 0.032,
  horizonDays: number = 7,
  locale: 'ko' | 'en' = 'ko',
  userElo: number = DEFAULT_ELO,
  cohortMeanElo: number = DEFAULT_ELO
): EloProjection {
  const safeHorizon = Math.max(1, horizonDays);
  const horizonVolPct = Math.max(2.0, dailyVolatility * 100 * Math.sqrt(safeHorizon));
  const referencePct = crowdChangePct !== undefined ? crowdChangePct : 0;

  const divergenceAbs = Math.abs(myChangePct - referencePct);
  const magnitudeAbs = Math.abs(myChangePct);
  const normalizedDispersion = (divergenceAbs * 0.65 + magnitudeAbs * 0.35) / horizonVolPct;

  const isOppositeSign =
    crowdChangePct !== undefined &&
    Math.abs(crowdChangePct) >= 0.5 &&
    Math.abs(myChangePct) >= 0.5 &&
    Math.sign(myChangePct) !== Math.sign(crowdChangePct);

  const expectedProbability = calculateExpectedPeerPercentile(userElo, cohortMeanElo);
  const expectedWinLp = Math.round(K_FACTOR * (1 - expectedProbability));
  const expectedLossLp = -Math.round(K_FACTOR * expectedProbability);

  let difficultyLabel = locale === 'en' ? 'Consensus Aligned' : '컨센서스 동조';
  if (isOppositeSign || normalizedDispersion >= 0.85) {
    difficultyLabel = locale === 'en' ? 'Contrarian Call' : '역발상 예측';
  } else if (normalizedDispersion >= 0.45) {
    difficultyLabel = locale === 'en' ? 'Off-Consensus' : '컨센서스 이탈';
  }

  return {
    expectedWinLp,
    expectedLossLp,
    expectedProbability,
    difficultyLabel,
  };
}

/**
 * 코호트 상대 백분위(p_i) 기반 제로섬 Elo 정산 엔진
 * - peerScores가 2명 이상 존재하면 라운드 내 경쟁자 대비 순위 백분위 p_i로 정산하여 랜덤 예측의 기대 LP를 0으로 유지합니다.
 * - 오프라인 단독 평가 시에는 랜덤 워크 기대 점수(~50점) 기준 로지스틱 성과비로 폴백합니다.
 */
export function settleEloRating(
  score: ScoreBreakdown,
  myChangePct: number,
  crowdChangePct?: number,
  dailyVolatility: number = 0.032,
  horizonDays: number = 7,
  locale: 'ko' | 'en' = 'ko',
  cohort?: EloCohortOptions
): EloSettlement {
  const projection = calculateEloProjection(
    myChangePct,
    crowdChangePct,
    dailyVolatility,
    horizonDays,
    locale,
    cohort?.userElo ?? DEFAULT_ELO,
    cohort?.cohortMeanElo ?? DEFAULT_ELO
  );

  const peerScores = cohort?.peerScores?.filter((s) => Number.isFinite(s)) ?? [];
  const performanceRatio =
    peerScores.length >= 2
      ? computeCohortPercentile(score.total, peerScores)
      : parseFloat(clamp(1 / (1 + Math.exp(-(score.total - 50) / 14)), 0, 1).toFixed(3));

  const rawDelta = Math.round(K_FACTOR * (performanceRatio - projection.expectedProbability));
  const deltaLp = clamp(rawDelta, -32, 32);

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
