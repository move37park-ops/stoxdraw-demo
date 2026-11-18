import { useMemo } from 'react';
import { Lock } from 'lucide-react';
import { repository } from '../../data/localRepository';
import { BTC_DAILY_VOLATILITY } from '../../data/btcMarket';
import { DEFAULT_ELO, getEloTierInfo } from '../../domain/elo';
import { formatPct } from '../../domain/format';
import { calculateForecastScore } from '../../domain/scoring';
import { ForecastSparkline } from '../../components/ForecastSparkline';
import { useI18n } from '../../lib/i18nCore';
import type { Forecast, ScoreBreakdown, User } from '../../domain/types';
import type { OverlayRival } from './PathCanvas';

interface ParticipantsTableProps {
  forecasts: Forecast[];
  isConsensusUnlocked: boolean;
  roundStatus?: 'OPEN' | 'LIVE' | 'RESOLVED';
  settledCloses?: number[];
  realizedDailyVol?: number;
  myForecastId?: string;
  overlaidRivals: OverlayRival[];
  onToggleOverlay: (forecast: Forecast, handle: string, elo: number) => void;
  onNavigateProfile: (handle: string) => void;
  onNavigateDetail?: (forecastId: string) => void;
}

const EMPTY_CLOSES: number[] = [];

export function ParticipantsTable({
  forecasts,
  isConsensusUnlocked,
  roundStatus = 'OPEN',
  settledCloses = EMPTY_CLOSES,
  realizedDailyVol = BTC_DAILY_VOLATILITY,
  myForecastId,
  overlaidRivals,
  onToggleOverlay,
  onNavigateProfile,
}: ParticipantsTableProps) {
  const { t } = useI18n();

  const userById = useMemo(
    () => new Map<string, User>(repository.listAllUsers().map(u => [u.id, u])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [forecasts]
  );

  const hasTrackingCloses =
    (roundStatus === 'LIVE' || roundStatus === 'RESOLVED') && settledCloses.length > 0;

  const rankedRows = useMemo(() => {
    const mapped = forecasts.map(fc => {
      const author = fc.authorId ? userById.get(fc.authorId) ?? null : null;
      const handle = author
        ? author.handle
        : `guest_${fc.anonId.replace(/^anon[_-]?/i, '').slice(-4) || 'user'}`;
      const elo = author?.elo ?? DEFAULT_ELO;
      const tier = getEloTierInfo(elo);
      const path = fc.path || [];
      const endP = path.length > 0 ? path[path.length - 1].price : fc.basePrice;
      const pct = fc.basePrice > 0 ? ((endP - fc.basePrice) / fc.basePrice) * 100 : 0;
      const isMyRow = myForecastId === fc.id;

      let score: ScoreBreakdown | null = null;
      if (hasTrackingCloses && path.length > 0) {
        score = calculateForecastScore(
          path.map(pt => pt.price),
          settledCloses,
          fc.basePrice,
          realizedDailyVol
        );
      }

      return {
        fc,
        handle,
        elo,
        tier,
        endP,
        pct,
        isMyRow,
        score,
      };
    });

    if (hasTrackingCloses) {
      mapped.sort(
        (a, b) =>
          (b.score?.total ?? -1) - (a.score?.total ?? -1) ||
          b.elo - a.elo
      );
    } else {
      mapped.sort(
        (a, b) =>
          Number(b.isMyRow) - Number(a.isMyRow) ||
          b.elo - a.elo
      );
    }

    return mapped;
  }, [forecasts, userById, hasTrackingCloses, settledCloses, realizedDailyVol, myForecastId]);

  return (
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
            <th className="w-14">{t('순위', 'Rank')}</th>
            <th>{t('참여자', 'Forecaster')}</th>
            <th>{t('7일 예측 경로', '7D Path')}</th>
            <th className="op-num">{t('D+7 목표가', '7D Target')}</th>
            <th className="op-num">{t('점수 · 비교', 'Score · Compare')}</th>
          </tr>
        </thead>
        <tbody>
          {rankedRows.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="py-10 text-center text-[13px]"
                style={{ color: 'var(--op-ink-3)' }}
              >
                {t('해당 라운드에 제출된 예측이 없습니다.', 'No forecasts submitted in this round yet.')}
              </td>
            </tr>
          ) : (
            rankedRows.map((row, idx) => {
              const { fc, handle, elo, tier, endP, pct, isMyRow, score } = row;
              const rivalOverlay = overlaidRivals.find(r => r.forecast.id === fc.id);
              const isOverlaid = Boolean(rivalOverlay);
              const canReveal = isConsensusUnlocked || isMyRow;

              return (
                <tr
                  key={fc.id}
                  style={{
                    backgroundColor: isOverlaid
                      ? 'var(--op-raised)'
                      : isMyRow
                      ? 'rgba(255, 85, 0, 0.04)'
                      : undefined,
                  }}
                >
                  <td className="op-mono whitespace-nowrap font-semibold">
                    <span
                      style={{
                        color: idx === 0 && hasTrackingCloses ? 'var(--op-orange)' : 'var(--op-ink-2)',
                      }}
                    >
                      #{idx + 1}
                    </span>
                  </td>

                  <td className="whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
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
                      <span
                        className="inline-flex items-center gap-1 op-mono text-[11px]"
                        style={{ color: 'var(--op-ink-3)' }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-[1px]"
                          style={{ backgroundColor: tier.accentHex }}
                          aria-hidden="true"
                        />
                        {elo} LP
                      </span>
                    </div>
                  </td>

                  <td className="whitespace-nowrap">
                    {canReveal ? (
                      <ForecastSparkline
                        forecast={fc}
                        isActiveLayer={isOverlaid || isMyRow}
                        layerColor={isMyRow ? 'var(--op-orange)' : rivalOverlay?.colorVar}
                        width={96}
                        height={24}
                        pastDays={7}
                      />
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] op-mono"
                        style={{ color: 'var(--op-ink-3)' }}
                      >
                        <Lock size={10} aria-hidden="true" />
                        {t('비공개', 'Blind')}
                      </span>
                    )}
                  </td>

                  <td className="op-num whitespace-nowrap">
                    {canReveal ? (
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

                  <td className="op-num whitespace-nowrap">
                    {canReveal ? (
                      <div className="inline-flex items-center justify-end gap-2">
                        {hasTrackingCloses && score && (
                          <span
                            className="op-mono text-[12px] font-semibold"
                            style={{
                              color: score.total >= 75 ? 'var(--op-bull)' : 'var(--op-ink)',
                            }}
                          >
                            {score.total.toFixed(1)}
                            {t('점', ' pts')}
                          </span>
                        )}
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
                            {isOverlaid ? t('비교 중', 'Overlaid') : t('차트 겹쳐 보기', 'Overlay')}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[11.5px] op-mono"
                        style={{ color: 'var(--op-ink-3)' }}
                      >
                        <Lock size={11} aria-hidden="true" />
                        {t('비공개', 'Locked')}
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
  );
}
