import type { MarketBar } from './types';
import { calculateRealizedDailyVolatility } from './scoring';

export interface PracticeChartCues {
  realizedVol: number;
  expected7dBandPct: number;
  range20dHighPct: number;
  range20dLowPct: number;
  ma20DeviationPct: number;
  volumeRatio: number | null;
}

export type CalibrationBias = 'overextended' | 'flat' | 'calibrated';

export interface CalibrationDiagnostic {
  expectedBandPct: number;
  zMagnitude: number;
  bias: CalibrationBias;
}

/**
 * 블라인드 차트 구조 파악용 객관적 수치 지표 계산 (스포일러 배제)
 */
export function extractPracticeMetrics(
  historyBars: MarketBar[],
  fallbackVol: number = 0.032
): PracticeChartCues {
  const closes = historyBars.map(b => b.close);
  const realizedVol = calculateRealizedDailyVolatility(closes, fallbackVol);
  const expected7dBandPct = parseFloat((realizedVol * 100 * Math.sqrt(7)).toFixed(1));

  const lastBar = historyBars[historyBars.length - 1];
  const basePrice = lastBar?.close ?? 1;
  const recent20 = historyBars.slice(-20);

  let high20 = basePrice;
  let low20 = basePrice;
  let closeSum = 0;

  for (const bar of recent20) {
    if (bar.high > high20) high20 = bar.high;
    if (bar.low < low20) low20 = bar.low;
    closeSum += bar.close;
  }

  const ma20 = recent20.length > 0 ? closeSum / recent20.length : basePrice;
  const range20dHighPct = basePrice > 0 ? ((high20 - basePrice) / basePrice) * 100 : 0;
  const range20dLowPct = basePrice > 0 ? ((low20 - basePrice) / basePrice) * 100 : 0;
  const ma20DeviationPct = ma20 > 0 ? ((basePrice - ma20) / ma20) * 100 : 0;

  let volumeRatio: number | null = null;
  const volBars = recent20.filter(b => typeof b.volume === 'number' && b.volume > 0);
  if (volBars.length >= 6) {
    const avg20Vol = volBars.reduce((s, b) => s + (b.volume ?? 0), 0) / volBars.length;
    const recent3Vol = volBars.slice(-3);
    const avg3Vol = recent3Vol.reduce((s, b) => s + (b.volume ?? 0), 0) / recent3Vol.length;
    if (avg20Vol > 0) {
      volumeRatio = parseFloat((avg3Vol / avg20Vol).toFixed(2));
    }
  }

  return {
    realizedVol,
    expected7dBandPct,
    range20dHighPct: parseFloat(range20dHighPct.toFixed(1)),
    range20dLowPct: parseFloat(range20dLowPct.toFixed(1)),
    ma20DeviationPct: parseFloat(ma20DeviationPct.toFixed(1)),
    volumeRatio,
  };
}

/**
 * 단일 연습 라운드의 변동성 대비 목표 진폭 캘리브레이션 진단
 */
export function analyzeAttemptCalibration(
  predictedPct: number,
  actualPct: number,
  realizedVol: number,
  horizonDays: number = 7
): CalibrationDiagnostic {
  const expectedBandPct = Math.max(1.5, realizedVol * 100 * Math.sqrt(Math.max(1, horizonDays)));
  const zMagnitude = Math.abs(predictedPct) / expectedBandPct;
  const actualZ = Math.abs(actualPct) / expectedBandPct;

  let bias: CalibrationBias = 'calibrated';
  if (zMagnitude > 1.75) {
    bias = 'overextended';
  } else if (zMagnitude < 0.25 && actualZ >= 0.4) {
    bias = 'flat';
  }

  return {
    expectedBandPct: parseFloat(expectedBandPct.toFixed(1)),
    zMagnitude: parseFloat(zMagnitude.toFixed(2)),
    bias,
  };
}
