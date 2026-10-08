import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Swords, ThumbsUp, CheckCircle2 } from 'lucide-react';
import type { Forecast } from '../domain/types';
import { repository } from '../data/localRepository';
import { formatPct } from '../domain/format';

interface CompactForecastCardProps {
  forecast: Forecast;
  isActiveLayer?: boolean;
  layerColor?: string;
  onToggleLayer?: (forecastId: string) => void;
  onDuel?: (forecast: Forecast) => void;
}

export function CompactForecastCard({
  forecast,
  isActiveLayer = false,
  layerColor = '#38bdf8',
  onToggleLayer,
  onDuel,
}: CompactForecastCardProps) {
  const navigate = useNavigate();
  const author = forecast.authorId ? repository.getUser(forecast.authorId) : null;
  const isLiked = repository.isLiked(forecast.id);
  const likesCount = repository.getLikesCount(forecast.id);

  // Target price and change pct calculation
  let targetPrice = forecast.basePrice;
  if (forecast.mode === 'path' && forecast.path && forecast.path.length > 0) {
    targetPrice = forecast.path[forecast.path.length - 1].price;
  } else if (forecast.mode === 'breakout' && forecast.breakout) {
    targetPrice = forecast.breakout.price;
  }

  const changePct = forecast.basePrice > 0
    ? ((targetPrice - forecast.basePrice) / forecast.basePrice) * 100
    : 0;

  const isBull = changePct >= 0;

  // Mini sparkline SVG generator
  const renderSparkline = () => {
    if (forecast.mode !== 'path' || !forecast.path || forecast.path.length === 0) {
      // Simple direct vector for breakout
      return (
        <svg width="84" height="28" viewBox="0 0 84 28" className="overflow-visible">
          <line
            x1="2"
            y1={isBull ? 22 : 6}
            x2="80"
            y2={isBull ? 6 : 22}
            stroke={isBull ? '#34d399' : '#f43f5e'}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle
            cx="80"
            cy={isBull ? 6 : 22}
            r="3.5"
            fill={isBull ? '#34d399' : '#f43f5e'}
          />
        </svg>
      );
    }

    const prices = [forecast.basePrice, ...forecast.path.map(p => p.price)];
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const w = 84;
    const h = 28;
    const pad = 4;

    const points = prices.map((p, idx) => {
      const x = pad + (idx / (prices.length - 1)) * (w - pad * 2);
      const norm = (p - min) / range;
      const y = pad + (h - pad * 2) * (1 - norm);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const d = `M ${points.join(' L ')}`;
    const lastX = pad + (w - pad * 2);
    const lastNorm = (prices[prices.length - 1] - min) / range;
    const lastY = pad + (h - pad * 2) * (1 - lastNorm);

    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <path
          d={d}
          fill="none"
          stroke={isActiveLayer ? layerColor : (isBull ? '#34d399' : '#f43f5e')}
          strokeWidth={isActiveLayer ? "2.5" : "2"}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={lastX}
          cy={lastY}
          r="3"
          fill={isActiveLayer ? layerColor : (isBull ? '#34d399' : '#f43f5e')}
        />
      </svg>
    );
  };

  const handleCardClick = () => {
    navigate(`/f/${forecast.id}`);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    repository.toggleLike(forecast.id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleLayer) onToggleLayer(forecast.id);
  };

  const handleDuelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDuel) {
      onDuel(forecast);
    } else {
      navigate(`/draw?parent=${forecast.id}&ticker=${forecast.ticker}&horizon=${forecast.horizon}&mode=${forecast.mode}`);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group relative flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
        isActiveLayer
          ? 'bg-[#0f1422] border-sky-500/50 shadow-md shadow-sky-500/10'
          : 'bg-[#0d0f14] border-[#1f222b] hover:border-[#2f3545] hover:bg-[#12151d]'
      }`}
    >
      {/* Active Layer Indicator Line */}
      {isActiveLayer && (
        <span
          className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
          style={{ backgroundColor: layerColor }}
        />
      )}

      {/* Left: Author & Stance */}
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <img
          src={author?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
          alt={author?.name || '익명'}
          className="w-8 h-8 rounded-full object-cover border border-[#272a33] flex-shrink-0"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-white truncate max-w-[100px] sm:max-w-[130px]">
              {author?.name || '익명 예측가'}
            </span>
            {author && (
              <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
                @{author.handle}
              </span>
            )}
            {author && author.completedCount > 5 && (
              <CheckCircle2 size={12} className="text-sky-400 flex-shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={`text-[11px] font-mono font-bold px-1.5 py-0.2 rounded ${
                isBull
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              {isBull ? '▲' : '▼'} {formatPct(changePct)}
            </span>
            <span className="text-[11px] text-[#8e95a5] font-mono">
              ${targetPrice.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Center: Sparkline */}
      <div className="hidden xs:flex items-center justify-center px-2 flex-shrink-0">
        {renderSparkline()}
      </div>

      {/* Right: Actions (Layer Toggle + Duel + Like) */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Layer View Toggle Button */}
        {onToggleLayer && forecast.mode === 'path' && (
          <button
            type="button"
            onClick={handleToggle}
            title={isActiveLayer ? "메인 차트에서 숨기기" : "메인 차트에 오버레이하기"}
            className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition ${
              isActiveLayer
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : 'bg-[#161922] text-zinc-400 hover:text-white border border-[#242836]'
            }`}
          >
            {isActiveLayer ? <Eye size={14} /> : <EyeOff size={14} />}
            <span className="text-[11px] hidden sm:inline">
              {isActiveLayer ? '차트 On' : '오버레이'}
            </span>
          </button>
        )}

        {/* Duel Button */}
        <button
          type="button"
          onClick={handleDuelClick}
          title="이 예측에 반박선 긋기"
          className="p-1.5 rounded-lg bg-[#161922] text-zinc-400 hover:text-amber-400 hover:border-amber-500/30 border border-[#242836] text-xs flex items-center gap-1 transition"
        >
          <Swords size={14} />
          <span className="text-[11px] hidden md:inline">반박</span>
        </button>

        {/* Agree / Like Button */}
        <button
          type="button"
          onClick={handleLike}
          className={`px-2 py-1.5 rounded-lg text-xs flex items-center gap-1 border transition ${
            isLiked
              ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
              : 'bg-[#161922] text-zinc-400 hover:text-white border-[#242836]'
          }`}
        >
          <ThumbsUp size={12} className={isLiked ? 'fill-sky-400' : ''} />
          <span className="text-[11px] font-mono">{likesCount}</span>
        </button>
      </div>
    </div>
  );
}
