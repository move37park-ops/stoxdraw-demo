import type { Forecast, CrowdAggregate, Horizon, Mode, PathPoint } from './types';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
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
      // Project against reference base price
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
