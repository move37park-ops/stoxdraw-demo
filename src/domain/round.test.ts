import { describe, it, expect } from 'vitest';
import { getRoundFor, getISOWeekNumber, getCountdownRemaining, getDailyRollingBtcRounds } from './round';

describe('Round Engine (Daily Rolling & Weekly Cohorts)', () => {
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

  it('generates overlapping daily rolling 7D BTC cohorts with distinct status states', () => {
    const rounds = getDailyRollingBtcRounds('2026-10-02', '2026-10-02', 4, 7);
    expect(rounds).toHaveLength(4);
    expect(rounds[0].baseDate).toBe('2026-10-02');
    expect(rounds[0].status).toBe('OPEN');
    expect(rounds[1].baseDate).toBe('2026-10-01');
    expect(rounds[1].status).toBe('LIVE');
    expect(rounds[0].evalDates).toHaveLength(7);
  });

  it('classifies 15 consecutive daily BTC rounds across Open, Tracking (LIVE), and Evaluated (RESOLVED)', () => {
    const rounds = getDailyRollingBtcRounds('2026-10-02', '2026-10-02', 15, 7);
    expect(rounds).toHaveLength(15);
    expect(rounds[0]).toMatchObject({ baseDate: '2026-10-02', status: 'OPEN' });
    // 1..6 days ago: Tracking (LIVE)
    for (let i = 1; i <= 6; i++) {
      expect(rounds[i].status).toBe('LIVE');
    }
    // 7..14 days ago (2026-09-25 down to 2026-09-18): Evaluated (RESOLVED)
    expect(rounds[7]).toMatchObject({ baseDate: '2026-09-25', status: 'RESOLVED' });
    for (let i = 7; i < rounds.length; i++) {
      expect(rounds[i].status).toBe('RESOLVED');
    }
    expect(rounds[rounds.length - 1].baseDate).toBe('2026-09-18');
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
