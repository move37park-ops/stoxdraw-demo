import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId, subscribeSession } from '../../data/session';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecastsWithCohort } from '../../domain/resolution';
import { getStockHistory } from '../../data/market';
import { getEloTierInfo, DEFAULT_ELO, MIN_ELO, formatSignedLp } from '../../domain/elo';
import { CompactForecastCard } from '../../components/CompactForecastCard';
import { localizeDataText, useI18n } from '../../lib/i18nCore';
import type { User, Forecast } from '../../domain/types';

interface ProfilePageProps {
  currentDateStr: string;
}

export function ProfilePage({ currentDateStr }: ProfilePageProps) {
  const { locale, t } = useI18n();
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'forecasts' | 'results'>('forecasts');
  const [repoTick, setRepoTick] = useState(0);
  const [, setFollowTick] = useState(0);

  useEffect(() => {
    const bump = () => setRepoTick(c => c + 1);
    const unsubRepo = repository.subscribe(bump);
    const unsubSession = subscribeSession(bump);
    return () => {
      unsubRepo();
      unsubSession();
    };
  }, []);

  const isMeRoute = !handle || handle === 'me' || handle === 'record';

  const currentUser = useMemo(() => {
    void repoTick;
    return getCurrentUser();
  }, [repoTick]);

  const { user, forecasts } = useMemo<{ user: User | undefined; forecasts: Forecast[] }>(() => {
    void repoTick;
    if (isMeRoute) {
      if (currentUser) {
        return {
          user: currentUser,
          forecasts: repository.listByUser(currentUser.id),
        };
      }
      const anonId = getOrCreateAnonId();
      const cleanSuffix = anonId.replace(/^anon[_-]?/i, '').slice(0, 4) || 'guest';
      const all = repository.listFeed('all', currentDateStr);
      const myAnonList = all.filter(f => f.anonId === anonId);
      const myAnonUser: User = {
        id: anonId,
        handle: `guest_${cleanSuffix}`,
        name: '게스트 참여자',
        avatarUrl: '',
        bio: '이 브라우저에 저장된 예측 기록입니다.',
        forecastsCount: myAnonList.length,
        completedCount: myAnonList.filter(
          f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED'
        ).length,
        elo: DEFAULT_ELO,
      };
      return { user: myAnonUser, forecasts: myAnonList };
    }

    const targetUser = handle ? repository.getUserByHandle(handle) : undefined;
    return {
      user: targetUser,
      forecasts: targetUser ? repository.listByUser(targetUser.id) : [],
    };
  }, [handle, isMeRoute, currentUser, currentDateStr, repoTick]);

  const resolvedForecasts = forecasts.filter(
    f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED'
  );

  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [tabRect, setTabRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    ready: boolean;
  }>({ left: 0, top: 0, width: 0, height: 0, ready: false });

  useLayoutEffect(() => {
    if (!user) return;
    const syncTab = () => {
      const idx = activeTab === 'forecasts' ? 0 : 1;
      const el = tabBtnRefs.current[idx];
      if (!el) return;
      setTabRect({
        left: el.offsetLeft,
        top: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
        ready: el.offsetWidth > 0,
      });
    };

    syncTab();
    const bar = tabBarRef.current;
    let observer: ResizeObserver | null = null;
    if (bar && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(syncTab);
      observer.observe(bar);
    }
    window.addEventListener('resize', syncTab);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncTab);
    };
  }, [user, activeTab, forecasts.length, resolvedForecasts.length, locale]);

  if (!user) {
    return (
      <div className="p-16 text-center space-y-4">
        <p className="v-heading-16" style={{ color: 'var(--v-ink)' }}>
          {t('예측 기록을 찾을 수 없습니다.', 'Forecaster profile not found.')}
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="op-btn-primary"
        >
          {t('예측하기 화면으로 돌아가기', 'Back to Predict')}
        </button>
      </div>
    );
  }

  const isMe =
    isMeRoute ||
    (currentUser && handle?.toLowerCase() === currentUser.handle.toLowerCase());
  const isFollowing = repository.isFollowing(user.id);

  const handleFollowToggle = () => {
    repository.toggleFollow(user.id);
    setFollowTick(t => t + 1);
  };

  const baseElo = user.elo ?? DEFAULT_ELO;
  let hitCount = 0;
  let totalScoreSum = 0;
  let scoredCount = 0;
  let netLpDelta = 0;

  const allResolvedInRepo = repository
    .listFeed('all', currentDateStr)
    .filter(f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED');
  const userEloMap: Record<string, number> = {};
  repository.listAllUsers().forEach(u => {
    userEloMap[u.id] = u.elo ?? DEFAULT_ELO;
  });
  userEloMap[user.id] = baseElo;
  const visibleBtcBars = getStockHistory('BTC/USDT').filter(b => b.date <= currentDateStr);
  const cohortResults = resolveForecastsWithCohort(
    allResolvedInRepo,
    visibleBtcBars,
    userEloMap
  );

  resolvedForecasts.forEach(f => {
    const res = cohortResults.get(f.id);
    if (!res) return;
    const isHit = f.mode === 'breakout' ? res.breakoutHit : res.directionHit;
    if (isHit) hitCount++;
    if (res.score) {
      totalScoreSum += res.score.total;
      scoredCount++;
    }
    if (res.eloSettlement) {
      netLpDelta += res.eloSettlement.deltaLp;
    }
  });

  const liveElo = Math.max(MIN_ELO, baseElo + netLpDelta);
  const tierInfo = getEloTierInfo(liveElo);

  const hitRate =
    resolvedForecasts.length > 0
      ? Math.round((hitCount / resolvedForecasts.length) * 100)
      : null;
  const avgScore =
    scoredCount > 0 ? (totalScoreSum / scoredCount).toFixed(1) : null;

  const displayedList = activeTab === 'results' ? resolvedForecasts : forecasts;

  const boxStyle = {
    backgroundColor: 'var(--op-canvas)',
    border: '1px solid var(--op-line-strong)',
    borderRadius: '2px',
  } as const;

  return (
    <div className="px-4 sm:px-6 pt-4 pb-6 space-y-4 op-view-enter" style={{ backgroundColor: 'var(--op-canvas)' }}>
      {/* ZONE 1: 12-Col Bento Header (7 Cols Profile Box | 5 Cols 3 KPI Boxes) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left 7 Cols Box: Identity, Bio & Elo Tier Progression */}
        <div
          className="lg:col-span-7 p-5 flex flex-col justify-between gap-4 min-w-0"
          style={boxStyle}
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1
                  className="v-mono text-xl font-semibold tracking-tight"
                  style={{ color: 'var(--v-ink)' }}
                >
                  @{user.handle}
                </h1>
                <span
                  className="v-caption-mono px-2 py-0.5 rounded-[2px] inline-flex items-center gap-1.5 font-semibold"
                  style={{
                    backgroundColor: 'var(--op-panel)',
                    border: '1px solid var(--op-line-strong)',
                    color: tierInfo.accentHex,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-[1.5px] flex-shrink-0"
                    style={{ backgroundColor: tierInfo.accentHex }}
                    aria-hidden="true"
                  />
                  {locale === 'en' ? tierInfo.title : `${tierInfo.krTitle} (${tierInfo.tier})`} · {liveElo} LP
                </span>
                {netLpDelta !== 0 && (
                  <span
                    className="v-mono text-xs font-semibold"
                    style={{
                      color:
                        netLpDelta >= 0 ? 'var(--v-bull)' : 'var(--v-bear)',
                    }}
                  >
                    ({formatSignedLp(netLpDelta)})
                  </span>
                )}
              </div>

              {!isMe && (
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  className={isFollowing ? 'v-btn-secondary rounded-[2px]' : 'v-btn-primary rounded-[2px]'}
                >
                  {isFollowing ? t('팔로잉', 'Following') : t('팔로우', 'Follow')}
                </button>
              )}
            </div>

            <p className="v-body-sm mt-2" style={{ color: 'var(--v-body)' }}>
              {localizeDataText(user.bio, locale)}
            </p>
          </div>

          {/* Elo Tier Progress Bar with 5-Tier Milestones */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between v-caption-mono">
              <span style={{ color: 'var(--v-ink)' }}>
                {t(`다음 등급까지 진행률 (${tierInfo.progressPct}%)`, `Tier Progress (${tierInfo.progressPct}%)`)}
              </span>
              <span style={{ color: tierInfo.accentHex }}>
                {tierInfo.nextTierElo
                  ? t(`다음 등급까지 필요한 ${tierInfo.nextTierElo - liveElo} LP`, `${tierInfo.nextTierElo - liveElo} LP to next tier`)
                  : t('최고 등급 달성', 'Max Diamond Tier Reached')}
              </span>
            </div>
            <div
              className="w-full h-2 rounded-[2px] overflow-hidden"
              style={{ backgroundColor: 'var(--op-raised)' }}
            >
              <div
                className="h-full rounded-[2px] transition-all duration-300"
                style={{
                  width: `${Math.max(6, tierInfo.progressPct)}%`,
                  backgroundColor: tierInfo.accentHex,
                }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 v-caption-mono text-xs pt-0.5">
              {[
                { label: t('브론즈', 'Bronze'), lp: 600 },
                { label: t('실버', 'Silver'), lp: 1200 },
                { label: t('골드', 'Gold'), lp: 1400 },
                { label: t('플래티넘', 'Platinum'), lp: 1600 },
                { label: t('다이아', 'Diamond'), lp: 1800 },
              ].map(m => {
                const reached = liveElo >= m.lp;
                return (
                  <span
                    key={m.lp}
                    style={{
                      color: reached ? 'var(--v-ink)' : 'var(--v-mute)',
                      fontWeight: reached ? 600 : 400,
                    }}
                  >
                    {m.label} ({m.lp})
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Compact Unified 3-Metric Box */}
        <div
          className="lg:col-span-5 grid grid-cols-3 divide-x divide-[var(--op-line)] min-w-0"
          style={boxStyle}
        >
          <div className="p-4 sm:p-5 flex flex-col justify-between min-w-0">
            <span className="v-caption" style={{ color: 'var(--v-mute)' }}>
              {t('제출', 'Submitted')}
            </span>
            <p
              className="v-mono text-xl font-semibold tracking-tight mt-2"
              style={{ color: 'var(--v-ink)' }}
            >
              {t(`${forecasts.length}건`, `${forecasts.length}`)}
            </p>
          </div>

          <div className="p-4 sm:p-5 flex flex-col justify-between min-w-0">
            <span className="v-caption" style={{ color: 'var(--v-mute)' }}>
              {t('평가 완료', 'Evaluated')}
            </span>
            <p
              className="v-mono text-xl font-semibold tracking-tight mt-2"
              style={{ color: 'var(--v-ink)' }}
            >
              {t(`${resolvedForecasts.length}건`, `${resolvedForecasts.length}`)}
            </p>
          </div>

          <div className="p-4 sm:p-5 flex flex-col justify-between min-w-0">
            <span className="v-caption" style={{ color: 'var(--v-mute)' }}>
              {avgScore !== null ? t('평균 예측 점수', 'Avg Score') : t('방향 적중률', 'Hit Rate')}
            </span>
            <p
              className="v-mono text-xl font-semibold tracking-tight mt-2"
              style={{ color: 'var(--v-bull)' }}
            >
              {avgScore !== null
                ? t(`${avgScore}점`, `${avgScore}`)
                : hitRate !== null
                ? `${hitRate}%`
                : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* ZONE 2: Boxed Forecaster Deployment & Settlement History */}
      <section className="overflow-hidden" style={boxStyle}>
        <div
          className="px-5 flex flex-wrap items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--op-panel)',
            borderBottom: '1px solid var(--op-line)',
          }}
        >
          <div
            ref={tabBarRef}
            role="tablist"
            aria-label={t('예측 기록 탭', 'Forecast record tabs')}
            className="relative flex items-center gap-2"
          >
            <span
              aria-hidden="true"
              className="op-sliding-glow"
              style={{
                transform: `translate3d(${tabRect.left}px, ${tabRect.top + 6}px, 0)`,
                width: `${tabRect.width}px`,
                height: `${Math.max(0, tabRect.height - 12)}px`,
                opacity: tabRect.ready ? 1 : 0,
              }}
            />
            <span
              aria-hidden="true"
              className="op-sliding-underline"
              style={{
                transform: `translate3d(${tabRect.left}px, 0, 0)`,
                width: `${tabRect.width}px`,
                opacity: tabRect.ready ? 1 : 0,
              }}
            />
            {[
              {
                id: 'forecasts' as const,
                label: t(`전체 (${forecasts.length})`, `All (${forecasts.length})`),
              },
              {
                id: 'results' as const,
                label: t(`평가 완료 (${resolvedForecasts.length})`, `Evaluated (${resolvedForecasts.length})`),
              },
            ].map((tab, idx) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`profile-tab-${tab.id}`}
                  role="tab"
                  aria-selected={active}
                  aria-controls={`profile-tabpanel-${tab.id}`}
                  ref={el => {
                    tabBtnRefs.current[idx] = el;
                  }}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="relative z-10 px-2.5 py-3 text-xs font-medium transition-colors whitespace-nowrap"
                  style={{
                    color: active ? 'var(--op-orange)' : 'var(--v-mute)',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          key={activeTab}
          role="tabpanel"
          id={`profile-tabpanel-${activeTab}`}
          aria-labelledby={`profile-tab-${activeTab}`}
          className="op-view-enter"
        >
          {displayedList.length > 0 ? (
            <div className="divide-y divide-[var(--op-line)]">
              {displayedList.map(forecast => (
                <CompactForecastCard
                  key={forecast.id}
                  forecast={forecast}
                  currentDateStr={currentDateStr}
                  borderless={true}
                />
              ))}
            </div>
          ) : (
            <div className="p-16 text-center space-y-4">
              <p className="v-body-sm" style={{ color: 'var(--v-mute)' }}>
                {activeTab === 'results'
                  ? t('평가 완료된 예측이 없습니다.', 'No evaluated forecasts yet.')
                  : t('아직 예측 기록이 없습니다.', 'No forecasts yet.')}
              </p>
              {isMe && (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="op-btn-primary"
                >
                  {t('예측하러 가기', 'Make a Forecast')}
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default ProfilePage;
