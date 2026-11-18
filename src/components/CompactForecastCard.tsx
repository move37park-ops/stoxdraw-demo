import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Forecast } from '../domain/types';
import { repository } from '../data/localRepository';
import { getStockHistory } from '../data/market';
import { deriveForecastStatus } from '../domain/lifecycle';
import { resolveForecast } from '../domain/resolution';
import {
  getEloTierInfo,
  DEFAULT_ELO,
  formatSignedLp,
} from '../domain/elo';
import { localizeDataText, useI18n } from '../lib/i18nCore';
import { ForecastSparkline } from './ForecastSparkline';

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
  const { locale, t } = useI18n();

  const author = forecast.authorId ? repository.getUser(forecast.authorId) : null;
  const authorHandle = author
    ? author.handle
    : `guest_${forecast.anonId.replace(/^anon[_-]?/i, '').slice(0, 4) || 'user'}`;
  const authorElo = author?.elo ?? DEFAULT_ELO;
  const tierInfo = getEloTierInfo(authorElo);

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

  const resolvedData = React.useMemo(() => {
    if (status !== 'RESOLVED') return null;
    const bars = getStockHistory(forecast.ticker).filter(
      b => b.date <= currentDateStr
    );
    return resolveForecast(forecast, bars);
  }, [forecast, status, currentDateStr]);

  return (
    <article
      className="relative px-5 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 transition-colors"
      style={{
        backgroundColor: isActiveLayer
          ? 'var(--op-panel)'
          : 'var(--op-canvas)',
        borderBottom: borderless
          ? '1px solid var(--op-line)'
          : 'none',
        boxShadow: borderless ? 'none' : '0 0 0 1px var(--op-line)',
        borderRadius: borderless ? 0 : '2px',
      }}
    >
      {isActiveLayer && (
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px]"
          style={{ backgroundColor: layerColor }}
        />
      )}

      {/* Col 1: Status + Base Date + Ticker + Target + Author + Memo */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={() => navigate(`/f/${forecast.id}`)}
          className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group"
        >
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
            <span className="text-[11px]" style={{ color: 'var(--v-mute)' }}>
              {forecast.baseDate.slice(5)}
            </span>
            <span
              className="text-xs font-semibold group-hover:underline"
              style={{ color: 'var(--v-ink)' }}
            >
              {forecast.ticker}
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
              (${targetPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })})
            </span>
          </div>
        </button>

        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              if (author) navigate(`/u/${author.handle}`);
              else navigate(`/f/${forecast.id}`);
            }}
            className="v-mono text-xs hover:underline cursor-pointer"
            style={{ color: 'var(--v-body)' }}
          >
            @{authorHandle}
          </button>
          <span
            className="w-1.5 h-1.5 rounded-[1.5px] flex-shrink-0"
            style={{ backgroundColor: tierInfo.accentHex }}
            title={`${locale === 'en' ? tierInfo.title : tierInfo.krTitle} · ${authorElo} LP`}
            aria-hidden="true"
          />
        </div>

        {forecast.comment && (
          <button
            type="button"
            onClick={() => navigate(`/f/${forecast.id}`)}
            className="v-body-sm truncate max-w-[300px] hidden md:block text-left hover:underline cursor-pointer min-w-0"
            style={{ color: 'var(--v-mute)' }}
          >
            {localizeDataText(forecast.comment, locale)}
          </button>
        )}
      </div>

      {/* Col 2: Past + 7D Sparkline + Evaluated Score */}
      <div className="hidden lg:flex items-center gap-4 flex-shrink-0">
        <ForecastSparkline
          forecast={forecast}
          isActiveLayer={isActiveLayer}
          layerColor={layerColor}
        />

        {resolvedData?.score && (
          <div className="w-28 text-right v-caption-mono">
            <span className="inline-flex items-center gap-1.5">
              <span style={{ color: 'var(--v-ink)' }}>
                {resolvedData.score.total.toFixed(1)}{t('점', ' pts')}
              </span>
              {resolvedData.eloSettlement && (
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
              )}
            </span>
          </div>
        )}
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
            {isActiveLayer ? t('비교 중', 'Overlaid') : t('경로 겹쳐 보기', 'Overlay Path')}
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate(`/f/${forecast.id}`)}
          className="op-mono text-[11.5px] px-1.5 py-1 hover:underline cursor-pointer"
          style={{ color: 'var(--op-ink-3)' }}
        >
          {t('상세 ↗', 'Details ↗')}
        </button>
      </div>
    </article>
  );
}
