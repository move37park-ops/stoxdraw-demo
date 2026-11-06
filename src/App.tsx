import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { LandingPage } from './features/landing/LandingPage';
import { TrajectoryStudioPage } from './features/studio/TrajectoryStudioPage';
import { ReplayLabPage } from './features/practice/ReplayLabPage';
import { LeaderboardPage } from './features/leaderboard/LeaderboardPage';
import { DetailPage } from './features/detail/DetailPage';
import { ProfilePage } from './features/profile/ProfilePage';

export function App() {
  // Unified Time-Warp simulator state for Live 20D tracking (defaults to D-0 Lock: 2026-10-02)
  const [currentDateStr, setCurrentDateStr] = useState<string>('2026-10-02');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const toggleTheme = () =>
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <BrowserRouter>
      <Routes>
        {/* 1. Live Mode Studio - BTC/USDT 20D Polyline Studio & Consensus Compare */}
        <Route
          path="/studio"
          element={
            <TrajectoryStudioPage
              currentDateStr={currentDateStr}
              onDateChange={setCurrentDateStr}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          }
        />
        <Route
          path="/live"
          element={
            <TrajectoryStudioPage
              currentDateStr={currentDateStr}
              onDateChange={setCurrentDateStr}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          }
        />

        {/* 2. Unified Geist AppShell Routes (Landing Gateway, Practice Mode, Leaderboard & Record) */}
        <Route
          element={
            <AppShell
              currentDateStr={currentDateStr}
              onDateChange={setCurrentDateStr}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          }
        >
          {/* Root Landing & Mode Selector Gateway */}
          <Route
            path="/"
            element={<LandingPage currentDateStr={currentDateStr} />}
          />

          {/* Tab 2: Practice Mode - Replay Lab (Blind Quiz & 1-Second Grading) */}
          <Route path="practice" element={<ReplayLabPage />} />

          {/* Tab 3: Leaderboard (Bronze ~ Diamond) & Verifiable Track Record */}
          <Route
            path="leaderboard"
            element={<LeaderboardPage currentDateStr={currentDateStr} />}
          />
          <Route
            path="record"
            element={<ProfilePage currentDateStr={currentDateStr} />}
          />
          <Route
            path="u/:handle"
            element={<ProfilePage currentDateStr={currentDateStr} />}
          />
          <Route
            path="f/:id"
            element={
              <DetailPage
                currentDateStr={currentDateStr}
                onDateChange={setCurrentDateStr}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
