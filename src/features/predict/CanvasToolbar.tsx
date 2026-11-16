import { memo, useRef, useLayoutEffect, useState } from 'react';
import { RotateCcw, Layers, Minus, Plus, Trash2, Eraser } from 'lucide-react';
import { formatPct } from '../../domain/format';
import { useI18n } from '../../lib/i18nCore';
import type { AnchorPoint, ForecastVersion, MarketBar } from '../../domain/types';

interface CanvasToolbarProps {
  ticker: string;
  basePrice: number;
  horizonDays: number;
  lookbackDays: number;
  minLookbackDays: number;
  maxLookbackDays: number;
  pathCompleted: boolean;
  readOnly: boolean;
  anchorsCount: number;
  selectedAnchor: AnchorPoint | null;
  chartStyle: 'line' | 'candles';
  showConsensus: boolean;
  hasConsensusBand: boolean;
  isConsensusUnlocked: boolean;
  initialVersion: ForecastVersion | null;
  showInitialVersion: boolean;
  headerSubtitle?: string;
  hideAssetBadge?: boolean;
  blindMode?: boolean;
  hoveredDay: number | null;
  hoverPrice: number | null;
  hoverPctDelta: number | null;
  snapState: { label: string; price: number } | null;
  hoveredPastBar: MarketBar | null;
  hoveredPastOffset?: number | null;
  onToggleConsensus: () => void;
  onToggleInitialVersion: () => void;
  onChangeChartStyle: (style: 'line' | 'candles') => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onResetZoom: () => void;
  onDeleteSelectedAnchor: () => void;
  onClearAnchors: () => void;
}

export const CanvasToolbar = memo(function CanvasToolbar({
  ticker,
  basePrice,
  horizonDays,
  lookbackDays,
  minLookbackDays,
  maxLookbackDays,
  pathCompleted,
  readOnly,
  anchorsCount,
  selectedAnchor,
  chartStyle,
  showConsensus,
  hasConsensusBand,
  isConsensusUnlocked,
  initialVersion,
  showInitialVersion,
  headerSubtitle,
  hideAssetBadge = false,
  blindMode = false,
  hoveredDay,
  hoverPrice,
  hoverPctDelta,
  snapState,
  hoveredPastBar,
  hoveredPastOffset = null,
  onToggleConsensus,
  onToggleInitialVersion,
  onChangeChartStyle,
  onZoomOut,
  onZoomIn,
  onResetZoom,
  onDeleteSelectedAnchor,
  onClearAnchors,
}: CanvasToolbarProps) {
  const { t } = useI18n();
  const styleSegRef = useRef<HTMLDivElement | null>(null);
  const styleBtnRefs = useRef<Record<'line' | 'candles', HTMLButtonElement | null>>({
    line: null,
    candles: null,
  });
  const [styleGlow, setStyleGlow] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  useLayoutEffect(() => {
    const updateGlow = () => {
      const btn = styleBtnRefs.current[chartStyle];
      const wrap = styleSegRef.current;
      if (!btn || !wrap) return;
      setStyleGlow({
        left: btn.offsetLeft,
        top: btn.offsetTop,
        width: btn.offsetWidth,
        height: btn.offsetHeight,
        ready: true,
      });
    };
    updateGlow();
    const wrap = styleSegRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(updateGlow);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [chartStyle]);

  const formatBarLevel = (val: number) => {
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
      {/* Left: Asset Quote (when standalone) + Live Hover OHLC/Forecast Readout */}
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
                {t('블라인드', 'BLIND')}
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
            className={`inline-flex items-center gap-2 op-mono text-[11.5px] truncate ${
              hideAssetBadge ? '' : 'pl-2 border-l border-[var(--op-line)]'
            }`}
          >
            <span style={{ color: 'var(--op-ink-3)' }}>
              {blindMode
                ? hoveredPastOffset !== null
                  ? `D-${hoveredPastOffset}`
                  : 'D-0'
                : hoveredPastBar.date.slice(5)}
            </span>
            <span style={{ color: 'var(--op-ink-2)' }}>
              {t('시', 'O')} {formatBarLevel(hoveredPastBar.open)}
            </span>
            <span style={{ color: 'var(--op-bull)' }}>
              {t('고', 'H')} {formatBarLevel(hoveredPastBar.high)}
            </span>
            <span style={{ color: 'var(--op-bear)' }}>
              {t('저', 'L')} {formatBarLevel(hoveredPastBar.low)}
            </span>
            <span style={{ color: 'var(--op-ink)' }}>
              {t('종', 'C')} {formatBarLevel(hoveredPastBar.close)}
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
        ) : isConsensusUnlocked && showConsensus && hasConsensusBand ? (
          <span
            className={`hidden sm:inline-flex items-center gap-3 op-mono text-[11px] truncate ${
              hideAssetBadge ? '' : 'pl-2.5 border-l border-[var(--op-line)]'
            }`}
          >
            <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--op-smart)' }}>
              <span
                className="inline-block w-3 h-[2px]"
                style={{ backgroundColor: 'var(--op-smart)' }}
              />
              {t('고티어', 'Top-Tier')}
            </span>
            <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--op-ink-2)' }}>
              <span
                className="inline-block w-3 border-t border-dashed"
                style={{ borderColor: 'var(--op-crowd)' }}
              />
              {t('시장평균', 'Crowd Avg')}
            </span>
          </span>
        ) : !readOnly && anchorsCount > 0 && !pathCompleted ? (
          <span
            className={`text-[11.5px] op-mono hidden sm:inline truncate font-medium ${
              hideAssetBadge ? '' : 'pl-2 border-l border-[var(--op-line)]'
            }`}
            style={{ color: 'var(--op-orange)' }}
          >
            {t(
              `D+${horizonDays} 만기선 연결 필요`,
              `Finish at D+${horizonDays}`
            )}
          </span>
        ) : hideAssetBadge ? (
          <span
            className="op-mono text-[11px] hidden sm:inline truncate"
            style={{ color: 'var(--op-ink-3)' }}
          >
            {t('1D · 스크롤 확대/축소', '1D · Scroll to zoom')}
          </span>
        ) : null}
      </div>

      {/* Right: Touch/Key Point Delete, Path Clear, Consensus, Line/Candle, Time Zoom */}
      <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
        {!readOnly && selectedAnchor && (
          <button
            type="button"
            onClick={onDeleteSelectedAnchor}
            className="op-btn-ghost h-7 px-2 text-[11.5px]"
            style={{ borderColor: 'var(--op-bear)', color: 'var(--op-bear)' }}
            title={t(`선택한 D+${selectedAnchor.day} 점 삭제 (Delete 키)`, `Delete D+${selectedAnchor.day} anchor (Delete key)`)}
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
            title={t('그린 경로 모두 지우기', 'Clear drawn path')}
            aria-label={t('경로 지우기', 'Clear path')}
          >
            <Eraser size={11} aria-hidden="true" />
            <span className="hidden sm:inline">{t('지우기', 'Clear')}</span>
          </button>
        )}

        {isConsensusUnlocked && hasConsensusBand && (
          <button
            type="button"
            aria-pressed={showConsensus}
            onClick={onToggleConsensus}
            className="op-btn-ghost h-7 px-2 text-[11.5px]"
            style={{
              borderColor: showConsensus ? 'var(--op-smart)' : 'var(--op-line)',
              color: showConsensus ? 'var(--op-smart)' : 'var(--op-ink-3)',
            }}
          >
            {t('고티어·평균선', 'Top-Tier / Avg')}
          </button>
        )}

        {initialVersion && (
          <button
            type="button"
            aria-pressed={showInitialVersion}
            onClick={onToggleInitialVersion}
            className="op-btn-ghost h-7 px-2 text-[11.5px]"
            style={{ opacity: showInitialVersion ? 1 : 0.45 }}
          >
            <Layers size={11} aria-hidden="true" />
            {t('초기본', 'v1 Initial')}
          </button>
        )}

        {/* Line / Candle Toggle */}
        <div ref={styleSegRef} className="op-seg relative overflow-hidden">
          {styleGlow.ready && (
            <span
              aria-hidden="true"
              className="op-sliding-glow"
              style={{
                transform: `translate3d(${styleGlow.left}px, ${styleGlow.top}px, 0)`,
                width: `${styleGlow.width}px`,
                height: `${styleGlow.height}px`,
              }}
            />
          )}
          <button
            ref={el => {
              styleBtnRefs.current.line = el;
            }}
            type="button"
            aria-pressed={chartStyle === 'line'}
            data-active={chartStyle === 'line'}
            onClick={() => onChangeChartStyle('line')}
            className="op-seg-btn relative z-10"
            style={{
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              color: chartStyle === 'line' ? 'var(--op-orange)' : 'var(--op-ink-3)',
            }}
          >
            {t('라인', 'Line')}
          </button>
          <button
            ref={el => {
              styleBtnRefs.current.candles = el;
            }}
            type="button"
            aria-pressed={chartStyle === 'candles'}
            data-active={chartStyle === 'candles'}
            onClick={() => onChangeChartStyle('candles')}
            className="op-seg-btn relative z-10"
            style={{
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              color: chartStyle === 'candles' ? 'var(--op-orange)' : 'var(--op-ink-3)',
            }}
          >
            {t('캔들', 'Candles')}
          </button>
        </div>

        {/* Time Axis Zoom (- / + / Reset Zoom Only) */}
        <div
          className="op-seg"
          role="group"
          aria-label={t('과거 기간 줌 조절', 'History range zoom')}
        >
          <button
            type="button"
            disabled={lookbackDays >= maxLookbackDays}
            onClick={onZoomOut}
            className="op-seg-btn px-1.5 disabled:opacity-40"
            title={t('기간 넓히기 (마우스 휠 다운)', 'Widen range (Scroll down)')}
            aria-label={t('기간 넓히기', 'Zoom out')}
          >
            <Minus size={12} />
          </button>
          <span
            className="px-1.5 inline-flex items-center op-mono text-[11px] border-x border-[var(--op-line)] select-none"
            style={{ color: 'var(--op-ink-2)' }}
            title={t('차트 위 휠: 기간(7D~240D) 조절 · 가격축 휠/드래그: 세로 스케일', 'Scroll chart: time range (7D–240D) · Scroll or drag price axis: Y scale')}
          >
            {lookbackDays}D
          </span>
          <button
            type="button"
            disabled={lookbackDays <= minLookbackDays}
            onClick={onZoomIn}
            className="op-seg-btn px-1.5 disabled:opacity-40"
            title={t('기간 좁히기 (마우스 휠 업)', 'Narrow range (Scroll up)')}
            aria-label={t('기간 좁히기', 'Zoom in')}
          >
            <Plus size={12} />
          </button>
          <button
            type="button"
            onClick={onResetZoom}
            className="op-seg-btn px-1.5"
            title={t('줌만 초기화 (21D · 그린 경로 유지)', 'Reset zoom only (21D · keeps path)')}
            aria-label={t('줌 초기화', 'Reset zoom')}
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>
    </div>
  );
});
