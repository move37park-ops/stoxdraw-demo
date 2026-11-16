import { describe, it, expect } from 'vitest';
import {
  interpolate20DayPath,
  buildInterpolatedTrajectory,
  getNextCalendarDays,
  buildPresetAnchors,
  normalizeAnchors,
  isPathComplete,
  buildDrawnSegment,
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

  it('does not auto-extend drawn segment when last anchor is before D+20', () => {
    const basePrice = 75000;
    expect(buildDrawnSegment(basePrice, [], 20)).toEqual([]);
    const drawn = buildDrawnSegment(basePrice, [{ day: 8, price: 78000 }], 20);
    expect(drawn).toEqual([
      { day: 0, price: 75000 },
      { day: 8, price: 78000 },
    ]);
    expect(isPathComplete([], 20)).toBe(false);
    expect(isPathComplete([{ day: 8, price: 78000 }], 20)).toBe(false);
    expect(isPathComplete([{ day: 8, price: 78000 }, { day: 20, price: 82000 }], 20)).toBe(true);
  });

  it('builds complete path and percentage series from anchors', () => {
    const basePrice = 68420;
    const evalDates = getNextCalendarDays('2026-10-02', 20);
    const anchors = buildPresetAnchors(basePrice, 'dip_rally', 20);
    const res = buildInterpolatedTrajectory(basePrice, evalDates, anchors);

    expect(res.prices.length).toBe(20);
    expect(res.path.length).toBe(20);
    expect(res.pathPct.length).toBe(20);
    expect(res.path[19].date).toBe('2026-10-22');
  });

  it('builds complete 7-day preset anchors and trajectory without day collisions', () => {
    const basePrice = 75897;
    const evalDates = getNextCalendarDays('2026-10-02', 7);
    const anchors = buildPresetAnchors(basePrice, 'dip_rally', 7);
    expect(anchors.length).toBeGreaterThanOrEqual(3);
    expect(anchors[anchors.length - 1].day).toBe(7);
    expect(isPathComplete(anchors, 7)).toBe(true);
    const res = buildInterpolatedTrajectory(basePrice, evalDates, anchors);
    expect(res.prices.length).toBe(7);
    expect(res.path[6].date).toBe('2026-10-09');
  });

  it('caps inflection points at MAX_ANCHORS (5) while preserving final target anchor', () => {
    expect(MAX_ANCHORS).toBe(5);
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
