import { X, ArrowRight, Lock } from 'lucide-react';
import type { CrowdAggregate, Forecast, Horizon, Mode } from '../../domain/types';
import type { ArenaSummary } from '../../domain/arena';
import { getStockHistory, getStockLandmarks } from '../../data/market';
import { getNextTradingDays, getHorizonTradingDays } from '../../domain/tradingCalendar';
import { formatPct } from '../../domain/format';

interface ArenaHeroStageProps {
  ticker: string;
  horizon?: Horizon;
  mode?: Mode;
  currentDateStr: string;
  crowd: CrowdAggregate;
  arenaSummary: ArenaSummary;
  activeLayerForecasts: Forecast[];
  hasParticipated: boolean;
  onHorizonChange?: (h: Horizon) => void;
  onModeChange?: (m: Mode) => void;
  onDrawClick: () => void;
  onRemoveLayer: (forecastId: string) => void;
}

const LAYER_COLORS = ['#DFC15D', '#10b981', '#f43f5e'];

export function ArenaHeroStage({
  ticker,
  horizon = '5D',
  currentDateStr,
  crowd,
  arenaSummary,
  activeLayerForecasts,
  hasParticipated,
  onDrawClick,
  onRemoveLayer,
}: ArenaHeroStageProps) {
  const stockBars = getStockHistory(ticker);
  const tradingDaysCount = getHorizonTradingDays(horizon);
  const evalDates = getNextTradingDays(currentDateStr, tradingDaysCount);

  const pastBars = stockBars.filter(b => b.date <= currentDateStr).slice(-15);
  const basePrice = arenaSummary.currentPrice;
  const landmarks = getStockLandmarks(ticker, basePrice);

  const allPrices: number[] = [
    ...pastBars.flatMap(b => [b.high, b.low, b.close]),
    basePrice,
    ...landmarks.map(l => l.price),
  ];

  if (hasParticipated && crowd.consensusPath) {
    crowd.consensusPath.forEach(p => allPrices.push(p.price));
  }

  activeLayerForecasts.forEach(f => {
    if (f.mode === 'path' && f.path) {
      f.path.forEach(p => allPrices.push(p.price));
    }
  });

  const rawMin = Math.min(...allPrices);
  const rawMax = Math.max(...allPrices);
  const pad = (rawMax - rawMin) * 0.18 || basePrice * 0.08;
  const minPrice = rawMin - pad;
  const maxPrice = rawMax + pad;
  const priceRange = maxPrice - minPrice || 1;

  const allXDates = [...pastBars.map(b => b.date), ...evalDates];
  const width = 800;
  const height = 300;
  const padX = 28;
  const padY = 32;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const getX = (dateStr: string) => {
    const idx = allXDates.indexOf(dateStr);
    if (idx === -1) return padX;
    return padX + (idx / (allXDates.length - 1)) * chartW;
  };

  const getY = (price: number) => {
    const norm = (price - minPrice) / priceRange;
    return padY + chartH * (1 - norm);
  };

  const baseX = getX(currentDateStr);
  const baseY = getY(basePrice);

  let consensusPathD = '';
  let consensusAreaD = '';
  if (hasParticipated && crowd.consensusPath && crowd.consensusPath.length > 0) {
    consensusPathD = `M ${baseX} ${baseY}`;
    consensusAreaD = `M ${baseX} ${baseY}`;
    crowd.consensusPath.forEach(p => {
      consensusPathD += ` L ${getX(p.date)} ${getY(p.price)}`;
      consensusAreaD += ` L ${getX(p.date)} ${getY(p.price)}`;
    });
    const lastP = crowd.consensusPath[crowd.consensusPath.length - 1];
    consensusAreaD += ` L ${getX(lastP.date)} ${baseY} Z`;
  }

  const gridSteps = [0.2, 0.4, 0.6, 0.8];

  return (
    <div className="relative w-full bg-zinc-950 border border-zinc-800 rounded-lg divide-y divide-zinc-800 overflow-hidden mb-5">
      {/* Top Bar */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-lg sm:text-xl font-bold text-zinc-100 tracking-tight font-mono">
            ${ticker}
          </span>
          <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-zinc-900 border border-zinc-800 text-zinc-200 tabular-nums">
            ${basePrice.toFixed(2)}
          </span>
          <span className="text-xs text-zinc-400 font-mono tabular-nums">
            {arenaSummary.participantsCount}명 참여 · <span className="text-emerald-400">BULL {arenaSummary.bullPct}%</span> / <span className="text-rose-400">BEAR {arenaSummary.bearPct}%</span>
          </span>
        </div>

        {/* Active Layer Forecasters Badge Bar */}
        {activeLayerForecasts.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {activeLayerForecasts.map((f, idx) => {
              const color = LAYER_COLORS[idx % LAYER_COLORS.length];
              const author = f.authorId ? f.authorId.replace('u_', '') : '익명';

              return (
                <div
                  key={f.id}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono border bg-zinc-900 flex-shrink-0"
                  style={{ borderColor: `${color}80`, color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                  <span>@{author}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveLayer(f.id)}
                    className="p-0.5 hover:bg-zinc-800 rounded transition"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Integrated Chart Canvas (No Nested Border) */}
      <div className="relative w-full aspect-[16/9] min-h-[300px] max-h-[400px] bg-black overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full block"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="arenaConsensusGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a1a1aa" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#a1a1aa" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {gridSteps.map(stepRatio => {
            const y = padY + chartH * stepRatio;
            const priceVal = maxPrice - priceRange * stepRatio;
            return (
              <g key={stepRatio}>
                <line
                  x1={padX}
                  y1={y}
                  x2={width - padX}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                  className="text-zinc-850"
                />
                <text
                  x={width - padX + 4}
                  y={y + 3}
                  className="fill-zinc-500 font-mono text-[9px]"
                  textAnchor="start"
                >
                  ${priceVal.toFixed(0)}
                </text>
              </g>
            );
          })}

          {landmarks.map(lm => {
            const ly = getY(lm.price);
            const isRes = lm.category !== 'support';
            const color = isRes ? '#71717a' : '#d4d4d8';
            return (
              <g key={lm.id}>
                <line
                  x1={baseX}
                  y1={ly}
                  x2={width - padX}
                  y2={ly}
                  stroke={color}
                  strokeWidth="1"
                  strokeDasharray="2 4"
                  opacity="0.5"
                />
                <text
                  x={width - padX - 4}
                  y={ly - 4}
                  fill={color}
                  fontSize="8.5"
                  fontFamily="monospace"
                  textAnchor="end"
                  opacity="0.85"
                >
                  {lm.shortLabel} ${lm.price.toFixed(1)}
                </text>
              </g>
            );
          })}

          <line
            x1={baseX}
            y1={padY - 10}
            x2={baseX}
            y2={height - padY + 10}
            stroke="#a1a1aa"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            opacity="0.4"
          />
          <text
            x={baseX}
            y={height - padY + 22}
            className="fill-zinc-400 font-mono text-[10px]"
            textAnchor="middle"
          >
            {currentDateStr.slice(5)}
          </text>

          {pastBars.map((bar) => {
            const x = getX(bar.date);
            const isUp = bar.close >= bar.open;
            const color = isUp ? '#10b981' : '#f43f5e';
            const yHigh = getY(bar.high);
            const yLow = getY(bar.low);
            const yOpen = getY(bar.open);
            const yClose = getY(bar.close);
            const bodyTop = Math.min(yOpen, yClose);
            const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));
            const candleW = 6.5;

            return (
              <g key={bar.date}>
                <line
                  x1={x}
                  y1={yHigh}
                  x2={x}
                  y2={yLow}
                  stroke={color}
                  strokeWidth={1.3}
                />
                <rect
                  x={x - candleW / 2}
                  y={bodyTop}
                  width={candleW}
                  height={bodyHeight}
                  fill={color}
                  rx={0.5}
                />
              </g>
            );
          })}

          {hasParticipated && consensusAreaD && <path d={consensusAreaD} fill="url(#arenaConsensusGrad)" />}
          {hasParticipated && consensusPathD && (
            <g>
              <path
                d={consensusPathD}
                fill="none"
                stroke="#e4e4e7"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="5 4"
              />
              {crowd.consensusPath && crowd.consensusPath.length > 0 && (
                <circle
                  cx={getX(crowd.consensusPath[crowd.consensusPath.length - 1].date)}
                  cy={getY(crowd.consensusPath[crowd.consensusPath.length - 1].price)}
                  r="4.5"
                  fill="#ffffff"
                />
              )}
            </g>
          )}

          {activeLayerForecasts.map((f, idx) => {
            const color = LAYER_COLORS[idx % LAYER_COLORS.length];
            if (f.mode === 'path' && f.path && f.path.length > 0) {
              let pathD = `M ${baseX} ${baseY}`;
              f.path.forEach(p => {
                pathD += ` L ${getX(p.date)} ${getY(p.price)}`;
              });
              const lastP = f.path[f.path.length - 1];

              return (
                <g key={f.id}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx={getX(lastP.date)}
                    cy={getY(lastP.price)}
                    r="4"
                    fill={color}
                  />
                </g>
              );
            }
            return null;
          })}

          <circle cx={baseX} cy={baseY} r="4.5" fill="#ffffff" />
          <circle cx={baseX} cy={baseY} r="7.5" fill="none" stroke="#a1a1aa" strokeWidth="1.5" />
        </svg>

        {/* Top-Left Consensus HUD */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
          {hasParticipated ? (
            <div className="px-2.5 py-1 rounded-md bg-zinc-950/90 border border-zinc-800 text-xs font-mono text-zinc-300 flex items-center gap-2 tabular-nums">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-100" />
              <span>시장 컨센서스</span>
              <span className={arenaSummary.medianChangePct >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                {formatPct(arenaSummary.medianChangePct)} (${arenaSummary.medianTargetPrice})
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onDrawClick}
              className="px-2.5 py-1 rounded-md bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400 flex items-center gap-1.5 transition"
            >
              <Lock size={11} className="text-zinc-500" />
              <span>시장 컨센서스 잠김 ·</span>
              <span className="text-zinc-200 font-medium">내 예측 그리기 →</span>
            </button>
          )}
        </div>

        {/* Bottom-Right Primary CTA */}
        <div className="absolute bottom-3 right-3 z-10">
          <button
            type="button"
            onClick={onDrawClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-white hover:bg-zinc-200 text-black font-medium text-xs transition"
          >
            <span>${ticker} 예측 그리기</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
