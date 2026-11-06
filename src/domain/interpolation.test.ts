import { describe, it, expect } from 'vitest';
import {
  interpolate20DayPath,
  buildInterpolatedTrajectory,
  getNextCalendarDays,
  buildPresetAnchors,
  normalizeAnchors,
  MAX_ANCHORS,
} from './interpolation';

describe('20-Day Polyline Linear Interpolation Engine (interpolation.ts)', () => {
  it('generates 20 consecutive calendar days for 365d crypto market', () => {
    const days = getNextCalendarDays('2026-10-02', 20);
    expect(days.length).toBe(20);
    expect(days[0]).toBe('2026-10-03');
    expect(days[19]).toBe('2026-10-22');
  });

  it('linearly interpolates inflection anchors into 20 daily prices', () => {
    const basePrice = 60000;
    const anchors = [
      { day: 10, price: 66000 }, // +$600/day for D+1..D+10
      { day: 20, price: 62000 }, // -$400/day for D+11..D+20
    ];

    const prices = interpolate20DayPath(basePrice, anchors, 20);
    expect(prices.length).toBe(20);
    expect(prices[0]).toBe(60600);  // D+1
    expect(prices[4]).toBe(63000);  // D+5
    expect(prices[9]).toBe(66000);  // D+10
    expect(prices[14]).toBe(64000); // D+15
    expect(prices[19]).toBe(62000); // D+20
  });

  it('extends final anchor price to day 20 if last anchor is before day 20', () => {
    const basePrice = 50000;
    const anchors = [{ day: 5, price: 55000 }];
    const prices = interpolate20DayPath(basePrice, anchors, 20);

    expect(prices.length).toBe(20);
    expect(prices[4]).toBe(55000);  // D+5
    expect(prices[19]).toBe(55000); // Extended to D+20
  });

  it('builds complete path and percentage series from preset anchors', () => {
    const basePrice = 68420;
    const evalDates = getNextCalendarDays('2026-10-02', 20);
    const anchors = buildPresetAnchors(basePrice, 'dip_rally', 20);
    const res = buildInterpolatedTrajectory(basePrice, evalDates, anchors);

    expect(res.prices.length).toBe(20);
    expect(res.path.length).toBe(20);
    expect(res.pathPct.length).toBe(20);
    expect(res.path[19].date).toBe('2026-10-22');
  });

  it('caps inflection points at MAX_ANCHORS (4) while preserving final target anchor', () => {
    const raw = [
      { day: 3, price: 61000 },
      { day: 7, price: 62500 },
      { day: 11, price: 64000 },
      { day: 15, price: 65500 },
      { day: 18, price: 67000 },
      { day: 20, price: 70000 },
    ];
    const normalized = normalizeAnchors(raw, 20);
    expect(normalized.length).toBe(MAX_ANCHORS);
    expect(normalized[normalized.length - 1]).toEqual({ day: 20, price: 70000 });
  });
});
