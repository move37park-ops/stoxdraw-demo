import { describe, it, expect } from 'vitest';
import {
  analyzeAttemptCalibration,
  extractPracticeMetrics,
} from './practiceStats';
import type { MarketBar } from './types';

function makeBars(closes: number[], volumes?: number[]): MarketBar[] {
  return closes.map((close, idx) => ({
    date: `2025-01-${String(idx + 1).padStart(2, '0')}`,
    open: idx > 0 ? closes[idx - 1] : close,
    high: close * 1.015,
    low: close * 0.985,
    close,
    volume: volumes ? volumes[idx] : 1000,
  }));
}

describe('practiceStats intuition metrics & calibration', () => {
  it('computes dynamic range, MA20 deviation, and volume ratio from OHLCV', () => {
    const closes = Array.from({ length: 24 }, (_, i) => 50000 + i * 250);
    const vols = Array.from({ length: 24 }, (_, i) => (i >= 21 ? 2000 : 1000));
    const cues = extractPracticeMetrics(makeBars(closes, vols), 0.03);

    expect(cues.realizedVol).toBeGreaterThan(0);
    expect(cues.expected7dBandPct).toBeGreaterThan(0);
    expect(cues.ma20DeviationPct).toBeGreaterThan(0);
    expect(cues.volumeRatio).toBeGreaterThan(1.5);
  });

  it('flags overextended, flat, and calibrated forecasts against realized sigma', () => {
    // dailyVol = 0.02 -> 7D 1-sigma ~= 5.29%
    const over = analyzeAttemptCalibration(14.0, 4.0, 0.02, 7);
    expect(over.bias).toBe('overextended');
    expect(over.zMagnitude).toBeGreaterThan(1.75);

    const flat = analyzeAttemptCalibration(0.3, 5.5, 0.02, 7);
    expect(flat.bias).toBe('flat');

    const ok = analyzeAttemptCalibration(5.0, 4.5, 0.02, 7);
    expect(ok.bias).toBe('calibrated');
  });
});
