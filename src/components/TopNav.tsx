import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Sun, Moon, HelpCircle, ChevronDown, LogOut, User as UserIcon } from 'lucide-react';
import { getEloTierInfo } from '../domain/elo';
import { getCurrentUser, logout } from '../data/session';
import { ConnectModal } from '../features/auth/ConnectModal';
import { useI18n } from '../lib/i18nCore';
import { track } from '../lib/analytics';

interface TopNavProps {
  userHandle: string;
  liveElo: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenGuide: () => void;
}

export function TopNav({
  userHandle,
  liveElo,
  theme,
  onToggleTheme,
  onOpenGuide,
}: TopNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { locale, toggleLocale, t } = useI18n();
  const currentUser = getCurrentUser();
  const tierInfo = getEloTierInfo(liveElo);

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; right: number }>({
    top: 56,
    right: 24,
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePopoverPosition = () => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    setPopoverPos({
      top: rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  };

  useEffect(() => {
    const popoverEl = popoverRef.current;
    if (!popoverEl) return;

    const handleToggle = (event: Event) => {
      const toggleEvent = event as ToggleEvent;
      const open = toggleEvent.newState === 'open';
      if (open) {
        updatePopoverPosition();
      }
      setIsUserMenuOpen(open);
    };

    popoverEl.addEventListener('toggle', handleToggle);
    return () => popoverEl.removeEventListener('toggle', handleToggle);
  }, [currentUser?.id]);

  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [navIndicator, setNavIndicator] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    ready: boolean;
  }>({ left: 0, top: 0, width: 0, height: 0, ready: false });

  const isPredictActive = location.pathname === '/';
  const isPracticeActive = location.pathname.startsWith('/practice');
  const isCommunityActive =
    location.pathname.startsWith('/community') ||
    location.pathname.startsWith('/leaderboard');
  const isMeActive =
    location.pathname.startsWith('/me') ||
    location.pathname.startsWith('/u/') ||
    location.pathname.startsWith('/f/');

  const navItems = [
    { to: '/', label: t('예측하기', 'Predict'), isActive: isPredictActive },
    { to: '/practice', label: t('연습하기', 'Practice'), isActive: isPracticeActive },
    { to: '/community', label: t('커뮤니티', 'Community'), isActive: isCommunityActive },
    { to: '/me', label: t('내 기록', 'My Record'), isActive: isMeActive },
  ];

  const activeNavIdx = navItems.findIndex(item => item.isActive);

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const el = activeNavIdx >= 0 ? itemRefs.current[activeNavIdx] : null;
      if (!el) {
        setNavIndicator(prev => (prev.ready ? { ...prev, ready: false } : prev));
        return;
      }
      setNavIndicator({
        left: el.offsetLeft,
        top: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
        ready: el.offsetWidth > 0,
      });
    };

    updateIndicator();

    const navEl = navRef.current;
    let observer: ResizeObserver | null = null;
    if (navEl && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateIndicator);
      observer.observe(navEl);
    }
    window.addEventListener('resize', updateIndicator);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateIndicator);
    };
  }, [activeNavIdx, locale]);

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full"
        style={{
          backgroundColor: 'var(--op-canvas)',
          borderBottom: '1px solid var(--op-line)',
        }}
      >
        <div className="w-full px-3 sm:px-6 min-h-[56px] py-1.5 flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr] gap-2 sm:gap-4">
          {/* Left: Orange Paths Brand */}
          <Link
            to="/"
            className="justify-self-start inline-flex items-center flex-shrink-0"
            title="Orange Paths"
          >
            <span
              className="op-nav-brand font-bold tracking-[-0.025em]"
              style={{ color: 'var(--op-ink)' }}
            >
              Orange Paths
            </span>
          </Link>

          {/* Center: Desktop 4-Item Navigation with Flat Active Pill */}
          <nav
            ref={navRef}
            aria-label={t('주 메뉴', 'Main navigation')}
            className="justify-self-center relative hidden md:inline-flex items-center gap-1.5 max-w-full"
          >
            <span
              aria-hidden="true"
              className="op-sliding-glow"
              style={{
                transform: `translate3d(${navIndicator.left}px, ${navIndicator.top}px, 0)`,
                width: `${navIndicator.width}px`,
                height: `${navIndicator.height}px`,
                opacity: navIndicator.ready ? 1 : 0,
              }}
            />
            {navItems.map((item, idx) => (
              <NavLink
                key={item.to}
                ref={el => {
                  itemRefs.current[idx] = el;
                }}
                to={item.to}
                className="op-nav-item relative z-10 min-h-[34px] py-1 px-3 sm:px-3.5 rounded-[6px] flex items-center gap-1.5 font-semibold transition-colors whitespace-nowrap hover:text-[var(--op-ink)]"
                style={{
                  color: item.isActive ? 'var(--op-orange)' : 'var(--op-ink)',
                }}
              >
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right: Guide + Language + Theme Toggle + Login / Tier HUD */}
          <div className="justify-self-end flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onOpenGuide}
              className="op-btn-ghost h-8 px-2 sm:px-3 text-[13px]"
              title={t('이용 가이드 보기', 'View Guide')}
            >
              <HelpCircle size={14} style={{ color: 'var(--op-orange)' }} />
              <span className="hidden sm:inline">{t('이용 가이드', 'Guide')}</span>
            </button>

            <button
              type="button"
              onClick={toggleLocale}
              className="h-8 px-1.5 inline-flex items-center gap-1.5 op-mono text-[11.5px] font-medium tracking-[0.04em] bg-transparent border-0 cursor-pointer transition-colors hover:opacity-90"
              style={{ color: 'var(--op-ink-3)' }}
              aria-label={t('언어 변경 (한국어 / English)', 'Switch language (Korean / English)')}
              title={locale === 'ko' ? 'Switch to English' : '한국어로 전환'}
            >
              <span
                className="transition-colors"
                style={{
                  color: locale === 'ko' ? 'var(--op-orange)' : 'var(--op-ink-3)',
                  fontWeight: locale === 'ko' ? 600 : 400,
                }}
              >
                KO
              </span>
              <span style={{ color: 'var(--op-line-strong)' }}>/</span>
              <span
                className="transition-colors"
                style={{
                  color: locale === 'en' ? 'var(--op-orange)' : 'var(--op-ink-3)',
                  fontWeight: locale === 'en' ? 600 : 400,
                }}
              >
                EN
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              className="w-8 h-8 rounded-[4px] flex items-center justify-center transition-colors"
              style={{
                backgroundColor: 'var(--op-panel)',
                border: '1px solid var(--op-line)',
                color: 'var(--op-ink-2)',
              }}
              title={
                theme === 'dark'
                  ? t('라이트 모드로 전환', 'Switch to light mode')
                  : t('다크 모드로 전환', 'Switch to dark mode')
              }
              aria-label={
                theme === 'dark'
                  ? t('라이트 모드로 전환', 'Switch to light mode')
                  : t('다크 모드로 전환', 'Switch to dark mode')
              }
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {currentUser ? (
              <div className="relative">
                <button
                  ref={triggerRef}
                  type="button"
                  aria-expanded={isUserMenuOpen}
                  aria-controls="user-profile-popover"
                  aria-haspopup="menu"
                  onClick={() => {
                    updatePopoverPosition();
                    popoverRef.current?.togglePopover?.();
                  }}
                  className="h-8 px-2 sm:px-2.5 rounded-[4px] inline-flex items-center gap-1.5 sm:gap-2 text-xs transition-colors whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--op-panel)',
                    border: '1px solid var(--op-line-strong)',
                    color: 'var(--op-ink)',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-[1px] flex-shrink-0"
                    style={{ backgroundColor: tierInfo.accentHex }}
                  />
                  <span
                    className="hidden sm:inline op-mono text-[11px] font-semibold"
                    style={{ color: tierInfo.accentHex }}
                  >
                    {locale === 'en' ? tierInfo.title : tierInfo.krTitle}
                  </span>
                  <span className="op-mono text-[11px] font-medium" style={{ color: 'var(--op-ink-2)' }}>
                    <span className="hidden sm:inline">· </span>
                    {liveElo} LP
                  </span>
                  <ChevronDown size={11} style={{ color: 'var(--op-ink-3)' }} />
                </button>

                <div
                  id="user-profile-popover"
                  ref={popoverRef}
                  {...({ popover: 'auto' } as any)}
                  className="w-56 p-3 space-y-2.5"
                  style={{
                    position: 'fixed',
                    top: `${popoverPos.top}px`,
                    right: `${popoverPos.right}px`,
                    bottom: 'auto',
                    left: 'auto',
                    margin: 0,
                    backgroundColor: 'var(--op-raised)',
                    border: '1px solid var(--op-line-strong)',
                    boxShadow: 'var(--op-shadow-stack)',
                    color: 'var(--op-ink)',
                  }}
                >
                  <div
                    className="pb-2 flex items-center justify-between gap-2"
                    style={{ borderBottom: '1px solid var(--op-line)' }}
                  >
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--op-ink)' }}>
                      @{userHandle}
                    </span>
                    <span
                      className="op-mono text-[11px] font-semibold inline-flex items-center gap-1.5 flex-shrink-0"
                      style={{ color: tierInfo.accentHex }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-[1px]"
                        style={{ backgroundColor: tierInfo.accentHex }}
                        aria-hidden="true"
                      />
                      {locale === 'en' ? tierInfo.title : tierInfo.krTitle} · {liveElo} LP
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      popoverRef.current?.hidePopover?.();
                      navigate('/me');
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs flex items-center gap-2 hover:bg-[var(--op-panel)]"
                    style={{ color: 'var(--op-ink)' }}
                  >
                    <UserIcon size={13} />
                    {t('내 기록 보기', 'My Record')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      popoverRef.current?.hidePopover?.();
                      logout();
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs flex items-center gap-2 hover:bg-[var(--op-panel)]"
                    style={{ color: 'var(--op-bear)' }}
                  >
                    <LogOut size={13} />
                    {t('로그아웃', 'Sign Out')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  track('signup_nudge_clicked', { source: 'topnav' });
                  setIsConnectOpen(true);
                }}
                className="op-btn-primary h-8 px-3.5"
              >
                {t('로그인', 'Sign In')}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Full-Width 4-Item Sub-Navigation (Zero Clipping) */}
        <nav
          aria-label={t('모바일 주 메뉴', 'Mobile main navigation')}
          className="md:hidden w-full px-3 py-1.5 grid grid-cols-4 gap-1"
          style={{ borderTop: '1px solid var(--op-line)' }}
        >
          {navItems.map(item => (
            <NavLink
              key={`mob-${item.to}`}
              to={item.to}
              className="h-8 px-1.5 rounded-[4px] inline-flex items-center justify-center gap-1 text-[12px] font-semibold whitespace-nowrap transition-colors"
              style={{
                backgroundColor: item.isActive ? 'var(--op-orange-soft)' : 'transparent',
                color: item.isActive ? 'var(--op-orange)' : 'var(--op-ink-2)',
              }}
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      <ConnectModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
      />
    </>
  );
}
