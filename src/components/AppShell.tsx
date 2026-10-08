import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, PenTool, User as UserIcon, Bell, Calendar, TrendingUp, Sparkles, LogOut, Sun, Moon } from 'lucide-react';
import { getCurrentUser, subscribeSession, logout } from '../data/session';
import { repository } from '../data/localRepository';
import { STOCKS } from '../data/market';
import { ConnectModal } from '../features/auth/ConnectModal';
import type { User } from '../domain/types';

interface AppShellProps {
  currentDateStr: string;
  onDateChange: (newDate: string) => void;
}

export function AppShell({ currentDateStr, onDateChange }: AppShellProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentUser());
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const [isLightMode, setIsLightMode] = useState(() => {
    const saved = localStorage.getItem('theme-light');
    const isLight = saved ? saved === 'true' : false;
    if (isLight) document.documentElement.classList.add('light');
    return isLight;
  });

  const toggleTheme = () => {
    const isLight = document.documentElement.classList.toggle('light');
    setIsLightMode(isLight);
    localStorage.setItem('theme-light', String(isLight));
  };

  useEffect(() => {
    const unsubSession = subscribeSession(setCurrentUser);
    const updateUnread = () => {
      if (currentUser) {
        setUnreadCount(repository.getUnreadNotificationsCount(currentUser.id));
      } else {
        setUnreadCount(0);
      }
    };
    updateUnread();
    const unsubRepo = repository.subscribe(updateUnread);
    return () => {
      unsubSession();
      unsubRepo();
    };
  }, [currentUser]);

  const handleStockClick = (ticker: string) => {
    navigate(`/?stock=${ticker}`);
  };

  const isDrawPath = location.pathname.startsWith('/draw');
  const isDetailPage = location.pathname.startsWith('/f/');
  const hideMobileNav = isDrawPath || isDetailPage;

  return (
    <div className="app-layout">
      {/* 1. Desktop Left Sidebar (X / Twitter Style) */}
      <aside className="desktop-nav">
        <div>
          {/* Brand Logo */}
          <NavLink to="/" className="nav-brand">
            <span className="nav-brand-logo">
              <span className="dot" />
              STOXDRAW
            </span>
          </NavLink>

          {/* Nav Items */}
          <ul className="nav-menu">
            <li>
              <NavLink to="/" end className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}>
                <Home size={22} />
                <span>홈 (Feed)</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/notifications" className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}>
                <div className="relative">
                  <Bell size={22} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full ring-2 ring-black" />
                  )}
                </div>
                <span>알림</span>
              </NavLink>
            </li>
            <li>
              <button
                onClick={toggleTheme}
                className="nav-item-link w-full text-left"
              >
                {isLightMode ? <Moon size={22} /> : <Sun size={22} />}
                <span>{isLightMode ? '다크 모드' : '화이트 모드'}</span>
              </button>
            </li>
            <li>
              <NavLink
                to={currentUser ? `/u/${currentUser.handle}` : '/u/me'}
                className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
              >
                <UserIcon size={22} />
                <span>프로필 (Record)</span>
              </NavLink>
            </li>
          </ul>

          {/* Primary Action Button: 나도 그리기 (§3.4, §4) */}
          <button
            onClick={() => navigate('/draw')}
            className="nav-draw-cta"
          >
            <PenTool size={18} className="stroke-[2.5]" />
            <span>나도 그리기</span>
          </button>
        </div>

        {/* Bottom User Profile Section */}
        <div>
          {currentUser ? (
            <div className="nav-user-badge" onClick={() => navigate(`/u/${currentUser.handle}`)}>
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-10 h-10 rounded-full object-cover border border-[#272a33]"
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white text-[14px] truncate">{currentUser.name}</div>
                <div className="text-[#71767b] text-[12px] truncate">@{currentUser.handle}</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  logout();
                }}
                title="로그아웃"
                className="text-[#71767b] hover:text-white p-1"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsConnectOpen(true)}
              className="w-full py-2.5 px-3 rounded-full border border-[#272a33] text-white hover:bg-zinc-900 text-[13px] font-semibold flex items-center justify-center gap-2 transition"
            >
              <Sparkles size={15} className="text-[#38bdf8]" />
              계정 연결 / 로그인
            </button>
          )}
        </div>
      </aside>

      {/* 2. Main Content Column */}
      <main className="feed-column" style={{ paddingBottom: hideMobileNav ? 0 : undefined }}>
        {/* Mobile Header (Rendered on Home Feed only; subpages have their own back-navigation header) */}
        {location.pathname === '/' && (
          <header className="mobile-header">
            <NavLink to="/" className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#38bdf8]" />
              <span className="font-bold text-white tracking-tight text-lg">STOXDRAW</span>
            </NavLink>
            <div className="flex items-center gap-3">
              <button onClick={toggleTheme} className="p-1.5 text-zinc-400 hover:text-white transition" title="테마 변경">
                {isLightMode ? <Moon size={20} /> : <Sun size={20} />}
              </button>
              <NavLink to="/notifications" className="relative p-1.5 text-zinc-400 hover:text-white">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-black" />
                )}
              </NavLink>
              {currentUser ? (
                <NavLink to={`/u/${currentUser.handle}`}>
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-7 h-7 rounded-full object-cover border border-zinc-700"
                  />
                </NavLink>
              ) : (
                <button
                  onClick={() => setIsConnectOpen(true)}
                  className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-white font-medium border border-zinc-700"
                >
                  로그인
                </button>
              )}
            </div>
          </header>
        )}

        {/* Child Views */}
        <Outlet />
      </main>

      {/* 3. Desktop Right Rail (Widgets & Time Machine Simulator) */}
      <aside className="right-rail">
        {/* Time Travel Simulator (개발 & 검증용 스펙 완주 도구) */}
        <div className="p-4 rounded-2xl bg-[#0c0d12] border border-[#1f222b]">
          <div className="flex items-center gap-2 text-white font-semibold text-[13px] mb-2.5">
            <Calendar size={16} className="text-[#38bdf8]" />
            <span>Time Travel (검증 시뮬레이터)</span>
          </div>
          <p className="text-[12px] text-[#71767b] mb-3">
            날짜를 이동하여 <strong>LIVE 진행</strong> 및 <strong>RESOLVED 적중 결과</strong>를 바로 확인하세요.
          </p>
          <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
            {[
              { label: '9/28 (과거)', date: '2026-09-28' },
              { label: '10/05 (현재)', date: '2026-10-05' },
              { label: '10/08 (미래+3)', date: '2026-10-08' },
              { label: '10/12 (미래+7)', date: '2026-10-12' },
              { label: '10/26 (미래+21)', date: '2026-10-26' },
            ].map(item => (
              <button
                key={item.date}
                onClick={() => onDateChange(item.date)}
                className={`py-1.5 px-2 rounded-lg border text-center transition ${
                  currentDateStr === item.date
                    ? 'bg-sky-500 text-white font-bold border-sky-400 shadow-sm'
                    : 'bg-[#14161f] text-[#9aa0a6] border-[#222530] hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-2 text-right text-[11px] text-[#71767b] font-mono">
            현재 시점: <span className="text-white font-semibold">{currentDateStr}</span>
          </div>
        </div>

        {/* Trending Stocks Quick Filter */}
        <div className="p-4 rounded-2xl bg-[#0c0d12] border border-[#1f222b]">
          <div className="flex items-center gap-2 text-white font-semibold text-[13px] mb-3">
            <TrendingUp size={16} className="text-[#22c55e]" />
            <span>종목별 Forecast</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STOCKS.map(s => (
              <button
                key={s.ticker}
                onClick={() => handleStockClick(s.ticker)}
                className="px-2.5 py-1 rounded-full bg-[#14161f] hover:bg-[#1f222f] border border-[#222530] text-[12px] font-mono font-medium text-white transition flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.logoColor }} />
                {s.ticker}
              </button>
            ))}
          </div>
        </div>

        {/* STOXDRAW Philosophy Card */}
        <div className="p-4 rounded-2xl bg-[#0c0d12] border border-[#1f222b] text-[12px] text-[#71767b] leading-relaxed">
          <div className="font-semibold text-white text-[13px] mb-1">STOXDRAW UX 원칙</div>
          피드에서 Forecast를 발견하고, 직접 그리고, Crowd와 비교하며, 검증 가능한 Record로 축적하세요.
        </div>
      </aside>

      {/* 4. Mobile Bottom 3-Tab Navigation (Feed · (+) Draw · Profile) */}
      {!hideMobileNav && (
        <nav className="mobile-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <Home size={22} />
            <span>Feed</span>
          </NavLink>

          {/* 중앙 강조 FAB 버튼 (§4 Draw는 하단 중앙의 Primary Action) */}
          <NavLink
            to="/draw"
            className="mobile-nav-item draw-btn-center"
          >
            <div className="fab">
              <PenTool size={20} className="stroke-[2.5]" />
            </div>
            <span>Draw</span>
          </NavLink>

          <NavLink
            to={currentUser ? `/u/${currentUser.handle}` : '/u/me'}
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <UserIcon size={22} />
            <span>Profile</span>
          </NavLink>
        </nav>
      )}

      {/* Progressive Onboarding Connect Modal */}
      <ConnectModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onSuccess={() => setCurrentUser(getCurrentUser())}
      />
    </div>
  );
}
