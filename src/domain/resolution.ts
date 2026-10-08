import type { Forecast, ForecastResult, MarketBar } from './types';

export function resolveForecast(
  forecast: Forecast,
  actualBars: MarketBar[]
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

  return {
    mode: 'path',
    forecastChangePct: parseFloat(forecastChangePct.toFixed(2)),
    actualChangePct: parseFloat(actualChangePct.toFixed(2)),
    directionHit,
    endErrorPct: parseFloat(endErrorPct.toFixed(2)),
  };
}
