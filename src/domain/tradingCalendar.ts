export function isTradingDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 토요일(6), 일요일(0) 제외
}

export function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateStr(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getNextTradingDays(startDateStr: string, count: number): string[] {
  const result: string[] = [];
  const curr = parseDateStr(startDateStr);

  while (result.length < count) {
    curr.setDate(curr.getDate() + 1);
    if (isTradingDay(curr)) {
      result.push(formatDateStr(curr));
    }
  }

  return result;
}

export function getHorizonTradingDays(horizon: '5D' | '30D'): number {
  return horizon === '5D' ? 5 : 21; // 5D = 5거래일, 30D = 21거래일 (약 1개월)
}
