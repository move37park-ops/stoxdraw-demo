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
import { getBtc20DRound, getCountdownRemaining } from '../../domain/round';
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
  { date: '2026-10-02', code: 'D-0', label: '제출', phase: 'OPEN' },
  { date: '2026-10-07', code: 'D+5', label: '5일차 추적', phase: 'LIVE' },
  { date: '2026-10-14', code: 'D+12', label: '12일차 추적', phase: 'LIVE' },
  { date: '2026-10-22', code: 'D+20', label: '20일 정산', phase: 'RESOLVED' },
];

interface StudioCommandBarProps {
  ticker?: string;
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

  const round = getBtc20DRound('2026-10-02', studioDateStr);
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

  const isLandingActive = location.pathname === '/';
  const isLiveStudioActive =
    location.pathname.startsWith('/studio') ||
    location.pathname.startsWith('/live');
  const isPracticeActive = location.pathname.startsWith('/practice');
  const isLeaderboardOrRecordActive =
    location.pathname.startsWith('/leaderboard') ||
    location.pathname.startsWith('/record') ||
    location.pathname.startsWith('/u/') ||
    location.pathname.startsWith('/f/');

  const navTabs = [
    {
      to: '/',
      label: '홈',
      isActive: isLandingActive,
    },
    {
      to: '/studio',
      label: '실전 모드',
      isActive: isLiveStudioActive,
    },
    {
      to: '/practice',
      label: '연습 모드',
      isActive: isPracticeActive,
    },
    {
      to: '/leaderboard',
      label: '리더보드',
      isActive: isLeaderboardOrRecordActive,
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
          {/* Left: Brand + 3 Lean Navigation Tabs */}
          <div className="flex items-center gap-4 sm:gap-6 h-full min-w-0">
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 flex-shrink-0 group"
              title="STOXDRAW"
            >
              <span
                className="v-serif-brand text-xl font-bold tracking-wider"
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

            {/* Primary 3-Tab Navigation (Vercel standard 14px text-sm font-medium) */}
            <nav className="flex items-center gap-1 sm:gap-1.5 h-full overflow-x-auto no-scrollbar">
              {navTabs.map(tab => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className="relative h-full flex items-center gap-2 px-3 sm:px-3.5 text-sm font-medium transition-colors whitespace-nowrap"
                  style={{
                    color: tab.isActive ? 'var(--v-ink)' : 'var(--v-mute)',
                  }}
                >
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className="v-caption-mono text-xs px-1.5 py-0.5 rounded-[3px]"
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

          {/* Right: Live 20D Tracking Scrubber + User Tier & Theme */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            {!isPracticeActive && !isLandingActive && (
              <div
                className="hidden sm:inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-[6px]"
                style={{
                  backgroundColor: 'var(--v-canvas-soft)',
                  boxShadow: 'var(--v-shadow-border)',
                }}
                role="group"
                aria-label="20일 시장 추적 시뮬레이터"
              >
                <div className="flex items-center gap-1.5 mr-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: statusDotColor }}
                  />
                  <span
                    className="v-caption-mono text-xs font-medium hidden xl:inline"
                    style={{ color: 'var(--v-body)' }}
                  >
                    {currentStep.phase === 'OPEN'
                      ? `마감 ${countdown.formatted}`
                      : `${currentStep.label}`}
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
                        className="px-2 py-0.5 rounded-[4px] text-xs v-mono transition-all"
                        style={{
                          backgroundColor: active
                            ? 'var(--v-primary)'
                            : 'transparent',
                          color: active
                            ? 'var(--v-on-primary)'
                            : 'var(--v-mute)',
                          fontWeight: active ? 600 : 400,
                        }}
                        title={`${step.code} (${step.label})`}
                      >
                        {step.code}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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
                className="w-8 h-8 rounded-[6px] flex items-center justify-center transition-colors relative"
                style={{
                  color: 'var(--v-mute)',
                  boxShadow: 'var(--v-shadow-border)',
                  backgroundColor: isNotifOpen
                    ? 'var(--v-canvas-soft)'
                    : 'transparent',
                }}
                title="알림"
                aria-label="알림"
              >
                <Bell size={14} />
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
                      알림 센터
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsNotifOpen(false)}
                      style={{ color: 'var(--v-mute)' }}
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {notifications.length === 0 ? (
                    <p
                      className="v-caption py-6 text-center"
                      style={{ color: 'var(--v-mute)' }}
                    >
                      새로운 알림이 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {notifications.slice(0, 6).map(n => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => handleNotificationClick(n)}
                          className="w-full text-left p-2 rounded-[6px] transition-colors flex items-start gap-2"
                          style={{
                            backgroundColor: n.read
                              ? 'transparent'
                              : 'var(--v-canvas-soft)',
                          }}
                        >
                          <span className="mt-0.5 flex-shrink-0">
                            {n.type === 'resolved' ? (
                              <CheckCircle2
                                size={13}
                                style={{ color: 'var(--v-bull)' }}
                              />
                            ) : n.type === 'response' ? (
                              <CornerDownRight
                                size={13}
                                style={{ color: 'var(--v-link)' }}
                              />
                            ) : (
                              <MessageSquare
                                size={13}
                                style={{ color: 'var(--v-mute)' }}
                              />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className="v-caption leading-snug"
                              style={{ color: 'var(--v-ink)' }}
                            >
                              <span className="font-semibold">
                                @{n.actorHandle}
                              </span>{' '}
                              {n.message}
                            </p>
                            <span
                              className="v-caption-mono text-xs"
                              style={{ color: 'var(--v-mute)' }}
                            >
                              {formatRelativeTime(n.createdAt)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Theme Toggle (Dark / Light) */}
            <button
              type="button"
              onClick={onToggleTheme}
              className="w-8 h-8 rounded-[6px] flex items-center justify-center transition-colors"
              style={{
                color: 'var(--v-mute)',
                boxShadow: 'var(--v-shadow-border)',
                backgroundColor: 'transparent',
              }}
              title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
              aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {/* User Profile / Elo Tier HUD Pill */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() =>
                  currentUser
                    ? setIsUserMenuOpen(prev => !prev)
                    : setIsConnectOpen(true)
                }
                className="h-8 px-3 rounded-[6px] inline-flex items-center gap-2 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--v-canvas-soft)',
                  boxShadow: 'var(--v-shadow-border)',
                  color: 'var(--v-ink)',
                }}
                title={`${tierInfo.krTitle} · ${liveElo} LP (승급 진행률 ${tierInfo.progressPct}%)`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tierInfo.accentHex }}
                />
                <span className="v-caption-mono font-semibold">
                  {tierInfo.krTitle}
                </span>
                <span
                  className="v-caption-mono font-semibold hidden sm:inline"
                  style={{ color: tierInfo.accentHex }}
                >
                  {liveElo} LP
                </span>
                <span
                  className="hidden md:inline-block w-10 h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--v-canvas-soft-2)' }}
                >
                  <span
                    className="block h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(8, tierInfo.progressPct)}%`,
                      backgroundColor: tierInfo.accentHex,
                    }}
                  />
                </span>
                <ChevronDown size={11} style={{ color: 'var(--v-mute)' }} />
              </button>

              {isUserMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 rounded-[8px] p-3 z-50 space-y-2.5"
                  style={{
                    backgroundColor: 'var(--v-canvas)',
                    boxShadow: 'var(--v-shadow-stack)',
                  }}
                >
                  <div
                    className="pb-2.5 space-y-2"
                    style={{ borderBottom: '1px solid var(--v-hairline)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className="v-body-sm-strong truncate"
                        style={{ color: 'var(--v-ink)' }}
                      >
                        @{userHandle}
                      </p>
                      <span
                        className="v-caption-mono text-xs font-semibold px-1.5 py-0.5 rounded-[4px]"
                        style={{
                          backgroundColor: 'var(--v-canvas-soft)',
                          color: tierInfo.accentHex,
                          boxShadow: 'var(--v-shadow-border)',
                        }}
                      >
                        {tierInfo.krTitle}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between v-caption-mono text-xs mb-1">
                        <span style={{ color: 'var(--v-ink)' }}>{liveElo} LP</span>
                        <span style={{ color: 'var(--v-mute)' }}>
                          {tierInfo.nextTierElo
                            ? `승급까지 ${Math.max(0, tierInfo.nextTierElo - liveElo)} LP`
                            : '최고 티어 달성'}
                        </span>
                      </div>
                      <div
                        className="w-full h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--v-canvas-soft-2)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${tierInfo.progressPct}%`,
                            backgroundColor: tierInfo.accentHex,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigate('/record');
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-[5px] v-caption flex items-center gap-2 transition-colors"
                    style={{ color: 'var(--v-ink)' }}
                  >
                    <UserIcon size={13} />내 기록
                  </button>

                  {currentUser ? (
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-[5px] v-caption flex items-center gap-2 transition-colors"
                      style={{ color: 'var(--v-bear)' }}
                    >
                      <LogOut size={13} />
                      연결 해제
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsConnectOpen(true);
                      }}
                      className="w-full v-btn-primary text-xs h-8 mt-1"
                    >
                      계정 연결 / 전환
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <ConnectModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
      />
    </>
  );
}
