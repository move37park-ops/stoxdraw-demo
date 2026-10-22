export interface ScoreBreakdown {
  total: number;       // 0 ~ 100점
  pathScore: number;   // /50 (경로 밀착도 & 스킬)
  directionScore: number; // /30 (일별 및 최종 방향성)
  targetScore: number; // /20 (변동성 대비 종가 정밀도)
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  directionHit: boolean;
  endErrorPct: number;
}

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

/**
 * 100점 만점 하이브리드 주가 궤적 채점 엔진 (PRD v2.0 스펙)
 * @param forecastPrices 5거래일 예측 가격 배열 [p1, p2, p3, p4, p5]
 * @param actualPrices 실제 시장 종가 배열 [a1, a2, a3, a4, a5] (길이 <= 5)
 * @param basePrice 기준가 (p0)
 * @param dailyVolatility 종목의 일일 변동성 (예: NVDA=0.038, AAPL=0.018, 기본 0.03)
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

  // 1. 경로 스킬 점수 (50점): 기준가 수평선(Flat baseline) 대비 오차 개선율
  let errSum = 0;
  let baseErrSum = 0;

  for (let t = 0; t < T; t++) {
    const weight = t + 1; // 시간 가중치 w_t = t (후반부 오차에 더 큰 가중치)
    const act = actualPrices[t];
    const pred = forecastPrices[t];
    const floor = 0.5 * dailyVolatility * Math.sqrt(t + 1);

    errSum += weight * (Math.abs(pred - act) / act);
    baseErrSum += weight * Math.max(Math.abs(basePrice - act) / act, floor);
  }

  const skill = baseErrSum > 0 ? 1 - (errSum / baseErrSum) : 0;
  // skill = 1 (완벽 적중) -> 50점
  // skill = 0 (수평선 수준) -> 20점
  // skill < 0 (수평선보다 못함) -> 0 ~ 20점
  const pathScore = 50 * clamp(0.4 + 0.6 * skill, 0, 1);

  // 2. 방향성 유사도 (30점): 일별 부호 일치율(10) + 최종 방향 일치(20)
  let dailyDirectionMatches = 0;
  const predReturns: number[] = [];
  const actReturns: number[] = [];

  let prevPred = basePrice;
  let prevAct = basePrice;
  for (let t = 0; t < T; t++) {
    const rPred = (forecastPrices[t] - prevPred) / prevPred;
    const rAct = (actualPrices[t] - prevAct) / prevAct;
    predReturns.push(rPred);
    actReturns.push(rAct);

    // 둘 다 상승이거나 둘 다 하락 (단, 평평한 수평선은 불일치 처리)
    if (Math.sign(rPred) === Math.sign(rAct) && Math.abs(rPred) > 1e-5 && Math.abs(rAct) > 1e-5) {
      dailyDirectionMatches++;
    }

    prevPred = forecastPrices[t];
    prevAct = actualPrices[t];
  }

  const lastPred = forecastPrices[T - 1];
  const lastAct = actualPrices[T - 1];
  const finalPredDiff = lastPred - basePrice;
  const finalActDiff = lastAct - basePrice;
  const directionHit = Math.sign(finalPredDiff) === Math.sign(finalActDiff) && Math.abs(finalPredDiff) > 1e-4;

  const dailyDirPts = (dailyDirectionMatches / T) * 10;
  const finalDirPts = directionHit ? 20 : 0;
  const directionScore = dailyDirPts + finalDirPts;

  // 3. 타깃 정규화 적중 점수 (20점): 최종일 종가 오차를 종목 변동성(σ√T) 단위로 스케일링
  const endError = Math.abs(lastPred - lastAct) / lastAct;
  const endErrorPct = parseFloat((endError * 100).toFixed(2));
  const z = endError / (dailyVolatility * Math.sqrt(T));
  const targetScore = 20 * Math.exp(-1.0 * z);

  // 확신도 가중 (Conviction factor):
  // 예측 변동폭이 0.5% 미만인 극단적 수평선 꼼수는 점수를 감점 보정
  const avgPredChange = predReturns.reduce((sum, r) => sum + Math.abs(r), 0) / T;
  const convictionPenalty = avgPredChange < 0.003 ? 0.75 : 1.0;

  const rawTotal = (pathScore + directionScore + targetScore) * convictionPenalty;
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
