import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import { TopNav } from './TopNav';
import { Footer } from './Footer';
import { GuideModal } from '../features/onboarding/GuideModal';
import { useI18n } from '../lib/i18nCore';
import { repository } from '../data/localRepository';
import { getCurrentUser, getOrCreateAnonId, subscribeSession } from '../data/session';
import { deriveForecastStatus } from '../domain/lifecycle';
import { resolveForecastsWithCohort } from '../domain/resolution';
import { getBtcHistoryBars } from '../data/btcMarket';
import { DEFAULT_ELO, MIN_ELO } from '../domain/elo';
import type { Forecast, User } from '../domain/types';

interface AppShellProps {
  currentDateStr: string;
  onDateChange: (newDate: string) => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

const GUIDE_SEEN_KEY = 'op_guide_seen';

export function AppShell({
  currentDateStr,
  onDateChange,
  theme = 'dark',
  onToggleTheme = () => {},
}: AppShellProps) {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentUser());
  const [allForecasts, setAllForecasts] = useState<Forecast[]>(() =>
    repository.listFeed('all', currentDateStr)
  );
  const [guideRequested, setGuideRequested] = useState<boolean>(false);
  const isGuideOpen = guideRequested || searchParams.get('guide') === '1';

  const handleOpenGuide = useCallback(() => {
    setGuideRequested(true);
  }, []);

  const handleCloseGuide = useCallback(() => {
    setGuideRequested(false);
    try {
      localStorage.setItem(GUIDE_SEEN_KEY, '1');
    } catch {}
    if (searchParams.get('guide') === '1') {
      const next = new URLSearchParams(searchParams);
      next.delete('guide');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const unsubRepo = repository.subscribe(() => {
      setAllForecasts(repository.listFeed('all', currentDateStr));
    });
    const unsubSession = subscribeSession(() => {
      setCurrentUser(getCurrentUser());
      setAllForecasts(repository.listFeed('all', currentDateStr));
    });
    return () => {
      unsubRepo();
      unsubSession();
    };
  }, [currentDateStr]);

  const anonId = getOrCreateAnonId();
  const myForecasts = useMemo(() => {
    return currentUser
      ? allForecasts.filter(f => f.authorId === currentUser.id)
      : allForecasts.filter(f => f.anonId === anonId);
  }, [allForecasts, currentUser, anonId]);

  const liveElo = useMemo(() => {
    const base = currentUser?.elo ?? DEFAULT_ELO;
    const allBars = getBtcHistoryBars().filter(b => b.date <= currentDateStr);
    const resolvedAll = allForecasts.filter(
      f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED'
    );
    const userEloMap: Record<string, number> = {};
    for (const u of repository.listAllUsers()) {
      userEloMap[u.id] = u.elo ?? DEFAULT_ELO;
    }
    if (currentUser) {
      userEloMap[currentUser.id] = currentUser.elo ?? DEFAULT_ELO;
    }
    const cohortResults = resolveForecastsWithCohort(resolvedAll, allBars, userEloMap);

    let delta = 0;
    myForecasts.forEach(f => {
      if (deriveForecastStatus(f, currentDateStr) === 'RESOLVED') {
        const res = cohortResults.get(f.id);
        if (res?.eloSettlement) {
          delta += res.eloSettlement.deltaLp;
        }
      }
    });
    return Math.max(MIN_ELO, base + delta);
  }, [currentUser, myForecasts, allForecasts, currentDateStr]);

  const cleanAnonSuffix = anonId.replace(/^anon[_-]?/i, '').slice(0, 4) || 'guest';
  const userHandle = currentUser ? currentUser.handle : `guest_${cleanAnonSuffix}`;

  return (
    <div
      className="op-root v-studio-root min-h-screen w-full flex flex-col"
    >
      <a href="#main" className="skip-link">
        {t('본문 바로가기', 'Skip to content')}
      </a>

      <TopNav
        userHandle={userHandle}
        liveElo={liveElo}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onOpenGuide={handleOpenGuide}
      />

      <main
        id="main"
        tabIndex={-1}
        className="flex-1 w-full relative focus:outline-none"
      >
        <Suspense
          fallback={
            <div
              className="py-20 text-center text-xs op-mono"
              style={{ color: 'var(--op-ink-3)' }}
            >
              Loading...
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      <Footer
        currentDateStr={currentDateStr}
        onDateChange={onDateChange}
      />

      <GuideModal isOpen={isGuideOpen} onClose={handleCloseGuide} />
    </div>
  );
}
