import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId } from '../../data/session';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecast } from '../../domain/resolution';
import { getStockHistory } from '../../data/market';
import { getEloTierInfo, DEFAULT_ELO, formatSignedLp } from '../../domain/elo';
import { CompactForecastCard } from '../../components/CompactForecastCard';
import { ConnectModal } from '../auth/ConnectModal';
import type { User, Forecast } from '../../domain/types';

interface ProfilePageProps {
  currentDateStr: string;
}

export function ProfilePage({ currentDateStr }: ProfilePageProps) {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const [activeTab, setActiveTab] = useState<'forecasts' | 'results'>('forecasts');
  const [user, setUser] = useState<User | undefined>(undefined);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [, setFollowTick] = useState(0);

  const isMeRoute = !handle || handle === 'me' || handle === 'record';

  const loadData = useCallback(() => {
    if (isMeRoute) {
      if (currentUser) {
        setUser(currentUser);
        setForecasts(repository.listByUser(currentUser.id));
      } else {
        const anonId = getOrCreateAnonId();
        const cleanSuffix = anonId.replace(/^anon[_-]?/i, '').slice(0, 4) || 'guest';
        const all = repository.listFeed('all', currentDateStr);
        const myAnonList = all.filter(f => f.anonId === anonId);
        const myAnonUser: User = {
          id: anonId,
          handle: `guest_${cleanSuffix}`,
          name: 'Local Session Forecaster',
          avatarUrl: '',
          bio: 'Immutable 5-day trajectory deployments and Elo settlements stored in this browser session.',
          forecastsCount: myAnonList.length,
          completedCount: myAnonList.filter(
            f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED'
          ).length,
          elo: DEFAULT_ELO,
        };
        setUser(myAnonUser);
        setForecasts(myAnonList);
      }
      return;
    }

    const targetUser = repository.getUserByHandle(handle);
    setUser(targetUser);
    if (targetUser) {
      setForecasts(repository.listByUser(targetUser.id));
    } else {
      setForecasts([]);
    }
  }, [handle, isMeRoute, currentUser, currentDateStr]);

  useEffect(() => {
    loadData();
    const unsub = repository.subscribe(loadData);
    return () => unsub();
  }, [loadData]);

  if (!user) {
    return (
      <div className="p-16 text-center space-y-4">
        <p className="v-heading-16" style={{ color: 'var(--v-ink)' }}>
          Forecaster dossier not found.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="v-btn-primary"
        >
          Return to Studio
        </button>
      </div>
    );
  }

  const isMe =
    isMeRoute ||
    (currentUser && handle?.toLowerCase() === currentUser.handle.toLowerCase());
  const isAnonymousDevice = isMe && !currentUser;
  const isFollowing = repository.isFollowing(user.id);

  const handleFollowToggle = () => {
    repository.toggleFollow(user.id);
    setFollowTick(t => t + 1);
  };

  const resolvedForecasts = forecasts.filter(
    f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED'
  );

  const baseElo = user.elo ?? DEFAULT_ELO;
  let hitCount = 0;
  let totalScoreSum = 0;
  let scoredCount = 0;
  let netLpDelta = 0;

  resolvedForecasts.forEach(f => {
    const stockBars = getStockHistory(f.ticker);
    const visibleBars = stockBars.filter(b => b.date <= currentDateStr);
    const res = resolveForecast(f, visibleBars);
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

  const liveElo = Math.max(800, baseElo + netLpDelta);
  const tierInfo = getEloTierInfo(liveElo);

  const hitRate =
    resolvedForecasts.length > 0
      ? Math.round((hitCount / resolvedForecasts.length) * 100)
      : null;
  const avgScore =
    scoredCount > 0 ? (totalScoreSum / scoredCount).toFixed(1) : null;

  const displayedList = activeTab === 'results' ? resolvedForecasts : forecasts;

  return (
    <div className="w-full">
      {/* Optional Ephemeral Session Notice Strip */}
      {isAnonymousDevice && (
        <div
          className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--v-canvas-soft)',
            borderBottom: '1px solid var(--v-hairline)',
          }}
        >
          <span className="v-caption" style={{ color: 'var(--v-body)' }}>
            Session deployments are currently bound to this browser. Connect an account to persist your Elo standing across devices.
          </span>
          <button
            type="button"
            onClick={() => setIsConnectOpen(true)}
            className="v-btn-secondary"
          >
            Connect account
          </button>
        </div>
      )}

      {/* ZONE 1: Forecaster Dossier Masthead Band */}
      <div
        className="relative grid grid-cols-1 lg:grid-cols-12"
        style={{ borderBottom: '1px solid var(--v-hairline)' }}
      >
        <span className="v-crosshair" style={{ bottom: -6, left: -6 }} />
        <span className="v-crosshair" style={{ bottom: -6, right: -6 }} />

        {/* Left 7 Cols: Identity, Bio & Elo Tier Progression */}
        <div
          className="lg:col-span-7 p-5 flex flex-col justify-between gap-4 min-w-0"
          style={{ borderRight: '1px solid var(--v-hairline)' }}
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
                  className="v-caption-mono px-2 py-0.5 rounded-[4px]"
                  style={{
                    backgroundColor: 'var(--v-canvas-soft-2)',
                    boxShadow: 'var(--v-shadow-border)',
                    color: 'var(--v-ink)',
                  }}
                >
                  {tierInfo.tier} · {liveElo} LP
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

              {!isMe ? (
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  className={isFollowing ? 'v-btn-secondary' : 'v-btn-primary'}
                >
                  {isFollowing ? 'Following' : 'Follow forecaster'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="v-btn-secondary"
                >
                  + New 5D trajectory
                </button>
              )}
            </div>

            <p className="v-body-sm mt-2" style={{ color: 'var(--v-body)' }}>
              {user.bio}
            </p>
          </div>

          {/* Elo Tier Progress Bar */}
          <div>
            <div className="flex items-center justify-between v-caption-mono mb-1.5">
              <span style={{ color: 'var(--v-mute)' }}>
                Tier progression ({tierInfo.progressPct}%)
              </span>
              <span style={{ color: 'var(--v-mute)' }}>
                {tierInfo.nextTierElo
                  ? `${tierInfo.nextTierElo - liveElo} LP to next tier`
                  : 'Top tier achieved'}
              </span>
            </div>
            <div
              className="w-full h-1.5 rounded-[2px] overflow-hidden"
              style={{ backgroundColor: 'var(--v-hairline)' }}
            >
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${tierInfo.progressPct}%`,
                  backgroundColor: 'var(--v-primary)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Flush 3-Column Career Telemetry Strip */}
        <div className="lg:col-span-5 grid grid-cols-3 min-w-0">
          <div
            className="p-4 sm:p-5 flex flex-col justify-between min-w-0"
            style={{ borderRight: '1px solid var(--v-hairline)' }}
          >
            <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
              Total locks
            </span>
            <div className="mt-2">
              <p
                className="v-mono text-xl font-semibold tracking-tight"
                style={{ color: 'var(--v-ink)' }}
              >
                {forecasts.length}
              </p>
              <p className="v-caption-mono mt-0.5" style={{ color: 'var(--v-mute)' }}>
                Immutable paths
              </p>
            </div>
          </div>

          <div
            className="p-4 sm:p-5 flex flex-col justify-between min-w-0"
            style={{ borderRight: '1px solid var(--v-hairline)' }}
          >
            <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
              Settled rounds
            </span>
            <div className="mt-2">
              <p
                className="v-mono text-xl font-semibold tracking-tight"
                style={{ color: 'var(--v-ink)' }}
              >
                {resolvedForecasts.length}
              </p>
              <p className="v-caption-mono mt-0.5" style={{ color: 'var(--v-mute)' }}>
                As of {currentDateStr}
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 flex flex-col justify-between min-w-0">
            <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
              {avgScore !== null ? 'Mean score' : 'Hit rate'}
            </span>
            <div className="mt-2">
              <p
                className="v-mono text-xl font-semibold tracking-tight"
                style={{ color: 'var(--v-bull)' }}
              >
                {avgScore !== null
                  ? `${avgScore}`
                  : hitRate !== null
                  ? `${hitRate}%`
                  : '—'}
              </p>
              <p className="v-caption-mono mt-0.5" style={{ color: 'var(--v-mute)' }}>
                100-pt rubric
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ZONE 2: Forecaster Deployment & Settlement History */}
      <div>
        <div
          className="px-5 flex flex-wrap items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--v-canvas-soft)',
            borderBottom: '1px solid var(--v-hairline)',
          }}
        >
          <div className="flex items-center gap-6">
            {[
              {
                id: 'forecasts' as const,
                label: `All deployments (${forecasts.length})`,
              },
              {
                id: 'results' as const,
                label: `Settled receipts (${resolvedForecasts.length})`,
              },
            ].map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="relative py-3 text-xs font-medium transition-colors"
                  style={{
                    color: active ? 'var(--v-ink)' : 'var(--v-mute)',
                  }}
                >
                  {tab.label}
                  {active && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[2px]"
                      style={{ backgroundColor: 'var(--v-primary)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <span className="v-caption-mono" style={{ color: 'var(--v-mute)' }}>
            rules:v1 · immutable verification
          </span>
        </div>

        {displayedList.length > 0 ? (
          <div>
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
                ? 'No settled trajectories as of this timeline date. Switch the header timeline to [D+5 Settled] to inspect Friday close scoring.'
                : 'No locked 5D trajectories recorded yet.'}
            </p>
            {isMe && (
              <button
                type="button"
                onClick={() => navigate('/')}
                className="v-btn-primary"
              >
                Sculpt 5D trajectory in Studio
              </button>
            )}
          </div>
        )}
      </div>

      <ConnectModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onSuccess={() => {
          setIsConnectOpen(false);
          loadData();
        }}
      />
    </div>
  );
}

export default ProfilePage;
