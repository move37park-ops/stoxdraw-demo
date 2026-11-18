import { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId } from '../../data/session';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecastsWithCohort } from '../../domain/resolution';
import { getBtcHistoryBars, DEFAULT_BASE_DATE } from '../../data/btcMarket';
import {
  getEloTierInfo,
  DEFAULT_ELO,
  MIN_ELO,
  formatSignedLp,
  isProvisionalAccount,
  PROVISIONAL_MIN_ROUNDS,
  type EloTierInfo,
} from '../../domain/elo';
import { localizeDataText, useI18n } from '../../lib/i18nCore';
import type { User, Forecast, EloTier } from '../../domain/types';

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
  totalCount: number;
  avgMae: string;
  latestForecast?: Forecast;
}

const USER_META: Record<
  string,
  {
    defaultScore: number;
    baseElo: number;
  }
> = {
  u_quant: {
    defaultScore: 91.4,
    baseElo: 1890,
  },
  u_alpha: {
    defaultScore: 87.8,
    baseElo: 1820,
  },
  u_satoshi: {
    defaultScore: 83.5,
    baseElo: 1640,
  },
  u_bull: {
    defaultScore: 79.2,
    baseElo: 1460,
  },
  u_macro: {
    defaultScore: 73.6,
    baseElo: 1240,
  },
  u_rookie: {
    defaultScore: 65.0,
    baseElo: 980,
  },
};

const TIER_FILTERS: {
  id: 'ALL' | EloTier;
  ko: string;
  en: string;
  minLp?: string;
  color?: string;
  softBg?: string;
}[] = [
  { id: 'ALL', ko: '전체', en: 'ALL' },
  {
    id: 'DIAMOND',
    ko: '다이아몬드',
    en: 'DIAMOND',
    minLp: '1,800+',
    color: '#3291ff',
    softBg: 'rgba(50, 145, 255, 0.15)',
  },
  {
    id: 'PLATINUM',
    ko: '플래티넘',
    en: 'PLATINUM',
    minLp: '1,600+',
    color: '#00e599',
    softBg: 'rgba(0, 229, 153, 0.14)',
  },
  {
    id: 'GOLD',
    ko: '골드',
    en: 'GOLD',
    minLp: '1,400+',
    color: '#f5a623',
    softBg: 'rgba(245, 166, 35, 0.15)',
  },
  {
    id: 'SILVER',
    ko: '실버',
    en: 'SILVER',
    minLp: '1,200+',
    color: '#a1a1aa',
    softBg: 'rgba(161, 161, 170, 0.15)',
  },
  {
    id: 'BRONZE',
    ko: '브론즈',
    en: 'BRONZE',
    minLp: '600+',
    color: '#71717a',
    softBg: 'rgba(113, 113, 122, 0.18)',
  },
];

export function LeaderboardPage({ currentDateStr, embedded = false }: LeaderboardPageProps) {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const [tierFilter, setTierFilter] = useState<'ALL' | EloTier>('ALL');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsub = repository.subscribe(() => setTick(t => t + 1));
    return () => unsub();
  }, []);

  const currentUser = getCurrentUser();
  const anonId = getOrCreateAnonId();

  const allFeedForecasts = useMemo(
    () => repository.listFeed('all', currentDateStr),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentDateStr, tick]
  );

  const hasSubmittedCurrentRound = useMemo(() => {
    return allFeedForecasts.some(
      f =>
        f.baseDate === DEFAULT_BASE_DATE &&
        ((currentUser && f.authorId === currentUser.id) || f.anonId === anonId)
    );
  }, [allFeedForecasts, currentUser, anonId]);

  const rankedUsers: RankedUser[] = useMemo(() => {
    void tick;
    const rawUsers = repository.listAllUsers();
    const btcBars = getBtcHistoryBars().filter(b => b.date <= currentDateStr);
    const allForecasts = allFeedForecasts;
    const resolvedAll = allForecasts.filter(
      f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED'
    );
    const userEloMap: Record<string, number> = {};
    rawUsers.forEach(u => {
      userEloMap[u.id] = u.elo ?? USER_META[u.id]?.baseElo ?? DEFAULT_ELO;
    });
    const cohortResults = resolveForecastsWithCohort(resolvedAll, btcBars, userEloMap);

    const forecastsByUser = new Map<string, Forecast[]>();
    allForecasts.forEach(f => {
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
      let errorSum = 0;
      let netLpDelta = 0;

      resolved.forEach(f => {
        const res = cohortResults.get(f.id);
        if (!res) return;
        if (res.directionHit) hitCount++;
        if (res.score) {
          scoreSum += res.score.total;
          scoreCount++;
        }
        if (res.endErrorPct !== undefined) {
          errorSum += res.endErrorPct;
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
      const avgMae =
        resolved.length > 0
          ? `${(errorSum / resolved.length).toFixed(2)}%`
          : `${Math.max(1.1, (100 - meta.defaultScore) * 0.16).toFixed(2)}%`;

      const verifiedCount = resolved.length + u.completedCount;
      const sortedUserForecasts = [...forecasts].sort(
        (a, b) => new Date(b.lockedAt).getTime() - new Date(a.lockedAt).getTime()
      );
      const visibleForecast = sortedUserForecasts.find(f => {
        if (f.baseDate !== DEFAULT_BASE_DATE) return true;
        if (hasSubmittedCurrentRound) return true;
        return (currentUser && f.authorId === currentUser.id) || f.anonId === anonId;
      });

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
        totalCount: forecasts.length + u.forecastsCount,
        avgMae,
        latestForecast: visibleForecast,
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
  }, [currentDateStr, tick, allFeedForecasts, hasSubmittedCurrentRound, currentUser, anonId]);

  const filteredUsers = useMemo(() => {
    if (tierFilter === 'ALL') return rankedUsers;
    return rankedUsers.filter(u => u.tierInfo.tier === tierFilter);
  }, [rankedUsers, tierFilter]);

  const boxStyle = {
    backgroundColor: 'var(--op-canvas)',
    border: '1px solid var(--op-line-strong)',
    borderRadius: '2px',
  } as const;

  const tierWrapRef = useRef<HTMLDivElement>(null);
  const tierBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [tierGlow, setTierGlow] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    ready: boolean;
  }>({ left: 0, top: 0, width: 0, height: 0, ready: false });

  const activeTierIdx = TIER_FILTERS.findIndex(tf => tf.id === tierFilter);
  const activeTierSoftBg = activeTierIdx >= 0 ? TIER_FILTERS[activeTierIdx]?.softBg : undefined;

  useLayoutEffect(() => {
    const syncTierGlow = () => {
      const btn = activeTierIdx >= 0 ? tierBtnRefs.current[activeTierIdx] : null;
      if (!btn) return;
      setTierGlow({
        left: btn.offsetLeft,
        top: btn.offsetTop,
        width: btn.offsetWidth,
        height: btn.offsetHeight,
        ready: btn.offsetWidth > 0,
      });
    };

    syncTierGlow();
    const wrap = tierWrapRef.current;
    let observer: ResizeObserver | null = null;
    if (wrap && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(syncTierGlow);
      observer.observe(wrap);
    }
    window.addEventListener('resize', syncTierGlow);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncTierGlow);
    };
  }, [activeTierIdx, filteredUsers.length, locale]);

  return (
    <div
      className={embedded ? 'space-y-4 op-view-enter' : 'px-4 sm:px-6 pt-4 pb-6 space-y-4 op-view-enter'}
      style={{ backgroundColor: 'var(--op-canvas)' }}
    >
      {/* Box 1: Compact Header (standalone only), Standing & Tier Filter */}
      <section className="overflow-hidden" style={boxStyle}>
        {!embedded && (
          <div className="px-5 py-4">
            <h1 className="v-display-md" style={{ color: 'var(--v-ink)' }}>
              {t('예측자 순위', 'Forecaster Rankings')}
            </h1>
            <p className="v-caption mt-0.5" style={{ color: 'var(--v-mute)' }}>
              {t(
                '7일 예측 경로의 오차율과 방향 정확도를 반영한 참여자 평판 순위입니다.',
                'Forecaster rankings weighted by 7-day forecast path accuracy and directional hit rate.'
              )}
            </p>
          </div>
        )}

        {/* Unified Tier Filter Bar */}
        <div
          className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--op-panel)',
            borderTop: embedded ? 'none' : '1px solid var(--op-line)',
          }}
        >
          <div ref={tierWrapRef} className="relative flex flex-wrap items-center gap-1.5">
            <span
              aria-hidden="true"
              className="op-sliding-glow"
              style={{
                transform: `translate3d(${tierGlow.left}px, ${tierGlow.top}px, 0)`,
                width: `${tierGlow.width}px`,
                height: `${tierGlow.height}px`,
                opacity: tierGlow.ready ? 1 : 0,
                backgroundColor: activeTierSoftBg,
              }}
            />
            {TIER_FILTERS.map((tf, idx) => {
              const active = tf.id === tierFilter;
              const tierAccent = tf.color;
              return (
                <button
                  key={tf.id}
                  ref={el => {
                    tierBtnRefs.current[idx] = el;
                  }}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTierFilter(tf.id)}
                  className="relative z-10 h-7 px-2.5 rounded-[6px] inline-flex items-center gap-1.5 text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: active ? 'transparent' : 'var(--op-canvas)',
                    color: tierAccent ?? (active ? 'var(--op-orange)' : 'var(--v-body)'),
                    border: active
                      ? '1px solid transparent'
                      : '1px solid var(--op-line)',
                  }}
                >
                  {tf.color && (
                    <span
                      className="w-2 h-2 rounded-[1.5px] flex-shrink-0"
                      style={{ backgroundColor: tf.color }}
                    />
                  )}
                  <span>{locale === 'en' ? tf.en : tf.ko}</span>
                  {tf.minLp && (
                    <span
                      className="v-mono text-[11px] font-medium"
                      style={{
                        color: active ? (tierAccent ?? 'var(--op-orange)') : 'var(--v-mute)',
                      }}
                    >
                      {tf.minLp}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <span className="v-caption-mono text-xs" style={{ color: 'var(--v-mute)' }}>
            {t(`참여자 ${filteredUsers.length}명`, `${filteredUsers.length} Forecasters`)}
          </span>
        </div>
      </section>

      {/* Box 2: Single Clean Ranking Table */}
      <section className="overflow-hidden" style={boxStyle}>
        <div className="overflow-x-auto">
          <table className="v-audit-table">
            <thead>
              <tr>
                <th className="w-16">{t('순위', 'Rank')}</th>
                <th>{t('참여자', 'Forecaster')}</th>
                <th>{t('예측자 등급 · LP', 'Tier · LP')}</th>
                <th className="v-numeric">{t('평균 예측 점수', 'Avg Score')}</th>
                <th className="v-numeric">{t('방향 정확도', 'Dir Accuracy')}</th>
                <th className="v-numeric">{t('평균 오차', 'Avg MAE')}</th>
                <th className="v-numeric">{t('평가 완료 횟수', 'Evaluated')}</th>
                <th className="v-numeric">{t('예측 경로', 'Path')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-12 text-center v-caption"
                    style={{ color: 'var(--v-mute)' }}
                  >
                    {t('해당 등급에 속한 참여자가 없습니다.', 'No forecasters in this tier.')}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
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
                            color:
                              u.rank <= 3 ? 'var(--v-ink)' : 'var(--v-mute)',
                          }}
                        >
                          {u.rank}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() => navigate(`/u/${u.handle}`)}
                          className="text-left group inline-flex items-baseline gap-2"
                        >
                          <span
                            className="v-body-sm-strong group-hover:underline"
                            style={{ color: 'var(--v-ink)' }}
                          >
                            @{u.handle}
                          </span>
                          <span
                            className="v-caption text-xs"
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

                      <td
                        className="v-numeric font-semibold"
                        style={{ color: 'var(--v-bull)' }}
                      >
                        {u.accuracy}
                      </td>

                      <td
                        className="v-numeric"
                        style={{ color: 'var(--v-mute)' }}
                      >
                        ±{u.avgMae}
                      </td>

                      <td
                        className="v-numeric"
                        style={{ color: 'var(--v-body)' }}
                      >
                        <span>{t(`${u.verifiedCount}회`, `${u.verifiedCount}`)}</span>
                        {u.isProvisional && (
                          <span
                            className="ml-1.5 px-1.5 py-0.5 rounded-[2px] text-[10px] font-medium"
                            style={{
                              backgroundColor: 'var(--op-raised)',
                              border: '1px solid var(--op-line)',
                              color: 'var(--v-mute)',
                            }}
                            title={t(
                              `평가 완료 예측 ${PROVISIONAL_MIN_ROUNDS}회부터 정식 순위에 반영됩니다`,
                              `Needs ${PROVISIONAL_MIN_ROUNDS}+ evaluated forecasts for ranked standing`
                            )}
                          >
                            {t('잠정 순위', 'Prov')}
                          </span>
                        )}
                      </td>

                      <td className="v-numeric">
                        {u.latestForecast ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/f/${u.latestForecast!.id}`)
                            }
                            className="v-btn-secondary h-7 px-2.5 text-[12px] rounded-[2px]"
                          >
                            {t('예측 상세', 'View Path')} <ArrowUpRight size={12} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigate(`/u/${u.handle}`)}
                            className="v-btn-secondary h-7 px-2.5 text-[12px] rounded-[2px]"
                          >
                            {t('예측 기록', 'Profile')}
                          </button>
                        )}
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
