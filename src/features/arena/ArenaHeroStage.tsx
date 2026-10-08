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

const LAYER_COLORS = ['#f59e0b', '#c084fc', '#34d399', '#f43f5e', '#38bdf8'];

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
    <div className="relative w-full bg-[#0a0c11] border-b border-[#1b1e26] p-3 sm:p-5">
      {/* Top Controls: Ticker Info & Horizon/Mode Switchers */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-bold font-mono text-white">
                ${ticker}
              </span>
              <span className="text-xs sm:text-sm text-zinc-400 font-medium">
                {arenaSummary.name}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#141824] border border-[#23293d] text-white">
                ${basePrice.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
              <span className="flex items-center gap-1">
                <Users size={12} className="text-sky-400" />
                {arenaSummary.participantsCount}명 참여 중
              </span>
              <span>·</span>
              <span className="text-emerald-400 font-medium">
                Bull {arenaSummary.bullPct}%
              </span>
              <span>·</span>
              <span className="text-rose-400 font-medium">
                Bear {arenaSummary.bearPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Switchers (Horizon & Mode) */}
        <div className="flex items-center gap-2">
          {/* Horizon Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-[#11131a] border border-[#1f2330]">
            {(['5D', '30D'] as Horizon[]).map(h => (
              <button
                key={h}
                type="button"
                onClick={() => onHorizonChange(h)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold font-mono transition ${
                  horizon === h
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {h}
              </button>
            ))}
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-[#11131a] border border-[#1f2330]">
            {(['path', 'breakout'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  mode === m
                    ? 'bg-[#222736] text-white'
                    : 'text-zinc-400 hover:text-white'
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
        <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
          <span className="text-[11px] text-zinc-400 font-medium flex-shrink-0">
            비교 오버레이:
          </span>
          {activeLayerForecasts.map((f, idx) => {
            const color = LAYER_COLORS[idx % LAYER_COLORS.length];
            const author = f.authorId ? f.authorId.replace('u_', '') : '익명';

            return (
              <div
                key={f.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-[#111420] flex-shrink-0"
                style={{ borderColor: `${color}60`, color }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span>@{author}</span>
                <button
                  type="button"
                  onClick={() => onRemoveLayer(f.id)}
                  className="p-0.5 hover:bg-white/10 rounded transition"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Integrated Chart Canvas */}
      <div className="relative w-full aspect-[16/9] max-h-[360px] rounded-2xl bg-[#06070a] border border-[#1b1f2b] overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full block"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Past price gradient */}
            <linearGradient id="pastAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#475569" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#475569" stopOpacity="0.0" />
            </linearGradient>

            {/* Crowd consensus gradient */}
            <linearGradient id="consensusGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
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
                  stroke="#161822"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <text
                  x={width - padX + 4}
                  y={y + 3}
                  fill="#4b5563"
                  fontSize="9"
                  fontFamily="monospace"
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
            stroke="#262b3d"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text
            x={baseX}
            y={height - padY + 22}
            fill="#71767b"
            fontSize="10"
            fontFamily="monospace"
            textAnchor="middle"
          >
            NOW (기준 시점)
          </text>

          {/* Past Market Area & Line */}
          {pastAreaD && <path d={pastAreaD} fill="url(#pastAreaGrad)" />}
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
          {consensusAreaD && <path d={consensusAreaD} fill="url(#consensusGrad)" />}
          {consensusPathD && (
            <g>
              <path
                d={consensusPathD}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="6 4"
              />
              {crowd.consensusPath && crowd.consensusPath.length > 0 && (
                <circle
                  cx={getX(crowd.consensusPath[crowd.consensusPath.length - 1].date)}
                  cy={getY(crowd.consensusPath[crowd.consensusPath.length - 1].price)}
                  r="5"
                  fill="#38bdf8"
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
          <circle cx={baseX} cy={baseY} r="5" fill="#ffffff" />
          <circle cx={baseX} cy={baseY} r="8" fill="none" stroke="#38bdf8" strokeWidth="2" />
        </svg>

        {/* Floating Stage Legend & Info HUD */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 pointer-events-none">
          <div className="px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-[#232738] text-[11px] font-mono text-zinc-300 flex items-center gap-1.5 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span>군중 중간값: </span>
            <span className={arenaSummary.medianChangePct >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {formatPct(arenaSummary.medianChangePct)} (${arenaSummary.medianTargetPrice})
            </span>
          </div>
        </div>

        {/* Floating Call To Action: "내 선 얹기" */}
        <div className="absolute bottom-3 right-3 z-10">
          <button
            type="button"
            onClick={onDrawClick}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-sky-500/25 transition active:scale-95"
          >
            <PenTool size={16} />
            <span>이 아레나에 내 선 얹기</span>
          </button>
        </div>
      </div>
    </div>
  );
}
