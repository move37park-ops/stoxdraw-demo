import { describe, it, expect } from 'vitest';
import { getRoundFor, getISOWeekNumber, getCountdownRemaining } from './round';

describe('Round Engine (Weekly Cohorts)', () => {
  it('correctly calculates round for a given date in 2026', () => {
    // 2026-10-05 is a Monday (Week 41)
    expect(getISOWeekNumber(new Date('2026-10-05'))).toEqual({ year: 2026, week: 41 });
    const round = getRoundFor('NVDA', '2026-10-05');
    expect(round.ticker).toBe('NVDA');
    expect(round.id).toBe('W2026-41-NVDA');
    expect(round.baseDate).toBe('2026-10-02'); // 직전 금요일
    expect(round.evalDates).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
    ]);
    expect(round.status).toBe('LIVE');
  });

  it('calculates countdown remaining accurately', () => {
    const fixedNow = 1700000000000;
    const futureCutoff = new Date(fixedNow + 3600 * 1000 * 4 + 120 * 1000).toISOString();
    const countdown = getCountdownRemaining(futureCutoff, fixedNow);
    expect(countdown.isExpired).toBe(false);
    expect(countdown.hours).toBe(4);
    expect(countdown.minutes).toBe(2);
    expect(countdown.seconds).toBe(0);
    expect(countdown.formatted).toBe('04:02:00');
  });
});
