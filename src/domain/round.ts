import { isTradingDay, formatDateStr, parseDateStr } from './tradingCalendar';

export type RoundStatus = 'OPEN' | 'LIVE' | 'RESOLVED';

export interface Round {
  id: string; // e.g. 'W2026-40-NVDA'
  ticker: string;
  year: number;
  weekNumber: number;
  baseDate: string; // 직전 금요일 (기준 거래일)
  cutoffAt: string; // 제출 마감 시각 (ISO string, 보통 월요일 개장 시점)
  evalDates: string[]; // 월~금 5거래일
  status: RoundStatus;
}

/**
 * 주어진 날짜(Date)의 ISO 주차(Week number) 계산
 */
export function getISOWeekNumber(date: Date): { year: number; week: number } {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return { year: target.getFullYear(), week: weekNumber };
}

/**
 * 특정 기준일(currentDateStr: YYYY-MM-DD)을 포함하는 주의 주간 라운드를 계산
 * 기본 규칙:
 * - 매주 월요일 미국장 개장 전까지 제출(OPEN)
 * - 월요일 장 시작부터 금요일 장 마감까지 LIVE
 * - 금요일 장 마감 이후 RESOLVED
 * - baseDate는 이전 주의 마지막 거래일 (금요일)
 */
export function getRoundFor(ticker: string, asOfDateStr: string = '2026-10-05'): Round {
  const asOf = parseDateStr(asOfDateStr);
  const { year, week } = getISOWeekNumber(asOf);

  // 해당 주차의 월요일 찾기
  const monday = new Date(asOf);
  const day = monday.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  // 직전 금요일 찾기 (baseDate)
  const prevFriday = new Date(monday);
  prevFriday.setDate(prevFriday.getDate() - 3);
  while (!isTradingDay(prevFriday)) {
    prevFriday.setDate(prevFriday.getDate() - 1);
  }
  const baseDate = formatDateStr(prevFriday);

  // 월요일부터 5거래일 (evalDates)
  const evalDates: string[] = [];
  const cur = new Date(monday);
  while (evalDates.length < 5) {
    if (isTradingDay(cur)) {
      evalDates.push(formatDateStr(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }

  // cutoff: 월요일 09:30 EDT (한국시간 22:30 / 서머타임 해제 시 23:30)
  // 여기서는 YYYY-MM-DDT13:30:00Z (UTC 13:30 = EDT 09:30)
  const cutoffAt = `${evalDates[0]}T13:30:00Z`;

  const lastEval = evalDates[evalDates.length - 1];

  let status: RoundStatus = 'OPEN';
  if (asOfDateStr > lastEval) {
    status = 'RESOLVED';
  } else if (asOfDateStr >= evalDates[0]) {
    status = 'LIVE';
  } else {
    status = 'OPEN';
  }

  const paddedWeek = String(week).padStart(2, '0');
  const id = `W${year}-${paddedWeek}-${ticker.toUpperCase()}`;

  return {
    id,
    ticker: ticker.toUpperCase(),
    year,
    weekNumber: week,
    baseDate,
    cutoffAt,
    evalDates,
    status,
  };
}

/**
 * 카운트다운 남은 시간 포맷팅
 */
export function getCountdownRemaining(cutoffIso: string, nowMs?: number): {
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
  isExpired: boolean;
} {
  const currentMs = nowMs ?? Date.now();
  let diff = new Date(cutoffIso).getTime() - currentMs;

  // 데모 환경에서 시뮬레이션 기준일이 과거여서 diff <= 0인 경우,
  // 테스트용 명시적 nowMs가 없을 때는 다음 미국장 개장(13:30 UTC / 22:30 KST)까지 실시간 롤링 카운트다운 제공
  if (diff <= 0 && nowMs === undefined) {
    const nowDate = new Date(currentMs);
    const nextCutoff = new Date(Date.UTC(
      nowDate.getUTCFullYear(),
      nowDate.getUTCMonth(),
      nowDate.getUTCDate(),
      13, 30, 0, 0
    ));
    if (nextCutoff.getTime() <= currentMs) {
      nextCutoff.setUTCDate(nextCutoff.getUTCDate() + 1);
    }
    diff = nextCutoff.getTime() - currentMs;
  }

  if (diff <= 0) {
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      formatted: '00:00:00',
      isExpired: true,
    };
  }

  const totalSec = Math.floor(diff / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const formatted = [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':');

  return {
    hours,
    minutes,
    seconds,
    formatted,
    isExpired: false,
  };
}
