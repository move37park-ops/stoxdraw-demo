import type { Forecast, CrowdAggregate, Horizon, Mode, PathPoint } from './types';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function getEstimatedPriceAtDate(f: Forecast, targetDate: string): number | null {
  const path = f.path;
  if (!path || path.length === 0) return null;

  const direct = path.find(p => p.date === targetDate);
  if (direct) return direct.price;

  const sorted = [...path].sort((a, b) => a.date.localeCompare(b.date));
  if (targetDate <= sorted[0].date) return sorted[0].price;
  if (targetDate >= sorted[sorted.length - 1].date) return sorted[sorted.length - 1].price;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].date <= targetDate && targetDate <= sorted[i + 1].date) {
      const p1 = sorted[i];
      const p2 = sorted[i + 1];
      const allDates = f.evalDates;
      const idx1 = allDates.indexOf(p1.date);
      const idx2 = allDates.indexOf(p2.date);
      const targetIdx = allDates.indexOf(targetDate);
      if (idx1 !== -1 && idx2 !== -1 && targetIdx !== -1 && idx2 > idx1) {
        const factor = (targetIdx - idx1) / (idx2 - idx1);
        return p1.price + factor * (p2.price - p1.price);
      }
      return (p1.price + p2.price) / 2;
    }
  }
  return sorted[sorted.length - 1].price;
}

function weightedQuantile(entries: { value: number; weight: number }[], q: number): number {
  if (entries.length === 0) return 0;
  const sorted = [...entries].sort((a, b) => a.value - b.value);
  const totalWeight = sorted.reduce((sum, e) => sum + e.weight, 0);
  if (totalWeight <= 0) return quantile(sorted.map((e) => e.value), q);

  const target = clampWeight(q) * totalWeight;
  let cum = 0;
  for (let i = 0; i < sorted.length; i++) {
    const prevCum = cum;
    cum += sorted[i].weight;
    if (cum >= target) {
      if (i === 0 || sorted[i].weight <= 0) return sorted[i].value;
      const frac = (target - prevCum) / sorted[i].weight;
      return sorted[i - 1].value + frac * (sorted[i].value - sorted[i - 1].value);
    }
  }
  return sorted[sorted.length - 1].value;
}

function clampWeight(val: number): number {
  return Math.max(0, Math.min(1, val));
}

function getEloSkillWeight(elo: number | undefined): number {
  if (elo === undefined || !Number.isFinite(elo)) return 1;
  return Math.max(0.5, Math.min(2.0, 0.5 + (elo - 1000) / 800));
}

export interface DailyConsensusBandPoint {
  day: number;       // 1..N
  date: string;
  p15: number;       // 하위 15% 분위수
  p25: number;       // 하위 25% 분위수
  median: number;    // Crowd Median (실력 가중 중앙값)
  p75: number;       // 상위 75% 분위수
  p85: number;       // 상위 85% 분위수
  topForecasterMedian: number; // 상위 티어(Top Forecasters) 가중 중앙값
}

/**
 * 전체 기간 시계열에 대해 Elo 가중 Crowd Median, 분포 밴드(P15~P85, P25~P75),
 * 그리고 동적 고티어(Top-Tier: Elo 1500+ 또는 상위 25%) 시나리오 중앙값을 계산합니다.
 */
export function computeConsensusBand(
  forecasts: Forecast[],
  evalDates: string[],
  basePrice: number,
  topAuthorIds?: Set<string>,
  authorEloMap?: Record<string, number>
): DailyConsensusBandPoint[] {
  const valid = forecasts.filter(
    (f) => f.mode === 'path' && f.path && f.path.length > 0 && f.basePrice > 0
  );

  if (valid.length === 0 || evalDates.length === 0) {
    return [];
  }

  let effectiveTopIds = topAuthorIds;
  if (!effectiveTopIds && authorEloMap) {
    const rankedAuthors = valid
      .map((f) => ({ id: f.authorId || f.id, elo: authorEloMap[f.authorId || ''] ?? 1200 }))
      .sort((a, b) => b.elo - a.elo);
    const highEloIds = rankedAuthors.filter((a) => a.elo >= 1500).map((a) => a.id);
    if (highEloIds.length >= 2) {
      effectiveTopIds = new Set(highEloIds);
    } else {
      const topSliceCount = Math.max(1, Math.ceil(rankedAuthors.length * 0.25));
      effectiveTopIds = new Set(rankedAuthors.slice(0, topSliceCount).map((a) => a.id));
    }
  }
  const fallbackTopIds = effectiveTopIds ?? new Set(['u_quant', 'u_alpha']);
  const topForecasts = valid.filter((f) => f.authorId && fallbackTopIds.has(f.authorId));
  const topPool = topForecasts.length > 0 ? topForecasts : valid;

  return evalDates.map((date, stepIdx) => {
    const entries = valid.map((f) => {
      const pt = f.path![stepIdx] ?? f.path![f.path!.length - 1];
      const value = pt ? (pt.price - f.basePrice) / f.basePrice : 0;
      const weight = authorEloMap ? getEloSkillWeight(authorEloMap[f.authorId || '']) : 1;
      return { value, weight };
    });

    const topEntries = topPool.map((f) => {
      const pt = f.path![stepIdx] ?? f.path![f.path!.length - 1];
      const value = pt ? (pt.price - f.basePrice) / f.basePrice : 0;
      const weight = authorEloMap ? getEloSkillWeight(authorEloMap[f.authorId || '']) : 1;
      return { value, weight };
    });

    const toPrice = (pct: number) => parseFloat((basePrice * (1 + pct)).toFixed(2));

    return {
      day: stepIdx + 1,
      date,
      p15: toPrice(weightedQuantile(entries, 0.15)),
      p25: toPrice(weightedQuantile(entries, 0.25)),
      median: toPrice(weightedQuantile(entries, 0.5)),
      p75: toPrice(weightedQuantile(entries, 0.75)),
      p85: toPrice(weightedQuantile(entries, 0.85)),
      topForecasterMedian: toPrice(weightedQuantile(topEntries, 0.5)),
    };
  });
}

/** @deprecated computeConsensusBand 사용 권장 (기존 호환 별칭) */
export const compute20DConsensusBand = computeConsensusBand;

export function aggregateCrowd(
  forecasts: Forecast[],
  ticker: string,
  horizon: Horizon,
  mode: Mode
): CrowdAggregate {
  const matches = forecasts.filter(
    f => f.ticker === ticker && f.horizon === horizon && f.mode === mode && f.lockedAt
  );

  const count = matches.length;
  const isColdStart = count < 5;

  if (isColdStart) {
    return {
      ticker,
      horizon,
      mode,
      participantsCount: count,
      isColdStart: true,
    };
  }

  if (mode === 'breakout') {
    let upCount = 0;
    let downCount = 0;
    const prices: number[] = [];

    matches.forEach(f => {
      if (!f.breakout) return;
      if (f.breakout.direction === 'up') upCount++;
      else downCount++;
      prices.push(f.breakout.price);
    });

    const total = upCount + downCount;
    const upPct = total > 0 ? Math.round((upCount / total) * 100) : 50;
    const downPct = 100 - upPct;
    const medianPrice = median(prices);

    return {
      ticker,
      horizon,
      mode,
      participantsCount: count,
      isColdStart: false,
      upPct,
      downPct,
      medianPrice: parseFloat(medianPrice.toFixed(2)),
    };
  }

  // Path Mode: calculate median percentage change for each eval date
  const referenceForecast = matches[0];
  const evalCount = referenceForecast.evalDates.length;
  const consensusPoints: PathPoint[] = [];

  for (let i = 0; i < evalCount; i++) {
    const targetDate = referenceForecast.evalDates[i];
    const changesAtStep: number[] = [];

    matches.forEach(f => {
      if (f.pathPct && f.pathPct[i] !== undefined) {
        changesAtStep.push(f.pathPct[i]);
      } else if (f.basePrice > 0) {
        const estPrice = getEstimatedPriceAtDate(f, targetDate);
        if (estPrice !== null) {
          const pctChange = (estPrice - f.basePrice) / f.basePrice;
          changesAtStep.push(pctChange);
        }
      }
    });

    if (changesAtStep.length > 0) {
      const stepMedianPct = median(changesAtStep);
      const medianPrice = referenceForecast.basePrice * (1 + stepMedianPct);
      consensusPoints.push({
        date: targetDate,
        price: parseFloat(medianPrice.toFixed(2)),
      });
    }
  }

  const firstBase = referenceForecast.basePrice;
  const lastPrice = consensusPoints[consensusPoints.length - 1]?.price || firstBase;
  const consensusChangePct = ((lastPrice - firstBase) / firstBase) * 100;

  return {
    ticker,
    horizon,
    mode,
    participantsCount: count,
    isColdStart: false,
    consensusPath: consensusPoints,
    consensusChangePct: parseFloat(consensusChangePct.toFixed(2)),
  };
}
