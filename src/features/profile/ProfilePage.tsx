import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, PenTool } from 'lucide-react';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId } from '../../data/session';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecast } from '../../domain/resolution';
import { getStockHistory } from '../../data/market';
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
          name: '내 예측 기록 (디바이스 ID)',
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          bio: '현재 브라우저 기기에 저장된 나의 주가 궤적과 검증 성적표입니다.',
          forecastsCount: myAnonList.length,
          completedCount: myAnonList.filter(f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED').length,
        };
        setUser(myAnonUser);
        setForecasts(myAnonList);
      }
      return;
    }

    // Other user profile
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
        <h3 className="text-zinc-900 dark:text-white font-bold mb-2 text-lg">사용자를 찾을 수 없습니다</h3>
        <button
          onClick={() => navigate('/arena')}
          className="mt-4 px-6 py-2.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold text-xs"
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

  let hitCount = 0;
  resolvedForecasts.forEach(f => {
    const stockBars = getStockHistory(f.ticker);
    const visibleBars = stockBars.filter(b => b.date <= currentDateStr);
    const res = resolveForecast(f, visibleBars);
    const isHit = f.mode === 'breakout' ? res.breakoutHit : res.directionHit;
    if (isHit) hitCount++;
  });

  const hitRate = resolvedForecasts.length > 0
    ? Math.round((hitCount / resolvedForecasts.length) * 100)
    : null;

  const displayedList = activeTab === 'results' ? resolvedForecasts : forecasts;

  return (
    <div className="w-full max-w-4xl mx-auto py-2">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white mb-6 transition"
      >
        <ArrowLeft size={16} />
        <span>돌아가기</span>
      </button>

      {/* Profile Header Card */}
      <div className="rounded-3xl bg-[#0d0d10] border border-white/10 p-6 sm:p-9 shadow-none mb-6">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-4">
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-white/10"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="type-h2 text-white font-bold">
                  {user.name}
                </h1>
                <CheckCircle2 size={18} className="text-[#DFC15D]" />
              </div>
              <div className="type-caption text-zinc-400">
                @{user.handle}
              </div>
            </div>
          </div>

          {!isMe && (
            <button
              onClick={handleFollowToggle}
              className={`px-5 py-2 rounded-full font-semibold text-xs sm:text-sm transition ${
                isFollowing
                  ? 'bg-zinc-900 text-zinc-300 border border-white/15'
                  : 'bg-white text-black hover:bg-zinc-200'
              }`}
            >
              {isFollowing ? '팔로잉' : '팔로우'}
            </button>
          )}
        </div>

        {user.bio && (
          <p className="type-body text-zinc-400 mb-6">
            {user.bio}
          </p>
        )}

        {isAnonymousDevice && (
          <div className="mb-5 p-3.5 sm:p-4 rounded-2xl bg-[#141418] border border-white/10 flex items-center justify-between gap-3 text-xs">
            <div className="text-zinc-300">
              현재 브라우저(기기 ID)에 예측이 실시간 저장되고 있습니다.
            </div>
            <button
              onClick={() => setIsConnectOpen(true)}
              className="px-3.5 py-1.5 rounded-full bg-white text-black font-semibold hover:bg-zinc-200 transition flex-shrink-0 text-xs"
            >
              계정 연동
            </button>
          </div>
        )}

        {/* Verified Track Record Stats Grid */}
        <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-[#141418] border border-white/10">
          <div className="text-center">
            <div className="text-[11px] text-zinc-400 mb-0.5">전체 Forecast</div>
            <div className="font-bold text-white text-lg sm:text-xl">
              {forecasts.length}
            </div>
          </div>
          <div className="text-center border-x border-white/10">
            <div className="text-[11px] text-zinc-400 mb-0.5">검증 완료 (Record)</div>
            <div className="font-bold text-zinc-200 text-lg sm:text-xl">
              {resolvedForecasts.length}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[11px] text-zinc-400 mb-0.5">적중률 (Hit Rate)</div>
            <div className="font-bold text-lg sm:text-xl font-mono text-[#DFC15D]">
              {hitRate !== null ? `${hitRate}%` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Pill Buttons */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('forecasts')}
          className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
            activeTab === 'forecasts'
              ? 'bg-white text-black'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          진행 중인 예측 ({forecasts.length})
        </button>

        <button
          onClick={() => setActiveTab('results')}
          className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
            activeTab === 'results'
              ? 'bg-white text-black'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          검증 완료 아카이브 ({resolvedForecasts.length})
        </button>
      </div>

      {/* Forecasts List */}
      <div className="space-y-3">
        {displayedList.length > 0 ? (
          displayedList.map(f => (
            <CompactForecastCard
              key={f.id}
              forecast={f}
            />
          ))
        ) : (
          <div className="text-center py-16 px-4 rounded-2xl bg-[#0d0d10] border border-white/10">
            <div className="w-12 h-12 rounded-full bg-[#181822] border border-[#C5A059]/20 text-[#DFC15D] flex items-center justify-center mx-auto mb-3">
              <PenTool size={20} />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">
              {activeTab === 'results' ? '아직 검증 완료된 결과가 없습니다' : '아직 제출한 예측이 없습니다'}
            </h3>
            <p className="text-xs text-zinc-400 mb-5 max-w-xs mx-auto">
              {activeTab === 'results'
                ? '5거래일이 지나 실제 주가와 대조되면 여기에 오차율과 성적이 기록됩니다.'
                : '차트 위에 나만의 미래 5D 궤적을 그리고 첫 트랙 레코드를 쌓아보세요!'}
            </p>
            <button
              onClick={() => navigate('/draw')}
              className="btn-signature-draw px-5 py-2.5 rounded-full text-xs"
            >
              <span>DRAW — 첫 궤적 그리기</span>
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
