import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';
import { repository } from '../../data/localRepository';
import { getCurrentUser } from '../../data/session';
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
  const [user, setUser] = useState<User | undefined>(() => {
    if (!handle || handle === 'me') return currentUser || undefined;
    return repository.getUserByHandle(handle);
  });
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [isConnectOpen, setIsConnectOpen] = useState(false);

  const isMe = currentUser && (handle === 'me' || handle?.toLowerCase() === currentUser.handle.toLowerCase());

  const loadData = () => {
    let targetUser: User | undefined;
    if (!handle || handle === 'me') {
      targetUser = getCurrentUser() || undefined;
    } else {
      targetUser = repository.getUserByHandle(handle);
    }
    setUser(targetUser);

    if (targetUser) {
      const list = repository.listByUser(targetUser.id);
      setForecasts(list);
    } else {
      setForecasts([]);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = repository.subscribe(loadData);
    return () => unsub();
  }, [handle, currentDateStr]);

  if (!user) {
    return (
      <div className="py-20 text-center max-w-sm mx-auto">
        <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sky-500 flex items-center justify-center mx-auto mb-4 border border-zinc-200 dark:border-zinc-700">
          <Sparkles size={24} />
        </div>
        <h3 className="text-zinc-900 dark:text-white font-bold mb-2 text-lg">로그인이 필요합니다</h3>
        <p className="text-xs sm:text-sm text-zinc-500 mb-6 leading-relaxed">
          내 Forecast와 검증된 적중률 Record를 확인하려면 계정을 연결하세요.
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => setIsConnectOpen(true)}
            className="w-full py-3 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold text-xs sm:text-sm transition shadow-sm"
          >
            계정 연결 / 로그인
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-xs sm:text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
          >
            홈으로 돌아가기
          </button>
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
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white mb-6 transition"
      >
        <ArrowLeft size={16} />
        <span>돌아가기</span>
      </button>

      {/* Profile Header Card */}
      <div className="rounded-3xl bg-white dark:bg-[#0e1017] border border-zinc-200/90 dark:border-zinc-800 p-6 sm:p-9 shadow-sm mb-6">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-4">
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-700 shadow-sm"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
                  {user.name}
                </h1>
                <CheckCircle2 size={18} className="text-sky-500" />
              </div>
              <div className="text-xs sm:text-sm text-zinc-400 font-mono">
                @{user.handle}
              </div>
            </div>
          </div>

          {!isMe && (
            <button
              onClick={handleFollowToggle}
              className={`px-5 py-2 rounded-full font-semibold text-xs sm:text-sm transition ${
                isFollowing
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700'
                  : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 shadow-sm'
              }`}
            >
              {isFollowing ? '팔로잉' : '팔로우'}
            </button>
          )}
        </div>

        {user.bio && (
          <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6 leading-relaxed">
            {user.bio}
          </p>
        )}

        {/* Verified Track Record Stats Grid */}
        <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-[#12141c] border border-zinc-200/70 dark:border-zinc-800">
          <div className="text-center">
            <div className="text-[11px] text-zinc-400 mb-0.5">전체 Forecast</div>
            <div className="font-mono font-bold text-zinc-900 dark:text-white text-lg sm:text-xl">
              {forecasts.length}
            </div>
          </div>
          <div className="text-center border-x border-zinc-200 dark:border-zinc-800">
            <div className="text-[11px] text-zinc-400 mb-0.5">검증 완료 (Record)</div>
            <div className="font-mono font-bold text-zinc-900 dark:text-white text-lg sm:text-xl">
              {resolvedForecasts.length}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[11px] text-zinc-400 mb-0.5">적중률 (Hit Rate)</div>
            <div className="font-mono font-bold text-lg sm:text-xl text-emerald-600 dark:text-emerald-400">
              {hitRate !== null ? `${hitRate}%` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Pill Buttons */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setActiveTab('forecasts')}
          className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
            activeTab === 'forecasts'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          전체 예측 ({forecasts.length})
        </button>

        <button
          onClick={() => setActiveTab('results')}
          className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
            activeTab === 'results'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
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
          <div className="text-center py-16 px-4 rounded-3xl bg-white dark:bg-[#0e1017] border border-zinc-200/80 dark:border-zinc-800">
            <p className="text-xs sm:text-sm text-zinc-500">
              {activeTab === 'results' ? '아직 검증 완료된 결과가 없습니다.' : '등록된 예측이 없습니다.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
