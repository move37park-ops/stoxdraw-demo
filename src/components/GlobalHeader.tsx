import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  User as UserIcon,
  LogOut,
  ChevronDown,
  PenTool,
  Bell,
  CheckCircle2,
  CornerDownRight,
  MessageSquare,
  X,
  Check,
  ArrowRight,
} from 'lucide-react';
import { getCurrentUser, subscribeSession, logout, getOrCreateAnonId } from '../data/session';
import { repository } from '../data/localRepository';
import { deriveForecastStatus } from '../domain/lifecycle';
import { resolveForecast } from '../domain/resolution';
import { getEloTierInfo, DEFAULT_ELO } from '../domain/elo';
import { getStockHistory, STOCKS, getCurrentStockPrice } from '../data/market';
import { ConnectModal } from '../features/auth/ConnectModal';
import { formatRelativeTime } from '../domain/format';
import type { User, Notification as AppNotification } from '../domain/types';

interface GlobalHeaderProps {
  currentDateStr: string;
  onDateChange: (date: string) => void;
}

const TIME_SLIP_OPTIONS = [
  { date: '2026-10-05', label: '10.05 현재' },
  { date: '2026-10-08', label: '10.08 D+3' },
  { date: '2026-10-12', label: '10.12 만기' },
];

const CORE_TICKERS = ['NVDA', 'TSLA', 'AAPL'];

export function GlobalHeader({ currentDateStr, onDateChange }: GlobalHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentUser());
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isTickerSwitcherOpen, setIsTickerSwitcherOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [anonForecastsCount, setAnonForecastsCount] = useState<number>(0);
  const [liveElo, setLiveElo] = useState<number>(DEFAULT_ELO);

  const notifRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const tickerRef = useRef<HTMLDivElement>(null);

  const isShowcaseHome = location.pathname === '/home';

  // Detect active ticker from URL path or query params
  const activeTicker = (() => {
    const arenaMatch = location.pathname.match(/^\/arena\/([A-Za-z]+)/);
    if (arenaMatch) return arenaMatch[1].toUpperCase();
    const qTicker = searchParams.get('ticker');
    if (qTicker) return qTicker.toUpperCase();
    return null;
  })();

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  }, []);

  const loadUserData = () => {
    const user = getCurrentUser();
    setCurrentUser(user);
    const all = repository.listFeed('all', currentDateStr);
    const anonId = getOrCreateAnonId();

    const myForecasts = user
      ? all.filter(f => f.authorId === user.id)
      : all.filter(f => f.anonId === anonId);

    const baseElo = user?.elo ?? DEFAULT_ELO;
    let deltaSum = 0;
    myForecasts.forEach(f => {
      if (deriveForecastStatus(f, currentDateStr) === 'RESOLVED') {
        const bars = getStockHistory(f.ticker).filter(b => b.date <= currentDateStr);
        const res = resolveForecast(f, bars);
        if (res.eloSettlement) {
          deltaSum += res.eloSettlement.deltaLp;
        }
      }
    });
    setLiveElo(baseElo + deltaSum);

    if (user) {
      setNotifications(repository.listNotifications(user.id));
    } else {
      setAnonForecastsCount(myForecasts.length);
      setNotifications(repository.listNotifications(anonId));
    }
  };

  useEffect(() => {
    loadUserData();
    const unsubSession = subscribeSession(setCurrentUser);
    const unsubRepo = repository.subscribe(loadUserData);
    return () => {
      unsubSession();
      unsubRepo();
    };
  }, [currentDateStr]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
      if (tickerRef.current && !tickerRef.current.contains(e.target as Node)) {
        setIsTickerSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const tierInfo = getEloTierInfo(liveElo);

  const handleNotificationClick = (n: AppNotification) => {
    repository.markNotificationRead(n.id);
    setIsNotifOpen(false);
    navigate(`/f/${n.forecastId}`);
  };

  const handleSelectTicker = (t: string) => {
    setIsTickerSwitcherOpen(false);
    localStorage.setItem('last_arena_ticker', t);
    if (location.pathname.startsWith('/draw')) {
      navigate(`/draw?ticker=${t}`);
    } else {
      navigate(`/arena/${t}`);
    }
  };

  const subNavItems = [
    { to: '/', label: 'Overview', exact: true },
    { to: '/studio', label: 'Studio', exact: false },
    { to: '/arena', label: 'Markets', exact: false },
    { to: '/draw', label: 'Draw', exact: false },
    { to: '/leaderboard', label: 'Leaderboard', exact: false },
    {
      to: '/record',
      label: 'My Record',
      exact: false,
      badge: !currentUser && anonForecastsCount > 0 ? anonForecastsCount : undefined,
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-md border-b border-zinc-800">
        {/* Tier 1: Top Context & Breadcrumb Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-2">
          {/* Left: Brand & Vercel-Style Scope Breadcrumb */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <NavLink to="/" className="flex items-center gap-2 group flex-shrink-0">
              <span className="w-4 h-4 inline-flex items-center justify-center text-zinc-100 font-mono text-xs">
                ▲
              </span>
              <span className="font-bold text-sm sm:text-base tracking-tight text-zinc-100 font-mono">
                STOXDRAW
              </span>
            </NavLink>

            {isShowcaseHome ? (
              <nav className="hidden sm:flex items-center gap-5 ml-4 text-xs font-medium text-zinc-400">
                <NavLink to="/" className="hover:text-zinc-100 transition">
                  대시보드
                </NavLink>
                <NavLink to="/arena" className="hover:text-zinc-100 transition">
                  종목 아레나
                </NavLink>
                <NavLink to="/leaderboard" className="hover:text-zinc-100 transition">
                  리더보드
                </NavLink>
              </nav>
            ) : (
              <>
                <span className="text-zinc-700 font-mono text-sm select-none">/</span>

                {/* User / Workspace Scope Pill */}
                <button
                  type="button"
                  onClick={() => navigate('/record')}
                  className="inline-flex items-center gap-2 px-2 py-1 rounded-md hover:bg-zinc-900 transition text-xs min-w-0"
                  title="내 기록 및 Elo 레이팅"
                >
                  <span className="font-medium text-zinc-200 truncate max-w-[100px] sm:max-w-[140px]">
                    {currentUser ? currentUser.handle : 'workspace'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border border-zinc-800 bg-zinc-900 text-zinc-300 flex-shrink-0">
                    {tierInfo.tier} · {liveElo} LP
                  </span>
                </button>

                <span className="text-zinc-700 font-mono text-sm select-none hidden sm:inline">/</span>

                {/* Market Project Switcher Dropdown */}
                <div className="relative hidden sm:block" ref={tickerRef}>
                  <button
                    type="button"
                    onClick={() => setIsTickerSwitcherOpen(!isTickerSwitcherOpen)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-zinc-900 border border-transparent hover:border-zinc-800 text-xs font-mono text-zinc-200 transition"
                  >
                    <span className="font-semibold text-zinc-100">
                      {activeTicker ? `$${activeTicker}` : '종목 선택'}
                    </span>
                    <ChevronDown size={13} className="text-zinc-500" />
                  </button>

                  {isTickerSwitcherOpen && (
                    <div className="absolute left-0 mt-1.5 w-60 rounded-lg bg-zinc-950 border border-zinc-800 shadow-2xl p-1 z-50">
                      <div className="px-2.5 py-1.5 text-[11px] text-zinc-500 border-b border-zinc-800/80 mb-1">
                        종목 워크스페이스 전환
                      </div>
                      {CORE_TICKERS.map(t => {
                        const meta = STOCKS.find(s => s.ticker === t);
                        const price = getCurrentStockPrice(t, currentDateStr);
                        const isSelected = activeTicker === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => handleSelectTicker(t)}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition ${
                              isSelected ? 'bg-zinc-900 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-900/60'
                            }`}
                          >
                            <div className="flex items-center gap-2 font-mono">
                              <span className="font-semibold text-zinc-100">${t}</span>
                              <span className="text-zinc-500 font-sans text-[11px]">{meta?.name}</span>
                            </div>
                            <div className="flex items-center gap-2 font-mono">
                              <span className="text-zinc-300">${price.toFixed(2)}</span>
                              {isSelected && <Check size={12} className="text-zinc-100" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right: Utilities, Time-Slip, Notifications, Primary CTA, User */}
          <div className="flex items-center gap-2">
            {!isShowcaseHome && (
              <NavLink
                to="/home"
                className="hidden xl:inline-flex items-center px-2.5 py-1 rounded-md text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition"
              >
                서비스 소개
              </NavLink>
            )}

            {/* Time-Slip Switch */}
            <div
              className="hidden lg:flex items-center bg-zinc-950 p-0.5 rounded-md border border-zinc-800 text-[11px] font-mono"
              title="시점 시뮬레이션"
            >
              {TIME_SLIP_OPTIONS.map(opt => {
                const isSelected = currentDateStr === opt.date;
                return (
                  <button
                    key={opt.date}
                    type="button"
                    onClick={() => onDateChange(opt.date)}
                    className={`px-2 py-1 rounded transition ${
                      isSelected
                        ? 'bg-zinc-800 text-zinc-100 font-medium'
                        : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Mobile Time-Slip Select */}
            <select
              value={currentDateStr}
              onChange={(e) => onDateChange(e.target.value)}
              className="lg:hidden px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-200 focus:outline-none"
              title="시점 선택"
            >
              {TIME_SLIP_OPTIONS.map(opt => (
                <option key={opt.date} value={opt.date} className="bg-zinc-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>

            {isShowcaseHome ? (
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-md bg-white hover:bg-zinc-200 text-black font-medium text-xs transition"
              >
                <span>대시보드 열기</span>
                <ArrowRight size={13} />
              </button>
            ) : (
              <>
                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                  <button
                    type="button"
                    onClick={() => setIsNotifOpen(!isNotifOpen)}
                    className="relative p-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition"
                    title="알림"
                  >
                    <Bell size={14} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                  </button>

                  {isNotifOpen && (
                    <div className="absolute right-0 mt-2 w-80 rounded-lg bg-zinc-950 border border-zinc-800 shadow-2xl p-3 z-50">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800 px-1">
                        <span className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                          <span>알림</span>
                          {unreadCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10px] font-mono">
                              {unreadCount}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsNotifOpen(false)}
                          className="text-zinc-500 hover:text-zinc-300 p-0.5"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800/60">
                        {notifications.length > 0 ? (
                          notifications.slice(0, 5).map(n => (
                            <div
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={`p-2.5 text-left cursor-pointer transition hover:bg-zinc-900/60 ${
                                !n.read ? 'bg-zinc-900/30' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="font-semibold text-zinc-100 flex items-center gap-1 font-mono">
                                  {n.type === 'response' ? (
                                    <CornerDownRight size={11} className="text-zinc-400" />
                                  ) : n.type === 'resolved' ? (
                                    <CheckCircle2 size={11} className="text-emerald-400" />
                                  ) : (
                                    <MessageSquare size={11} className="text-zinc-400" />
                                  )}
                                  <span>${n.ticker}</span>
                                </span>
                                <span className="text-zinc-500 font-mono text-[10px]">
                                  {formatRelativeTime(n.createdAt)}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-300 line-clamp-2 leading-snug">
                                {n.message}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="py-6 text-center text-xs text-zinc-500">
                            새로운 알림이 없습니다.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary Draw CTA */}
                <button
                  type="button"
                  onClick={() => navigate(activeTicker ? `/draw?ticker=${activeTicker}` : '/draw')}
                  className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-md bg-white hover:bg-zinc-200 text-black font-medium text-xs transition"
                >
                  <PenTool size={12} />
                  <span>예측 등록</span>
                </button>

                {/* User Menu / Login */}
                {currentUser ? (
                  <div className="relative" ref={menuRef}>
                    <button
                      type="button"
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="flex items-center gap-1.5 py-1 pl-2 pr-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition"
                    >
                      <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-100 font-medium text-[10px] flex items-center justify-center overflow-hidden">
                        {currentUser.avatarUrl ? (
                          <img
                            src={currentUser.avatarUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          currentUser.handle[0].toUpperCase()
                        )}
                      </div>
                      <ChevronDown size={12} className="text-zinc-500" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-44 rounded-lg bg-zinc-950 border border-zinc-800 shadow-2xl p-1 z-50 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            navigate('/record');
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-zinc-900 text-zinc-200 text-left transition font-medium"
                        >
                          <UserIcon size={13} />
                          <span>내 기록</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            navigate('/draw');
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-zinc-900 text-zinc-200 text-left transition font-medium"
                        >
                          <PenTool size={13} />
                          <span>예측 등록</span>
                        </button>
                        <div className="my-1 border-t border-zinc-800" />
                        <button
                          type="button"
                          onClick={() => {
                            logout();
                            setIsMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 text-left transition"
                        >
                          <LogOut size={13} />
                          <span>로그아웃</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConnectOpen(true)}
                    className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-zinc-100 transition text-xs font-medium"
                  >
                    <UserIcon size={12} />
                    <span className="hidden sm:inline">로그인</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tier 2: Sub-Navigation Tab Bar (Workspace routes only) */}
        {!isShowcaseHome && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between border-t border-zinc-900">
            <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar -mb-px">
              {subNavItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                      isActive
                        ? 'border-zinc-100 text-zinc-100'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`
                  }
                >
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-zinc-500">
              <span>기준일: {currentDateStr}</span>
            </div>
          </div>
        )}
      </header>

      <ConnectModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onSuccess={() => {
          navigate('/record');
        }}
      />
    </>
  );
}

export default GlobalHeader;
