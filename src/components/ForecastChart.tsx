import type { Forecast, PathPoint } from '../domain/types';
import { getStockHistory } from '../data/market';
import { deriveForecastStatus } from '../domain/lifecycle';

interface ForecastChartProps {
  forecast: Forecast;
  height?: number;
  showCrowd?: boolean;
  crowdPath?: PathPoint[];
  currentDateStr?: string;
  className?: string;
}

export function ForecastChart({
  forecast,
  height = 200,
  showCrowd = false,
  crowdPath,
  currentDateStr = '2026-10-05',
  className = '',
}: ForecastChartProps) {
  const stockBars = getStockHistory(forecast.ticker);
  const status = deriveForecastStatus(forecast, currentDateStr);

  // 1. 기준일 이전 과거 15거래일 추출
  const pastBars = stockBars
    .filter(b => b.date <= forecast.baseDate)
    .slice(-15);

  // 2. 실제 시세 중 평가 대상 거래일 추출 (LIVE 또는 RESOLVED인 경우)
  const evalDatesSet = new Set(forecast.evalDates);
  const actualEvalBars = (status === 'LIVE' || status === 'RESOLVED')
    ? stockBars.filter(b => evalDatesSet.has(b.date) && b.date <= currentDateStr)
    : [];

  // 3. 차트의 X축 스텝 구성
  // [과거 15일 ... 기준일(과거의 마지막)] + [미래 evalDates]
  const allXDates = [
    ...pastBars.map(b => b.date),
    ...forecast.evalDates,
  ];

  // 4. 가격 범위 계산 (Min & Max Price)
  const allPrices: number[] = [
    ...pastBars.map(b => b.close),
    forecast.basePrice,
  ];

  if (forecast.mode === 'path' && forecast.path) {
    forecast.path.forEach(p => allPrices.push(p.price));
  } else if (forecast.mode === 'breakout' && forecast.breakout) {
    allPrices.push(forecast.breakout.price);
  }

  actualEvalBars.forEach(b => allPrices.push(b.close));
  if (showCrowd && crowdPath) {
    crowdPath.forEach(p => allPrices.push(p.price));
  }

  const rawMin = Math.min(...allPrices);
  const rawMax = Math.max(...allPrices);
  const pad = (rawMax - rawMin) * 0.14 || rawMax * 0.05;
  const minPrice = rawMin - pad;
  const maxPrice = rawMax + pad;
  const priceRange = maxPrice - minPrice || 1;

  // SVG 좌표 맵핑
  const width = 600; // viewBox 기준 좌표
  const paddingX = 16;
  const paddingY = 18;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const getX = (dateStr: string) => {
    const idx = allXDates.indexOf(dateStr);
    if (idx === -1) return paddingX;
    return paddingX + (idx / (allXDates.length - 1)) * chartW;
  };

  const getY = (price: number) => {
    const norm = (price - minPrice) / priceRange;
    return paddingY + chartH * (1 - norm);
  };

  // Base Point 좌표
  const baseX = getX(forecast.baseDate);
  const baseY = getY(forecast.basePrice);

  // A. 과거 시세 SVG Path
  let pastPathD = '';
  pastBars.forEach((b, i) => {
    const x = getX(b.date);
    const y = getY(b.close);
    if (i === 0) pastPathD += `M ${x} ${y}`;
    else pastPathD += ` L ${x} ${y}`;
  });

  // B. Forecast Path
  let forecastPathD = '';
  if (forecast.mode === 'path' && forecast.path && forecast.path.length > 0) {
    forecastPathD = `M ${baseX} ${baseY}`;
    forecast.path.forEach(p => {
      forecastPathD += ` L ${getX(p.date)} ${getY(p.price)}`;
    });
  }

  // C. Actual Market Path (진행/완료 시)
  let actualPathD = '';
  if (actualEvalBars.length > 0) {
    actualPathD = `M ${baseX} ${baseY}`;
    actualEvalBars.forEach(b => {
      actualPathD += ` L ${getX(b.date)} ${getY(b.close)}`;
    });
  }

  // D. Crowd Consensus Path
  let crowdPathD = '';
  if (showCrowd && crowdPath && crowdPath.length > 0) {
    crowdPathD = `M ${baseX} ${baseY}`;
    crowdPath.forEach(p => {
      crowdPathD += ` L ${getX(p.date)} ${getY(p.price)}`;
    });
  }

  const isUpTrend = forecast.mode === 'path' && forecast.path && forecast.path.length > 0
    ? forecast.path[forecast.path.length - 1].price >= forecast.basePrice
    : forecast.breakout?.direction === 'up';

  const forecastColor = isUpTrend ? '#38bdf8' : '#f43f5e';

  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden bg-[#090a0d] border border-[#1b1e26] flex items-center justify-center ${className}`}
      style={{ aspectRatio: `${width}/${height}` }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full block"
      >
        <defs>
          <linearGradient id={`grad-past-${forecast.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#71767b" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#71767b" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id={`grad-forecast-${forecast.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={forecastColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={forecastColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* 기준 분기선 (Current / Start line) */}
        <line
          x1={baseX}
          y1={paddingY}
          x2={baseX}
          y2={height - paddingY}
          stroke="var(--border-strong, #272a33)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />

        {/* 과거 시세 라인 */}
        {pastPathD && (
          <path
            d={pastPathD}
            fill="none"
            stroke="var(--text-muted, #525866)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.8"
          />
        )}

        {/* Breakout Target Horizontal Line */}
        {forecast.mode === 'breakout' && forecast.breakout && (
          <g>
            <line
              x1={baseX}
              y1={getY(forecast.breakout.price)}
              x2={getX(forecast.evalDates[forecast.evalDates.length - 1])}
              y2={getY(forecast.breakout.price)}
              stroke={forecastColor}
              strokeWidth="2.5"
              strokeDasharray="6 4"
            />
            {/* Target Price Label Pin */}
            <circle
              cx={getX(forecast.evalDates[forecast.evalDates.length - 1])}
              cy={getY(forecast.breakout.price)}
              r="4"
              fill={forecastColor}
            />
          </g>
        )}

        {/* Crowd Path (바이올렛 점선) */}
        {showCrowd && crowdPathD && (
          <path
            d={crowdPathD}
            fill="none"
            stroke="#a855f7"
            strokeWidth="2.5"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
        )}

        {/* Forecast Path (일렉트릭 블루/로즈) */}
        {forecastPathD && (
          <g>
            <path
              d={forecastPathD}
              fill="none"
              stroke={forecastColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Forecast 꼭짓점 포인트들 */}
            {forecast.path?.map((p, idx) => (
              <circle
                key={idx}
                cx={getX(p.date)}
                cy={getY(p.price)}
                r="3.5"
                fill={forecastColor}
                stroke="var(--bg-app, #090a0d)"
                strokeWidth="1.5"
              />
            ))}
          </g>
        )}

        {/* 실제 시세 라인 (Actual Market - 테마 연동 실선) */}
        {actualPathD && (
          <g>
            <path
              d={actualPathD}
              fill="none"
              stroke="var(--text-primary, #ffffff)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* 현재/종료 시점 Actual 점 */}
            {actualEvalBars.length > 0 && (
              <circle
                cx={getX(actualEvalBars[actualEvalBars.length - 1].date)}
                cy={getY(actualEvalBars[actualEvalBars.length - 1].close)}
                r="4"
                fill="var(--text-primary, #ffffff)"
                stroke="var(--bg-app, #090a0d)"
                strokeWidth="2"
              />
            )}
          </g>
        )}

        {/* 기준점 (Base Price Point) */}
        <circle
          cx={baseX}
          cy={baseY}
          r="4.5"
          fill="var(--text-primary, #ffffff)"
          stroke="var(--bg-app, #090a0d)"
          strokeWidth="2"
        />
      </svg>

      {/* 우측 상단 범례 태그 */}
      <div className="chart-legend absolute top-2 right-2.5 flex items-center gap-2 text-[11px] font-medium bg-[#090a0d]/80 backdrop-blur px-2 py-0.5 rounded border border-[#272a33]">
        <span className="flex items-center gap-1 text-[#38bdf8]">
          <span className="w-2 h-0.5 bg-[#38bdf8] rounded" /> Forecast
        </span>
        {actualEvalBars.length > 0 && (
          <span className="flex items-center gap-1 text-[var(--text-primary)]">
            <span className="w-2 h-0.5 bg-[var(--text-primary)] rounded" /> Actual
          </span>
        )}
        {showCrowd && (
          <span className="flex items-center gap-1 text-purple-400">
            <span className="w-2 h-0.5 bg-purple-400 rounded" /> Crowd
          </span>
        )}
      </div>

      {/* 좌측 하단 기준가 표기 */}
      <div className="absolute bottom-1.5 left-2.5 text-[11px] text-[#71767b] font-mono">
        기준가: ${forecast.basePrice.toFixed(2)}
      </div>
    </div>
  );
}
