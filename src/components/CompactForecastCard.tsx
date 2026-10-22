import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThumbsUp } from 'lucide-react';
import type { Forecast } from '../domain/types';
import { repository } from '../data/localRepository';
import { getStockHistory, STOCKS } from '../data/market';
import { deriveForecastStatus } from '../domain/lifecycle';
import { resolveForecast } from '../domain/resolution';
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
  currentDateStr = '2026-10-02',
  isActiveLayer = false,
  layerColor = 'var(--v-cyan)',
  onToggleLayer,
  borderless = false,
}: CompactForecastCardProps) {
  const navigate = useNavigate();
  const [, setLikeTick] = useState(0);

  const author = forecast.authorId ? repository.getUser(forecast.authorId) : null;
  const authorHandle = author
    ? author.handle
    : `guest_${forecast.anonId.replace(/^anon[_-]?/i, '').slice(0, 4) || 'user'}`;
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

  const changePct =
    forecast.basePrice > 0
      ? ((targetPrice - forecast.basePrice) / forecast.basePrice) * 100
      : 0;

  const isBull = changePct >= 0;
  const status = deriveForecastStatus(forecast, currentDateStr);
  const stockMeta = STOCKS.find(s => s.ticker === forecast.ticker) || STOCKS[0];

  const resolvedData = React.useMemo(() => {
    if (status !== 'RESOLVED') return null;
    const bars = getStockHistory(forecast.ticker).filter(
      b => b.date <= currentDateStr
    );
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
    const span = Math.max(1e-4, max - min);
    const w = 88;
    const h = 24;
    const pad = 3;

    const points = prices
      .map((p, idx) => {
        const x = pad + (idx / Math.max(1, prices.length - 1)) * (w - pad * 2);
        const y = pad + (h - pad * 2) * (1 - (p - min) / span);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const lastCoords = points.split(' ').pop()?.split(',') || ['85', '12'];
    const strokeColor = isActiveLayer
      ? layerColor
      : isBull
      ? 'var(--v-bull)'
      : 'var(--v-bear)';

    return (
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="overflow-visible"
        aria-hidden="true"
      >
        <line
          x1="0"
          y1={h / 2}
          x2={w}
          y2={h / 2}
          stroke="var(--v-hairline)"
          strokeDasharray="2 2"
          strokeWidth="1"
        />
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth={isActiveLayer ? '2' : '1.5'}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        <circle
          cx={lastCoords[0]}
          cy={lastCoords[1]}
          r="2.2"
          fill={strokeColor}
        />
      </svg>
    );
  };

  return (
    <div
      onClick={() => navigate(`/f/${forecast.id}`)}
      className="relative px-5 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 transition-colors cursor-pointer"
      style={{
        backgroundColor: isActiveLayer
          ? 'var(--v-canvas-soft)'
          : 'var(--v-canvas)',
        borderBottom: borderless
          ? '1px solid var(--v-hairline-subtle)'
          : 'none',
        boxShadow: borderless ? 'none' : 'var(--v-shadow-border)',
        borderRadius: borderless ? 0 : '6px',
      }}
    >
      {isActiveLayer && (
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px]"
          style={{ backgroundColor: layerColor }}
        />
      )}

      {/* Col 1: Status + Ticker + Target + Author + Thesis */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            backgroundColor:
              status === 'RESOLVED'
                ? 'var(--v-link)'
                : isBull
                ? 'var(--v-bull)'
                : 'var(--v-bear)',
          }}
          title={status}
        />

        <div className="flex items-baseline gap-1.5 flex-shrink-0 v-mono">
          <span
            className="text-xs font-semibold"
            style={{ color: 'var(--v-ink)' }}
          >
            ${forecast.ticker}
          </span>
          <span
            className="text-xs font-semibold"
            style={{ color: isBull ? 'var(--v-bull)' : 'var(--v-bear)' }}
          >
            {isBull ? '+' : ''}
            {changePct.toFixed(2)}%
          </span>
          <span
            className="v-caption-mono"
            style={{ color: 'var(--v-body)' }}
          >
            (${targetPrice.toFixed(2)})
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              if (author) navigate(`/u/${author.handle}`);
            }}
            className="v-mono text-xs hover:underline"
            style={{ color: 'var(--v-body)' }}
          >
            @{authorHandle}
          </button>
          <span
            className="v-caption-mono px-1.5 py-0.2 rounded-[4px]"
            style={{
              backgroundColor: 'var(--v-canvas-soft-2)',
              boxShadow: 'var(--v-shadow-border)',
              color: 'var(--v-mute)',
            }}
          >
            {tierInfo.tier} · {authorElo}
          </span>
        </div>

        {forecast.comment && (
          <p
            className="v-body-sm truncate max-w-[340px] hidden md:block"
            style={{ color: 'var(--v-mute)' }}
          >
            {forecast.comment}
          </p>
        )}
      </div>

      {/* Col 2: 5D Sparkline + Quantitative Elo Stake / Settlement */}
      <div className="hidden lg:flex items-center gap-4 flex-shrink-0">
        {renderSparkline()}

        <div className="w-28 text-right v-caption-mono">
          {resolvedData?.eloSettlement ? (
            <span className="inline-flex items-center gap-1.5">
              {resolvedData.score && (
                <span style={{ color: 'var(--v-body)' }}>
                  {resolvedData.score.total.toFixed(1)} pts
                </span>
              )}
              <span
                className="font-semibold"
                style={{
                  color:
                    resolvedData.eloSettlement.deltaLp >= 0
                      ? 'var(--v-bull)'
                      : 'var(--v-bear)',
                }}
              >
                {formatSignedLp(resolvedData.eloSettlement.deltaLp)}
              </span>
            </span>
          ) : (
            <span>
              <span style={{ color: 'var(--v-bull)' }}>
                +{eloProjection.expectedWinLp}
              </span>
              <span style={{ color: 'var(--v-dim)' }}> / </span>
              <span style={{ color: 'var(--v-bear)' }}>
                {eloProjection.expectedLossLp} LP
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Col 3: Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {onToggleLayer && forecast.mode === 'path' && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onToggleLayer(forecast.id);
            }}
            className="v-btn-secondary"
            style={{
              backgroundColor: isActiveLayer
                ? 'var(--v-primary)'
                : 'var(--v-canvas)',
              color: isActiveLayer
                ? 'var(--v-on-primary)'
                : 'var(--v-ink)',
            }}
          >
            {isActiveLayer ? 'Pinned' : 'Overlay'}
          </button>
        )}

        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            navigate(`/studio/${forecast.ticker}`);
          }}
          className="v-btn-secondary"
        >
          Studio ↗
        </button>

        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            repository.toggleLike(forecast.id);
            setLikeTick(t => t + 1);
          }}
          className="v-btn-secondary px-2"
          style={{
            color: isLiked ? 'var(--v-ink)' : 'var(--v-mute)',
          }}
          title="Like trajectory"
        >
          <ThumbsUp size={11} />
          {likesCount > 0 && (
            <span className="v-caption-mono">{likesCount}</span>
          )}
        </button>

        <span
          className="v-caption-mono px-1 hover:underline"
          style={{ color: 'var(--v-mute)' }}
        >
          Receipt ↗
        </span>
      </div>
    </div>
  );
}
