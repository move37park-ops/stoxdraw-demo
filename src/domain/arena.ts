import type { Forecast, Horizon, Mode } from './types';
import { STOCKS, getCurrentStockPrice, type StockMeta } from '../data/market';

export interface ArenaSummary {
  ticker: string;
  name: string;
  logoColor: string;
  currentPrice: number;
  participantsCount: number;
  bullCount: number;
  bearCount: number;
  bullPct: number;
  bearPct: number;
  medianChangePct: number;
  medianTargetPrice: number;
  topForecasts: Forecast[];
}

export function computeArenaSummary(
  ticker: string,
  forecasts: Forecast[],
  currentDateStr: string = '2026-10-05',
  horizon: Horizon = '5D',
  mode: Mode = 'path'
): ArenaSummary {
  const meta: StockMeta = STOCKS.find(s => s.ticker === ticker) || {
    ticker,
    name: ticker,
    startPrice: 100,
    volatility: 0.03,
    logoColor: '#38bdf8',
  };

  const currentPrice = getCurrentStockPrice(ticker, currentDateStr);

  const matched = forecasts.filter(
    f => f.ticker === ticker && f.horizon === horizon && f.mode === mode
  );

  let bullCount = 0;
  let bearCount = 0;
  const changes: number[] = [];
  const targetPrices: number[] = [];

  matched.forEach(f => {
    let targetPrice = f.basePrice;
    if (f.mode === 'path' && f.path && f.path.length > 0) {
      targetPrice = f.path[f.path.length - 1].price;
    } else if (f.mode === 'breakout' && f.breakout) {
      targetPrice = f.breakout.price;
    }

    const changePct = f.basePrice > 0 ? ((targetPrice - f.basePrice) / f.basePrice) * 100 : 0;
    changes.push(changePct);
    targetPrices.push(targetPrice);

    if (changePct >= 0) bullCount++;
    else bearCount++;
  });

  const total = matched.length;
  const bullPct = total > 0 ? Math.round((bullCount / total) * 100) : 50;
  const bearPct = total > 0 ? 100 - bullPct : 50;

  // Median change
  const sortedChanges = [...changes].sort((a, b) => a - b);
  const midIdx = Math.floor(sortedChanges.length / 2);
  const medianChangePct = sortedChanges.length > 0
    ? sortedChanges.length % 2 !== 0
      ? sortedChanges[midIdx]
      : (sortedChanges[midIdx - 1] + sortedChanges[midIdx]) / 2
    : 0;

  const medianTargetPrice = parseFloat((currentPrice * (1 + medianChangePct / 100)).toFixed(2));

  // Top forecasts sorted by lockedAt descending
  const sortedForecasts = [...matched].sort(
    (a, b) => new Date(b.lockedAt).getTime() - new Date(a.lockedAt).getTime()
  );

  return {
    ticker,
    name: meta.name,
    logoColor: meta.logoColor,
    currentPrice,
    participantsCount: total,
    bullCount,
    bearCount,
    bullPct,
    bearPct,
    medianChangePct: parseFloat(medianChangePct.toFixed(2)),
    medianTargetPrice,
    topForecasts: sortedForecasts,
  };
}

export function getHotArenas(
  forecasts: Forecast[],
  currentDateStr: string = '2026-10-05',
  horizon: Horizon = '5D'
): ArenaSummary[] {
  const summaries = STOCKS.map(s =>
    computeArenaSummary(s.ticker, forecasts, currentDateStr, horizon, 'path')
  );

  // Sort by participants count descending, then ticker
  return summaries.sort((a, b) => b.participantsCount - a.participantsCount);
}

export interface PriceBucket {
  label: string;
  min: number;
  max: number;
  count: number;
  pct: number;
}

export function computePriceDistribution(
  ticker: string,
  forecasts: Forecast[],
  basePrice: number,
  horizon: Horizon = '5D'
): PriceBucket[] {
  const matched = forecasts.filter(f => f.ticker === ticker && f.horizon === horizon);
  if (matched.length === 0) return [];

  const targets = matched.map(f => {
    if (f.mode === 'path' && f.path && f.path.length > 0) {
      return f.path[f.path.length - 1].price;
    }
    if (f.mode === 'breakout' && f.breakout) {
      return f.breakout.price;
    }
    return f.basePrice;
  });

  const step = basePrice * 0.05; // 5% interval
  const buckets: PriceBucket[] = [
    { label: `< $${(basePrice - step * 2).toFixed(0)}`, min: -Infinity, max: basePrice - step * 2, count: 0, pct: 0 },
    { label: `$${(basePrice - step * 2).toFixed(0)} - $${(basePrice - step).toFixed(0)}`, min: basePrice - step * 2, max: basePrice - step, count: 0, pct: 0 },
    { label: `$${(basePrice - step).toFixed(0)} - $${basePrice.toFixed(0)}`, min: basePrice - step, max: basePrice, count: 0, pct: 0 },
    { label: `$${basePrice.toFixed(0)} - $${(basePrice + step).toFixed(0)}`, min: basePrice, max: basePrice + step, count: 0, pct: 0 },
    { label: `$${(basePrice + step).toFixed(0)} - $${(basePrice + step * 2).toFixed(0)}`, min: basePrice + step, max: basePrice + step * 2, count: 0, pct: 0 },
    { label: `> $${(basePrice + step * 2).toFixed(0)}`, min: basePrice + step * 2, max: Infinity, count: 0, pct: 0 },
  ];

  targets.forEach(p => {
    for (const b of buckets) {
      if (p >= b.min && p < b.max) {
        b.count++;
        break;
      }
    }
  });

  const total = targets.length;
  buckets.forEach(b => {
    b.pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
  });

  return buckets;
}
