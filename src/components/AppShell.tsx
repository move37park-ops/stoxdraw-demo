import { Outlet } from 'react-router-dom';
import { GlobalHeader } from './GlobalHeader';
import { ShowcaseFooter } from '../features/showcase/ShowcaseFooter';

interface AppShellProps {
  currentDateStr: string;
  onDateChange: (newDate: string) => void;
}

export function AppShell({ currentDateStr, onDateChange }: AppShellProps) {
  return (
    <div className="min-h-screen w-full bg-black text-zinc-100 flex flex-col font-sans">
      <GlobalHeader
        currentDateStr={currentDateStr}
        onDateChange={onDateChange}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>

      <ShowcaseFooter />
    </div>
  );
}
