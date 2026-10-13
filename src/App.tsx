import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './features/landing/LandingPage';
import { AppShell } from './components/AppShell';
import { ArenaPage } from './features/arena/ArenaPage';
import { FeedPage } from './features/feed/FeedPage';
import { DetailPage } from './features/detail/DetailPage';
import { DrawWizard } from './features/draw/DrawWizard';
import { ProfilePage } from './features/profile/ProfilePage';
import { NotificationPage } from './features/notifications/NotificationPage';
import { LeaderboardPage } from './features/leaderboard/LeaderboardPage';

export function App() {
  // 기준 시점 (Time Travel 시뮬레이터 지원)
  const [currentDateStr, setCurrentDateStr] = useState<string>('2026-10-05');

  return (
    <BrowserRouter>
      <Routes>
        {/* 1. Master Home: STOXDRAW Sketched Landing Page */}
        <Route
          path="/"
          element={
            <LandingPage
              currentDateStr={currentDateStr}
              onDateChange={setCurrentDateStr}
            />
          }
        />

        {/* 2. Interactive App Tools & Subpages */}
        <Route
          element={
            <AppShell
              currentDateStr={currentDateStr}
              onDateChange={setCurrentDateStr}
            />
          }
        >
          <Route path="arena" element={<ArenaPage currentDateStr={currentDateStr} />} />
          <Route path="arena/:ticker" element={<ArenaPage currentDateStr={currentDateStr} />} />
          <Route path="feed" element={<FeedPage currentDateStr={currentDateStr} />} />
          <Route path="stream" element={<FeedPage currentDateStr={currentDateStr} />} />
          <Route path="record" element={<ProfilePage currentDateStr={currentDateStr} />} />
          <Route path="f/:id" element={<DetailPage currentDateStr={currentDateStr} />} />
          <Route path="draw" element={<DrawWizard currentDateStr={currentDateStr} />} />
          <Route path="u/:handle" element={<ProfilePage currentDateStr={currentDateStr} />} />
          <Route path="notifications" element={<NotificationPage />} />
          <Route path="leaderboard" element={<LeaderboardPage currentDateStr={currentDateStr} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
