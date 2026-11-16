import { ArrowUpRight, Lock } from 'lucide-react';
import { repository } from '../../data/localRepository';
import { DEFAULT_ELO, getEloTierInfo } from '../../domain/elo';
import { formatPct } from '../../domain/format';
import { classifyScenario } from '../../domain/report';
import { localizeDataText, useI18n } from '../../lib/i18nCore';
import type { Forecast, User } from '../../domain/types';
import type { OverlayRival } from './PathCanvas';

interface ParticipantsTableProps {
  forecasts: Forecast[];
  isConsensusUnlocked: boolean;
  myForecastId?: string;
  overlaidRivals: OverlayRival[];
  onToggleOverlay: (forecast: Forecast, handle: string, elo: number) => void;
  onNavigateProfile: (handle: string) => void;
  onNavigateDetail: (forecastId: string) => void;
}

const SCENARIO_LABELS: Record<string, { ko: string; en: string }> = {
  RALLY: { ko: '꾸준한 상승', en: 'Steady Rally' },
  DIP_RALLY: { ko: '조정 후 반등', en: 'Dip & Rally' },
  RALLY_FADE: { ko: '반등 후 하락', en: 'Rally & Fade' },
  SLIDE: { ko: '꾸준한 하락', en: 'Steady Slide' },
};

export function ParticipantsTable({
  forecasts,
  isConsensusUnlocked,
  myForecastId,
  overlaidRivals,
  onToggleOverlay,
  onNavigateProfile,
  onNavigateDetail,
}: ParticipantsTableProps) {
  const { locale, t } = useI18n();

  const userById = new Map<string, User>(
    repository.listAllUsers().map(u => [u.id, u])
  );

  let validTargetCount = 0;
  let targetPriceSum = 0;
  let targetPctSum = 0;

  for (const fc of forecasts) {
    const path = fc.path || [];
    const endPrice = path.length > 0 ? path[path.length - 1].price : fc.basePrice;
    if (fc.basePrice > 0 && Number.isFinite(endPrice)) {
      validTargetCount += 1;
      targetPriceSum += endPrice;
      targetPctSum += ((endPrice - fc.basePrice) / fc.basePrice) * 100;
    }
  }

  const avgTargetPrice = validTargetCount > 0 ? targetPriceSum / validTargetCount : 0;
  const avgTargetPct = validTargetCount > 0 ? targetPctSum / validTargetCount : 0;

  return (
    <div className="p-4 sm:p-6 space-y-3" style={{ backgroundColor: 'var(--op-canvas)' }}>
      {/* Single Compact Summary Strip */}
      <div
        className="px-4 py-2.5 rounded-[2px] flex flex-wrap items-center justify-between gap-3 op-mono text-[12px]"
        style={{
          backgroundColor: 'var(--op-panel)',
          border: '1px solid var(--op-line-strong)',
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span style={{ color: 'var(--op-ink-2)' }}>
            {t(`총 ${forecasts.length}명 제출`, `${forecasts.length} Submitted`)}
          </span>
          <span style={{ color: 'var(--op-line-strong)' }}>·</span>
          {isConsensusUnlocked ? (
            <span style={{ color: 'var(--op-ink)' }}>
              {t('평균 목표가', 'Mean Target')}{' '}
              <strong>{validTargetCount > 0 ? `$${Math.round(avgTargetPrice).toLocaleString('en-US')}` : '-'}</strong>
              {validTargetCount > 0 && (
                <span className="ml-1" style={{ color: avgTargetPct >= 0 ? 'var(--op-bull)' : 'var(--op-bear)' }}>
                  ({formatPct(avgTargetPct)})
                </span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1" style={{ color: 'var(--op-orange)' }}>
              <Lock size={11} aria-hidden="true" />
              {t('제출 후 목표가·경로 공개', 'Targets hidden until submission')}
            </span>
          )}
        </div>

        <span style={{ color: isConsensusUnlocked ? 'var(--op-smart)' : 'var(--op-ink-3)' }}>
          {t('차트 비교', 'Overlays')}: {isConsensusUnlocked ? `${overlaidRivals.length}/3` : t('잠금', 'Locked')}
        </span>
      </div>

      {/* Participant Table */}
      <div
        className="overflow-x-auto rounded-[2px]"
        style={{
          backgroundColor: 'var(--op-canvas)',
          border: '1px solid var(--op-line-strong)',
        }}
      >
        <table className="op-table">
          <thead>
            <tr>
              <th>{t('참여자', 'Forecaster')}</th>
              <th>{t('등급 · 점수', 'Tier · LP')}</th>
              <th>{t('경로 유형', 'Pattern')}</th>
              <th className="op-num">{t('7일 목표가', '7D Target')}</th>
              <th>{t('예측 메모', 'Memo')}</th>
              <th className="op-num">{t('차트 비교', 'Overlay')}</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 text-center text-[13px]"
                  style={{ color: 'var(--op-ink-3)' }}
                >
                  {t('현재 라운드에 등록된 참여자가 없습니다.', 'No forecasters submitted in this round yet.')}
                </td>
              </tr>
            ) : (
              forecasts.map(fc => {
                const author = fc.authorId ? userById.get(fc.authorId) ?? null : null;
                const handle = author
                  ? author.handle
                  : `guest_${fc.anonId.replace(/^anon[_-]?/i, '').slice(-4) || 'user'}`;
                const elo = author?.elo ?? DEFAULT_ELO;
                const tier = getEloTierInfo(elo);
                const path = fc.path || [];
                const endP = path.length > 0 ? path[path.length - 1].price : fc.basePrice;
                const pct = fc.basePrice > 0 ? ((endP - fc.basePrice) / fc.basePrice) * 100 : 0;
                const pcts =
                  fc.pathPct && fc.pathPct.length > 0
                    ? fc.pathPct
                    : path.map(pt => (fc.basePrice > 0 ? (pt.price - fc.basePrice) / fc.basePrice : 0));
                const scenario = classifyScenario(pcts);
                const isOverlaid = overlaidRivals.some(r => r.forecast.id === fc.id);
                const isMyRow = myForecastId === fc.id;

                return (
                  <tr
                    key={fc.id}
                    style={{
                      backgroundColor: isOverlaid ? 'var(--op-raised)' : undefined,
                    }}
                  >
                    <td className="whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onNavigateProfile(handle)}
                        className="inline-flex items-center gap-1.5 font-medium hover:underline cursor-pointer"
                        style={{ color: 'var(--op-ink)' }}
                      >
                        @{handle}
                        {isMyRow && (
                          <span className="op-badge op-badge-orange">{t('나', 'ME')}</span>
                        )}
                      </button>
                    </td>

                    <td className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-[12.5px]">
                        <span
                          className="w-2 h-2 rounded-[2px]"
                          style={{ backgroundColor: tier.accentHex }}
                          aria-hidden="true"
                        />
                        <span className="font-semibold" style={{ color: tier.accentHex }}>
                          {locale === 'en' ? tier.title : tier.krTitle}
                        </span>
                        <span className="op-mono text-[12px]" style={{ color: 'var(--op-ink-3)' }}>
                          {elo} LP
                        </span>
                      </span>
                    </td>

                    <td className="whitespace-nowrap">
                      {isConsensusUnlocked || isMyRow ? (
                        <span className="op-badge">
                          {SCENARIO_LABELS[scenario]
                            ? locale === 'en'
                              ? SCENARIO_LABELS[scenario].en
                              : SCENARIO_LABELS[scenario].ko
                            : scenario}
                        </span>
                      ) : (
                        <span className="op-badge" style={{ color: 'var(--op-ink-3)' }}>
                          <Lock size={10} aria-hidden="true" />
                          {t('비공개', 'Hidden')}
                        </span>
                      )}
                    </td>

                    <td className="op-num whitespace-nowrap">
                      {isConsensusUnlocked || isMyRow ? (
                        <>
                          <span style={{ color: 'var(--op-ink)' }}>
                            ${Math.round(endP).toLocaleString('en-US')}
                          </span>
                          <span
                            className="ml-1.5 text-[12px]"
                            style={{ color: pct >= 0 ? 'var(--op-bull)' : 'var(--op-bear)' }}
                          >
                            ({formatPct(pct)})
                          </span>
                        </>
                      ) : (
                        <span className="op-mono text-[12px]" style={{ color: 'var(--op-ink-3)' }}>
                          {t('비공개', 'Locked')}
                        </span>
                      )}
                    </td>

                    <td>
                      {isConsensusUnlocked || isMyRow ? (
                        <span className="line-clamp-1 text-[12.5px]" style={{ color: 'var(--op-ink-2)' }}>
                          {fc.comment ? localizeDataText(fc.comment, locale) : '-'}
                        </span>
                      ) : (
                        <span className="text-[12px]" style={{ color: 'var(--op-ink-3)' }}>
                          -
                        </span>
                      )}
                    </td>

                    <td className="op-num whitespace-nowrap">
                      {isConsensusUnlocked || isMyRow ? (
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {!isMyRow && (
                            <button
                              type="button"
                              aria-pressed={isOverlaid}
                              onClick={() => onToggleOverlay(fc, handle, elo)}
                              className="h-7 px-2.5 rounded-[2px] text-[12px] font-medium transition-colors cursor-pointer"
                              style={
                                isOverlaid
                                  ? {
                                      backgroundColor: 'var(--op-orange)',
                                      color: 'var(--op-on-orange)',
                                    }
                                  : {
                                      backgroundColor: 'transparent',
                                      color: 'var(--op-ink-2)',
                                      border: '1px solid var(--op-line-strong)',
                                    }
                              }
                            >
                              {isOverlaid ? t('비교 중', 'Overlaid') : t('차트 비교', 'Overlay')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onNavigateDetail(fc.id)}
                            className="op-btn-ghost h-7 px-2.5 text-[12px] rounded-[2px]"
                          >
                            {t('상세', 'Details')} <ArrowUpRight size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11.5px] op-mono" style={{ color: 'var(--op-ink-3)' }}>
                          <Lock size={11} aria-hidden="true" />
                          {t('잠금', 'Locked')}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
