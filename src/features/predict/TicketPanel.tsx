import { useState } from 'react';
import { Share2, ShieldCheck, ArrowRight, Eye, CheckCircle2 } from 'lucide-react';
import { formatPct } from '../../domain/format';
import { type TrajectoryPresetId } from '../../domain/interpolation';
import { useI18n } from '../../lib/i18nCore';
import type {
  AnchorPoint,
  EloProjection,
  EloSettlement,
  Forecast,
  ScoreBreakdown,
} from '../../domain/types';

export interface RoundLeaderEntry {
  forecast: Forecast;
  handle: string;
  elo: number;
  score: number;
  changePct: number;
}

interface TicketPanelProps {
  baseDate?: string;
  basePrice: number;
  evalDates: string[];
  anchors?: AnchorPoint[];
  interpolatedPrices: number[];
  pathCompleted: boolean;
  isSubmitted: boolean;
  isRoundOpen?: boolean;
  roundStatus?: 'OPEN' | 'LIVE' | 'RESOLVED';
  myForecast: Forecast | null;
  eloProjection?: EloProjection;
  liveTrackingScore: ScoreBreakdown | null;
  liveTrackingSettlement: EloSettlement | null;
  settledCount: number;
  participantsCount?: number;
  crowdMedianPrice?: number;
  crowdChangePct?: number;
  bullishSharePct?: number;
  avgRoundScore?: number | null;
  leaderEntry?: RoundLeaderEntry | null;
  isLeaderOverlaid?: boolean;
  onToggleLeaderOverlay?: () => void;
  actualLatestPrice?: number | null;
  actualLatestChangePct?: number | null;
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
  baseDate,
  basePrice,
  evalDates,
  interpolatedPrices,
  pathCompleted,
  isSubmitted,
  isRoundOpen = true,
  roundStatus = 'OPEN',
  myForecast,
  liveTrackingScore,
  liveTrackingSettlement,
  settledCount,
  participantsCount = 0,
  crowdMedianPrice,
  crowdChangePct = 0,
  bullishSharePct = 50,
  avgRoundScore = null,
  leaderEntry = null,
  isLeaderOverlaid = false,
  onToggleLeaderOverlay,
  actualLatestPrice = null,
  actualLatestChangePct = null,
  commentText,
  onChangeComment,
  onSubmit,
  onResetToToday,
  onOpenShare,
  onViewDetail,
  onApplyPreset,
  activePreset,
}: TicketPanelProps) {
  const { locale, t } = useI18n();
  const [localSelectedPreset, setLocalSelectedPreset] = useState<TrajectoryPresetId | null>(null);
  const selectedPreset = activePreset !== undefined ? activePreset : localSelectedPreset;

  const horizonDays = evalDates.length || 7;

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

  const effectiveCrowdMedian = crowdMedianPrice ?? basePrice;
  const bearishSharePct = Math.max(0, 100 - bullishSharePct);
  const remainingDays = Math.max(0, horizonDays - settledCount);

  // =========================================================================
  // STATE 3 & 4: PAST CLOSED ROUNDS (TRACKING 1/7~6/7 or EVALUATED 7/7)
  // =========================================================================
  if (!isRoundOpen) {
    const isResolved = roundStatus === 'RESOLVED';

    return (
      <div
        className="h-full flex flex-col justify-between p-4 gap-4"
        style={{ backgroundColor: 'var(--op-panel)' }}
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span
                className="op-mono text-[10.5px] font-semibold px-2 py-0.5 rounded-[2px]"
                style={{
                  backgroundColor: isResolved
                    ? 'rgba(0, 229, 153, 0.12)'
                    : 'rgba(50, 145, 255, 0.14)',
                  color: isResolved ? 'var(--op-bull)' : 'var(--op-smart)',
                  border: `1px solid ${isResolved ? 'rgba(0, 229, 153, 0.32)' : 'rgba(50, 145, 255, 0.35)'}`,
                }}
              >
                {isResolved
                  ? t('EVALUATED · 7/7 확정', 'EVALUATED · 7/7 FINAL')
                  : t(`TRACKING · ${settledCount}/${horizonDays}일`, `TRACKING · ${settledCount}/${horizonDays}D`)}
              </span>
              {baseDate && (
                <span className="op-mono text-[11px]" style={{ color: 'var(--op-ink-3)' }}>
                  {baseDate.slice(5).replace('-', '.')} → {expiryShort}
                </span>
              )}
            </div>

            <h2
              className="text-[15.5px] font-semibold tracking-[-0.015em] pt-0.5"
              style={{ color: 'var(--op-ink)' }}
            >
              {isResolved
                ? t('7일 예측 라운드 최종 결과', '7-Day Round Final Results')
                : t('집단 예측 실시간 추적', 'How is the crowd tracking?')}
            </h2>
          </div>

          {/* 2-Col Comparison: Actual Price vs Crowd Path */}
          <div className="grid grid-cols-2 gap-2">
            <div
              className="p-2.5 rounded-[2px] space-y-0.5"
              style={{
                backgroundColor: 'var(--op-canvas)',
                border: '1px solid var(--op-line-strong)',
              }}
            >
              <div className="op-mono text-[10.5px]" style={{ color: 'var(--op-ink-3)' }}>
                {isResolved
                  ? t('실제 7일 종가', 'Actual Close')
                  : t(`실제 가격 (D+${settledCount})`, `Actual (D+${settledCount})`)}
              </div>
              <div className="op-mono text-[14.5px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                {actualLatestPrice !== null
                  ? `$${Math.round(actualLatestPrice).toLocaleString('en-US')}`
                  : '-'}
              </div>
              <div
                className="op-mono text-[12px] font-semibold"
                style={{
                  color:
                    (actualLatestChangePct ?? 0) >= 0 ? 'var(--op-bull)' : 'var(--op-bear)',
                }}
              >
                {actualLatestChangePct !== null ? formatPct(actualLatestChangePct) : '-'}
              </div>
            </div>

            <div
              className="p-2.5 rounded-[2px] space-y-0.5"
              style={{
                backgroundColor: 'var(--op-canvas)',
                border: '1px solid var(--op-line-strong)',
              }}
            >
              <div className="op-mono text-[10.5px]" style={{ color: 'var(--op-smart)' }}>
                {t(`집단 경로 D+${horizonDays}`, `Crowd Path D+${horizonDays}`)}
              </div>
              <div className="op-mono text-[14.5px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                ${Math.round(effectiveCrowdMedian).toLocaleString('en-US')}
              </div>
              <div
                className="op-mono text-[12px] font-semibold"
                style={{
                  color: crowdChangePct >= 0 ? 'var(--op-bull)' : 'var(--op-bear)',
                }}
              >
                {formatPct(crowdChangePct)}
              </div>
            </div>
          </div>

          {/* 4-Row Live / Final Score Box */}
          <div
            className="rounded-[2px] divide-y divide-[var(--op-line)] text-[12px]"
            style={{
              backgroundColor: 'var(--op-canvas)',
              border: '1px solid var(--op-line-strong)',
            }}
          >
            <div className="px-3 py-2 flex items-center justify-between gap-2">
              <span style={{ color: 'var(--op-ink-3)' }}>
                {t('예측 참여자', 'Participants')}
              </span>
              <span className="op-mono font-medium" style={{ color: 'var(--op-ink)' }}>
                {t(`${participantsCount}명`, `${participantsCount}`)}
              </span>
            </div>

            <div className="px-3 py-2 flex items-center justify-between gap-2">
              <span style={{ color: 'var(--op-ink-3)' }}>
                {isResolved
                  ? t('평균 최종 점수', 'Avg Final Score')
                  : t('평균 중간 점수', 'Avg Interim Score')}
              </span>
              <span className="op-mono font-semibold" style={{ color: 'var(--op-ink)' }}>
                {avgRoundScore !== null
                  ? t(`${avgRoundScore.toFixed(1)}점`, `${avgRoundScore.toFixed(1)} pts`)
                  : '-'}
              </span>
            </div>

            <div className="px-3 py-2 flex items-center justify-between gap-2">
              <span style={{ color: 'var(--op-ink-3)' }}>
                {t('평가 진행 일수', 'Days Evaluated')}
              </span>
              <span className="op-mono" style={{ color: 'var(--op-ink)' }}>
                {settledCount} / {horizonDays}
                {!isResolved && (
                  <span className="ml-1.5 text-[11px]" style={{ color: 'var(--op-ink-3)' }}>
                    ({t(`${remainingDays}일 남음`, `${remainingDays}D left`)})
                  </span>
                )}
              </span>
            </div>

            {leaderEntry && (
              <div className="px-3 py-2 flex items-center justify-between gap-2">
                <span style={{ color: 'var(--op-ink-3)' }}>
                  {isResolved
                    ? t('최종 1위', 'Round Winner')
                    : t('현재 1위', 'Current Leader')}
                </span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="op-mono font-semibold truncate" style={{ color: 'var(--op-ink)' }}>
                    @{leaderEntry.handle}
                  </span>
                  <span className="op-mono text-[11.5px]" style={{ color: 'var(--op-bull)' }}>
                    {leaderEntry.score.toFixed(1)}
                  </span>
                  {onToggleLeaderOverlay && (
                    <button
                      type="button"
                      onClick={onToggleLeaderOverlay}
                      aria-pressed={isLeaderOverlaid}
                      className="px-1.5 py-0.5 rounded-[2px] text-[10.5px] font-medium cursor-pointer transition-colors"
                      style={{
                        backgroundColor: isLeaderOverlaid
                          ? 'var(--op-orange)'
                          : 'var(--op-panel)',
                        border: '1px solid var(--op-line-strong)',
                        color: isLeaderOverlaid ? 'var(--op-on-orange)' : 'var(--op-ink-2)',
                      }}
                    >
                      <Eye size={10} className="inline mr-1" aria-hidden="true" />
                      {isLeaderOverlaid ? t('표시 중', 'Shown') : t('경로 보기', 'Show')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {myForecast && liveTrackingScore && (
            <div
              className="px-3 py-2 rounded-[2px] flex items-center justify-between op-mono text-[11.5px]"
              style={{
                backgroundColor: 'rgba(0, 229, 153, 0.08)',
                border: '1px solid rgba(0, 229, 153, 0.35)',
              }}
            >
              <span style={{ color: 'var(--op-ink)' }}>
                {isResolved
                  ? t('내 최종 점수', 'My Final Score')
                  : t('내 중간 점수', 'My Interim Score')}
              </span>
              <span className="font-semibold" style={{ color: 'var(--op-bull)' }}>
                {t(
                  `${liveTrackingScore.grade}등급 · ${liveTrackingScore.total}점`,
                  `Grade ${liveTrackingScore.grade} · ${liveTrackingScore.total} pts`
                )}
                {isResolved && liveTrackingSettlement && (
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

        <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--op-line)' }}>
          {myForecast && (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onOpenShare(myForecast)}
                className="op-btn-ghost h-8 text-[12px]"
              >
                <Share2 size={12} aria-hidden="true" />
                {t('공유 카드', 'Share Card')}
              </button>
              <button
                type="button"
                onClick={() => onViewDetail(myForecast.id)}
                className="op-btn-ghost h-8 text-[12px]"
              >
                <ShieldCheck size={12} aria-hidden="true" />
                {t('예측 상세', 'Details')}
              </button>
            </div>
          )}

          {onResetToToday && (
            <button
              type="button"
              onClick={onResetToToday}
              className="op-btn-primary w-full h-10 text-[13px]"
            >
              <span>{t('오늘 라운드로 이동', 'Go to Today’s Round')}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 2: TODAY'S OPEN ROUND — POST-SUBMISSION (COMPARE)
  // =========================================================================
  if (isSubmitted) {
    return (
      <div
        className="h-full flex flex-col justify-between p-4 gap-4"
        style={{ backgroundColor: 'var(--op-panel)' }}
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span
                className="op-mono text-[10.5px] font-semibold px-2 py-0.5 rounded-[2px] inline-flex items-center gap-1"
                style={{
                  backgroundColor: 'rgba(0, 229, 153, 0.12)',
                  color: 'var(--op-bull)',
                  border: '1px solid rgba(0, 229, 153, 0.32)',
                }}
              >
                <CheckCircle2 size={11} aria-hidden="true" />
                {t('COMPARE · 제출 완료', 'COMPARE · SUBMITTED')}
              </span>
              <span className="op-mono text-[11px]" style={{ color: 'var(--op-ink-3)' }}>
                {expiryShort}
              </span>
            </div>

            <h2
              className="text-[15.5px] font-semibold tracking-[-0.015em] pt-0.5"
              style={{ color: 'var(--op-ink)' }}
            >
              {t('내 예측 vs 집단 전망', 'Your Forecast vs. The Crowd')}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div
              className="p-3 rounded-[2px] space-y-0.5"
              style={{
                backgroundColor: 'var(--op-canvas)',
                border: '1px solid var(--op-orange)',
              }}
            >
              <div className="op-mono text-[10.5px]" style={{ color: 'var(--op-orange)' }}>
                {t('내 D+7 예측', 'My Forecast')}
              </div>
              <div className="op-mono text-[16px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                {finalTargetPrice !== null
                  ? `$${Math.round(finalTargetPrice).toLocaleString('en-US')}`
                  : '-'}
              </div>
              <div
                className="op-mono text-[12.5px] font-semibold"
                style={{
                  color: (finalChangePct ?? 0) >= 0 ? 'var(--op-bull)' : 'var(--op-bear)',
                }}
              >
                {finalChangePct !== null ? formatPct(finalChangePct) : '-'}
              </div>
            </div>

            <div
              className="p-3 rounded-[2px] space-y-0.5"
              style={{
                backgroundColor: 'var(--op-canvas)',
                border: '1px solid var(--op-line-strong)',
              }}
            >
              <div className="op-mono text-[10.5px]" style={{ color: 'var(--op-smart)' }}>
                {t('집단 중앙 경로', 'Crowd Path')}
              </div>
              <div className="op-mono text-[16px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                ${Math.round(effectiveCrowdMedian).toLocaleString('en-US')}
              </div>
              <div
                className="op-mono text-[12.5px] font-semibold"
                style={{
                  color: crowdChangePct >= 0 ? 'var(--op-bull)' : 'var(--op-bear)',
                }}
              >
                {formatPct(crowdChangePct)}
              </div>
            </div>
          </div>

          <div
            className="p-3 rounded-[2px] space-y-1.5"
            style={{
              backgroundColor: 'var(--op-canvas)',
              border: '1px solid var(--op-line-strong)',
            }}
          >
            <div className="flex items-center justify-between text-[11.5px] op-mono">
              <span style={{ color: 'var(--op-bull)' }}>
                {t(`상승 전망 ${bullishSharePct}%`, `Bullish ${bullishSharePct}%`)}
              </span>
              <span style={{ color: 'var(--op-bear)' }}>
                {t(`하락 전망 ${bearishSharePct}%`, `Bearish ${bearishSharePct}%`)}
              </span>
            </div>
            <div
              className="h-2 w-full rounded-[2px] overflow-hidden flex gap-0.5"
              style={{ backgroundColor: 'var(--op-panel)' }}
            >
              <div
                className="h-full"
                style={{ width: `${bullishSharePct}%`, backgroundColor: 'var(--op-bull)' }}
              />
              <div
                className="h-full"
                style={{ width: `${bearishSharePct}%`, backgroundColor: 'var(--op-bear)' }}
              />
            </div>
          </div>
        </div>

        {myForecast && (
          <div className="grid grid-cols-2 gap-1.5 pt-2" style={{ borderTop: '1px solid var(--op-line)' }}>
            <button
              type="button"
              onClick={() => onOpenShare(myForecast)}
              className="op-btn-primary h-9 text-[12.5px]"
            >
              <Share2 size={12} aria-hidden="true" />
              {t('공유 카드', 'Share Card')}
            </button>
            <button
              type="button"
              onClick={() => onViewDetail(myForecast.id)}
              className="op-btn-ghost h-9 text-[12.5px]"
            >
              <ShieldCheck size={12} aria-hidden="true" />
              {t('예측 상세', 'View Details')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // STATE 1: TODAY'S OPEN ROUND — PRE-SUBMISSION (DRAW)
  // =========================================================================
  return (
    <div
      className="h-full flex flex-col justify-between p-4 gap-4"
      style={{ backgroundColor: 'var(--op-panel)' }}
    >
      <div className="space-y-3.5">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className="op-mono text-[10.5px] font-semibold px-2 py-0.5 rounded-[2px]"
              style={{
                backgroundColor: 'var(--op-orange-soft)',
                color: 'var(--op-orange)',
                border: '1px solid rgba(255, 85, 0, 0.35)',
              }}
            >
              {t('OPEN · 오늘 라운드', 'OPEN · TODAY')}
            </span>
            <span className="op-mono text-[11px]" style={{ color: 'var(--op-ink-3)' }}>
              {t(`참여자 ${participantsCount}명`, `${participantsCount} entered`)}
            </span>
          </div>

          <h2
            className="text-[15.5px] font-semibold tracking-[-0.015em] pt-0.5"
            style={{ color: 'var(--op-ink)' }}
          >
            {t('향후 7일, 비트코인은 어디로 향할까요?', 'Where will Bitcoin go in 7 days?')}
          </h2>
        </div>

        {/* D+7 Target Readout */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11.5px] op-mono">
            <span style={{ color: 'var(--op-ink-3)' }}>
              {t(`D+${horizonDays} 목표가`, `D+${horizonDays} Target`)}
            </span>
            <span style={{ color: 'var(--op-ink-3)' }}>{expiryShort}</span>
          </div>

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
                  {t(`차트 우측 영역을 클릭해 D+${horizonDays}까지 연결하세요`, `Click right zone to draw to D+${horizonDays}`)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Quick Preset Chips */}
        {onApplyPreset && (
          <div className="space-y-1">
            <span className="op-mono text-[11px]" style={{ color: 'var(--op-ink-3)' }}>
              {t('빠른 예시', 'Presets')}
            </span>
            <div
              className="grid grid-cols-3 gap-1.5"
              role="group"
              aria-label={t('예측 경로 예시 선택', 'Select forecast path preset')}
            >
              {SCENARIO_TABS.map(item => {
                const isActive = pathCompleted && selectedPreset === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      setLocalSelectedPreset(item.id);
                      onApplyPreset(item.id);
                    }}
                    className="h-7 px-1.5 rounded-[2px] text-[11.5px] font-medium transition-colors truncate cursor-pointer"
                    style={{
                      backgroundColor: isActive ? 'var(--op-orange-soft)' : 'var(--op-canvas)',
                      border: isActive
                        ? '1px solid var(--op-orange)'
                        : '1px solid var(--op-line)',
                      color: isActive ? 'var(--op-orange)' : 'var(--op-ink-2)',
                    }}
                  >
                    {locale === 'en' ? item.en : item.ko}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 1-Line Optional Memo */}
        <input
          id="thesis-input"
          type="text"
          maxLength={140}
          aria-label={t('한 줄 메모 (선택)', 'Memo (optional)')}
          value={commentText}
          onChange={e => onChangeComment(e.target.value)}
          placeholder={t(
            '한 줄 메모 (선택, 140자)',
            'One-line memo (optional, max 140)'
          )}
          className="op-input h-9 text-[12px]"
        />
      </div>

      {/* Bottom 1-Click Submission CTA */}
      <div className="pt-2" style={{ borderTop: '1px solid var(--op-line)' }}>
        <button
          type="button"
          disabled={!pathCompleted}
          onClick={onSubmit}
          className="op-btn-primary w-full h-10 text-[13px]"
        >
          {!pathCompleted ? (
            <span>
              {t(`D+${horizonDays}까지 경로를 완성하세요`, `Draw to D+${horizonDays} to Submit`)}
            </span>
          ) : (
            <>
              <span>{t('7일 예측 제출하기', 'Lock Your Forecast')}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
