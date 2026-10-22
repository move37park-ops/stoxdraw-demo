import type { Forecast, MarketBar } from './types';

export interface DailySettlementRow {
  slot: string;          // 'D+1' .. 'D+5'
  date: string;          // 'YYYY-MM-DD'
  weight: number;        // 시간 가중치 w_t (1..5)
  forecastPrice: number;
  forecastChangePct: number;
  actualClose: number | null;
  actualChangePct: number | null;
  absErrorPct: number | null;
  directionMatch: boolean | null;
  settled: boolean;
}

/**
 * 예측 페이로드(종목, 기준일, 기준가, 일별 궤적 좌표, 락 시각)로부터
 * 결정론적(Deterministic) 검증 해시 다이제스트를 생성합니다.
 */
export function computeForecastDigest(forecast: Forecast): string {
  const pathStr = (forecast.path || [])
    .map(p => `${p.date}:${p.price.toFixed(2)}`)
    .join('|');
  const canonical = `${forecast.ticker}|${forecast.baseDate}|${forecast.basePrice.toFixed(2)}|${pathStr}|${forecast.lockedAt}|${forecast.rulesVersion}`;

  // FNV-1a 64-bit style deterministic hex digest (4x 32-bit lanes for 128-bit visual receipt)
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  const hashes = seeds.map((seed, lane) => {
    let h = seed >>> 0;
    for (let i = 0; i < canonical.length; i++) {
      h ^= canonical.charCodeAt(i) + lane * 31;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  });

  return `0x${hashes.join('')}`;
}

/**
 * 예측 경로와 실제 시장 종가(OHLC Close)를 대조하여
 * 5거래일 일별 정산 원장(Settlement Ledger) 행 배열을 반환합니다.
 */
export function buildDailySettlementRows(
  forecast: Forecast,
  actualBars: MarketBar[],
  currentDateStr: string
): DailySettlementRow[] {
  const barsMap = new Map(actualBars.map(b => [b.date, b]));
  const pathMap = new Map((forecast.path || []).map(p => [p.date, p.price]));

  let prevPred = forecast.basePrice;
  let prevAct = forecast.basePrice;

  return forecast.evalDates.map((date, idx) => {
    const predPrice = pathMap.get(date) ?? forecast.basePrice;
    const predChangePct = forecast.basePrice > 0
      ? ((predPrice - forecast.basePrice) / forecast.basePrice) * 100
      : 0;

    const isReached = date <= currentDateStr;
    const bar = isReached ? barsMap.get(date) : undefined;
    const actualClose = bar ? bar.close : null;

    const actualChangePct = actualClose !== null && forecast.basePrice > 0
      ? ((actualClose - forecast.basePrice) / forecast.basePrice) * 100
      : null;

    const absErrorPct = actualClose !== null && actualClose > 0
      ? (Math.abs(predPrice - actualClose) / actualClose) * 100
      : null;

    let directionMatch: boolean | null = null;
    if (actualClose !== null) {
      const stepPredDiff = predPrice - prevPred;
      const stepActDiff = actualClose - prevAct;
      directionMatch = Math.sign(stepPredDiff) === Math.sign(stepActDiff);
      prevAct = actualClose;
    }
    prevPred = predPrice;

    return {
      slot: `D+${idx + 1}`,
      date,
      weight: idx + 1,
      forecastPrice: parseFloat(predPrice.toFixed(2)),
      forecastChangePct: parseFloat(predChangePct.toFixed(2)),
      actualClose: actualClose !== null ? parseFloat(actualClose.toFixed(2)) : null,
      actualChangePct: actualChangePct !== null ? parseFloat(actualChangePct.toFixed(2)) : null,
      absErrorPct: absErrorPct !== null ? parseFloat(absErrorPct.toFixed(2)) : null,
      directionMatch,
      settled: actualClose !== null,
    };
  });
}
