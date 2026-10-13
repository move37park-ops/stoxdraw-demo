import { Outlet } from 'react-router-dom';
import { GlobalHeader } from './GlobalHeader';
import { ShowcaseFooter } from '../features/showcase/ShowcaseFooter';

interface AppShellProps {
  currentDateStr: string;
  onDateChange: (newDate: string) => void;
}

export function AppShell({ currentDateStr, onDateChange }: AppShellProps) {
  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col transition-colors duration-200">
      {/* 1. Unified Sticky Navigation (GlobalHeader) */}
      <GlobalHeader
        currentDateStr={currentDateStr}
        onDateChange={onDateChange}
      />

      {/* 2. Full-width Spacious Centered Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>

      {/* 3. Modern Multi-column Footer */}
      <ShowcaseFooter />
    </div>
  );
}
