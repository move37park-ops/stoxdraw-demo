import { useMemo } from 'react';
import { getStockHistory } from '../data/market';
import type { Forecast } from '../domain/types';

interface ForecastSparklineProps {
  forecast: Forecast;
  isActiveLayer?: boolean;
  layerColor?: string;
  width?: number;
  height?: number;
  pastDays?: number;
}

export function ForecastSparkline({
  forecast,
  isActiveLayer = false,
  layerColor = 'var(--v-cyan)',
  width = 112,
  height = 28,
  pastDays = 7,
}: ForecastSparklineProps) {
  const geometry = useMemo(() => {
    if (forecast.mode !== 'path' || !forecast.path || forecast.path.length === 0) {
      return null;
    }

    const futurePrices = [forecast.basePrice, ...forecast.path.map(p => p.price)];
    const rawPast = getStockHistory(forecast.ticker)
      .filter(b => b.date <= forecast.baseDate)
      .slice(-(pastDays + 1));

    const lastBarClose = rawPast[rawPast.length - 1]?.close ?? forecast.basePrice;
    const scale = lastBarClose > 0 ? forecast.basePrice / lastBarClose : 1;
    const pastPrices =
      rawPast.length >= 2
        ? [...rawPast.slice(0, -1).map(b => b.close * scale), forecast.basePrice]
        : [forecast.basePrice];

    const pastIntervals = Math.max(0, pastPrices.length - 1);
    const futureIntervals = Math.max(1, futurePrices.length - 1);
    const totalIntervals = Math.max(1, pastIntervals + futureIntervals);

    const allPrices = [...pastPrices, ...futurePrices];
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    const span = Math.max(1e-4, max - min);
    const padX = 3;
    const padY = 3.5;

    const toX = (stepIdx: number) =>
      padX + (stepIdx / totalIntervals) * (width - padX * 2);
    const toY = (price: number) =>
      padY + (height - padY * 2) * (1 - (price - min) / span);

    const pastPoints =
      pastPrices.length > 1
        ? pastPrices
            .map((p, idx) => `${toX(idx).toFixed(1)},${toY(p).toFixed(1)}`)
            .join(' ')
        : '';

    const futurePoints = futurePrices
      .map((p, idx) => `${toX(pastIntervals + idx).toFixed(1)},${toY(p).toFixed(1)}`)
      .join(' ');

    const splitX = toX(pastIntervals);
    const baseY = toY(forecast.basePrice);
    const endX = toX(totalIntervals);
    const endY = toY(futurePrices[futurePrices.length - 1]);
    const isBull = futurePrices[futurePrices.length - 1] >= forecast.basePrice;

    return {
      hasPast: pastPrices.length > 1,
      pastPoints,
      futurePoints,
      splitX,
      baseY,
      endX,
      endY,
      isBull,
    };
  }, [forecast, width, height, pastDays]);

  if (!geometry) return null;

  const strokeColor = isActiveLayer
    ? layerColor
    : geometry.isBull
    ? 'var(--op-bull)'
    : 'var(--op-bear)';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="flex-shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <line
        x1="0"
        y1={geometry.baseY.toFixed(1)}
        x2={width}
        y2={geometry.baseY.toFixed(1)}
        stroke="var(--op-line-strong)"
        strokeDasharray="2 2"
        strokeWidth="0.9"
      />
      {geometry.hasPast && (
        <>
          <line
            x1={geometry.splitX.toFixed(1)}
            y1="1"
            x2={geometry.splitX.toFixed(1)}
            y2={height - 1}
            stroke="var(--op-line-strong)"
            strokeDasharray="2 2"
            strokeWidth="0.9"
          />
          <polyline
            fill="none"
            stroke="var(--op-ink-2)"
            strokeOpacity="0.68"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={geometry.pastPoints}
          />
          <circle
            cx={geometry.splitX.toFixed(1)}
            cy={geometry.baseY.toFixed(1)}
            r="1.7"
            fill="var(--op-ink-2)"
          />
        </>
      )}
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth={isActiveLayer ? '2' : '1.75'}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={geometry.futurePoints}
      />
      <circle
        cx={geometry.endX.toFixed(1)}
        cy={geometry.endY.toFixed(1)}
        r="2.2"
        fill={strokeColor}
      />
    </svg>
  );
}
