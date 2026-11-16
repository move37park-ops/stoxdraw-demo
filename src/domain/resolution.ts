import type { Forecast, ForecastResult, MarketBar } from './types';
import { calculateForecastScore, calculateRealizedDailyVolatility } from './scoring';
import { DEFAULT_ELO, settleEloRating } from './elo';
import { STOCKS } from '../data/market';

export interface ResolveCohortContext {
  peerScores?: number[];
  userElo?: number;
  cohortMeanElo?: number;
  realizedVolatility?: number;
}

/**
 * 예측 기준일 직전까지의 종가만을 사용하여 사전 변동성(미래 정보 누출 방지)을 계산합니다.
 */
function getBaselineVolatilityForForecast(forecast: Forecast, actualBars: MarketBar[]): number {
  const stockMeta = STOCKS.find((s) => s.ticker === forecast.ticker);
  const fallbackVol = stockMeta?.volatility || 0.032;
  const firstEvalDate = forecast.evalDates[0];
  const priorBars = firstEvalDate
    ? actualBars.filter((b) => b.date < firstEvalDate).map((b) => b.close)
    : [];
  if (priorBars.length >= 6) {
    return calculateRealizedDailyVolatility(priorBars, fallbackVol);
  }
  return fallbackVol;
}

export function resolveForecast(
  forecast: Forecast,
  actualBars: MarketBar[],
  crowdChangePct?: number,
  cohortContext?: ResolveCohortContext
): ForecastResult {
  const basePrice = forecast.basePrice;
  const barsMap = new Map(actualBars.map((b) => [b.date, b]));

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
  const lastPoint =
    path.find((p) => p.date === lastEvalDate) || (path.length > 0 ? path[path.length - 1] : undefined);
  const forecastEnd = lastPoint ? lastPoint.price : basePrice;

  const validBars = forecast.evalDates
    .map((d) => barsMap.get(d))
    .filter((b): b is MarketBar => b !== undefined);

  const actualEnd = validBars.length > 0 ? validBars[validBars.length - 1].close : basePrice;

  const forecastChangePct = ((forecastEnd - basePrice) / basePrice) * 100;
  const actualChangePct = validBars.length > 0 ? ((actualEnd - basePrice) / basePrice) * 100 : 0;

  const fSign = Math.sign(forecastChangePct);
  const aSign = Math.sign(actualChangePct);
  const directionHit = fSign === aSign || (fSign === 0 && aSign === 0);

  const endErrorPct =
    actualEnd > 0 ? (Math.abs(forecastEnd - actualEnd) / actualEnd) * 100 : 0;

  const forecastPrices: number[] = [];
  const actualPrices: number[] = [];
  for (const date of evalDates) {
    const pt = path.find((p) => p.date === date);
    const act = barsMap.get(date);
    if (pt && act) {
      forecastPrices.push(pt.price);
      actualPrices.push(act.close);
    }
  }

  const vol = cohortContext?.realizedVolatility ?? getBaselineVolatilityForForecast(forecast, actualBars);
  const horizonDays = Math.max(1, evalDates.length);

  const score =
    forecastPrices.length > 0
      ? calculateForecastScore(forecastPrices, actualPrices, basePrice, vol)
      : undefined;

  const eloSettlement = score
    ? settleEloRating(score, forecastChangePct, crowdChangePct, vol, horizonDays, 'ko', {
        peerScores: cohortContext?.peerScores,
        userElo: cohortContext?.userElo,
        cohortMeanElo: cohortContext?.cohortMeanElo,
      })
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

/**
 * 동일 라운드(종목 + 평가 구간) 예측들을 묶어 코호트 점수와 레이팅 맥락을 공유한 채 일괄 정산합니다.
 * AppShell, LeaderboardPage, ProfilePage, PredictPage, DetailPage 전반의 정산 정합성을 단일 경로로 보장합니다.
 */
export function resolveForecastsWithCohort(
  forecasts: Forecast[],
  actualBars: MarketBar[],
  userEloMap: Record<string, number> = {}
): Map<string, ForecastResult> {
  const results = new Map<string, ForecastResult>();
  const prelim = forecasts.map((f) => ({
    forecast: f,
    baseResult: resolveForecast(f, actualBars),
    roundKey: `${f.ticker}:${f.evalDates[0] || ''}:${f.evalDates[f.evalDates.length - 1] || ''}`,
  }));

  const cohorts = new Map<string, typeof prelim>();
  for (const item of prelim) {
    const list = cohorts.get(item.roundKey) || [];
    list.push(item);
    cohorts.set(item.roundKey, list);
  }

  for (const group of cohorts.values()) {
    const validEndPcts = group
      .filter((g) => g.forecast.mode === 'path')
      .map((g) => g.baseResult.forecastChangePct)
      .sort((a, b) => a - b);
    const crowdChangePct =
      validEndPcts.length > 0 ? validEndPcts[Math.floor(validEndPcts.length / 2)] : undefined;

    const cohortElos = group.map((g) => userEloMap[g.forecast.authorId || ''] ?? DEFAULT_ELO);
    const cohortMeanElo =
      cohortElos.length > 0
        ? cohortElos.reduce((sum, e) => sum + e, 0) / cohortElos.length
        : DEFAULT_ELO;

    for (const item of group) {
      const peerScores = group
        .filter((other) => other.forecast.id !== item.forecast.id && other.baseResult.score !== undefined)
        .map((other) => other.baseResult.score!.total);

      const settled = resolveForecast(item.forecast, actualBars, crowdChangePct, {
        peerScores,
        userElo: userEloMap[item.forecast.authorId || ''] ?? DEFAULT_ELO,
        cohortMeanElo,
      });
      results.set(item.forecast.id, settled);
    }
  }

  return results;
}
