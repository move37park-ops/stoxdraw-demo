import { useEffect, useState, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import '../features/studio/vercel-geist.css';
import { StudioCommandBar } from '../features/studio/StudioCommandBar';
import { repository } from '../data/localRepository';
import { getCurrentUser, getOrCreateAnonId, subscribeSession } from '../data/session';
import { deriveForecastStatus } from '../domain/lifecycle';
import { resolveForecast } from '../domain/resolution';
import { getStockHistory } from '../data/market';
import { DEFAULT_ELO } from '../domain/elo';
import type { Forecast, User } from '../domain/types';

interface AppShellProps {
  currentDateStr: string;
  onDateChange: (newDate: string) => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export function AppShell({
  currentDateStr,
  onDateChange,
  theme = 'dark',
  onToggleTheme = () => {},
}: AppShellProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    getCurrentUser()
  );
  const [allForecasts, setAllForecasts] = useState<Forecast[]>(() =>
    repository.listFeed('all', currentDateStr)
  );

  useEffect(() => {
    const refresh = () => {
      setAllForecasts(repository.listFeed('all', currentDateStr));
      setCurrentUser(getCurrentUser());
    };
    refresh();
    const unsubRepo = repository.subscribe(refresh);
    const unsubSession = subscribeSession(refresh);
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
    let delta = 0;
    myForecasts.forEach(f => {
      if (deriveForecastStatus(f, currentDateStr) === 'RESOLVED') {
        const bars = getStockHistory(f.ticker).filter(
          b => b.date <= currentDateStr
        );
        const res = resolveForecast(f, bars);
        if (res.eloSettlement) {
          delta += res.eloSettlement.deltaLp;
        }
      }
    });
    return base + delta;
  }, [currentUser, myForecasts, currentDateStr]);

  const cleanAnonSuffix = anonId.replace(/^anon[_-]?/i, '').slice(0, 4) || 'guest';
  const userHandle = currentUser
    ? currentUser.handle
    : `guest_${cleanAnonSuffix}`;

  return (
    <div
      className="v-studio-root min-h-screen w-full flex flex-col"
      data-theme={theme}
    >
      <StudioCommandBar
        ticker="NVDA"
        studioDateStr={currentDateStr}
        onStudioDateChange={onDateChange}
        userHandle={userHandle}
        liveElo={liveElo}
        myForecasts={myForecasts}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      <main
        id="main"
        className="flex-1 w-full max-w-[1360px] mx-auto relative"
        style={{
          borderLeft: '1px solid var(--v-hairline)',
          borderRight: '1px solid var(--v-hairline)',
        }}
      >
        <Outlet />
      </main>

      <footer
        className="w-full"
        style={{
          borderTop: '1px solid var(--v-hairline)',
          backgroundColor: 'var(--v-canvas)',
        }}
      >
        <div
          className="max-w-[1360px] mx-auto px-5 py-6 flex flex-wrap items-center justify-between gap-4"
          style={{
            borderLeft: '1px solid var(--v-hairline)',
            borderRight: '1px solid var(--v-hairline)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <svg
              width="14"
              height="12"
              viewBox="0 0 76 65"
              fill="currentColor"
              aria-label="Vercel triangle mark"
              style={{ color: 'var(--v-ink)' }}
            >
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
            </svg>
            <span className="v-caption" style={{ color: 'var(--v-mute)' }}>
              STOXDRAW Trajectory Studio · Authored with Geist Design System (design.md & design.dark.md)
            </span>
          </div>
          <p className="v-caption-mono" style={{ color: 'var(--v-mute)' }}>
            rules:v1 · hybrid-100pt (path:50 / dir:30 / target:20) · immutable-lock
          </p>
        </div>
      </footer>
    </div>
  );
}
