import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { repository } from '../../data/localRepository';
import { getCurrentUser } from '../../data/session';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecast } from '../../domain/resolution';
import { getStockHistory } from '../../data/market';
import { ForecastCard } from '../../components/ForecastCard';
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
      <div className="p-12 text-center text-[#71767b] max-w-sm mx-auto">
        <div className="w-12 h-12 rounded-full bg-zinc-900 text-sky-400 flex items-center justify-center mx-auto mb-3 border border-zinc-800">
          <Sparkles size={22} />
        </div>
        <h3 className="text-white font-bold mb-1.5 text-base">로그인이 필요합니다</h3>
        <p className="text-xs mb-5 text-[#9aa0a6] leading-relaxed">
          내 Forecast와 검증된 적중률 Record를 확인하려면 계정을 연결하세요.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setIsConnectOpen(true)}
            className="w-full py-2.5 rounded-full bg-gradient-to-r from-[#4facfe] to-[#a18cd1] text-black font-bold text-xs hover:brightness-110 transition shadow-sm"
          >
            계정 연결 / 로그인
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full py-2.5 rounded-full bg-[#14161f] border border-[#272b38] text-white font-semibold text-xs hover:bg-[#1a1d28] transition"
          >
            피드로 돌아가기
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
    <div className="w-full pb-20">
      {/* Top Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-black/85 backdrop-blur-md border-b border-[#1b1e26]">
        <button
          onClick={() => navigate(-1)}
          className="p-1 rounded-full text-[#71767b] hover:text-white transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <div className="font-bold text-white text-[15px]">{user.name}</div>
          <div className="text-[11px] text-[#71767b]">{forecasts.length} Forecasts</div>
        </div>
      </div>

      {/* Profile Header (Instagram / X style) */}
      <div className="p-4 border-b border-[#1b1e26]">
        <div className="flex items-start justify-between mb-3">
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-[#272a33]"
          />

          {!isMe && (
            <button
              onClick={handleFollowToggle}
              className={`px-4 py-1.5 rounded-full font-semibold text-xs transition ${
                isFollowing
                  ? 'bg-zinc-800 text-white border border-zinc-700'
                  : 'bg-white text-black hover:bg-zinc-200'
              }`}
            >
              {isFollowing ? '팔로잉' : '팔로우'}
            </button>
          )}
        </div>

        <h2 className="text-lg font-bold text-white">{user.name}</h2>
        <div className="text-xs text-[#71767b] mb-2 font-mono">@{user.handle}</div>

        {user.bio && (
          <p className="text-[13px] text-[#d1d5db] mb-3 leading-relaxed">
            {user.bio}
          </p>
        )}

        {/* Verified Track Record Stats Card */}
        <div className="grid grid-cols-3 gap-2 mt-4 p-3 rounded-xl bg-[#0e0f14] border border-[#1f222b]">
          <div className="text-center">
            <div className="text-[11px] text-[#71767b] mb-0.5">전체 Forecast</div>
            <div className="font-mono font-bold text-white text-base">{forecasts.length}</div>
          </div>
          <div className="text-center border-x border-[#1f222b]">
            <div className="text-[11px] text-[#71767b] mb-0.5">검증 완료 (Record)</div>
            <div className="font-mono font-bold text-white text-base">{resolvedForecasts.length}</div>
          </div>
          <div className="text-center">
            <div className="text-[11px] text-[#71767b] mb-0.5">적중률 (Hit Rate)</div>
            <div className="font-mono font-bold text-base text-[#38bdf8]">
              {hitRate !== null ? `${hitRate}%` : '—'}
            </div>
            {resolvedForecasts.length > 0 && (
              <div className="text-[10px] text-[#71767b] font-mono mt-0.5">
                {hitCount}/{resolvedForecasts.length} 적중
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs: [Forecasts] [Results] */}
      <div className="flex border-b border-[#1b1e26]">
        <button
          onClick={() => setActiveTab('forecasts')}
          className={`flex-1 py-3 text-center text-xs font-semibold transition relative ${
            activeTab === 'forecasts' ? 'text-white' : 'text-[#71767b] hover:text-white'
          }`}
        >
          Forecasts ({forecasts.length})
          {activeTab === 'forecasts' && (
            <span className="absolute bottom-0 left-8 right-8 h-0.5 bg-white rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('results')}
          className={`flex-1 py-3 text-center text-xs font-semibold transition relative ${
            activeTab === 'results' ? 'text-white' : 'text-[#71767b] hover:text-white'
          }`}
        >
          Results ({resolvedForecasts.length})
          {activeTab === 'results' && (
            <span className="absolute bottom-0 left-8 right-8 h-0.5 bg-white rounded-full" />
          )}
        </button>
      </div>

      {/* Forecast Feed List in Profile */}
      <div>
        {displayedList.length > 0 ? (
          displayedList.map(forecast => (
            <ForecastCard
              key={forecast.id}
              forecast={forecast}
              currentDateStr={currentDateStr}
            />
          ))
        ) : (
          <div className="p-12 text-center text-[#71767b]">
            <Sparkles size={20} className="mx-auto mb-2 opacity-50" />
            <p className="text-xs">
              {activeTab === 'results'
                ? '아직 검증 완료된 Forecast가 없습니다.'
                : '작성한 Forecast가 없습니다.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
