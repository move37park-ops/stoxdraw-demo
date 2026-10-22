import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './features/landing/LandingPage';
import { AppShell } from './components/AppShell';
import { WorkspaceOverviewPage } from './features/workspace/WorkspaceOverviewPage';
import { ArenaPage } from './features/arena/ArenaPage';
import { DetailPage } from './features/detail/DetailPage';
import { DrawWizard } from './features/draw/DrawWizard';
import { ProfilePage } from './features/profile/ProfilePage';
import { LeaderboardPage } from './features/leaderboard/LeaderboardPage';
import { TrajectoryStudioPage } from './features/studio/TrajectoryStudioPage';

export function App() {
  // Unified Time-Warp simulator state (defaults to D-0 Lock: 2026-10-02)
  const [currentDateStr, setCurrentDateStr] = useState<string>('2026-10-02');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const toggleTheme = () =>
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <BrowserRouter>
      <Routes>
        {/* 1. Primary Unified Studio Workspace (/, /studio, /studio/:ticker) */}
        <Route
          path="/"
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
          path="/studio/:ticker"
          element={
            <TrajectoryStudioPage
              currentDateStr={currentDateStr}
              onDateChange={setCurrentDateStr}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          }
        />

        {/* 2. Product Showcase (/home) */}
        <Route
          path="/home"
          element={
            <LandingPage
              currentDateStr={currentDateStr}
              onDateChange={setCurrentDateStr}
            />
          }
        />

        {/* 3. Unified Secondary Workspace Views (Overview, Leaderboard, Record, Detail) */}
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
          <Route
            path="overview"
            element={<WorkspaceOverviewPage currentDateStr={currentDateStr} />}
          />
          <Route
            path="arena"
            element={<ArenaPage currentDateStr={currentDateStr} />}
          />
          <Route
            path="arena/:ticker"
            element={<ArenaPage currentDateStr={currentDateStr} />}
          />
          <Route path="feed" element={<Navigate to="/overview" replace />} />
          <Route path="stream" element={<Navigate to="/overview" replace />} />
          <Route
            path="record"
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
          <Route
            path="draw"
            element={
              <DrawWizard
                currentDateStr={currentDateStr}
                onDateChange={setCurrentDateStr}
              />
            }
          />
          <Route
            path="u/:handle"
            element={<ProfilePage currentDateStr={currentDateStr} />}
          />
          <Route path="notifications" element={<Navigate to="/" replace />} />
          <Route
            path="leaderboard"
            element={<LeaderboardPage currentDateStr={currentDateStr} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
