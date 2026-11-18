import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { repository } from '../../data/localRepository';
import { getCurrentUser } from '../../data/session';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecastsWithCohort } from '../../domain/resolution';
import { getBtcHistoryBars } from '../../data/btcMarket';
import {
  getEloTierInfo,
  DEFAULT_ELO,
  MIN_ELO,
  formatSignedLp,
  isProvisionalAccount,
  type EloTierInfo,
} from '../../domain/elo';
import { localizeDataText, useI18n } from '../../lib/i18nCore';
import type { User, Forecast } from '../../domain/types';

interface LeaderboardPageProps {
  currentDateStr: string;
  embedded?: boolean;
}

interface RankedUser extends User {
  rank: number;
  liveElo: number;
  netLpDelta: number;
  tierInfo: EloTierInfo;
  score: number;
  accuracy: string;
  verifiedCount: number;
  isProvisional: boolean;
}

const USER_META: Record<
  string,
  {
    defaultScore: number;
    baseElo: number;
  }
> = {
  u_quant: { defaultScore: 91.4, baseElo: 1890 },
  u_alpha: { defaultScore: 87.8, baseElo: 1820 },
  u_satoshi: { defaultScore: 83.5, baseElo: 1640 },
  u_bull: { defaultScore: 79.2, baseElo: 1460 },
  u_macro: { defaultScore: 73.6, baseElo: 1240 },
  u_rookie: { defaultScore: 65.0, baseElo: 980 },
};

export function LeaderboardPage({ currentDateStr, embedded = false }: LeaderboardPageProps) {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsub = repository.subscribe(() => setTick(t => t + 1));
    return () => unsub();
  }, []);

  const currentUser = getCurrentUser();

  const allFeedForecasts = useMemo(
    () => repository.listFeed('all', currentDateStr),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentDateStr, tick]
  );

  const rankedUsers: RankedUser[] = useMemo(() => {
    void tick;
    const rawUsers = repository.listAllUsers();
    const btcBars = getBtcHistoryBars().filter(b => b.date <= currentDateStr);
    const resolvedAll = allFeedForecasts.filter(
      f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED'
    );
    const userEloMap: Record<string, number> = {};
    rawUsers.forEach(u => {
      userEloMap[u.id] = u.elo ?? USER_META[u.id]?.baseElo ?? DEFAULT_ELO;
    });
    const cohortResults = resolveForecastsWithCohort(resolvedAll, btcBars, userEloMap);

    const forecastsByUser = new Map<string, Forecast[]>();
    allFeedForecasts.forEach(f => {
      if (!f.authorId) return;
      const bucket = forecastsByUser.get(f.authorId);
      if (bucket) bucket.push(f);
      else forecastsByUser.set(f.authorId, [f]);
    });

    const scored = rawUsers.map(u => {
      const forecasts = forecastsByUser.get(u.id) ?? [];
      const resolved = forecasts.filter(
        f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED'
      );

      const meta = USER_META[u.id] || {
        defaultScore: 72.0,
        baseElo: u.elo ?? DEFAULT_ELO,
      };

      const baseElo = u.elo ?? meta.baseElo;

      let hitCount = 0;
      let scoreSum = 0;
      let scoreCount = 0;
      let netLpDelta = 0;

      resolved.forEach(f => {
        const res = cohortResults.get(f.id);
        if (!res) return;
        if (res.directionHit) hitCount++;
        if (res.score) {
          scoreSum += res.score.total;
          scoreCount++;
        }
        if (res.eloSettlement) {
          netLpDelta += res.eloSettlement.deltaLp;
        }
      });

      const liveElo = Math.max(MIN_ELO, baseElo + netLpDelta);
      const tierInfo = getEloTierInfo(liveElo);

      const score =
        scoreCount > 0
          ? parseFloat((scoreSum / scoreCount).toFixed(1))
          : meta.defaultScore;
      const accuracy =
        resolved.length > 0
          ? `${Math.round((hitCount / resolved.length) * 100)}%`
          : `${Math.round(meta.defaultScore)}%`;

      const verifiedCount = resolved.length + u.completedCount;

      return {
        ...u,
        rank: 0,
        liveElo,
        netLpDelta,
        tierInfo,
        score,
        accuracy,
        verifiedCount,
        isProvisional: isProvisionalAccount(verifiedCount),
      };
    });

    return scored
      .sort(
        (a, b) =>
          Number(a.isProvisional) - Number(b.isProvisional) ||
          b.liveElo - a.liveElo ||
          b.score - a.score
      )
      .map((u, idx) => ({ ...u, rank: idx + 1 }));
  }, [currentDateStr, tick, allFeedForecasts]);

  const boxStyle = {
    backgroundColor: 'var(--op-canvas)',
    border: '1px solid var(--op-line-strong)',
    borderRadius: '2px',
  } as const;

  return (
    <div
      className={embedded ? 'space-y-4 op-view-enter' : 'px-4 sm:px-6 pt-4 pb-6 space-y-4 op-view-enter'}
      style={{ backgroundColor: 'var(--op-canvas)' }}
    >
      {!embedded && (
        <header className="px-1 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="v-display-md" style={{ color: 'var(--v-ink)' }}>
              {t('리더보드', 'Leaderboard')}
            </h1>
            <p className="v-caption mt-0.5" style={{ color: 'var(--v-mute)' }}>
              {t(
                '7일 예측 평가 완료 기록을 기준으로 산정한 예측자 평판 순위입니다.',
                'Forecaster rankings weighted by evaluated 7-day forecast performance.'
              )}
            </p>
          </div>
          <span className="v-caption-mono text-xs" style={{ color: 'var(--v-mute)' }}>
            {t(`참여자 ${rankedUsers.length}명`, `${rankedUsers.length} Forecasters`)}
          </span>
        </header>
      )}

      {/* Clean 5-Column Ranking Table */}
      <section className="overflow-hidden" style={boxStyle}>
        <div className="overflow-x-auto">
          <table className="v-audit-table">
            <thead>
              <tr>
                <th className="w-16">{t('순위', 'Rank')}</th>
                <th>{t('예측자', 'Forecaster')}</th>
                <th>{t('평판 등급 · LP', 'Tier · LP')}</th>
                <th className="v-numeric">{t('평균 예측 점수', 'Avg Score')}</th>
                <th className="v-numeric">{t('방향 적중률 · 완료', 'Accuracy · Evaluated')}</th>
              </tr>
            </thead>
            <tbody>
              {rankedUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center v-caption"
                    style={{ color: 'var(--v-mute)' }}
                  >
                    {t('등록된 예측자가 없습니다.', 'No forecasters yet.')}
                  </td>
                </tr>
              ) : (
                rankedUsers.map(u => {
                  const isMe = currentUser?.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      style={{
                        backgroundColor: isMe
                          ? 'var(--v-canvas-soft)'
                          : undefined,
                      }}
                    >
                      <td className="v-mono font-bold">
                        <span
                          style={{
                            color: u.rank <= 3 ? 'var(--op-orange)' : 'var(--v-mute)',
                          }}
                        >
                          #{u.rank}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() => navigate(`/u/${u.handle}`)}
                          className="text-left group inline-flex items-baseline gap-2 cursor-pointer"
                        >
                          <span
                            className="v-body-sm-strong group-hover:underline"
                            style={{ color: 'var(--v-ink)' }}
                          >
                            @{u.handle}
                          </span>
                          <span
                            className="v-caption text-xs hidden sm:inline"
                            style={{ color: 'var(--v-mute)' }}
                          >
                            {localizeDataText(u.name, locale)}
                          </span>
                        </button>
                      </td>

                      <td>
                        <div className="inline-flex items-center gap-2 v-caption">
                          <span
                            className="w-2 h-2 rounded-[2px] flex-shrink-0"
                            style={{ backgroundColor: u.tierInfo.accentHex }}
                          />
                          <span className="font-semibold" style={{ color: u.tierInfo.accentHex }}>
                            {locale === 'en' ? u.tierInfo.title : u.tierInfo.krTitle}
                          </span>
                          <span className="v-mono font-medium" style={{ color: 'var(--v-mute)' }}>
                            {u.liveElo.toLocaleString('en-US')} LP
                          </span>
                          {u.netLpDelta !== 0 && (
                            <span
                              className="v-mono text-xs"
                              style={{
                                color:
                                  u.netLpDelta >= 0
                                    ? 'var(--v-bull)'
                                    : 'var(--v-bear)',
                              }}
                            >
                              ({formatSignedLp(u.netLpDelta)})
                            </span>
                          )}
                        </div>
                      </td>

                      <td
                        className="v-numeric font-semibold"
                        style={{ color: 'var(--v-ink)' }}
                      >
                        {t(`${u.score.toFixed(1)}점`, `${u.score.toFixed(1)} pts`)}
                      </td>

                      <td className="v-numeric">
                        <span className="font-semibold" style={{ color: 'var(--v-bull)' }}>
                          {u.accuracy}
                        </span>
                        <span className="mx-1.5" style={{ color: 'var(--v-mute)' }}>·</span>
                        <span style={{ color: 'var(--v-body)' }}>
                          {t(`${u.verifiedCount}회`, `${u.verifiedCount}`)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
