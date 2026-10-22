import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ThumbsUp } from 'lucide-react';
import type { Forecast } from '../domain/types';
import { repository } from '../data/localRepository';
import { getStockHistory, STOCKS } from '../data/market';
import { deriveForecastStatus } from '../domain/lifecycle';
import { resolveForecast } from '../domain/resolution';
import { formatPct, formatRelativeTime } from '../domain/format';
import {
  getEloTierInfo,
  DEFAULT_ELO,
  calculateEloProjection,
  formatSignedLp,
} from '../domain/elo';

interface CompactForecastCardProps {
  forecast: Forecast;
  currentDateStr?: string;
  isActiveLayer?: boolean;
  layerColor?: string;
  onToggleLayer?: (forecastId: string) => void;
  borderless?: boolean;
}

export function CompactForecastCard({
  forecast,
  currentDateStr = '2026-10-05',
  isActiveLayer = false,
  layerColor = '#e4e4e7',
  onToggleLayer,
  borderless = false,
}: CompactForecastCardProps) {
  const navigate = useNavigate();
  const author = forecast.authorId ? repository.getUser(forecast.authorId) : null;
  const authorElo = author?.elo ?? DEFAULT_ELO;
  const tierInfo = getEloTierInfo(authorElo);
  const isLiked = repository.isLiked(forecast.id);
  const likesCount = repository.getLikesCount(forecast.id);

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

  const status = deriveForecastStatus(forecast, currentDateStr);
  const stockMeta = STOCKS.find(s => s.ticker === forecast.ticker) || STOCKS[0];

  const resolvedData = React.useMemo(() => {
    if (status !== 'RESOLVED') return null;
    const bars = getStockHistory(forecast.ticker).filter(b => b.date <= currentDateStr);
    return resolveForecast(forecast, bars);
  }, [forecast, status, currentDateStr]);

  const eloProjection = React.useMemo(
    () => calculateEloProjection(changePct, undefined, stockMeta.volatility),
    [changePct, stockMeta.volatility]
  );

  const renderSparkline = () => {
    if (forecast.mode !== 'path' || !forecast.path || forecast.path.length === 0) {
      return null;
    }

    const prices = [forecast.basePrice, ...forecast.path.map(p => p.price)];
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const w = 84;
    const h = 26;
    const pad = 3;

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
          stroke={isActiveLayer ? layerColor : (isBull ? '#10b981' : '#f43f5e')}
          strokeWidth={isActiveLayer ? '2.2' : '1.75'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={lastX}
          cy={lastY}
          r="2.5"
          fill={isActiveLayer ? layerColor : (isBull ? '#10b981' : '#f43f5e')}
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

  return (
    <div
      onClick={handleCardClick}
      className={`group relative flex items-center justify-between gap-4 px-4 py-3.5 transition-colors cursor-pointer ${
        borderless
          ? isActiveLayer
            ? 'bg-zinc-900/80 text-zinc-100'
            : 'bg-zinc-950 hover:bg-zinc-900/40 text-zinc-100'
          : isActiveLayer
          ? 'rounded-lg border border-zinc-600 bg-zinc-900 text-zinc-100'
          : 'rounded-lg border border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900/30 text-zinc-100'
      }`}
    >
      {isActiveLayer && (
        <span
          className="absolute left-0 top-2 bottom-2 w-1 rounded-r"
          style={{ backgroundColor: layerColor }}
        />
      )}

      {/* Column 1: Deployment Target & Thesis */}
      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-shrink-0 font-mono">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                status === 'RESOLVED'
                  ? resolvedData?.directionHit
                    ? 'bg-emerald-400'
                    : 'bg-zinc-500'
                  : 'bg-emerald-400'
              }`}
              title={status === 'RESOLVED' ? '정산 완료' : '진행 중'}
            />
            <span className="text-xs font-semibold text-zinc-100">
              ${forecast.ticker}
            </span>
            <span
              className={`text-xs font-semibold ${
                isBull ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatPct(changePct)}
            </span>
            <span className="text-xs text-zinc-400">
              (${targetPrice.toFixed(1)})
            </span>
          </div>

          {forecast.comment && (
            <span className="text-xs text-zinc-400 truncate max-w-[360px]">
              {forecast.comment}
            </span>
          )}
        </div>
      </div>

      {/* Column 2: 5D Sparkline & Quantitative Elo Stake / Settlement */}
      <div className="hidden md:flex items-center gap-4 flex-shrink-0">
        {renderSparkline()}

        <div className="w-32 text-right font-mono">
          {resolvedData?.eloSettlement ? (
            <div className="inline-flex items-center gap-1.5 text-xs">
              {resolvedData.score && (
                <span className="text-zinc-400">{resolvedData.score.total}점</span>
              )}
              <span
                className={`font-semibold ${
                  resolvedData.eloSettlement.deltaLp >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatSignedLp(resolvedData.eloSettlement.deltaLp)}
              </span>
            </div>
          ) : (
            <div className="text-[11px] text-zinc-400">
              <span className="text-emerald-400 font-medium">+{eloProjection.expectedWinLp}</span>
              <span className="text-zinc-600"> / </span>
              <span className="text-rose-400">{eloProjection.expectedLossLp} LP</span>
            </div>
          )}
        </div>
      </div>

      {/* Column 3: Author Scope & Actions */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="hidden sm:flex items-center gap-2 text-right">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-zinc-300 font-sans font-medium truncate max-w-[90px]">
              {author?.name || '익명'}
            </span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded border ${tierInfo.badgeClass}`}>
              {tierInfo.tier}
            </span>
            <span className="text-zinc-500 text-[11px] hidden lg:inline">
              {formatRelativeTime(forecast.lockedAt)}
            </span>
          </div>
          <img
            src={author?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
            alt={author?.name || '익명'}
            className="w-6 h-6 rounded-full object-cover border border-zinc-800 flex-shrink-0"
          />
        </div>

        {onToggleLayer && forecast.mode === 'path' && (
          <button
            type="button"
            onClick={handleToggle}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition ${
              isActiveLayer
                ? 'bg-zinc-100 text-black'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700'
            }`}
          >
            {isActiveLayer ? <Eye size={12} /> : <EyeOff size={12} />}
            <span className="text-[11px] hidden sm:inline">
              {isActiveLayer ? '표시 중' : '비교'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={handleLike}
          className={`px-2 py-1 rounded-md text-xs font-mono flex items-center gap-1 border transition ${
            isLiked
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-100 hover:border-zinc-700'
          }`}
        >
          <ThumbsUp size={11} className={isLiked ? 'fill-rose-500' : ''} />
          <span className="text-[11px]">{likesCount}</span>
        </button>
      </div>
    </div>
  );
}
