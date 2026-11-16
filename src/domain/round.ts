import { isTradingDay, formatDateStr, parseDateStr } from './tradingCalendar';
import { getNextCalendarDays } from './interpolation';

export type RoundStatus = 'OPEN' | 'LIVE' | 'RESOLVED';

export interface Round {
  id: string; // e.g. 'R2026-W40-BTCUSDT-7D'
  ticker: string;
  year: number;
  weekNumber: number;
  baseDate: string; // 기준일
  cutoffAt: string; // 제출 마감 시각 (ISO string)
  evalDates: string[]; // 평가 일자 배열 (기본 7일)
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
 * BTC/USDT 코호트 라운드 생성 (기본 7일 연속 달력일)
 */
export function getBtc20DRound(
  baseDateStr: string = '2026-10-02',
  asOfDateStr: string = '2026-10-02',
  horizonDays: number = 7
): Round {
  const baseDateObj = parseDateStr(baseDateStr);
  const { year, week } = getISOWeekNumber(baseDateObj);
  const evalDates = getNextCalendarDays(baseDateStr, horizonDays);
  const firstEval = evalDates[0];
  const lastEval = evalDates[evalDates.length - 1];

  const cutoffAt = `${firstEval}T00:00:00Z`;

  let status: RoundStatus = 'OPEN';
  if (asOfDateStr >= lastEval) {
    status = 'RESOLVED';
  } else if (asOfDateStr >= firstEval) {
    status = 'LIVE';
  } else {
    status = 'OPEN';
  }

  const paddedWeek = String(week).padStart(2, '0');
  return {
    id: `R${year}-W${paddedWeek}-BTCUSDT-${horizonDays}D`,
    ticker: 'BTC/USDT',
    year,
    weekNumber: week,
    baseDate: baseDateStr,
    cutoffAt,
    evalDates,
    status,
  };
}

export const getBtc7DRound = getBtc20DRound;

/**
 * 데일리 롤링 7일 BTC 코호트 목록 생성 (최근 N일 기준일별로 매일 오픈)
 */
export function getDailyRollingBtcRounds(
  latestBaseDateStr: string = '2026-10-02',
  asOfDateStr: string = '2026-10-02',
  count: number = 5,
  horizonDays: number = 7
): Round[] {
  const anchor = parseDateStr(latestBaseDateStr);
  const rounds: Round[] = [];

  for (let offset = 0; offset < Math.max(1, count); offset++) {
    const d = new Date(anchor);
    d.setDate(d.getDate() - offset);
    const baseStr = formatDateStr(d);
    const r = getBtc20DRound(baseStr, asOfDateStr, horizonDays);
    rounds.push({
      ...r,
      id: `R-${baseStr.replace(/-/g, '')}-BTCUSDT-${horizonDays}D`,
    });
  }

  return rounds;
}

/**
 * 특정 기준일(currentDateStr: YYYY-MM-DD)을 포함하는 주의 라운드를 계산
 */
export function getRoundFor(ticker: string, asOfDateStr: string = '2026-10-05'): Round {
  if (ticker.toUpperCase().includes('BTC')) {
    return getBtc20DRound('2026-10-02', asOfDateStr);
  }

  const asOf = parseDateStr(asOfDateStr);
  const { year, week } = getISOWeekNumber(asOf);

  const monday = new Date(asOf);
  const day = monday.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const prevFriday = new Date(monday);
  prevFriday.setDate(prevFriday.getDate() - 3);
  while (!isTradingDay(prevFriday)) {
    prevFriday.setDate(prevFriday.getDate() - 1);
  }
  const baseDate = formatDateStr(prevFriday);

  const evalDates: string[] = [];
  const cur = new Date(monday);
  while (evalDates.length < 5) {
    if (isTradingDay(cur)) {
      evalDates.push(formatDateStr(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }

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

  if (diff <= 0 && nowMs === undefined) {
    const nowDate = new Date(currentMs);
    const nextCutoff = new Date(Date.UTC(
      nowDate.getUTCFullYear(),
      nowDate.getUTCMonth(),
      nowDate.getUTCDate() + 1,
      0, 0, 0, 0
    ));
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
