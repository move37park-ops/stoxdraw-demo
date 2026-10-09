import { PenTool, Users, X } from 'lucide-react';
import type { CrowdAggregate, Forecast, Horizon, Mode } from '../../domain/types';
import type { ArenaSummary } from '../../domain/arena';
import { getStockHistory } from '../../data/market';
import { getNextTradingDays, getHorizonTradingDays } from '../../domain/tradingCalendar';
import { formatPct } from '../../domain/format';

interface ArenaHeroStageProps {
  ticker: string;
  horizon: Horizon;
  mode: Mode;
  currentDateStr: string;
  crowd: CrowdAggregate;
  arenaSummary: ArenaSummary;
  activeLayerForecasts: Forecast[];
  onHorizonChange: (h: Horizon) => void;
  onModeChange: (m: Mode) => void;
  onDrawClick: () => void;
  onRemoveLayer: (forecastId: string) => void;
}

const LAYER_COLORS = ['#f59e0b', '#c084fc', '#10b981', '#f43f5e', '#0284c7'];

export function ArenaHeroStage({
  ticker,
  horizon,
  mode,
  currentDateStr,
  crowd,
  arenaSummary,
  activeLayerForecasts,
  onHorizonChange,
  onModeChange,
  onDrawClick,
  onRemoveLayer,
}: ArenaHeroStageProps) {
  const stockBars = getStockHistory(ticker);
  const tradingDaysCount = getHorizonTradingDays(horizon);
  const evalDates = getNextTradingDays(currentDateStr, tradingDaysCount);

  // Past 15 bars up to currentDateStr
  const pastBars = stockBars.filter(b => b.date <= currentDateStr).slice(-15);
  const basePrice = arenaSummary.currentPrice;

  // Compute all prices for vertical scale
  const allPrices: number[] = [...pastBars.map(b => b.close), basePrice];

  if (crowd.consensusPath) {
    crowd.consensusPath.forEach(p => allPrices.push(p.price));
  }

  activeLayerForecasts.forEach(f => {
    if (f.mode === 'path' && f.path) {
      f.path.forEach(p => allPrices.push(p.price));
    } else if (f.mode === 'breakout' && f.breakout) {
      allPrices.push(f.breakout.price);
    }
  });

  const rawMin = Math.min(...allPrices);
  const rawMax = Math.max(...allPrices);
  const pad = (rawMax - rawMin) * 0.18 || basePrice * 0.08;
  const minPrice = rawMin - pad;
  const maxPrice = rawMax + pad;
  const priceRange = maxPrice - minPrice || 1;

  // Dimensions
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

  // 1. Past Bars Path & Area
  let pastPathD = '';
  let pastAreaD = '';
  pastBars.forEach((b, i) => {
    const x = getX(b.date);
    const y = getY(b.close);
    if (i === 0) {
      pastPathD += `M ${x} ${y}`;
      pastAreaD += `M ${x} ${height - padY} L ${x} ${y}`;
    } else {
      pastPathD += ` L ${x} ${y}`;
      pastAreaD += ` L ${x} ${y}`;
    }
  });
  if (pastBars.length > 0) {
    const lastPast = pastBars[pastBars.length - 1];
    pastAreaD += ` L ${getX(lastPast.date)} ${height - padY} Z`;
  }

  // 2. Crowd Consensus Path
  let consensusPathD = '';
  let consensusAreaD = '';
  if (crowd.consensusPath && crowd.consensusPath.length > 0) {
    consensusPathD = `M ${baseX} ${baseY}`;
    consensusAreaD = `M ${baseX} ${baseY}`;
    crowd.consensusPath.forEach(p => {
      consensusPathD += ` L ${getX(p.date)} ${getY(p.price)}`;
      consensusAreaD += ` L ${getX(p.date)} ${getY(p.price)}`;
    });
    const lastP = crowd.consensusPath[crowd.consensusPath.length - 1];
    consensusAreaD += ` L ${getX(lastP.date)} ${baseY} Z`;
  }

  // Grid levels
  const gridSteps = [0.2, 0.4, 0.6, 0.8];

  return (
    <div className="relative w-full bg-white dark:bg-[#0c0e14] border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-sm mb-6">
      {/* Top Controls: Ticker Info & Horizon/Mode Switchers */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-zinc-900 dark:text-white">
              ${ticker}
            </span>
            <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              {arenaSummary.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white">
              ${basePrice.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            <span className="flex items-center gap-1 font-medium">
              <Users size={13} className="text-sky-500" />
              {arenaSummary.participantsCount}명 참여 중
            </span>
            <span>·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              Bull {arenaSummary.bullPct}%
            </span>
            <span>·</span>
            <span className="text-rose-500 dark:text-rose-400 font-semibold">
              Bear {arenaSummary.bearPct}%
            </span>
          </div>
        </div>

        {/* Switchers (Horizon & Mode) with Pill Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Horizon Toggle */}
          <div className="flex items-center p-1 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60">
            {(['5D', '30D'] as Horizon[]).map(h => (
              <button
                key={h}
                type="button"
                onClick={() => onHorizonChange(h)}
                className={`px-3 py-1 rounded-full text-xs font-semibold font-mono transition ${
                  horizon === h
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {h}
              </button>
            ))}
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center p-1 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60">
            {(['path', 'breakout'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  mode === m
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {m === 'path' ? '경로' : '돌파'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Layer Forecasters Badge Bar */}
      {activeLayerForecasts.length > 0 && (
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
          <span className="text-xs text-zinc-500 font-medium flex-shrink-0">
            비교 오버레이:
          </span>
          {activeLayerForecasts.map((f, idx) => {
            const color = LAYER_COLORS[idx % LAYER_COLORS.length];
            const author = f.authorId ? f.authorId.replace('u_', '') : '익명';

            return (
              <div
                key={f.id}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-white dark:bg-zinc-800/80 flex-shrink-0 shadow-sm"
                style={{ borderColor: `${color}80`, color }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span>@{author}</span>
                <button
                  type="button"
                  onClick={() => onRemoveLayer(f.id)}
                  className="p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-full transition ml-0.5"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Integrated Chart Canvas */}
      <div className="relative w-full aspect-[16/9] max-h-[380px] rounded-2xl bg-zinc-50/80 dark:bg-[#07080b] border border-zinc-200/80 dark:border-zinc-800 overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full block"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="arenaPastGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64748b" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#64748b" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="arenaConsensusGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines & price labels */}
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
                  className="text-zinc-200 dark:text-zinc-800"
                />
                <text
                  x={width - padX + 4}
                  y={y + 3}
                  className="fill-zinc-400 font-mono text-[9px]"
                  textAnchor="start"
                >
                  ${priceVal.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Dividing vertical line at Base Date (Now) */}
          <line
            x1={baseX}
            y1={padY - 10}
            x2={baseX}
            y2={height - padY + 10}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            className="text-zinc-300 dark:text-zinc-700"
          />
          <text
            x={baseX}
            y={height - padY + 22}
            className="fill-zinc-400 font-mono text-[10px]"
            textAnchor="middle"
          >
            NOW (기준 시점)
          </text>

          {/* Past Market Area & Line */}
          {pastAreaD && <path d={pastAreaD} fill="url(#arenaPastGrad)" />}
          {pastPathD && (
            <path
              d={pastPathD}
              fill="none"
              stroke="#64748b"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Crowd Consensus Area & Line */}
          {consensusAreaD && <path d={consensusAreaD} fill="url(#arenaConsensusGrad)" />}
          {consensusPathD && (
            <g>
              <path
                d={consensusPathD}
                fill="none"
                stroke="#0284c7"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="6 4"
              />
              {crowd.consensusPath && crowd.consensusPath.length > 0 && (
                <circle
                  cx={getX(crowd.consensusPath[crowd.consensusPath.length - 1].date)}
                  cy={getY(crowd.consensusPath[crowd.consensusPath.length - 1].price)}
                  r="5"
                  fill="#0284c7"
                />
              )}
            </g>
          )}

          {/* Active Forecasters' Layers */}
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
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx={getX(lastP.date)}
                    cy={getY(lastP.price)}
                    r="4.5"
                    fill={color}
                  />
                </g>
              );
            }
            return null;
          })}

          {/* Base Anchor Point */}
          <circle cx={baseX} cy={baseY} r="5" className="fill-zinc-900 dark:fill-white" />
          <circle cx={baseX} cy={baseY} r="8" fill="none" stroke="#0284c7" strokeWidth="2" />
        </svg>

        {/* Floating HUD Label */}
        <div className="absolute top-3.5 left-3.5 flex flex-wrap items-center gap-2 pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-white/90 dark:bg-black/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200 flex items-center gap-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <span>군중 중간값: </span>
            <span className={arenaSummary.medianChangePct >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-500 dark:text-rose-400 font-bold'}>
              {formatPct(arenaSummary.medianChangePct)} (${arenaSummary.medianTargetPrice})
            </span>
          </div>
        </div>

        {/* Floating Primary CTA: Black Pill Button */}
        <div className="absolute bottom-3.5 right-3.5 z-10">
          <button
            type="button"
            onClick={onDrawClick}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs sm:text-sm shadow-xl active:scale-95 transition"
          >
            <PenTool size={15} />
            <span>이 아레나에 내 선 얹기</span>
          </button>
        </div>
      </div>
    </div>
  );
}
