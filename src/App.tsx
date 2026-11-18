import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { I18nProvider } from './lib/i18n';
import { useI18n } from './lib/i18nCore';
import { trackPageView } from './lib/analytics';
import { PredictPage } from './features/predict/PredictPage';

const CommunityPage = lazy(() =>
  import('./features/community/CommunityPage').then(m => ({ default: m.CommunityPage }))
);
const LeaderboardPage = lazy(() =>
  import('./features/leaderboard/LeaderboardPage').then(m => ({ default: m.LeaderboardPage }))
);
const DetailPage = lazy(() =>
  import('./features/detail/DetailPage').then(m => ({ default: m.DetailPage }))
);
const ProfilePage = lazy(() =>
  import('./features/profile/ProfilePage').then(m => ({ default: m.ProfilePage }))
);
const DocsPage = lazy(() =>
  import('./features/docs/DocsPage').then(m => ({ default: m.DocsPage }))
);
const PracticePage = lazy(() =>
  import('./features/practice/PracticePage').then(m => ({ default: m.PracticePage }))
);

const THEME_STORAGE_KEY = 'op_theme';

function readStoredThemeOverride(): 'dark' | 'light' | null {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {}
  return null;
}

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getRouteTitle(pathname: string, t: (ko: string, en: string) => string): string {
  if (pathname === '/practice') {
    return t('블라인드 연습 — Orange Paths', 'Blind Practice — Orange Paths');
  }
  if (pathname === '/community' || pathname === '/leaderboard') {
    return t('커뮤니티 · 평판 랭킹 — Orange Paths', 'Community & Rankings — Orange Paths');
  }
  if (pathname === '/docs') {
    return t('예측 평가 · 등급 규칙 — Orange Paths', 'Scoring & Reputation Rules — Orange Paths');
  }
  if (pathname === '/me' || pathname.startsWith('/u/')) {
    return t('내 기록 · 예측자 프로필 — Orange Paths', 'Forecaster Profile — Orange Paths');
  }
  if (pathname.startsWith('/f/')) {
    return t('예측 상세 리포트 — Orange Paths', 'Forecast Detail — Orange Paths');
  }
  return t('Orange Paths — 비트코인 7일 가격 예측', 'Orange Paths — 7-Day Bitcoin Forecast Path');
}

function RouteTracker() {
  const location = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    document.title = getRouteTitle(location.pathname, t);
  }, [location.pathname, t]);

  useEffect(() => {
    trackPageView(`${location.pathname}${location.search}`, getRouteTitle(location.pathname, t));
  }, [location.pathname, location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export function App() {
  // System date anchored to today's Open round ('2026-10-02'); users navigate past cohorts directly via Top Daily Round Nav
  const [currentDateStr] = useState<string>('2026-10-02');
  const [themeOverride, setThemeOverride] = useState<'dark' | 'light' | null>(readStoredThemeOverride);
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(getSystemTheme);

  const theme: 'dark' | 'light' = themeOverride ?? systemTheme;

  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'color-scheme';
      document.head.appendChild(meta);
    }
    meta.content = themeOverride ?? 'light dark';

    const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.content = theme === 'dark' ? '#000000' : '#ffffff';
    }
  }, [themeOverride, theme]);

  useEffect(() => {
    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;

    const handleSystemChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        setThemeOverride(
          event.newValue === 'dark' || event.newValue === 'light'
            ? event.newValue
            : readStoredThemeOverride()
        );
      }
    };

    mediaQuery?.addEventListener('change', handleSystemChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      mediaQuery?.removeEventListener('change', handleSystemChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const toggleTheme = () => {
    const target: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
    const currentSystem = getSystemTheme();
    if (target === currentSystem) {
      try {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } catch {}
      setThemeOverride(null);
    } else {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, target);
      } catch {}
      setThemeOverride(target);
    }
  };

  return (
    <I18nProvider>
      <BrowserRouter>
        <RouteTracker />
        <Suspense
          fallback={
            <div
              className="min-h-screen w-full flex items-center justify-center text-xs op-mono"
              style={{ backgroundColor: 'var(--op-canvas)', color: 'var(--op-ink-3)' }}
            >
              Loading...
            </div>
          }
        >
          <Routes>
          <Route
            element={
              <AppShell
                currentDateStr={currentDateStr}
                theme={theme}
                onToggleTheme={toggleTheme}
              />
            }
          >
            {/* Root = Live 7D Chart Drawing & Consensus Studio */}
            <Route
              index
              element={<PredictPage currentDateStr={currentDateStr} />}
            />
            <Route
              path="community"
              element={<CommunityPage currentDateStr={currentDateStr} />}
            />
            <Route
              path="leaderboard"
              element={<LeaderboardPage currentDateStr={currentDateStr} />}
            />
            <Route path="docs" element={<DocsPage />} />
            <Route path="guide" element={<Navigate to="/docs" replace />} />
            <Route
              path="me"
              element={<ProfilePage currentDateStr={currentDateStr} />}
            />
            <Route
              path="u/:handle"
              element={<ProfilePage currentDateStr={currentDateStr} />}
            />
            <Route
              path="f/:id"
              element={<DetailPage currentDateStr={currentDateStr} />}
            />

            {/* Legacy route redirects */}
            <Route path="studio" element={<Navigate to="/" replace />} />
            <Route path="live" element={<Navigate to="/" replace />} />
            <Route path="record" element={<Navigate to="/me" replace />} />
            <Route path="practice" element={<PracticePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </I18nProvider>
  );
}

export default App;
