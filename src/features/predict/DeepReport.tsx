import { useMemo } from 'react';
import {
  computeTargetDistribution,
  computePercentile,
  findMaxDispersionDay,
  computeInvestmentBriefing,
  computeDrawingIntelligence,
} from '../../domain/report';
import { formatPct } from '../../domain/format';
import { useI18n } from '../../lib/i18nCore';
import type { DailyConsensusBandPoint } from '../../domain/crowd';
import type { Forecast } from '../../domain/types';
import type { OverlayRival } from './PathCanvas';

interface DeepReportProps {
  basePrice: number;
  userPrices: number[];
  myForecast: Forecast | null;
  forecasts: Forecast[];
  consensusBand: DailyConsensusBandPoint[];
  overlaidRivals?: OverlayRival[];
  isSubmitted?: boolean;
  onRemoveOverlay?: (forecastId: string) => void;
  onSelectTargetPrice?: (price: number) => void;
}

export function DeepReport({
  basePrice,
  userPrices,
  myForecast,
  forecasts,
  consensusBand,
  overlaidRivals = [],
  isSubmitted = false,
  onRemoveOverlay,
  onSelectTargetPrice,
}: DeepReportProps) {
  const { locale, t } = useI18n();
  const horizonLen = Math.max(1, consensusBand[consensusBand.length - 1]?.day ?? 7);

  const effectiveUserPrices = useMemo(() => {
    if (userPrices.length > 0) return userPrices;
    return (myForecast?.path || []).map(pt => pt.price);
  }, [userPrices, myForecast?.path]);

  const hasUserPath = effectiveUserPrices.length > 0;
  const userTargetPrice = effectiveUserPrices[effectiveUserPrices.length - 1] ?? basePrice;
  const userTargetPct = basePrice > 0 ? (userTargetPrice - basePrice) / basePrice : 0;

  const percentile = useMemo(
    () => computePercentile(userTargetPct, forecasts),
    [userTargetPct, forecasts]
  );

  const distribution = useMemo(
    () => computeTargetDistribution(forecasts, basePrice, 7),
    [forecasts, basePrice]
  );

  const maxDispersion = useMemo(
    () => findMaxDispersionDay(consensusBand, basePrice),
    [consensusBand, basePrice]
  );

  const briefing = useMemo(
    () =>
      computeInvestmentBriefing(
        basePrice,
        effectiveUserPrices,
        consensusBand,
        forecasts,
        locale
      ),
    [basePrice, effectiveUserPrices, consensusBand, forecasts, locale]
  );

  const drawingIntel = useMemo(
    () =>
      computeDrawingIntelligence(
        basePrice,
        effectiveUserPrices,
        consensusBand,
        forecasts,
        locale
      ),
    [basePrice, effectiveUserPrices, consensusBand, forecasts, locale]
  );

  const crowdMedianPct =
    basePrice > 0 ? ((briefing.crowdMedian - basePrice) / basePrice) * 100 : 0;
  const topMedianPct =
    basePrice > 0 ? ((briefing.topMedian - basePrice) / basePrice) * 100 : 0;

  const isTopHalfBull = percentile >= 50;
  const bullRankLabel = isTopHalfBull
    ? t(`상위 ${Math.max(1, 100 - percentile)}%`, `Top ${Math.max(1, 100 - percentile)}%`)
    : t(`하위 ${Math.max(1, percentile)}%`, `Bottom ${Math.max(1, percentile)}%`);

  const maxShare = Math.max(1, ...distribution.map(b => b.sharePct));
  const matchesBucket = (lo: number, hi: number, idx: number, price: number | null) => {
    if (price === null) return false;
    if (idx === 0) return price >= lo;
    if (idx === distribution.length - 1) return price <= hi;
    return price >= lo && price < hi;
  };

  const bearishSharePct = Math.max(0, 100 - briefing.bullishSharePct);
  const maxDispDay = maxDispersion?.day ?? Math.ceil(horizonLen / 2);
  const maxDispGapPct = (maxDispersion?.widthPct ?? 0).toFixed(1);

  const boxStyle = {
    backgroundColor: 'var(--op-canvas)',
    border: '1px solid var(--op-line-strong)',
    borderRadius: '2px',
  } as const;

  const miniBoxStyle = {
    backgroundColor: 'var(--op-panel)',
    border: '1px solid var(--op-line)',
    borderRadius: '2px',
  } as const;

  return (
    <div className="p-4 sm:p-6 space-y-4" style={{ backgroundColor: 'var(--op-canvas)' }}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left 7 Cols: Bull/Bear Split + Top-Tier vs Crowd Comparison */}
        <section
          className="lg:col-span-7 p-5 flex flex-col justify-between gap-4"
          style={boxStyle}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15.5px] font-semibold tracking-[-0.015em]" style={{ color: 'var(--op-ink)' }}>
                {t('참여자 전망 및 주요 가격대', 'Crowd Forecast & Key Levels')}
              </h2>
              <span className="op-mono text-[11.5px]" style={{ color: 'var(--op-ink-3)' }}>
                {t(`예측 참여자 ${forecasts.length}명 · ${horizonLen}D`, `${forecasts.length} Forecasters · ${horizonLen}D`)}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[12px] op-mono" style={{ color: 'var(--op-ink-3)' }}>
                <span>{t(`상승 전망 ${briefing.bullishSharePct}%`, `Bullish ${briefing.bullishSharePct}%`)}</span>
                <span>{t(`하락 전망 ${bearishSharePct}%`, `Bearish ${bearishSharePct}%`)}</span>
              </div>
              <div
                className="h-2.5 w-full rounded-[2px] overflow-hidden flex gap-1"
                style={{ backgroundColor: 'var(--op-panel)' }}
              >
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${briefing.bullishSharePct}%`, backgroundColor: 'var(--op-bull)' }}
                />
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${bearishSharePct}%`, backgroundColor: 'var(--op-bear)' }}
                />
              </div>
              <div className="flex items-center justify-between text-[11.5px] op-mono" style={{ color: 'var(--op-ink-3)' }}>
                <span>{t('분포 하단 P15', '15th Pct P15')} ${Math.round(briefing.supportP15).toLocaleString('en-US')}</span>
                <span>{t('분포 상단 P85', '85th Pct P85')} ${Math.round(briefing.resistanceP85).toLocaleString('en-US')}</span>
              </div>
            </div>
          </div>

          <div className="divide-y divide-[var(--op-line)] text-[13px]">
            <div className="py-2.5 flex flex-wrap items-baseline justify-between gap-2">
              <span className="inline-flex items-center gap-2 font-medium" style={{ color: 'var(--op-ink)' }}>
                <span className="w-2 h-2 rounded-[1px]" style={{ backgroundColor: 'var(--op-smart)' }} aria-hidden="true" />
                {t('상위 예측자 중앙 경로', 'Top Forecasters Median')}
              </span>
              <span className="op-mono" style={{ color: 'var(--op-smart)' }}>
                <strong>${Math.round(briefing.topMedian).toLocaleString('en-US')}</strong> ({formatPct(topMedianPct)})
                <span className="ml-2 text-[11.5px]" style={{ color: 'var(--op-ink-3)' }}>
                  · {t('예상 저점', 'Low')} D+{drawingIntel.smartBottomPivot.day}
                </span>
              </span>
            </div>

            <div className="py-2.5 flex flex-wrap items-baseline justify-between gap-2">
              <span className="inline-flex items-center gap-2 font-medium" style={{ color: 'var(--op-ink)' }}>
                <span className="w-2 h-2 rounded-[1px]" style={{ backgroundColor: 'var(--op-crowd)' }} aria-hidden="true" />
                {t('참여자 중앙값', 'Crowd Median')}
              </span>
              <span className="op-mono" style={{ color: 'var(--op-ink)' }}>
                <strong>${Math.round(briefing.crowdMedian).toLocaleString('en-US')}</strong> ({formatPct(crowdMedianPct)})
                <span className="ml-2 text-[11.5px]" style={{ color: 'var(--op-ink-3)' }}>
                  · {t('주요 하락 구간', 'Dip')} ${Math.round(briefing.dipCheckpoint.price).toLocaleString('en-US')}
                </span>
              </span>
            </div>

            {hasUserPath && (
              <div className="py-2.5 flex flex-wrap items-baseline justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-medium" style={{ color: 'var(--op-ink)' }}>
                  <span className="w-2 h-2 rounded-[1px]" style={{ backgroundColor: 'var(--op-orange)' }} aria-hidden="true" />
                  {t('내 예측 경로', 'My Forecast Path')}
                </span>
                <span className="op-mono" style={{ color: 'var(--op-ink)' }}>
                  <strong>${Math.round(userTargetPrice).toLocaleString('en-US')}</strong> ({formatPct(userTargetPct * 100)})
                  <span className="ml-2 text-[11.5px]" style={{ color: 'var(--op-orange)' }}>
                    · {bullRankLabel} · {t('변동폭 비', 'Range Ratio')} 1:{drawingIntel.userPath.riskRewardRatio.toFixed(1)}
                  </span>
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="p-2.5" style={miniBoxStyle}>
              <div className="text-[11px]" style={{ color: 'var(--op-ink-3)' }}>
                {t('주요 예측 패턴', 'Dominant Pattern')}
              </div>
              <div className="mt-0.5 op-mono text-[12px] font-semibold truncate" style={{ color: 'var(--op-ink)' }}>
                {drawingIntel.dominantScenario.label} ({drawingIntel.dominantScenario.pct}%)
              </div>
            </div>

            <div className="p-2.5" style={miniBoxStyle}>
              <div className="text-[11px]" style={{ color: 'var(--op-ink-3)' }}>
                {t('의견 분산 최대', 'Peak Divergence')}
              </div>
              <div className="mt-0.5 op-mono text-[12px] font-semibold truncate" style={{ color: 'var(--op-orange)' }}>
                D+{maxDispDay} ({maxDispGapPct}%p)
              </div>
            </div>

            <div className="p-2.5" style={miniBoxStyle}>
              <div className="text-[11px]" style={{ color: 'var(--op-ink-3)' }}>
                {t('상위 예측자 격차', 'Top Forecaster Spread')}
              </div>
              <div
                className="mt-0.5 op-mono text-[12px] font-semibold truncate"
                style={{
                  color: briefing.smartVsCrowdPct >= 0 ? 'var(--op-bull)' : 'var(--op-bear)',
                }}
              >
                {briefing.smartVsCrowdPct >= 0 ? '+' : ''}
                {briefing.smartVsCrowdPct.toFixed(1)}%p
              </div>
            </div>
          </div>
        </section>

        {/* Right 5 Cols: 7D Path Touch & Target Distribution */}
        <section className="lg:col-span-5 p-5 space-y-3" style={boxStyle}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-semibold" style={{ color: 'var(--op-ink)' }}>
              {t(`${horizonLen}일 후 예상 가격 분포`, `${horizonLen}D Target Distribution`)}
            </h3>
            {overlaidRivals.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {overlaidRivals.map(r => (
                  <span
                    key={r.forecast.id}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] op-mono text-[10.5px]"
                    style={{
                      backgroundColor: 'var(--op-panel)',
                      border: '1px solid var(--op-line-strong)',
                      color: 'var(--op-ink)',
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-[1px]" style={{ backgroundColor: r.colorVar }} />
                    @{r.authorHandle}
                    {onRemoveOverlay && (
                      <button
                        type="button"
                        onClick={() => onRemoveOverlay(r.forecast.id)}
                        className="hover:opacity-75 cursor-pointer"
                        aria-label={t(`${r.authorHandle} 경로 겹쳐 보기 해제`, `Remove ${r.authorHandle} overlay`)}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            {distribution.map((bucket, idx) => {
              const isMine = hasUserPath && matchesBucket(bucket.lo, bucket.hi, idx, userTargetPrice);
              const isSmart = matchesBucket(bucket.lo, bucket.hi, idx, briefing.topMedian);
              const isMedian = matchesBucket(bucket.lo, bucket.hi, idx, briefing.crowdMedian);
              const barWidth = Math.max(
                bucket.count > 0 ? 8 : bucket.touchPct > 0 ? 4 : 0,
                (bucket.sharePct / maxShare) * 100
              );

              return (
                <button
                  key={`${bucket.lo}-${bucket.hi}`}
                  type="button"
                  disabled={isSubmitted}
                  onClick={() => {
                    if (!isSubmitted) onSelectTargetPrice?.(bucket.mid);
                  }}
                  className={`w-full relative px-2.5 py-2 rounded-[2px] flex flex-col gap-1.5 sm:grid sm:grid-cols-[96px_1fr_auto] sm:items-center sm:gap-2.5 text-left transition-colors ${
                    isSubmitted ? 'cursor-default' : 'hover:bg-[var(--op-raised)] cursor-pointer'
                  }`}
                  style={{
                    border: isMine ? '1px solid var(--op-orange)' : '1px solid var(--op-line)',
                    backgroundColor: isMine ? 'var(--op-orange-soft)' : 'var(--op-panel)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2 min-w-0 sm:contents">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="op-mono text-[12px] font-medium whitespace-nowrap"
                        style={{ color: isMine ? 'var(--op-orange)' : 'var(--op-ink)' }}
                      >
                        ${Math.round(bucket.mid).toLocaleString('en-US')}
                      </span>
                      <span className="op-mono text-[11px] whitespace-nowrap" style={{ color: 'var(--op-ink-3)' }}>
                        {bucket.midPct >= 0 ? '+' : ''}
                        {bucket.midPct.toFixed(0)}%
                      </span>
                    </div>

                    <span
                      className="op-mono text-[11px] text-right whitespace-nowrap sm:order-3"
                      style={{
                        color: bucket.count > 0 || bucket.touchPct > 0 ? 'var(--op-ink-2)' : 'var(--op-ink-3)',
                      }}
                    >
                      {t('도달', 'Touch')} {bucket.touchPct}% · {bucket.count > 0 ? `${bucket.sharePct}%` : '0%'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 min-w-0 sm:order-2">
                    <div className="w-full min-w-[40px] h-1.5 rounded-[1px] bg-[var(--op-canvas)] overflow-hidden relative">
                      {bucket.touchPct > 0 && (
                        <div
                          className="h-full absolute left-0 top-0"
                          style={{
                            width: `${Math.min(100, bucket.touchPct)}%`,
                            backgroundColor: 'var(--op-crowd)',
                            opacity: 0.22,
                          }}
                        />
                      )}
                      <div
                        className="h-full relative"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: isMine
                            ? 'var(--op-orange)'
                            : isSmart
                            ? 'var(--op-smart)'
                            : 'var(--op-crowd)',
                        }}
                      />
                    </div>
                    {isMine && (
                      <span
                        className="px-1 rounded-[2px] text-[10px] font-semibold flex-shrink-0 whitespace-nowrap"
                        style={{ backgroundColor: 'var(--op-orange)', color: 'var(--op-on-orange)' }}
                      >
                        {t('나', 'ME')}
                      </span>
                    )}
                    {isSmart && (
                      <span
                        className="px-1 rounded-[2px] text-[10px] font-semibold flex-shrink-0 whitespace-nowrap"
                        style={{ backgroundColor: 'var(--op-smart-soft)', color: 'var(--op-smart)' }}
                      >
                        {t('상위 예측자', 'TOP')}
                      </span>
                    )}
                    {!isMine && !isSmart && isMedian && (
                      <span
                        className="px-1 rounded-[2px] text-[10px] flex-shrink-0 whitespace-nowrap"
                        style={{ backgroundColor: 'var(--op-raised)', color: 'var(--op-ink-2)' }}
                      >
                        {t('중앙값', 'MEDIAN')}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
