import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { FeedPage } from './features/feed/FeedPage';
import { DetailPage } from './features/detail/DetailPage';
import { DrawWizard } from './features/draw/DrawWizard';
import { ProfilePage } from './features/profile/ProfilePage';
import { NotificationPage } from './features/notifications/NotificationPage';

export function App() {
  // 기준 시점 (Time Travel 시뮬레이터 지원)
  const [currentDateStr, setCurrentDateStr] = useState<string>('2026-10-05');

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <AppShell
              currentDateStr={currentDateStr}
              onDateChange={setCurrentDateStr}
            />
          }
        >
          <Route index element={<FeedPage currentDateStr={currentDateStr} />} />
          <Route path="f/:id" element={<DetailPage currentDateStr={currentDateStr} />} />
          <Route path="draw" element={<DrawWizard currentDateStr={currentDateStr} />} />
          <Route path="u/:handle" element={<ProfilePage currentDateStr={currentDateStr} />} />
          <Route path="notifications" element={<NotificationPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
