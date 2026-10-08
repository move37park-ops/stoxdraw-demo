import type { Forecast, ForecastStatus } from './types';

export function deriveForecastStatus(
  forecast: Forecast,
  currentDateStr: string
): ForecastStatus {
  if (!forecast.lockedAt) {
    return 'DRAFT';
  }

  const { evalDates } = forecast;
  if (!evalDates || evalDates.length === 0) {
    return 'LOCKED';
  }

  const firstEval = evalDates[0];
  const lastEval = evalDates[evalDates.length - 1];

  if (currentDateStr < firstEval) {
    return 'LOCKED';
  }

  if (currentDateStr >= lastEval) {
    return 'RESOLVED';
  }

  return 'LIVE';
}
