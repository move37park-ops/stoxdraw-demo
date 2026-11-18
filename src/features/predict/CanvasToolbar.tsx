import { memo } from 'react';
import { RotateCcw, Minus, Plus, Trash2, Eraser } from 'lucide-react';
import { formatPct } from '../../domain/format';
import { useI18n } from '../../lib/i18nCore';
import type { AnchorPoint, MarketBar } from '../../domain/types';

interface CanvasToolbarProps {
  ticker: string;
  basePrice: number;
  lookbackDays: number;
  minLookbackDays: number;
  maxLookbackDays: number;
  readOnly: boolean;
  anchorsCount: number;
  selectedAnchor: AnchorPoint | null;
  hasConsensusBand: boolean;
  isConsensusUnlocked: boolean;
  headerSubtitle?: string;
  hideAssetBadge?: boolean;
  blindMode?: boolean;
  hoveredDay: number | null;
  hoverPrice: number | null;
  hoverPctDelta: number | null;
  snapState: { label: string; price: number } | null;
  hoveredPastBar: MarketBar | null;
  hoveredPastOffset?: number | null;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onResetZoom: () => void;
  onDeleteSelectedAnchor: () => void;
  onClearAnchors: () => void;
}

export const CanvasToolbar = memo(function CanvasToolbar({
  ticker,
  basePrice,
  lookbackDays,
  minLookbackDays,
  maxLookbackDays,
  readOnly,
  anchorsCount,
  selectedAnchor,
  hasConsensusBand,
  isConsensusUnlocked,
  headerSubtitle,
  hideAssetBadge = false,
  blindMode = false,
  hoveredDay,
  hoverPrice,
  hoverPctDelta,
  snapState,
  hoveredPastBar,
  hoveredPastOffset = null,
  onZoomOut,
  onZoomIn,
  onResetZoom,
  onDeleteSelectedAnchor,
  onClearAnchors,
}: CanvasToolbarProps) {
  const { t } = useI18n();

  const formatBarClose = (val: number) => {
    if (blindMode) {
      const pct = basePrice > 0 ? ((val - basePrice) / basePrice) * 100 : 0;
      return formatPct(pct);
    }
    return `$${Math.round(val).toLocaleString('en-US')}`;
  };

  return (
    <div
      className="px-3.5 py-2 flex flex-wrap xl:flex-nowrap items-center justify-between gap-2"
      style={{
        backgroundColor: 'var(--op-canvas)',
        borderBottom: '1px solid var(--op-line)',
      }}
    >
      {/* Left: Standalone Quote + Hover Readout or 3-Line Legend / Concise Guide */}
      <div className="flex items-center gap-2 min-w-0">
        {!hideAssetBadge && (
          blindMode ? (
            <>
              <span
                className="op-mono text-[11px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-[2px] flex-shrink-0"
                style={{
                  backgroundColor: 'var(--op-raised)',
                  color: 'var(--op-orange)',
                  border: '1px solid var(--op-line-strong)',
                }}
              >
                {t('비공개', 'BLIND')}
              </span>
              <span
                className="op-mono text-[14px] font-semibold flex-shrink-0"
                style={{ color: 'var(--op-ink)' }}
              >
                0.00%
              </span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <img
                  src="/btc-logo.png"
                  alt=""
                  width={20}
                  height={20}
                  className="w-5 h-5 rounded-full flex-shrink-0 object-contain"
                  aria-hidden="true"
                />
                <span className="text-[13.5px] font-semibold tracking-tight" style={{ color: 'var(--op-ink)' }}>
                  {ticker === 'BTC/USDT' ? 'BTC' : ticker}
                </span>
              </div>

              <span
                className="op-mono text-[14.5px] font-semibold flex-shrink-0"
                style={{ color: 'var(--op-ink)' }}
              >
                ${basePrice.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </>
          )
        )}

        {hoveredDay !== null && hoverPrice !== null && hoverPctDelta !== null ? (
          <span
            className={`inline-flex items-center gap-2 op-mono text-[12px] truncate ${
              hideAssetBadge ? '' : 'pl-2 border-l border-[var(--op-line)]'
            }`}
          >
            <span style={{ color: 'var(--op-orange)' }}>D+{hoveredDay}</span>
            {!blindMode && (
              <span style={{ color: 'var(--op-ink)' }}>
                ${Math.round(hoverPrice).toLocaleString('en-US')}
              </span>
            )}
            <span style={{ color: hoverPctDelta >= 0 ? 'var(--op-bull)' : 'var(--op-bear)' }}>
              {formatPct(hoverPctDelta)}
            </span>
            {snapState && (
              <span
                className="px-1.5 py-0.5 text-[10px]"
                style={{
                  backgroundColor: 'var(--op-orange-soft)',
                  color: 'var(--op-orange)',
                  border: '1px solid var(--op-orange)',
                  borderRadius: '2px',
                }}
              >
                {t('자석', 'Snap')} · {snapState.label}
              </span>
            )}
          </span>
        ) : hoveredPastBar ? (
          <span
            className={`inline-flex items-center gap-2 op-mono text-[12px] truncate ${
              hideAssetBadge ? '' : 'pl-2 border-l border-[var(--op-line)]'
            }`}
          >
            <span style={{ color: 'var(--op-ink-3)' }}>
              {blindMode
                ? hoveredPastOffset !== null
                  ? `D-${hoveredPastOffset}`
                  : 'D0'
                : hoveredPastBar.date.slice(5)}
            </span>
            <span style={{ color: 'var(--op-ink)' }}>
              {formatBarClose(hoveredPastBar.close)}
            </span>
          </span>
        ) : isConsensusUnlocked && hasConsensusBand ? (
          <span
            className={`inline-flex items-center gap-3 op-mono text-[11px] truncate ${
              hideAssetBadge ? '' : 'pl-2.5 border-l border-[var(--op-line)]'
            }`}
          >
            <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--op-orange)' }}>
              <span className="inline-block w-3 h-[2px]" style={{ backgroundColor: 'var(--op-orange)' }} />
              {t('내 예측', 'My Forecast')}
            </span>
            <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--op-smart)' }}>
              <span className="inline-block w-3 border-t-2 border-dashed" style={{ borderColor: 'var(--op-smart)' }} />
              {t('집단 경로', 'Crowd Path')}
            </span>
            <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--op-bull)' }}>
              <span className="inline-block w-3 h-[2px]" style={{ backgroundColor: 'var(--op-bull)' }} />
              {t('실제 가격', 'Actual')}
            </span>
          </span>
        ) : headerSubtitle ? (
          <span
            className={`text-[12px] hidden sm:inline truncate ${
              hideAssetBadge ? '' : 'pl-2 border-l border-[var(--op-line)]'
            }`}
            style={{ color: 'var(--op-ink-2)' }}
          >
            {headerSubtitle}
          </span>
        ) : !readOnly ? (
          <span
            className={`text-[11.5px] hidden sm:inline truncate ${
              hideAssetBadge ? '' : 'pl-2 border-l border-[var(--op-line)]'
            }`}
            style={{ color: 'var(--op-ink-3)' }}
          >
            {t('D0 우측 영역을 클릭해 최대 5개 예측 지점을 연결하세요', 'Click right of D0 to plot up to 5 forecast points')}
          </span>
        ) : null}
      </div>

      {/* Right: Anchor Delete, Clear, and Time Zoom (- / 21D / + / Reset) */}
      <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
        {!readOnly && selectedAnchor && (
          <button
            type="button"
            onClick={onDeleteSelectedAnchor}
            className="op-btn-ghost h-7 px-2 text-[11.5px]"
            style={{ borderColor: 'var(--op-bear)', color: 'var(--op-bear)' }}
            title={t(`선택한 D+${selectedAnchor.day} 지점 삭제`, `Delete D+${selectedAnchor.day} point`)}
          >
            <Trash2 size={11} aria-hidden="true" />
            <span>{t(`D+${selectedAnchor.day} 삭제`, `Del D+${selectedAnchor.day}`)}</span>
          </button>
        )}

        {!readOnly && anchorsCount > 0 && (
          <button
            type="button"
            onClick={onClearAnchors}
            className="op-btn-ghost h-7 px-2 text-[11.5px]"
            title={t('그린 예측 경로 모두 지우기', 'Clear drawn path')}
            aria-label={t('예측 경로 지우기', 'Clear path')}
          >
            <Eraser size={11} aria-hidden="true" />
            <span className="hidden sm:inline">{t('지우기', 'Clear')}</span>
          </button>
        )}

        <div
          className="op-seg"
          role="group"
          aria-label={t('표시 기간 줌 조절', 'History range zoom')}
        >
          <button
            type="button"
            disabled={lookbackDays >= maxLookbackDays}
            onClick={onZoomOut}
            className="op-seg-btn px-1.5 disabled:opacity-40"
            title={t('표시 기간 늘리기', 'Zoom out')}
            aria-label={t('표시 기간 늘리기', 'Zoom out')}
          >
            <Minus size={12} />
          </button>
          <span
            className="px-1.5 inline-flex items-center op-mono text-[11px] border-x border-[var(--op-line)] select-none"
            style={{ color: 'var(--op-ink-2)' }}
          >
            {lookbackDays}D
          </span>
          <button
            type="button"
            disabled={lookbackDays <= minLookbackDays}
            onClick={onZoomIn}
            className="op-seg-btn px-1.5 disabled:opacity-40"
            title={t('표시 기간 줄이기', 'Zoom in')}
            aria-label={t('표시 기간 줄이기', 'Zoom in')}
          >
            <Plus size={12} />
          </button>
          <button
            type="button"
            onClick={onResetZoom}
            className="op-seg-btn px-1.5"
            title={t('줌 초기화 (21D)', 'Reset zoom (21D)')}
            aria-label={t('확대·축소 초기화', 'Reset zoom')}
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>
    </div>
  );
});
