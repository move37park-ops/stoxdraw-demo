import type { AnchorPoint, PathPoint } from './types';
import { formatDateStr, parseDateStr } from './tradingCalendar';

export const DEFAULT_HORIZON_DAYS = 20;
export const MAX_ANCHORS = 4;

/**
 * 기준일(baseDateStr: YYYY-MM-DD) 이후 N개의 연속 달력일(365일 크립토 일봉 기준) 생성
 */
export function getNextCalendarDays(baseDateStr: string, count: number = DEFAULT_HORIZON_DAYS): string[] {
  const cur = parseDateStr(baseDateStr);
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    cur.setDate(cur.getDate() + 1);
    result.push(formatDateStr(cur));
  }
  return result;
}

/**
 * 변곡점(AnchorPoint) 배열을 일자(day) 오름차순으로 정규화하고 중복 일자를 병합하며 최대 MAX_ANCHORS(4개)로 제한합니다.
 */
export function normalizeAnchors(
  anchors: AnchorPoint[],
  horizonDays: number = DEFAULT_HORIZON_DAYS,
  maxAnchors: number = MAX_ANCHORS
): AnchorPoint[] {
  const byDay = new Map<number, number>();
  for (const a of anchors) {
    const clampedDay = Math.max(1, Math.min(horizonDays, Math.round(a.day)));
    const safePrice = Math.max(1, parseFloat(a.price.toFixed(2)));
    byDay.set(clampedDay, safePrice);
  }

  const sorted = Array.from(byDay.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, price]) => ({ day, price }));

  if (sorted.length <= maxAnchors) {
    return sorted;
  }

  // 최대 개수 초과 시 앞쪽 변곡점과 마지막 목표점 보존
  return [
    ...sorted.slice(0, Math.max(0, maxAnchors - 1)),
    sorted[sorted.length - 1],
  ];
}

/**
 * 기준가(day=0, basePrice)와 유저가 찍은 변곡점(AnchorPoint[])을 기반으로
 * 향후 20일(D+1 ~ D+20) 일봉 가격 배열(number[20])을 선형 보간(Linear Interpolation)으로 즉시 산출합니다.
 *
 * - 변곡점이 하나도 없으면 기준가 수평선을 반환합니다.
 * - 마지막 변곡점이 20일 이전에 찍혀 있으면 마지막 변곡점 가격을 20일차까지 유지합니다.
 */
export function interpolate20DayPath(
  basePrice: number,
  anchors: AnchorPoint[],
  horizonDays: number = DEFAULT_HORIZON_DAYS
): number[] {
  const sorted = normalizeAnchors(anchors, horizonDays);
  if (sorted.length === 0) {
    return Array.from({ length: horizonDays }, () => parseFloat(basePrice.toFixed(2)));
  }

  const controlPoints: { day: number; price: number }[] = [
    { day: 0, price: basePrice },
    ...sorted,
  ];

  const lastPoint = controlPoints[controlPoints.length - 1];
  if (lastPoint.day < horizonDays) {
    controlPoints.push({
      day: horizonDays,
      price: lastPoint.price,
    });
  }

  const prices: number[] = [];

  for (let d = 1; d <= horizonDays; d++) {
    // d가 속하는 구간 [p0, p1] 탐색
    let p0 = controlPoints[0];
    let p1 = controlPoints[controlPoints.length - 1];

    for (let i = 0; i < controlPoints.length - 1; i++) {
      if (d >= controlPoints[i].day && d <= controlPoints[i + 1].day) {
        p0 = controlPoints[i];
        p1 = controlPoints[i + 1];
        break;
      }
    }

    if (p1.day === p0.day) {
      prices.push(parseFloat(p1.price.toFixed(2)));
    } else {
      const ratio = (d - p0.day) / (p1.day - p0.day);
      const interpolated = p0.price + ratio * (p1.price - p0.price);
      prices.push(parseFloat(interpolated.toFixed(2)));
    }
  }

  return prices;
}

/**
 * 보간된 가격 배열과 평가 날짜 배열을 결합하여 PathPoint[] 및 수익률 배열(pathPct[])을 반환합니다.
 */
export function buildInterpolatedTrajectory(
  basePrice: number,
  evalDates: string[],
  anchors: AnchorPoint[]
): {
  prices: number[];
  path: PathPoint[];
  pathPct: number[];
} {
  const prices = interpolate20DayPath(basePrice, anchors, evalDates.length);
  const path = evalDates.map((date, idx) => ({
    date,
    price: prices[idx] ?? basePrice,
  }));
  const pathPct = prices.map(p =>
    basePrice > 0 ? parseFloat(((p - basePrice) / basePrice).toFixed(4)) : 0
  );
  return { prices, path, pathPct };
}

export type TrajectoryPresetId = 'dip_rally' | 'breakout' | 'pullback_bounce' | 'bear_slide' | 'range_up';

/**
 * 빠른 작도를 위한 변곡점 프리셋 생성기 (피치덱 02.1 스타일 3~4개 변곡점 폴리라인)
 */
export function buildPresetAnchors(
  basePrice: number,
  preset: TrajectoryPresetId = 'dip_rally',
  horizonDays: number = DEFAULT_HORIZON_DAYS
): AnchorPoint[] {
  const d1 = Math.max(3, Math.round(horizonDays * 0.25));  // D+5
  const d2 = Math.max(7, Math.round(horizonDays * 0.55));  // D+11
  const d3 = Math.max(12, Math.round(horizonDays * 0.8));  // D+16
  const d4 = horizonDays;                                  // D+20

  const roundPrice = (mult: number) => parseFloat((basePrice * (1 + mult)).toFixed(2));

  switch (preset) {
    case 'dip_rally':
      // 기본 프리셋: 3개 변곡점 (1개 여유 슬롯으로 즉시 추가 체험 가능, 최대 4개)
      return [
        { day: d1, price: roundPrice(0.045) },
        { day: d2, price: roundPrice(0.012) },
        { day: d4, price: roundPrice(0.092) },
      ];
    case 'breakout':
      return [
        { day: d1, price: roundPrice(0.028) },
        { day: d2, price: roundPrice(0.068) },
        { day: d4, price: roundPrice(0.125) },
      ];
    case 'pullback_bounce':
      return [
        { day: d1, price: roundPrice(-0.042) },
        { day: d2, price: roundPrice(-0.012) },
        { day: d4, price: roundPrice(0.058) },
      ];
    case 'bear_slide':
      return [
        { day: d1, price: roundPrice(-0.025) },
        { day: d2, price: roundPrice(0.010) },
        { day: d3, price: roundPrice(-0.055) },
        { day: d4, price: roundPrice(-0.085) },
      ];
    case 'range_up':
      return [
        { day: d1, price: roundPrice(0.022) },
        { day: d2, price: roundPrice(-0.018) },
        { day: d3, price: roundPrice(0.025) },
        { day: d4, price: roundPrice(0.038) },
      ];
  }
}
