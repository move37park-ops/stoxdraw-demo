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
  // 기준 시점 (Time-Slip 시뮬레이터 지원)
  const [currentDateStr, setCurrentDateStr] = useState<string>('2026-10-05');

  return (
    <BrowserRouter>
      <Routes>
        {/* 0. Zero-Base Vercel Geist Trajectory Studio (/studio) */}
        <Route
          path="/studio"
          element={
            <TrajectoryStudioPage
              currentDateStr={currentDateStr}
              onDateChange={setCurrentDateStr}
            />
          }
        />
        <Route
          path="/studio/:ticker"
          element={
            <TrajectoryStudioPage
              currentDateStr={currentDateStr}
              onDateChange={setCurrentDateStr}
            />
          }
        />

        {/* 1. Product Showcase (/home) */}
        <Route
          path="/home"
          element={
            <LandingPage
              currentDateStr={currentDateStr}
              onDateChange={setCurrentDateStr}
            />
          }
        />

        {/* 2. Interactive Workspace & Project Views */}
        <Route
          element={
            <AppShell
              currentDateStr={currentDateStr}
              onDateChange={setCurrentDateStr}
            />
          }
        >
          <Route index element={<WorkspaceOverviewPage currentDateStr={currentDateStr} />} />
          <Route path="arena" element={<ArenaPage currentDateStr={currentDateStr} />} />
          <Route path="arena/:ticker" element={<ArenaPage currentDateStr={currentDateStr} />} />
          <Route path="feed" element={<Navigate to="/" replace />} />
          <Route path="stream" element={<Navigate to="/" replace />} />
          <Route path="record" element={<ProfilePage currentDateStr={currentDateStr} />} />
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
          <Route path="u/:handle" element={<ProfilePage currentDateStr={currentDateStr} />} />
          <Route path="notifications" element={<Navigate to="/" replace />} />
          <Route path="leaderboard" element={<LeaderboardPage currentDateStr={currentDateStr} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
