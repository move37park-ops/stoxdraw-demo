import { useEffect, useState, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Sun,
  Moon,
  User as UserIcon,
  LogOut,
  CheckCircle2,
  CornerDownRight,
  MessageSquare,
  X,
  ChevronDown,
} from 'lucide-react';
import { getRoundFor, getCountdownRemaining } from '../../domain/round';
import { getEloTierInfo } from '../../domain/elo';
import { repository } from '../../data/localRepository';
import { getCurrentUser, logout, getOrCreateAnonId } from '../../data/session';
import { formatRelativeTime } from '../../domain/format';
import { ConnectModal } from '../auth/ConnectModal';
import type { Forecast, Notification as AppNotification } from '../../domain/types';

export interface TimeWarpStep {
  date: string;
  code: string;
  label: string;
  phase: 'OPEN' | 'LIVE' | 'RESOLVED';
}

export const STUDIO_TIME_STEPS: TimeWarpStep[] = [
  { date: '2026-10-02', code: 'D-0', label: 'Lock', phase: 'OPEN' },
  { date: '2026-10-05', code: 'D+1', label: 'Day 1', phase: 'LIVE' },
  { date: '2026-10-07', code: 'D+3', label: 'Day 3', phase: 'LIVE' },
  { date: '2026-10-09', code: 'D+5', label: 'Settled', phase: 'RESOLVED' },
];

interface StudioCommandBarProps {
  ticker: string;
  studioDateStr: string;
  onStudioDateChange: (date: string) => void;
  userHandle: string;
  liveElo: number;
  myForecasts: Forecast[];
  activeForecastId?: string | null;
  onSelectForecast?: (forecastId: string | null) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export function StudioCommandBar({
  studioDateStr,
  onStudioDateChange,
  userHandle,
  liveElo,
  myForecasts,
  theme,
  onToggleTheme,
}: StudioCommandBarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const round = getRoundFor('NVDA', '2026-10-05');
  const tierInfo = getEloTierInfo(liveElo);

  const [countdown, setCountdown] = useState(() => getCountdownRemaining(round.cutoffAt));
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const currentUser = getCurrentUser();
  const anonId = getOrCreateAnonId();

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getCountdownRemaining(round.cutoffAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [round.cutoffAt]);

  useEffect(() => {
    const loadNotifs = () => {
      const u = getCurrentUser();
      if (u) {
        setNotifications(repository.listNotifications(u.id));
      } else {
        setNotifications(repository.listNotifications(anonId));
      }
    };
    loadNotifs();
    const unsub = repository.subscribe(loadNotifs);
    return () => unsub();
  }, [anonId, studioDateStr]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const currentStep =
    STUDIO_TIME_STEPS.find(s => s.date === studioDateStr) || STUDIO_TIME_STEPS[0];

  const statusDotColor =
    currentStep.phase === 'OPEN'
      ? 'var(--v-bull)'
      : currentStep.phase === 'LIVE'
      ? 'var(--v-warning)'
      : 'var(--v-link)';

  const isStudioActive =
    location.pathname === '/' ||
    location.pathname.startsWith('/studio') ||
    location.pathname.startsWith('/arena') ||
    location.pathname.startsWith('/draw');

  const navTabs = [
    {
      to: '/',
      label: 'Studio',
      isActive: isStudioActive,
    },
    {
      to: '/overview',
      label: 'Overview',
      isActive: location.pathname.startsWith('/overview'),
    },
    {
      to: '/leaderboard',
      label: 'Leaderboard',
      isActive: location.pathname.startsWith('/leaderboard'),
    },
    {
      to: '/record',
      label: 'My Record',
      isActive:
        location.pathname.startsWith('/record') ||
        location.pathname.startsWith('/u/'),
      badge: myForecasts.length > 0 ? myForecasts.length : undefined,
    },
  ];

  const handleNotificationClick = (n: AppNotification) => {
    repository.markNotificationRead(n.id);
    setIsNotifOpen(false);
    navigate(`/f/${n.forecastId}`);
  };

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full"
        style={{
          backgroundColor: 'var(--v-canvas)',
          borderBottom: '1px solid var(--v-hairline)',
        }}
      >
        {/* Streamlined Vercel Command Bar (52px) */}
        <div
          className="max-w-[1360px] mx-auto px-4 sm:px-6 h-[52px] flex items-center justify-between gap-4 min-w-0"
          style={{
            borderLeft: '1px solid var(--v-hairline)',
            borderRight: '1px solid var(--v-hairline)',
          }}
        >
          {/* Left: Brand + Primary Navigation Tabs */}
          <div className="flex items-center gap-5 sm:gap-7 h-full min-w-0">
            {/* Vercel Logo + STOXDRAW Mark */}
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 flex-shrink-0 group"
              title="STOXDRAW Studio"
            >
              <svg
                width="15"
                height="13"
                viewBox="0 0 76 65"
                fill="currentColor"
                aria-label="Vercel mark"
                style={{ color: 'var(--v-ink)' }}
                className="group-hover:opacity-80 transition-opacity"
              >
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
              </svg>
              <span
                className="v-mono text-xs font-bold tracking-tight"
                style={{ color: 'var(--v-ink)' }}
              >
                STOXDRAW
              </span>
            </Link>

            <span
              className="hidden md:inline-block h-4 w-[1px]"
              style={{ backgroundColor: 'var(--v-hairline)' }}
              aria-hidden="true"
            />

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 h-full">
              {navTabs.map(tab => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className="relative h-full flex items-center gap-1.5 px-3 text-xs font-medium transition-colors"
                  style={{
                    color: tab.isActive ? 'var(--v-ink)' : 'var(--v-mute)',
                  }}
                >
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className="v-caption-mono text-[9px] px-1 py-0 rounded-[3px]"
                      style={{
                        backgroundColor: tab.isActive
                          ? 'var(--v-canvas-soft)'
                          : 'transparent',
                        color: tab.isActive ? 'var(--v-ink)' : 'var(--v-mute)',
                        boxShadow: 'var(--v-shadow-border)',
                      }}
                    >
                      {tab.badge}
                    </span>
                  )}
                  {tab.isActive && (
                    <span
                      className="absolute bottom-0 left-2 right-2 h-[2px]"
                      style={{ backgroundColor: 'var(--v-primary)' }}
                    />
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Right: Unified Time-Warp Instrument + Global Actions */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {/* Integrated Time-Warp Simulation Scrubber */}
            <div
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-[6px]"
              style={{
                backgroundColor: 'var(--v-canvas-soft)',
                boxShadow: 'var(--v-shadow-border)',
              }}
              role="group"
              aria-label="Simulation state scrubber"
            >
              <div className="flex items-center gap-1.5 mr-1">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: statusDotColor }}
                />
                <span
                  className="v-caption-mono text-[11px] font-medium hidden lg:inline"
                  style={{ color: 'var(--v-body)' }}
                >
                  {currentStep.phase === 'OPEN'
                    ? countdown.formatted
                    : `${currentStep.code} ${currentStep.phase}`}
                </span>
              </div>

              <div className="inline-flex items-center gap-0.5">
                {STUDIO_TIME_STEPS.map(step => {
                  const active = step.date === studioDateStr;
                  return (
                    <button
                      key={step.date}
                      type="button"
                      onClick={() => onStudioDateChange(step.date)}
                      className="px-2 py-0.5 rounded-[4px] text-[10px] v-mono transition-all"
                      style={{
                        backgroundColor: active
                          ? 'var(--v-primary)'
                          : 'transparent',
                        color: active
                          ? 'var(--v-on-primary)'
                          : 'var(--v-mute)',
                        fontWeight: active ? 600 : 400,
                      }}
                      title={`${step.code} (${step.label}) - ${step.phase}`}
                    >
                      {step.code}
                    </button>
                  );
                })}
              </div>
            </div>

            <span
              className="hidden sm:inline-block h-3.5 w-[1px]"
              style={{ backgroundColor: 'var(--v-hairline)' }}
              aria-hidden="true"
            />

            {/* Notifications Bell */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setIsNotifOpen(prev => !prev)}
                className="w-7 h-7 rounded-[6px] flex items-center justify-center transition-colors relative"
                style={{
                  color: 'var(--v-mute)',
                  boxShadow: 'var(--v-shadow-border)',
                  backgroundColor: isNotifOpen
                    ? 'var(--v-canvas-soft)'
                    : 'transparent',
                }}
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell size={13} />
                {unreadCount > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: 'var(--v-bull)' }}
                  />
                )}
              </button>

              {isNotifOpen && (
                <div
                  className="absolute right-0 mt-2 w-80 rounded-[8px] p-3 z-50"
                  style={{
                    backgroundColor: 'var(--v-canvas)',
                    boxShadow: 'var(--v-shadow-stack)',
                  }}
                >
                  <div
                    className="flex items-center justify-between pb-2 mb-2"
                    style={{ borderBottom: '1px solid var(--v-hairline)' }}
                  >
                    <span
                      className="v-body-sm-strong"
                      style={{ color: 'var(--v-ink)' }}
                    >
                      Notifications
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsNotifOpen(false)}
                      style={{ color: 'var(--v-mute)' }}
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {notifications.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto flex flex-col">
                      {notifications.slice(0, 6).map(n => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => handleNotificationClick(n)}
                          className="w-full text-left p-2 rounded-[6px] transition"
                          style={{
                            borderBottom: '1px solid var(--v-hairline-subtle)',
                          }}
                        >
                          <div className="flex items-center justify-between v-caption-mono mb-0.5">
                            <span
                              className="inline-flex items-center gap-1 font-medium"
                              style={{ color: 'var(--v-ink)' }}
                            >
                              {n.type === 'response' ? (
                                <CornerDownRight size={11} />
                              ) : n.type === 'resolved' ? (
                                <CheckCircle2
                                  size={11}
                                  style={{ color: 'var(--v-bull)' }}
                                />
                              ) : (
                                <MessageSquare size={11} />
                              )}
                              <span>${n.ticker}</span>
                            </span>
                            <span style={{ color: 'var(--v-mute)' }}>
                              {formatRelativeTime(n.createdAt)}
                            </span>
                          </div>
                          <p
                            className="v-caption line-clamp-2"
                            style={{ color: 'var(--v-body)' }}
                          >
                            {n.message}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p
                      className="v-caption py-5 text-center"
                      style={{ color: 'var(--v-mute)' }}
                    >
                      No notifications yet.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Sleek Theme Toggle (Sun / Moon SVG Icon) */}
            <button
              type="button"
              onClick={onToggleTheme}
              className="w-7 h-7 rounded-[6px] flex items-center justify-center transition-colors"
              style={{
                color: 'var(--v-mute)',
                boxShadow: 'var(--v-shadow-border)',
                backgroundColor: 'transparent',
              }}
              title={
                theme === 'dark'
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              }
              aria-label="Toggle color theme"
            >
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            </button>

            {/* User Profile / Connect Action */}
            {currentUser ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(prev => !prev)}
                  className="inline-flex items-center gap-2 h-7 px-2 rounded-[6px] transition-colors"
                  style={{
                    boxShadow: 'var(--v-shadow-border)',
                    backgroundColor: isUserMenuOpen
                      ? 'var(--v-canvas-soft)'
                      : 'transparent',
                  }}
                  title={`@${currentUser.handle}`}
                >
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold v-mono"
                    style={{
                      backgroundColor: 'var(--v-canvas-soft)',
                      color: 'var(--v-ink)',
                      border: '1px solid var(--v-hairline)',
                    }}
                  >
                    {currentUser.handle.slice(0, 1).toUpperCase()}
                  </div>
                  <span
                    className="text-xs font-medium truncate max-w-[90px]"
                    style={{ color: 'var(--v-ink)' }}
                  >
                    @{currentUser.handle}
                  </span>
                  <span
                    className="v-caption-mono text-[10px] hidden sm:inline"
                    style={{ color: 'var(--v-mute)' }}
                  >
                    {liveElo} LP
                  </span>
                  <ChevronDown size={11} style={{ color: 'var(--v-mute)' }} />
                </button>

                {isUserMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-48 rounded-[8px] p-1.5 z-50"
                    style={{
                      backgroundColor: 'var(--v-canvas)',
                      boxShadow: 'var(--v-shadow-stack)',
                    }}
                  >
                    <div
                      className="px-2.5 py-1.5 mb-1"
                      style={{ borderBottom: '1px solid var(--v-hairline-subtle)' }}
                    >
                      <p
                        className="text-xs font-semibold"
                        style={{ color: 'var(--v-ink)' }}
                      >
                        @{currentUser.handle}
                      </p>
                      <p
                        className="v-caption-mono text-[10px]"
                        style={{ color: 'var(--v-mute)' }}
                      >
                        {tierInfo.tier} Tier · {liveElo} LP
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        navigate('/record');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-[5px] v-caption flex items-center gap-2 hover:bg-[var(--v-canvas-soft)] transition"
                      style={{ color: 'var(--v-ink)' }}
                    >
                      <UserIcon size={12} />
                      <span>My Record Dossier</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-[5px] v-caption flex items-center gap-2 hover:bg-[var(--v-canvas-soft)] transition"
                      style={{ color: 'var(--v-bear)' }}
                    >
                      <LogOut size={12} />
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/record')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-[5px] hover:bg-[var(--v-canvas-soft)] transition"
                  title="Guest account standing"
                >
                  <span
                    className="text-xs font-medium"
                    style={{ color: 'var(--v-body)' }}
                  >
                    @{userHandle}
                  </span>
                  <span
                    className="v-caption-mono text-[10px]"
                    style={{ color: 'var(--v-mute)' }}
                  >
                    ({liveElo} LP)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsConnectOpen(true)}
                  className="v-btn-primary h-7 px-3 text-xs"
                >
                  <span>Connect</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Sub-Row (< 768px only) */}
        <div
          className="md:hidden w-full overflow-x-auto no-scrollbar"
          style={{
            borderTop: '1px solid var(--v-hairline-subtle)',
            backgroundColor: 'var(--v-canvas)',
          }}
        >
          <div
            className="px-4 h-8 flex items-center gap-5 whitespace-nowrap"
            style={{
              borderLeft: '1px solid var(--v-hairline)',
              borderRight: '1px solid var(--v-hairline)',
            }}
          >
            {navTabs.map(tab => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className="relative h-full flex items-center gap-1.5 text-xs font-medium transition-colors"
                style={{
                  color: tab.isActive ? 'var(--v-ink)' : 'var(--v-mute)',
                }}
              >
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="v-kbd text-[9px] px-1 py-0">{tab.badge}</span>
                )}
                {tab.isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ backgroundColor: 'var(--v-primary)' }}
                  />
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </header>

      <ConnectModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onSuccess={() => {
          setIsConnectOpen(false);
        }}
      />
    </>
  );
}
