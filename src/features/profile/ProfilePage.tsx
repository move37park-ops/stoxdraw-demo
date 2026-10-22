import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, PenTool, ShieldAlert } from 'lucide-react';
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

  const isMeRoute = !handle || handle === 'me' || handle === 'record';

  const loadData = useCallback(() => {
    if (isMeRoute) {
      if (currentUser) {
        setUser(currentUser);
        setForecasts(repository.listByUser(currentUser.id));
      } else {
        const anonId = getOrCreateAnonId();
        const all = repository.listFeed('all', currentDateStr);
        const myAnonList = all.filter(f => f.anonId === anonId);
        const myAnonUser: User = {
          id: anonId,
          handle: 'device_user',
          name: '내 레코드 (임시 기기)',
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          bio: '현재 기기에 저장된 5D 궤적 및 Elo 정산 기록입니다.',
          forecastsCount: myAnonList.length,
          completedCount: myAnonList.filter(f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED').length,
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
      <div className="py-20 text-center max-w-sm mx-auto">
        <h3 className="text-zinc-200 font-semibold mb-3 text-base">사용자를 찾을 수 없습니다.</h3>
        <button
          onClick={() => navigate('/arena')}
          className="px-4 py-2 rounded-md bg-white text-black font-medium text-xs hover:bg-zinc-200 transition"
        >
          아레나로 이동
        </button>
      </div>
    );
  }

  const isMe = isMeRoute || (currentUser && handle?.toLowerCase() === currentUser.handle.toLowerCase());
  const isAnonymousDevice = isMe && !currentUser;
  const isFollowing = repository.isFollowing(user.id);
  const handleFollowToggle = () => {
    repository.toggleFollow(user.id);
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

  const hitRate = resolvedForecasts.length > 0
    ? Math.round((hitCount / resolvedForecasts.length) * 100)
    : null;
  const avgScore = scoredCount > 0 ? Math.round(totalScoreSum / scoredCount) : null;

  const displayedList = activeTab === 'results' ? resolvedForecasts : forecasts;

  return (
    <div className="w-full max-w-5xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 mb-4 transition"
      >
        <ArrowLeft size={15} />
        <span>뒤로</span>
      </button>

      {/* Compact Anonymous Banner */}
      {isAnonymousDevice && (
        <div className="mb-4 p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <ShieldAlert size={15} className="text-zinc-400 flex-shrink-0" />
            <span>현재 기기에 임시 저장된 기록입니다. 계정을 연결하시면 Elo 레이팅이 영구 보존됩니다.</span>
          </div>
          <button
            onClick={() => setIsConnectOpen(true)}
            className="px-3 py-1.5 rounded-md bg-white text-black font-medium hover:bg-zinc-200 transition text-xs"
          >
            계정 연결
          </button>
        </div>
      )}

      {/* Profile Header Container (Single 1px Hairline Surface, No Nested Cards) */}
      <div className="rounded-lg bg-zinc-950 border border-zinc-800 divide-y divide-zinc-800 overflow-hidden mb-5">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border border-zinc-800"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl text-zinc-100 font-bold">
                    {user.name}
                  </h1>
                  <CheckCircle2 size={15} className="text-zinc-400" />
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium border ${tierInfo.badgeClass}`}>
                    {tierInfo.tier} · {tierInfo.krTitle}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 font-mono mt-0.5">
                  @{user.handle}
                </div>
              </div>
            </div>

            {!isMe && (
              <button
                onClick={handleFollowToggle}
                className={`px-3.5 py-1.5 rounded-md font-medium text-xs transition ${
                  isFollowing
                    ? 'bg-zinc-900 text-zinc-300 border border-zinc-800'
                    : 'bg-white text-black hover:bg-zinc-200'
                }`}
              >
                {isFollowing ? '팔로잉' : '팔로우'}
              </button>
            )}
          </div>

          {user.bio && (
            <p className="text-xs sm:text-sm text-zinc-300 mt-3.5">
              {user.bio}
            </p>
          )}
        </div>

        {/* Elo Tier Progress Bar */}
        <div className="px-5 py-3.5 bg-zinc-950">
          <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-2">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 font-sans">Elo 레이팅</span>
              <span className="text-sm font-semibold text-zinc-100">
                {liveElo.toLocaleString()} LP
              </span>
              {netLpDelta !== 0 && (
                <span className={netLpDelta >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                  ({formatSignedLp(netLpDelta)})
                </span>
              )}
            </div>
            <span className="text-zinc-500 text-[11px]">
              {tierInfo.nextTierElo ? `승급까지 ${tierInfo.nextTierElo - liveElo} LP` : '최고 등급'}
            </span>
          </div>
          <div className="w-full h-1 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${tierInfo.progressPct}%`,
                backgroundColor: tierInfo.accentHex,
              }}
            />
          </div>
        </div>

        {/* Stats Grid (1px Hairline Columns) */}
        <div className="grid grid-cols-3 divide-x divide-zinc-800 bg-zinc-950 font-mono tabular-nums">
          <div className="p-3.5 text-center">
            <div className="text-[11px] text-zinc-500 font-sans mb-0.5">전체 기록</div>
            <div className="font-semibold text-zinc-100 text-base sm:text-lg">
              {forecasts.length}
            </div>
          </div>
          <div className="p-3.5 text-center">
            <div className="text-[11px] text-zinc-500 font-sans mb-0.5">정산 완료</div>
            <div className="font-semibold text-zinc-200 text-base sm:text-lg">
              {resolvedForecasts.length}
            </div>
          </div>
          <div className="p-3.5 text-center">
            <div className="text-[11px] text-zinc-500 font-sans mb-0.5">
              {avgScore !== null ? '평균 점수' : '적중률'}
            </div>
            <div className="font-semibold text-base sm:text-lg text-zinc-100">
              {avgScore !== null ? `${avgScore}점` : (hitRate !== null ? `${hitRate}%` : '—')}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setActiveTab('forecasts')}
          className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition ${
            activeTab === 'forecasts'
              ? 'bg-zinc-100 text-black'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          전체 예측 ({forecasts.length})
        </button>

        <button
          onClick={() => setActiveTab('results')}
          className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition ${
            activeTab === 'results'
              ? 'bg-zinc-100 text-black'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          정산 완료 ({resolvedForecasts.length})
        </button>
      </div>

      {/* Forecasts List (1px Hairline Deployment Rows) */}
      <div>
        {displayedList.length > 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800 overflow-hidden">
            {displayedList.map(f => (
              <CompactForecastCard
                key={f.id}
                forecast={f}
                currentDateStr={currentDateStr}
                borderless={true}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 px-4 rounded-lg bg-zinc-950 border border-zinc-800">
            <div className="w-9 h-9 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-3">
              <PenTool size={15} />
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              {activeTab === 'results' ? '정산 완료된 기록이 없습니다.' : '등록된 5D 예측이 없습니다.'}
            </p>
            <button
              onClick={() => navigate('/draw')}
              className="px-3.5 py-1.5 rounded-md bg-white hover:bg-zinc-200 text-black font-medium text-xs transition"
            >
              5D 예측 그리기
            </button>
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
