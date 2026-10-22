import type { Forecast, ForecastResult, MarketBar } from './types';
import { calculateForecastScore } from './scoring';
import { settleEloRating } from './elo';
import { STOCKS } from '../data/market';

export function resolveForecast(
  forecast: Forecast,
  actualBars: MarketBar[],
  crowdChangePct?: number
): ForecastResult {
  const basePrice = forecast.basePrice;
  const barsMap = new Map(actualBars.map(b => [b.date, b]));

  if (forecast.mode === 'breakout' && forecast.breakout) {
    const { direction, price: targetPrice } = forecast.breakout;
    let hit = false;
    let hitDate: string | undefined = undefined;

    for (const date of forecast.evalDates) {
      const bar = barsMap.get(date);
      if (!bar) continue;

      if (direction === 'up' && bar.high >= targetPrice) {
        hit = true;
        hitDate = date;
        break;
      }
      if (direction === 'down' && bar.low <= targetPrice) {
        hit = true;
        hitDate = date;
        break;
      }
    }

    const lastBar = actualBars[actualBars.length - 1];
    const currentActualPrice = lastBar ? lastBar.close : basePrice;
    const actualChangePct = ((currentActualPrice - basePrice) / basePrice) * 100;
    const forecastChangePct = ((targetPrice - basePrice) / basePrice) * 100;

    return {
      mode: 'breakout',
      forecastChangePct: parseFloat(forecastChangePct.toFixed(2)),
      actualChangePct: parseFloat(actualChangePct.toFixed(2)),
      directionHit: direction === 'up' ? actualChangePct > 0 : actualChangePct < 0,
      breakoutHit: hit,
      hitDate,
    };
  }

  // Path Mode
  const path = forecast.path || [];
  const evalDates = forecast.evalDates;
  const lastEvalDate = evalDates[evalDates.length - 1];
  const lastPoint = path.find(p => p.date === lastEvalDate) || (path.length > 0 ? path[path.length - 1] : undefined);
  const forecastEnd = lastPoint ? lastPoint.price : basePrice;
  
  // Find matching actual bars for evalDates
  const validBars = forecast.evalDates
    .map(d => barsMap.get(d))
    .filter((b): b is MarketBar => b !== undefined);

  const actualEnd = validBars.length > 0 ? validBars[validBars.length - 1].close : basePrice;

  const forecastChangePct = ((forecastEnd - basePrice) / basePrice) * 100;
  const actualChangePct = validBars.length > 0 ? ((actualEnd - basePrice) / basePrice) * 100 : 0;

  const fSign = Math.sign(forecastChangePct);
  const aSign = Math.sign(actualChangePct);
  const directionHit = (fSign === aSign) || (fSign === 0 && aSign === 0);

  const endErrorPct = actualEnd > 0
    ? (Math.abs(forecastEnd - actualEnd) / actualEnd) * 100
    : 0;

  // Calculate 100-pt hybrid score if we have predictions and actual prices
  const forecastPrices: number[] = [];
  const actualPrices: number[] = [];
  for (const date of evalDates) {
    const pt = path.find(p => p.date === date);
    const act = barsMap.get(date);
    if (pt && act) {
      forecastPrices.push(pt.price);
      actualPrices.push(act.close);
    }
  }

  const stockMeta = STOCKS.find(s => s.ticker === forecast.ticker);
  const vol = stockMeta?.volatility || 0.03;

  const score = forecastPrices.length > 0
    ? calculateForecastScore(forecastPrices, actualPrices, basePrice, vol)
    : undefined;

  const eloSettlement = score
    ? settleEloRating(score, forecastChangePct, crowdChangePct, vol)
    : undefined;

  return {
    mode: 'path',
    forecastChangePct: parseFloat(forecastChangePct.toFixed(2)),
    actualChangePct: parseFloat(actualChangePct.toFixed(2)),
    directionHit,
    endErrorPct: parseFloat(endErrorPct.toFixed(2)),
    score,
    eloSettlement,
  };
}
