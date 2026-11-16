export interface ScoreBreakdown {
  total: number;          // 0 ~ 100점
  pathScore: number;      // /50 (변동성 정규화 경로 정확도)
  directionScore: number; // /25 (일별 수익률 형태 유사도)
  targetScore: number;    // /25 (종가 정밀도 15 + 최종 방향 적중 10)
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  directionHit: boolean;
  endErrorPct: number;
}

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

/**
 * 최근 일간 종가 배열에서 일일 로그 수익률 표준편차(실현 변동성)를 계산합니다.
 */
export function calculateRealizedDailyVolatility(
  closes: number[],
  fallback: number = 0.032,
  lookback: number = 30
): number {
  const valid = closes.filter((c) => Number.isFinite(c) && c > 0);
  if (valid.length < 6) return clamp(fallback, 0.008, 0.12);

  const slice = valid.slice(-(lookback + 1));
  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    returns.push(Math.log(slice[i] / slice[i - 1]));
  }
  if (returns.length < 5) return clamp(fallback, 0.008, 0.12);

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / Math.max(1, returns.length - 1);
  const std = Math.sqrt(variance);
  return clamp(std, 0.008, 0.12);
}

/**
 * 100점 만점 변동성 정규화 + 형태 분리 주가 궤적 채점 엔진
 * - 50점: 변동성 정규화(σ√t) 시간가중 경로 오차 점수
 * - 25점: 일별 로그 수익률 벡터 코사인 유사도 (연속 노이즈 감쇠로 수평선 편법 방지)
 * - 25점: 최종 종가 변동성 정규화 정밀도(15) + 연속 램프 최종 방향 보너스(10)
 */
export function calculateForecastScore(
  forecastPrices: number[],
  actualPrices: number[],
  basePrice: number,
  dailyVolatility: number = 0.03
): ScoreBreakdown {
  const T = Math.min(forecastPrices.length, actualPrices.length);
  if (T === 0 || basePrice <= 0) {
    return {
      total: 0,
      pathScore: 0,
      directionScore: 0,
      targetScore: 0,
      grade: 'F',
      directionHit: false,
      endErrorPct: 0,
    };
  }

  const effectiveVol = clamp(dailyVolatility, 0.008, 0.12);

  // 1. 변동성 정규화 경로 정확도 (50점)
  let weightedZSum = 0;
  let weightTotal = 0;

  for (let t = 0; t < T; t++) {
    const act = actualPrices[t];
    const pred = forecastPrices[t];
    if (act <= 0 || pred <= 0) continue;

    const weight = t + 1;
    const scale = effectiveVol * Math.sqrt(t + 1);
    const z_t = Math.abs(Math.log(pred / act)) / scale;
    weightedZSum += weight * z_t;
    weightTotal += weight;
  }

  const avgZPath = weightTotal > 0 ? weightedZSum / weightTotal : 4;
  const pathScore = 50 * Math.exp(-0.6 * avgZPath);

  // 2. 일별 수익률 형태 유사도 (25점) — 클리프 없는 연속 코사인 유사도
  const predReturns: number[] = [];
  const actReturns: number[] = [];
  let prevPred = basePrice;
  let prevAct = basePrice;

  for (let t = 0; t < T; t++) {
    const pred = Math.max(1e-6, forecastPrices[t]);
    const act = Math.max(1e-6, actualPrices[t]);
    predReturns.push(Math.log(pred / Math.max(1e-6, prevPred)));
    actReturns.push(Math.log(act / Math.max(1e-6, prevAct)));
    prevPred = pred;
    prevAct = act;
  }

  let dot = 0;
  let normPredSq = 0;
  let normActSq = 0;
  for (let t = 0; t < T; t++) {
    dot += predReturns[t] * actReturns[t];
    normPredSq += predReturns[t] ** 2;
    normActSq += actReturns[t] ** 2;
  }

  const normPred = Math.sqrt(normPredSq);
  const normAct = Math.sqrt(normActSq);
  const noiseFloor = 0.15 * effectiveVol * Math.sqrt(T);

  let shapeSimilarity = 0;
  if (normAct < 1e-5 && normPred < 1e-5) {
    shapeSimilarity = 1;
  } else if (normAct >= 1e-5 && normPred > 0) {
    const denom = Math.sqrt(normPredSq + noiseFloor ** 2) * normAct;
    shapeSimilarity = clamp(dot / denom, 0, 1);
  }
  const directionScore = 25 * shapeSimilarity;

  // 3. 최종 종가 정밀도(15점) + 최종 방향성 적중(10점, 연속 램프 적용) = 25점
  const lastPred = Math.max(1e-6, forecastPrices[T - 1]);
  const lastAct = Math.max(1e-6, actualPrices[T - 1]);
  const endError = Math.abs(lastPred - lastAct) / lastAct;
  const endErrorPct = parseFloat((endError * 100).toFixed(2));

  const zEnd = Math.abs(Math.log(lastPred / lastAct)) / (effectiveVol * Math.sqrt(T));
  const targetPrecision = 15 * Math.exp(-0.85 * zEnd);

  const predTotalRet = (lastPred - basePrice) / basePrice;
  const actTotalRet = (lastAct - basePrice) / basePrice;
  const directionHit =
    Math.abs(actTotalRet) < 1e-4
      ? Math.abs(predTotalRet) < 1e-4
      : Math.sign(predTotalRet) === Math.sign(actTotalRet) && Math.abs(predTotalRet) > 1e-4;

  // 방향성 가산점(10점)도 미세 노이즈 구간에서의 불연속 점프를 막기 위해 변동성 대비 연속 램프 적용
  const convictionScale =
    Math.abs(actTotalRet) < 1e-4
      ? 1
      : clamp(Math.abs(predTotalRet) / (0.15 * effectiveVol * Math.sqrt(T)), 0, 1);
  const targetScore = targetPrecision + (directionHit ? 10 * convictionScale : 0);

  const rawTotal = pathScore + directionScore + targetScore;
  const total = parseFloat(clamp(rawTotal, 0, 100).toFixed(1));

  // 등급 산출 (S, A, B, C, D, F)
  let grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
  if (total >= 85 && directionHit) {
    grade = 'S';
  } else if (total >= 72) {
    grade = 'A';
  } else if (total >= 58) {
    grade = 'B';
  } else if (total >= 42) {
    grade = 'C';
  } else if (total >= 25) {
    grade = 'D';
  } else {
    grade = 'F';
  }

  return {
    total,
    pathScore: parseFloat(pathScore.toFixed(1)),
    directionScore: parseFloat(directionScore.toFixed(1)),
    targetScore: parseFloat(targetScore.toFixed(1)),
    grade,
    directionHit,
    endErrorPct,
  };
}
