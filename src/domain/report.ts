import type { Forecast, MarketBar } from './types';
import type { DailyConsensusBandPoint } from './crowd';

export interface TargetDistributionBucket {
  lo: number;
  hi: number;
  mid: number;
  loPct: number;
  hiPct: number;
  midPct: number;
  count: number;
  sharePct: number;
  touchCount: number;
  touchPct: number;
}

export type ScenarioType = 'RALLY' | 'DIP_RALLY' | 'RALLY_FADE' | 'SLIDE';

export interface ScenarioMixItem {
  type: ScenarioType;
  label: string;
  count: number;
  pct: number;
  medianTargetPct: number;
  medianDipPct: number;
}

export interface PhaseRegimeItem {
  id: 'early' | 'mid' | 'late';
  label: string;
  dayRange: string;
  bullPct: number;
  bearPct: number;
  medianDeltaPct: number;
  dominantRegime: string;
  regimeTone: 'bull' | 'bear' | 'neutral';
}

export interface PivotCoordinate {
  day: number;
  price: number;
  pctFromBase: number;
}

export interface UserPathAnalysis {
  scenario: ScenarioType;
  scenarioLabel: string;
  lowestPoint: PivotCoordinate;
  highestPoint: PivotCoordinate;
  targetPoint: PivotCoordinate;
  riskRewardRatio: number;
}

export interface DrawingIntelligenceMetrics {
  crowdBottomPivot: PivotCoordinate;
  smartBottomPivot: PivotCoordinate;
  crowdPeakPivot: PivotCoordinate;
  bullMaxDrawdownPrice: number;
  bullMaxDrawdownPct: number;
  phases: PhaseRegimeItem[];
  dominantScenario: ScenarioMixItem;
  userPath: UserPathAnalysis;
}

export interface MaxDispersionInfo {
  day: number;
  date: string;
  widthPrice: number;
  widthPct: number;
  p15: number;
  p85: number;
}

export interface MarketOverview {
  high20: number;
  low20: number;
  realizedVolPct: number;
  expectedMove20dPct: number;
  ma20: number;
  vsMa20Pct: number;
}

export interface DipCheckpoint {
  day: number;
  price: number;
  pctFromBase: number;
}

export type CrowdingLabel =
  | '상승 쏠림 주의'
  | '하락 쏠림 주의'
  | '양방향 균형'
  | 'Crowded Bullish'
  | 'Crowded Bearish'
  | 'Two-Way Balance';

export interface InvestmentBriefingMetrics {
  supportP25: number;
  supportP15: number;
  resistanceP75: number;
  resistanceP85: number;
  crowdMedian: number;
  topMedian: number;
  smartVsCrowdPct: number;
  dipCheckpoint: DipCheckpoint;
  riskRewardRatio: number;
  bullishSharePct: number;
  crowdingLabel: CrowdingLabel;
}

const SCENARIO_LABELS_BY_LOCALE: Record<'ko' | 'en', Record<ScenarioType, string>> = {
  ko: {
    RALLY: '꾸준한 상승',
    DIP_RALLY: '하락 후 반등',
    RALLY_FADE: '반등 후 하락',
    SLIDE: '꾸준한 하락',
  },
  en: {
    RALLY: 'Steady Rally',
    DIP_RALLY: 'Dip & Rally',
    RALLY_FADE: 'Rally & Fade',
    SLIDE: 'Steady Slide',
  },
};

const getScenarioLabel = (type: ScenarioType, locale: 'ko' | 'en' = 'ko') =>
  SCENARIO_LABELS_BY_LOCALE[locale][type];

function getNormalizedPathPctSeries(f: Forecast): number[] | null {
  if (f.pathPct && f.pathPct.length > 0) {
    return f.pathPct;
  }
  if (f.path && f.path.length > 0 && f.basePrice > 0) {
    return f.path.map(pt => (pt.price - f.basePrice) / f.basePrice);
  }
  return null;
}

function getNormalizedTargetPct(f: Forecast): number | null {
  const series = getNormalizedPathPctSeries(f);
  if (!series || series.length === 0) return null;
  return series[series.length - 1];
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * D+20 목표가 분포 및 20일 경로 경유 확률(touchPct) 버킷을 생성합니다 (높은 가격부터 낮은 가격 순 정렬).
 */
export function computeTargetDistribution(
  forecasts: Forecast[],
  basePrice: number,
  bucketCount: number = 8,
  minPrice?: number,
  maxPrice?: number
): TargetDistributionBucket[] {
  if (basePrice <= 0 || bucketCount <= 0) return [];

  const validSeries = forecasts
    .map(getNormalizedPathPctSeries)
    .filter((s): s is number[] => s !== null && s.length > 0);

  const targetPcts = validSeries.map(s => s[s.length - 1]);
  const scaledTargets = targetPcts.map(pct => basePrice * (1 + pct));

  const pathSpans = validSeries.map(series => {
    const prices = series.map(pct => basePrice * (1 + pct));
    return {
      minP: Math.min(basePrice, ...prices),
      maxP: Math.max(basePrice, ...prices),
    };
  });

  let rangeMin = minPrice;
  let rangeMax = maxPrice;

  if (rangeMin === undefined || rangeMax === undefined || rangeMax <= rangeMin) {
    const rawMin = scaledTargets.length > 0 ? Math.min(...scaledTargets, basePrice * 0.92) : basePrice * 0.88;
    const rawMax = scaledTargets.length > 0 ? Math.max(...scaledTargets, basePrice * 1.12) : basePrice * 1.12;
    const span = Math.max(rawMax - rawMin, basePrice * 0.14);
    rangeMin = rawMin - span * 0.08;
    rangeMax = rawMax + span * 0.08;
  }

  const totalSpan = Math.max(1, rangeMax - rangeMin);
  const step = totalSpan / bucketCount;
  const counts = Array.from({ length: bucketCount }, () => 0);

  for (const price of scaledTargets) {
    const rawIdx = Math.floor((price - rangeMin) / step);
    const idx = Math.max(0, Math.min(bucketCount - 1, rawIdx));
    counts[idx] += 1;
  }

  const totalCount = scaledTargets.length;
  const buckets: TargetDistributionBucket[] = [];

  for (let i = bucketCount - 1; i >= 0; i--) {
    const lo = parseFloat((rangeMin + i * step).toFixed(2));
    const hi = parseFloat((rangeMin + (i + 1) * step).toFixed(2));
    const mid = parseFloat(((lo + hi) / 2).toFixed(2));
    const count = counts[i];
    const touchCount = pathSpans.filter(sp => sp.maxP >= lo && sp.minP <= hi).length;
    buckets.push({
      lo,
      hi,
      mid,
      loPct: parseFloat((((lo - basePrice) / basePrice) * 100).toFixed(2)),
      hiPct: parseFloat((((hi - basePrice) / basePrice) * 100).toFixed(2)),
      midPct: parseFloat((((mid - basePrice) / basePrice) * 100).toFixed(2)),
      count,
      sharePct: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
      touchCount,
      touchPct: totalCount > 0 ? Math.round((touchCount / totalCount) * 100) : 0,
    });
  }

  return buckets;
}

/**
 * 참여자들 중 내 목표 수익률(decimal 또는 % 일치 단위)보다 낮은 예측의 백분위(0~100)를 반환합니다.
 * 예: 75 반환 시 상위 25% 강세.
 */
export function computePercentile(
  myTargetPct: number,
  forecasts: Forecast[]
): number {
  const targetPcts = forecasts
    .map(getNormalizedTargetPct)
    .filter((v): v is number => v !== null);
  if (targetPcts.length === 0) return 50;

  // myTargetPct가 9.2 같은 % 입력인지 0.092 소수인지 일관되게 처리 (참여자 데이터는 소수)
  const normalizedInput = Math.abs(myTargetPct) > 1.5 ? myTargetPct / 100 : myTargetPct;
  const atOrBelow = targetPcts.filter(p => p <= normalizedInput + 1e-6).length;
  return Math.round((atOrBelow / targetPcts.length) * 100);
}

/**
 * 20일 집단 밴드 중 의견 분열(P85 - P15 폭)이 가장 큰 날짜를 반환합니다.
 */
export function findMaxDispersionDay(
  band: DailyConsensusBandPoint[],
  basePrice: number
): MaxDispersionInfo | null {
  if (band.length === 0 || basePrice <= 0) return null;

  let best = band[0];
  let bestWidth = best.p85 - best.p15;

  for (let i = 1; i < band.length; i++) {
    const w = band[i].p85 - band[i].p15;
    if (w > bestWidth) {
      bestWidth = w;
      best = band[i];
    }
  }

  return {
    day: best.day,
    date: best.date,
    widthPrice: parseFloat(bestWidth.toFixed(2)),
    widthPct: parseFloat(((bestWidth / basePrice) * 100).toFixed(2)),
    p15: best.p15,
    p85: best.p85,
  };
}

/**
 * 20일 수익률 시계열(pathPct: 소수 배열)을 4대 시나리오 유형으로 분류합니다.
 */
export function classifyScenario(pathPct: number[]): ScenarioType {
  if (pathPct.length === 0) return 'RALLY';
  const end = pathPct[pathPct.length - 1];
  const earlyWindowEnd = Math.max(1, Math.floor(pathPct.length * 0.6));
  const earlySlice = pathPct.slice(0, earlyWindowEnd);
  const minEarly = Math.min(...earlySlice);
  const maxEarly = Math.max(...earlySlice);

  if (end >= 0) {
    return minEarly < -0.002 ? 'DIP_RALLY' : 'RALLY';
  }
  return maxEarly > 0.002 ? 'RALLY_FADE' : 'SLIDE';
}

/**
 * 제출된 예측 목록의 4대 시나리오 비중(%) 및 그룹별 중위 목표/눌림폭을 집계합니다.
 */
export function computeScenarioMix(
  forecasts: Forecast[],
  locale: 'ko' | 'en' = 'ko'
): ScenarioMixItem[] {
  const groups: Record<ScenarioType, { targets: number[]; dips: number[] }> = {
    RALLY: { targets: [], dips: [] },
    DIP_RALLY: { targets: [], dips: [] },
    RALLY_FADE: { targets: [], dips: [] },
    SLIDE: { targets: [], dips: [] },
  };

  const valid = forecasts
    .map(getNormalizedPathPctSeries)
    .filter((s): s is number[] => s !== null && s.length > 0);

  for (const pctSeries of valid) {
    const kind = classifyScenario(pctSeries);
    const targetPct = pctSeries[pctSeries.length - 1] * 100;
    const minPct = Math.min(0, ...pctSeries) * 100;
    groups[kind].targets.push(targetPct);
    groups[kind].dips.push(minPct);
  }

  const total = valid.length;
  const order: ScenarioType[] = ['DIP_RALLY', 'RALLY', 'RALLY_FADE', 'SLIDE'];

  return order.map(type => {
    const count = groups[type].targets.length;
    return {
      type,
      label: getScenarioLabel(type, locale),
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
      medianTargetPct: parseFloat(medianOf(groups[type].targets).toFixed(1)),
      medianDipPct: parseFloat(medianOf(groups[type].dips).toFixed(1)),
    };
  });
}

/**
 * 사용자가 그린 20일 가격 경로에서 시나리오 아키타입, 최저 변곡점, 최고 변곡점, 경로 손익비를 실시간 추출합니다.
 */
export function analyzeUserPath(
  basePrice: number,
  userPrices: number[],
  locale: 'ko' | 'en' = 'ko'
): UserPathAnalysis {
  const safeBase = basePrice > 0 ? basePrice : 1;
  if (userPrices.length === 0) {
    return {
      scenario: 'RALLY',
      scenarioLabel: getScenarioLabel('RALLY', locale),
      lowestPoint: { day: 1, price: safeBase, pctFromBase: 0 },
      highestPoint: { day: 1, price: safeBase, pctFromBase: 0 },
      targetPoint: { day: 7, price: safeBase, pctFromBase: 0 },
      riskRewardRatio: 1.5,
    };
  }

  const pcts = userPrices.map(p => (p - safeBase) / safeBase);
  const scenario = classifyScenario(pcts);

  let minIdx = 0;
  let maxIdx = 0;
  userPrices.forEach((p, idx) => {
    if (p < userPrices[minIdx]) minIdx = idx;
    if (p > userPrices[maxIdx]) maxIdx = idx;
  });

  const lowPrice = userPrices[minIdx];
  const highPrice = userPrices[maxIdx];
  const targetPrice = userPrices[userPrices.length - 1];

  const lowPct = ((lowPrice - safeBase) / safeBase) * 100;
  const highPct = ((highPrice - safeBase) / safeBase) * 100;
  const targetPct = ((targetPrice - safeBase) / safeBase) * 100;

  const rewardMag = Math.max(
    0.8,
    targetPct >= 0 ? Math.max(highPct, targetPct) : Math.abs(Math.min(lowPct, targetPct))
  );
  const riskMag = Math.max(
    1.0,
    targetPct >= 0 ? Math.max(1.2, Math.abs(Math.min(0, lowPct))) : Math.max(1.2, Math.max(0, highPct))
  );
  const riskRewardRatio = parseFloat((rewardMag / riskMag).toFixed(2));

  return {
    scenario,
    scenarioLabel: getScenarioLabel(scenario, locale),
    lowestPoint: {
      day: minIdx + 1,
      price: parseFloat(lowPrice.toFixed(2)),
      pctFromBase: parseFloat(lowPct.toFixed(2)),
    },
    highestPoint: {
      day: maxIdx + 1,
      price: parseFloat(highPrice.toFixed(2)),
      pctFromBase: parseFloat(highPct.toFixed(2)),
    },
    targetPoint: {
      day: userPrices.length,
      price: parseFloat(targetPrice.toFixed(2)),
      pctFromBase: parseFloat(targetPct.toFixed(2)),
    },
    riskRewardRatio,
  };
}

/**
 * 20일 드로잉 데이터를 초입(1주차)·중반(2주차)·종반(3주차) 3구간으로 나누어 시간차 방향성(Term Structure)을 추출합니다.
 */
export function computePhaseRegimes(
  forecasts: Forecast[],
  locale: 'ko' | 'en' = 'ko'
): PhaseRegimeItem[] {
  const valid = forecasts
    .map(getNormalizedPathPctSeries)
    .filter((s): s is number[] => s !== null && s.length > 0);

  const seriesLen = valid[0]?.length ?? 7;
  const isShort = seriesLen <= 7;
  const isEn = locale === 'en';

  const defs: {
    id: 'early' | 'mid' | 'late';
    label: string;
    dayRange: string;
    getSliceDelta: (s: number[]) => number;
  }[] = [
    {
      id: 'early',
      label: isEn
        ? isShort
          ? 'Early'
          : 'Early (Week 1)'
        : isShort
        ? '초입'
        : '초입 (1주차)',
      dayRange: isShort ? 'D+1 ~ D+2' : 'D+1 ~ D+7',
      getSliceDelta: s => {
        const endIdx = Math.min(s.length - 1, Math.max(0, Math.floor(s.length * 0.35) - 1));
        return s[endIdx] * 100;
      },
    },
    {
      id: 'mid',
      label: isEn
        ? isShort
          ? 'Mid'
          : 'Mid (Week 2)'
        : isShort
        ? '중반'
        : '중반 (2주차)',
      dayRange: isShort ? 'D+3 ~ D+5' : 'D+8 ~ D+14',
      getSliceDelta: s => {
        const startIdx = Math.min(s.length - 1, Math.max(0, Math.floor(s.length * 0.35) - 1));
        const endIdx = Math.min(s.length - 1, Math.max(startIdx, Math.floor(s.length * 0.72) - 1));
        return (s[endIdx] - s[startIdx]) * 100;
      },
    },
    {
      id: 'late',
      label: isEn
        ? isShort
          ? 'Late'
          : 'Late (Week 3)'
        : isShort
        ? '후반'
        : '후반 (3주차)',
      dayRange: isShort ? 'D+6 ~ D+7' : 'D+15 ~ D+20',
      getSliceDelta: s => {
        const startIdx = Math.min(s.length - 1, Math.max(0, Math.floor(s.length * 0.72) - 1));
        const endIdx = s.length - 1;
        return (s[endIdx] - s[startIdx]) * 100;
      },
    },
  ];

  const balancedLabel = isEn ? 'Balanced Split' : '팽팽한 분기';
  const bullLabel = isEn ? 'Bullish Tilt' : '상승 우세';
  const bearLabel = isEn ? 'Pullback Tilt' : '조정·눌림 우세';

  return defs.map(def => {
    if (valid.length === 0) {
      return {
        id: def.id,
        label: def.label,
        dayRange: def.dayRange,
        bullPct: 50,
        bearPct: 50,
        medianDeltaPct: 0,
        dominantRegime: balancedLabel,
        regimeTone: 'neutral',
      };
    }

    const deltas = valid.map(def.getSliceDelta);
    const bulls = deltas.filter(d => d >= 0).length;
    const bullPct = Math.round((bulls / deltas.length) * 100);
    const bearPct = 100 - bullPct;
    const medianDeltaPct = parseFloat(medianOf(deltas).toFixed(2));

    let dominantRegime = balancedLabel;
    let regimeTone: PhaseRegimeItem['regimeTone'] = 'neutral';
    if (bullPct >= 58) {
      dominantRegime = bullLabel;
      regimeTone = 'bull';
    } else if (bearPct >= 58) {
      dominantRegime = bearLabel;
      regimeTone = 'bear';
    }

    return {
      id: def.id,
      label: def.label,
      dayRange: def.dayRange,
      bullPct,
      bearPct,
      medianDeltaPct,
      dominantRegime,
      regimeTone,
    };
  });
}

/**
 * 드로잉 예측으로만 얻을 수 있는 다차원 경로 인사이트(2D 변곡점 좌표, 상승파 허용 낙폭, 구간별 추세 전환, 내 경로 구조)를 종합 계산합니다.
 */
export function computeDrawingIntelligence(
  basePrice: number,
  userPrices: number[],
  consensusBand: DailyConsensusBandPoint[],
  forecasts: Forecast[],
  locale: 'ko' | 'en' = 'ko'
): DrawingIntelligenceMetrics {
  const safeBase = basePrice > 0 ? basePrice : 1;
  const validSeries = forecasts
    .map(getNormalizedPathPctSeries)
    .filter((s): s is number[] => s !== null && s.length > 0);

  // 1. 각 참여자의 하방 변곡점(최저점 날·가격) 및 상방 변곡점(최고점 날·가격) 추출
  const minDays: number[] = [];
  const minPcts: number[] = [];
  const maxDays: number[] = [];
  const maxPcts: number[] = [];
  const bullDipPcts: number[] = [];

  for (const s of validSeries) {
    let minI = 0;
    let maxI = 0;
    const earlyEnd = Math.max(1, Math.floor(s.length * 0.75));
    for (let i = 0; i < earlyEnd; i++) {
      if (s[i] < s[minI]) minI = i;
    }
    for (let i = 0; i < s.length; i++) {
      if (s[i] > s[maxI]) maxI = i;
    }
    if (s[minI] < -0.001) {
      minDays.push(minI + 1);
      minPcts.push(s[minI]);
    }
    maxDays.push(maxI + 1);
    maxPcts.push(s[maxI]);

    if (s[s.length - 1] >= 0) {
      const pathMin = Math.min(...s);
      if (pathMin < -0.001) {
        bullDipPcts.push(pathMin);
      }
    }
  }

  const maxBandDay = consensusBand[consensusBand.length - 1]?.day ?? 7;
  const maxEarlyDay = Math.max(2, Math.floor(maxBandDay * 0.72));

  const crowdBottomDay =
    minDays.length > 0 ? Math.max(1, Math.round(medianOf(minDays))) : Math.min(2, maxBandDay);
  const crowdBottomPct = minPcts.length > 0 ? medianOf(minPcts) : -0.018;
  const crowdBottomPrice = safeBase * (1 + crowdBottomPct);

  const crowdPeakDay =
    maxDays.length > 0 ? Math.max(1, Math.round(medianOf(maxDays))) : maxBandDay;
  const crowdPeakPct = maxPcts.length > 0 ? medianOf(maxPcts) : 0.048;
  const crowdPeakPrice = safeBase * (1 + crowdPeakPct);

  // 상위 10% 고수의 초중반 반등 변곡점 추출 (단조 상승 시 P25 하방 지지 변곡점 활용)
  const earlyBand = consensusBand.filter(pt => pt.day >= 1 && pt.day <= maxEarlyDay);
  const scanBand = earlyBand.length > 0 ? earlyBand : consensusBand;
  let smartDay = crowdBottomDay;
  let smartPrice = crowdBottomPrice;
  if (scanBand.length > 0) {
    let monotonicUp = scanBand[0].topForecasterMedian >= safeBase;
    for (let i = 1; i < scanBand.length; i++) {
      if (scanBand[i].topForecasterMedian < scanBand[i - 1].topForecasterMedian) {
        monotonicUp = false;
        break;
      }
    }
    let chosen = scanBand[0];
    let lowest = monotonicUp ? chosen.p25 : chosen.topForecasterMedian;
    for (let i = 1; i < scanBand.length; i++) {
      const candidate = monotonicUp ? scanBand[i].p25 : scanBand[i].topForecasterMedian;
      if (candidate < lowest) {
        lowest = candidate;
        chosen = scanBand[i];
      }
    }
    smartDay = chosen.day;
    smartPrice = lowest;
  }

  const bullMaxDrawdownRaw =
    bullDipPcts.length > 0 ? medianOf(bullDipPcts) : Math.min(-0.018, crowdBottomPct);
  const bullMaxDrawdownPrice = safeBase * (1 + bullMaxDrawdownRaw);
  const bullMaxDrawdownPct = parseFloat((bullMaxDrawdownRaw * 100).toFixed(2));

  const phases = computePhaseRegimes(forecasts, locale);
  const scenarioMix = computeScenarioMix(forecasts, locale);
  const dominantScenario = [...scenarioMix].sort((a, b) => b.count - a.count)[0] ?? {
    type: 'DIP_RALLY',
    label: getScenarioLabel('DIP_RALLY', locale),
    count: 0,
    pct: 0,
    medianTargetPct: 0,
    medianDipPct: 0,
  };

  const userPath = analyzeUserPath(safeBase, userPrices, locale);

  return {
    crowdBottomPivot: {
      day: crowdBottomDay,
      price: parseFloat(crowdBottomPrice.toFixed(2)),
      pctFromBase: parseFloat((crowdBottomPct * 100).toFixed(2)),
    },
    smartBottomPivot: {
      day: smartDay,
      price: parseFloat(smartPrice.toFixed(2)),
      pctFromBase: parseFloat((((smartPrice - safeBase) / safeBase) * 100).toFixed(2)),
    },
    crowdPeakPivot: {
      day: crowdPeakDay,
      price: parseFloat(crowdPeakPrice.toFixed(2)),
      pctFromBase: parseFloat((crowdPeakPct * 100).toFixed(2)),
    },
    bullMaxDrawdownPrice: parseFloat(bullMaxDrawdownPrice.toFixed(2)),
    bullMaxDrawdownPct,
    phases,
    dominantScenario,
    userPath,
  };
}

/**
 * 과거 20일 일봉 기반 시장 개요 지표(20일 고/저가, 실현 변동성, MA20 괴리율)를 계산합니다.
 */
export function computeMarketOverview(
  historyBars: MarketBar[],
  horizonDays: number = 7
): MarketOverview {
  const slice = historyBars.slice(-20);
  if (slice.length === 0) {
    return {
      high20: 0,
      low20: 0,
      realizedVolPct: 0,
      expectedMove20dPct: horizonDays <= 7 ? 5.2 : 8.5,
      ma20: 0,
      vsMa20Pct: 0,
    };
  }

  const high20 = Math.max(...slice.map(b => b.high));
  const low20 = Math.min(...slice.map(b => b.low));
  const ma20 = slice.reduce((acc, b) => acc + b.close, 0) / slice.length;
  const lastClose = slice[slice.length - 1].close;
  const vsMa20Pct = ma20 > 0 ? ((lastClose - ma20) / ma20) * 100 : 0;

  const logReturns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    if (slice[i - 1].close > 0 && slice[i].close > 0) {
      logReturns.push(Math.log(slice[i].close / slice[i - 1].close));
    }
  }

  let dailyStd = 0;
  if (logReturns.length > 1) {
    const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const variance =
      logReturns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / (logReturns.length - 1);
    dailyStd = Math.sqrt(variance);
  }

  const realizedVolPct = dailyStd * Math.sqrt(365) * 100;
  const expectedMove20dPct =
    dailyStd > 0
      ? Math.max(0.1, parseFloat((dailyStd * Math.sqrt(horizonDays) * 100).toFixed(1)))
      : horizonDays <= 7
      ? 5.2
      : 8.5;

  return {
    high20: parseFloat(high20.toFixed(2)),
    low20: parseFloat(low20.toFixed(2)),
    realizedVolPct: parseFloat(realizedVolPct.toFixed(1)),
    expectedMove20dPct,
    ma20: parseFloat(ma20.toFixed(2)),
    vsMa20Pct: parseFloat(vsMa20Pct.toFixed(2)),
  };
}

/**
 * 투자 브리핑에 필요한 지지·저항선, 스마트머니 괴리, 눌림목 타이밍, 손익비(R:R), 쏠림 진단을 계산합니다.
 */
export function computeInvestmentBriefing(
  basePrice: number,
  userPrices: number[],
  consensusBand: DailyConsensusBandPoint[],
  forecasts: Forecast[],
  locale: 'ko' | 'en' = 'ko'
): InvestmentBriefingMetrics {
  const safeBase = basePrice > 0 ? basePrice : 1;
  const lastBand = consensusBand[consensusBand.length - 1];

  const supportP15 = lastBand?.p15 ?? safeBase * 0.95;
  const supportP25 = lastBand?.p25 ?? safeBase * 0.97;
  const resistanceP75 = lastBand?.p75 ?? safeBase * 1.04;
  const resistanceP85 = lastBand?.p85 ?? safeBase * 1.06;
  const crowdMedian = lastBand?.median ?? safeBase;
  const topMedian = lastBand?.topForecasterMedian ?? crowdMedian;
  const smartVsCrowdPct = parseFloat((((topMedian - crowdMedian) / safeBase) * 100).toFixed(2));

  const maxBandDay = consensusBand[consensusBand.length - 1]?.day ?? 7;
  const maxEarlyDay = Math.max(2, Math.floor(maxBandDay * 0.72));
  const earlyBand = consensusBand.filter(pt => pt.day >= 1 && pt.day <= maxEarlyDay);
  const scanBand = earlyBand.length > 0 ? earlyBand : consensusBand;

  let dipPoint: { day: number; price: number } = { day: Math.min(2, maxBandDay), price: supportP25 };
  if (scanBand.length > 0) {
    let monotonicUp = true;
    for (let i = 1; i < scanBand.length; i++) {
      if (scanBand[i].topForecasterMedian < scanBand[i - 1].topForecasterMedian) {
        monotonicUp = false;
        break;
      }
    }

    let chosen = scanBand[0];
    let lowestVal = monotonicUp ? chosen.p25 : chosen.topForecasterMedian;
    for (let i = 1; i < scanBand.length; i++) {
      const candidateVal = monotonicUp ? scanBand[i].p25 : scanBand[i].topForecasterMedian;
      if (candidateVal < lowestVal) {
        lowestVal = candidateVal;
        chosen = scanBand[i];
      }
    }
    dipPoint = { day: chosen.day, price: lowestVal };
  }

  const userTargetPrice = userPrices.length > 0 ? userPrices[userPrices.length - 1] : safeBase;
  const upsidePct = Math.max(0.8, Math.abs(((userTargetPrice - safeBase) / safeBase) * 100));
  const lowestPlannedPrice =
    userPrices.length > 0 ? Math.min(...userPrices, supportP25) : supportP25;
  const downsideRiskPct = Math.max(1.2, Math.abs(((safeBase - lowestPlannedPrice) / safeBase) * 100));
  const riskRewardRatio = parseFloat((upsidePct / downsideRiskPct).toFixed(2));

  const validTargets = forecasts
    .map(getNormalizedTargetPct)
    .filter((v): v is number => v !== null);
  const bullishCount = validTargets.filter(pct => pct >= 0).length;
  const bullishSharePct =
    validTargets.length > 0 ? Math.round((bullishCount / validTargets.length) * 100) : 50;

  const isEn = locale === 'en';
  let crowdingLabel: CrowdingLabel = isEn ? 'Two-Way Balance' : '양방향 균형';
  if (bullishSharePct >= 68) crowdingLabel = isEn ? 'Crowded Bullish' : '상승 쏠림 주의';
  else if (bullishSharePct <= 32) crowdingLabel = isEn ? 'Crowded Bearish' : '하락 쏠림 주의';

  return {
    supportP25: parseFloat(supportP25.toFixed(2)),
    supportP15: parseFloat(supportP15.toFixed(2)),
    resistanceP75: parseFloat(resistanceP75.toFixed(2)),
    resistanceP85: parseFloat(resistanceP85.toFixed(2)),
    crowdMedian: parseFloat(crowdMedian.toFixed(2)),
    topMedian: parseFloat(topMedian.toFixed(2)),
    smartVsCrowdPct,
    dipCheckpoint: {
      day: dipPoint.day,
      price: parseFloat(dipPoint.price.toFixed(2)),
      pctFromBase: parseFloat((((dipPoint.price - safeBase) / safeBase) * 100).toFixed(2)),
    },
    riskRewardRatio,
    bullishSharePct,
    crowdingLabel,
  };
}
