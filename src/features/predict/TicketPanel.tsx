import { useState, useRef, useLayoutEffect } from 'react';
import { Lock, Share2, ShieldCheck } from 'lucide-react';
import { formatPct } from '../../domain/format';
import {
  normalizeAnchors,
  MAX_ANCHORS,
  type TrajectoryPresetId,
} from '../../domain/interpolation';
import { analyzeUserPath } from '../../domain/report';
import { useI18n } from '../../lib/i18nCore';
import type {
  AnchorPoint,
  EloProjection,
  EloSettlement,
  Forecast,
  ScoreBreakdown,
} from '../../domain/types';

interface TicketPanelProps {
  basePrice: number;
  evalDates: string[];
  anchors: AnchorPoint[];
  interpolatedPrices: number[];
  pathCompleted: boolean;
  isSubmitted: boolean;
  isRoundOpen?: boolean;
  roundStatus?: 'OPEN' | 'LIVE' | 'RESOLVED';
  myForecast: Forecast | null;
  eloProjection: EloProjection;
  liveTrackingScore: ScoreBreakdown | null;
  liveTrackingSettlement: EloSettlement | null;
  settledCount: number;
  commentText: string;
  onChangeComment: (next: string) => void;
  onSubmit: () => void;
  onResetToToday?: () => void;
  onOpenGuide?: () => void;
  onOpenShare: (forecast: Forecast) => void;
  onViewDetail: (forecastId: string) => void;
  onApplyPreset?: (preset: TrajectoryPresetId) => void;
  activePreset?: TrajectoryPresetId | null;
}

const SCENARIO_TABS: { id: TrajectoryPresetId; ko: string; en: string }[] = [
  { id: 'pullback_bounce', ko: '하락 후 반등', en: 'Dip & Rally' },
  { id: 'breakout', ko: '눌림 후 돌파', en: 'Pullback Breakout' },
  { id: 'bear_slide', ko: '고점 후 하락', en: 'Peak & Pullback' },
];

export function TicketPanel({
  basePrice,
  evalDates,
  anchors,
  interpolatedPrices,
  pathCompleted,
  isSubmitted,
  isRoundOpen = true,
  roundStatus = 'OPEN',
  myForecast,
  eloProjection,
  liveTrackingScore,
  liveTrackingSettlement,
  settledCount,
  commentText,
  onChangeComment,
  onSubmit,
  onResetToToday,
  onOpenGuide: _onOpenGuide,
  onOpenShare,
  onViewDetail,
  onApplyPreset,
  activePreset,
}: TicketPanelProps) {
  const { locale, t } = useI18n();
  const [localSelectedPreset, setLocalSelectedPreset] = useState<TrajectoryPresetId | null>(null);
  const selectedPreset = activePreset !== undefined ? activePreset : localSelectedPreset;
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);
  const showConfirmSubmit =
    isConfirmingSubmit && pathCompleted && isRoundOpen && !isSubmitted;
  const scenarioWrapRef = useRef<HTMLDivElement>(null);
  const scenarioBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [scenarioGlow, setScenarioGlow] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    ready: boolean;
  }>({ left: 0, top: 0, width: 0, height: 0, ready: false });

  const activeScenarioIdx =
    pathCompleted && selectedPreset
      ? SCENARIO_TABS.findIndex(item => item.id === selectedPreset)
      : -1;

  useLayoutEffect(() => {
    const syncGlow = () => {
      const btn = activeScenarioIdx >= 0 ? scenarioBtnRefs.current[activeScenarioIdx] : null;
      if (!btn) {
        setScenarioGlow(prev => (prev.ready ? { ...prev, ready: false } : prev));
        return;
      }
      setScenarioGlow({
        left: btn.offsetLeft,
        top: btn.offsetTop,
        width: btn.offsetWidth,
        height: btn.offsetHeight,
        ready: btn.offsetWidth > 0,
      });
    };

    syncGlow();
    const wrap = scenarioWrapRef.current;
    let observer: ResizeObserver | null = null;
    if (wrap && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(syncGlow);
      observer.observe(wrap);
    }
    window.addEventListener('resize', syncGlow);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncGlow);
    };
  }, [activeScenarioIdx, locale]);
  const horizonDays = evalDates.length || 7;
  const sortedAnchors = normalizeAnchors(anchors, horizonDays, MAX_ANCHORS);

  const finalTargetPrice =
    pathCompleted && interpolatedPrices.length > 0
      ? interpolatedPrices[interpolatedPrices.length - 1]
      : null;
  const finalChangePct =
    finalTargetPrice !== null && basePrice > 0
      ? ((finalTargetPrice - basePrice) / basePrice) * 100
      : null;

  const expiryShort =
    evalDates[evalDates.length - 1]?.slice(5).replace('-', '.') || `D+${horizonDays}`;

  const pathAnalysis =
    pathCompleted && interpolatedPrices.length > 0
      ? analyzeUserPath(basePrice, interpolatedPrices, locale)
      : null;

  const troughPoint = (() => {
    if (!pathCompleted || interpolatedPrices.length === 0) return null;
    let minPrice = interpolatedPrices[0];
    let minDay = 1;
    interpolatedPrices.forEach((p, idx) => {
      if (p < minPrice) {
        minPrice = p;
        minDay = idx + 1;
      }
    });
    return { price: minPrice, day: minDay };
  })();

  const isLockedReadOnly = isSubmitted || !isRoundOpen;

  const handleSelectScenario = (presetId: TrajectoryPresetId) => {
    if (isLockedReadOnly) return;
    setLocalSelectedPreset(presetId);
    onApplyPreset?.(presetId);
  };

  const showExpandedDetails = pathCompleted || isSubmitted;

  return (
    <div
      className="h-full flex flex-col justify-between p-3.5 gap-3"
      style={{ backgroundColor: 'var(--op-panel)' }}
    >
      <div className="space-y-3">
        {/* 1. DeepBook Top 3-Button Rectangular Scenario Selector with Sliding Orange Glow */}
        {onApplyPreset && (
          <div
            ref={scenarioWrapRef}
            className="relative grid grid-cols-3 gap-1 p-1 rounded-[2px] overflow-hidden"
            style={{
              backgroundColor: 'var(--op-canvas)',
              border: '1px solid var(--op-line-strong)',
              opacity: isLockedReadOnly ? 0.65 : 1,
            }}
            role="group"
            aria-label={t('예측 경로 예시 선택', 'Select forecast path preset')}
          >
            <span
              aria-hidden="true"
              className="op-sliding-glow"
              style={{
                transform: `translate3d(${scenarioGlow.left}px, ${scenarioGlow.top}px, 0)`,
                width: `${scenarioGlow.width}px`,
                height: `${scenarioGlow.height}px`,
                opacity: scenarioGlow.ready ? 1 : 0,
              }}
            />
            {SCENARIO_TABS.map((item, idx) => {
              const isActive = activeScenarioIdx === idx;
              return (
                <button
                  key={item.id}
                  ref={el => {
                    scenarioBtnRefs.current[idx] = el;
                  }}
                  type="button"
                  aria-pressed={isActive}
                  disabled={isLockedReadOnly}
                  onClick={() => handleSelectScenario(item.id)}
                  className="relative z-10 h-8 px-1.5 text-[11.5px] font-medium transition-colors rounded-[6px] truncate disabled:cursor-not-allowed"
                  style={{
                    color: isActive ? 'var(--op-orange)' : 'var(--op-ink-2)',
                  }}
                >
                  {locale === 'en' ? item.en : item.ko}
                </button>
              );
            })}
          </div>
        )}

        {/* 2. Expiry & Target Price Sharp Readout */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11.5px] op-mono">
            <span style={{ color: 'var(--op-ink-3)' }}>
              {t(`D+${horizonDays} 목표가`, `D+${horizonDays} Target`)}
            </span>
            <span style={{ color: 'var(--op-ink-3)' }}>{expiryShort}</span>
          </div>

          {/* 3. Target Price Sharp Input-Like Readout */}
          <div
            className="px-3 py-2.5 rounded-[2px] flex items-center justify-between gap-2"
            style={{
              backgroundColor: 'var(--op-canvas)',
              border: pathCompleted
                ? '1px solid var(--op-orange)'
                : '1px solid var(--op-line-strong)',
            }}
          >
            {finalTargetPrice !== null && finalChangePct !== null ? (
              <>
                <span
                  className="op-mono text-[20px] font-semibold tracking-[-0.02em]"
                  style={{ color: 'var(--op-ink)' }}
                >
                  ${Math.round(finalTargetPrice).toLocaleString('en-US')}
                </span>
                <span
                  className="op-mono text-[13px] font-semibold"
                  style={{
                    color: finalChangePct >= 0 ? 'var(--op-bull)' : 'var(--op-bear)',
                  }}
                >
                  {formatPct(finalChangePct)}
                </span>
              </>
            ) : (
              <>
                <span className="op-mono text-[20px] font-medium" style={{ color: 'var(--op-ink-3)' }}>
                  $ -
                </span>
                <span className="text-[11.5px] text-right" style={{ color: 'var(--op-ink-3)' }}>
                  {sortedAnchors.length === 0
                    ? t('차트 클릭 또는 상단 예시 선택', 'Click chart or pick a preset')
                    : t(`D+${horizonDays} 종료 지점까지 연결`, `Connect to D+${horizonDays} end point`)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Pre-completion Lean Guidance / Post-completion Progressive Disclosure */}
        {!showExpandedDetails ? (
          <div
            className="px-3 py-2.5 rounded-[2px] text-[12px] leading-relaxed"
            style={{
              backgroundColor: 'var(--op-canvas)',
              border: '1px dashed var(--op-line-strong)',
              color: 'var(--op-ink-3)',
            }}
          >
            {t(
              `D+${horizonDays} 종료 지점까지 예측 경로를 완성하면 예상 가격 흐름, 최저 가격, 예상 변동폭과 예상 LP가 계산됩니다.`,
              `Complete your path to D+${horizonDays} to compute price pattern, forecast low, and expected LP change.`
            )}
          </div>
        ) : (
          <div className="space-y-3 op-view-enter">
            {/* 4. Compact 1-Line Thesis Memo */}
            <input
              id="thesis-input"
              type="text"
              maxLength={140}
              disabled={isLockedReadOnly}
              aria-label={t('예측 메모 (선택)', 'Forecast thesis memo (optional)')}
              value={commentText}
              onChange={e => onChangeComment(e.target.value)}
              placeholder={t(
                '메모 (선택, 140자) — 예: D+3 지지 후 반등',
                'Memo (optional, max 140) — e.g. D+3 support bounce'
              )}
              className="op-input h-8 text-[12px] disabled:opacity-65 disabled:cursor-not-allowed"
            />

            {/* 5. DeepBook Boxed Key-Value Metrics Table (3 Rows) */}
            <div
              className="rounded-[2px] divide-y divide-[var(--op-line)] text-[12px]"
              style={{
                backgroundColor: 'var(--op-canvas)',
                border: '1px solid var(--op-line-strong)',
              }}
            >
              <div className="px-3 py-2 flex items-center justify-between gap-2">
                <span style={{ color: 'var(--op-ink-3)' }}>{t('예상 가격 흐름', 'Forecast Pattern')}</span>
                <span className="font-medium" style={{ color: 'var(--op-ink)' }}>
                  {pathAnalysis ? pathAnalysis.scenarioLabel : '-'}
                </span>
              </div>
              <div className="px-3 py-2 flex items-center justify-between gap-2">
                <span style={{ color: 'var(--op-ink-3)' }}>{t('예상 최저 가격', 'Forecast Low')}</span>
                <span className="op-mono" style={{ color: 'var(--op-ink-2)' }}>
                  {troughPoint
                    ? `$${Math.round(troughPoint.price).toLocaleString('en-US')} (D+${troughPoint.day})`
                    : '-'}
                </span>
              </div>
              <div className="px-3 py-2 flex items-center justify-between gap-2">
                <span style={{ color: 'var(--op-ink-3)' }}>{t('목표/저점 비 · 예상 LP', 'Path Ratio · Est. LP')}</span>
                <span className="op-mono" style={{ color: 'var(--op-ink)' }}>
                  {pathAnalysis
                    ? `1 : ${pathAnalysis.riskRewardRatio.toFixed(1)} · +${eloProjection.expectedWinLp}/${eloProjection.expectedLossLp} LP`
                    : '-'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 6. Live Tracking Score Strip (Only during future time-travel preview) */}
        {liveTrackingScore && (
          <div
            className="px-3 py-2 rounded-[2px] flex items-center justify-between op-mono text-[11.5px]"
            style={{
              backgroundColor: 'var(--op-raised)',
              border: '1px solid var(--op-line-strong)',
            }}
          >
            <span style={{ color: 'var(--op-ink-2)' }}>
              {t(`현재 예측 점수 (${settledCount}/${horizonDays}일)`, `Current Score (${settledCount}/${horizonDays}D)`)}
            </span>
            <span style={{ color: 'var(--op-bull)' }}>
              {t(
                `${liveTrackingScore.grade}등급 · ${liveTrackingScore.total}점`,
                `Grade ${liveTrackingScore.grade} · ${liveTrackingScore.total} pts`
              )}
              {liveTrackingSettlement && (
                <span
                  className="ml-1.5"
                  style={{
                    color:
                      liveTrackingSettlement.deltaLp >= 0
                        ? 'var(--op-bull)'
                        : 'var(--op-bear)',
                  }}
                >
                  ({liveTrackingSettlement.deltaLp >= 0 ? '+' : ''}
                  {liveTrackingSettlement.deltaLp} LP)
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* 7. Bottom CTA & Post-Submit Receipt */}
      <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--op-line)' }}>
        {!isSubmitted && !isRoundOpen ? (
          <div className="space-y-1.5">
            <div
              className="px-3 py-2 rounded-[2px] text-[11.5px] leading-relaxed"
              style={{
                backgroundColor: 'var(--op-canvas)',
                border: '1px solid var(--op-line-strong)',
                color: 'var(--op-ink-2)',
              }}
            >
              {t(
                `현재 라운드는 ${roundStatus === 'RESOLVED' ? '평가 완료' : '진행 중'} 상태이므로 신규 제출할 수 없습니다.`,
                `Round is ${roundStatus}; new forecast submissions are closed.`
              )}
            </div>
            {onResetToToday && (
              <button
                type="button"
                onClick={onResetToToday}
                className="op-btn-primary w-full h-10 text-[13px]"
              >
                {t('진행 중인 라운드(오늘)로 돌아가기', 'Return to Live Round (Today)')}
              </button>
            )}
          </div>
        ) : isSubmitted ? (
          <div
            className="w-full px-3 py-2.5 rounded-[2px] flex items-center justify-between gap-2 text-[12px]"
            style={{
              backgroundColor: 'rgba(0, 229, 153, 0.08)',
              border: '1px solid rgba(0, 229, 153, 0.35)',
              color: 'var(--op-bull)',
            }}
          >
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Lock size={13} />
              {t('제출 후 수정 불가', 'Locked Forecast')}
            </span>
            <span className="op-mono text-[10.5px]" style={{ color: 'var(--op-ink-3)' }}>
              {t('라운드당 1회 제출', 'One Submission per Round')}
            </span>
          </div>
        ) : showConfirmSubmit ? (
          <div
            className="p-2.5 rounded-[2px] space-y-2"
            style={{
              backgroundColor: 'var(--op-canvas)',
              border: '1px solid var(--op-orange)',
            }}
          >
            <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
              {t(
                '제출 후에는 예측 경로를 수정하거나 취소할 수 없으며 집단 전망 리포트가 즉시 공개됩니다. 확정하시겠습니까?',
                'Once submitted, your forecast path cannot be edited and crowd insights unlock immediately. Confirm submission?'
              )}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setIsConfirmingSubmit(false)}
                className="op-btn-ghost h-8 text-[12px]"
              >
                {t('취소', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmingSubmit(false);
                  onSubmit();
                }}
                className="op-btn-primary h-8 text-[12px]"
              >
                <Lock size={12} />
                {t('예측 확정하기', 'Confirm Submission')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={!pathCompleted}
            onClick={() => setIsConfirmingSubmit(true)}
            className="op-btn-primary w-full h-10 text-[13px]"
          >
            {!pathCompleted ? (
              <span>
                {t(`${horizonDays}일 예측 경로를 완성해 주세요`, `Complete ${horizonDays}-day path to submit`)}
              </span>
            ) : (
              <span>
                {t(`${horizonDays}일 예측 제출하기`, `Submit ${horizonDays}-Day Forecast`)}
              </span>
            )}
          </button>
        )}

        {myForecast && (
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onOpenShare(myForecast)}
              className="op-btn-ghost h-8 text-[12px]"
            >
              <Share2 size={12} />
              {t('공유 카드', 'Share Card')}
            </button>
            <button
              type="button"
              onClick={() => onViewDetail(myForecast.id)}
              className="op-btn-ghost h-8 text-[12px]"
            >
              <ShieldCheck size={12} />
              {t('예측 상세', 'View Details')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
