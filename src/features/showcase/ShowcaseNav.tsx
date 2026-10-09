import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut, ArrowRight } from 'lucide-react';
import { getCurrentUser, subscribeSession, logout } from '../../data/session';
import { ConnectModal } from '../auth/ConnectModal';
import type { User } from '../../domain/types';

interface ShowcaseNavProps {
  currentDateStr: string;
  onDateChange: (date: string) => void;
}

export function ShowcaseNav({ currentDateStr, onDateChange }: ShowcaseNavProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentUser());
  const [isConnectOpen, setIsConnectOpen] = useState(false);

  useEffect(() => {
    // Ensure clean OpenAI editorial light mode
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    const unsub = subscribeSession(setCurrentUser);
    return () => unsub();
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 dark:bg-[#07080b]/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Left: Brand Logo & Navigation */}
        <div className="flex items-center gap-8">
          <NavLink to="/" className="flex items-center group">
            <span className="font-extrabold text-lg tracking-tight text-zinc-900 dark:text-white font-mono">
              STOXDRAW
            </span>
          </NavLink>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            <NavLink
              to="/arena"
              className={({ isActive }) =>
                `hover:text-zinc-900 dark:hover:text-white transition ${
                  isActive ? 'text-zinc-900 dark:text-white font-semibold' : ''
                }`
              }
            >
              아레나
            </NavLink>

            <NavLink
              to="/stream"
              className={({ isActive }) =>
                `hover:text-zinc-900 dark:hover:text-white transition ${
                  isActive ? 'text-zinc-900 dark:text-white font-semibold' : ''
                }`
              }
            >
              피드
            </NavLink>

            <NavLink
              to="/leaderboard"
              className={({ isActive }) =>
                `hover:text-zinc-900 dark:hover:text-white transition ${
                  isActive ? 'text-zinc-900 dark:text-white font-semibold' : ''
                }`
              }
            >
              리더보드
            </NavLink>
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Time Machine Selector (Subtle pill) */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-mono">
            <span className="text-[10px] text-zinc-400">시점:</span>
            <select
              value={currentDateStr}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="2026-09-28">9/28 (과거)</option>
              <option value="2026-10-05">10/05 (현재)</option>
              <option value="2026-10-08">10/08 (미래+3)</option>
              <option value="2026-10-12">10/12 (미래+7)</option>
              <option value="2026-10-26">10/26 (미래+21)</option>
            </select>
          </div>

          {/* User Profile or Login */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              <NavLink
                to={`/u/${currentUser.handle}`}
                className="flex items-center gap-2 p-1 pl-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
              >
                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 hidden sm:inline">
                  {currentUser.name}
                </span>
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-full object-cover"
                />
              </NavLink>
              <button
                type="button"
                onClick={logout}
                title="로그아웃"
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsConnectOpen(true)}
              className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white px-3 py-1.5"
            >
              로그인
            </button>
          )}

          {/* Primary Signature DRAW CTA */}
          <NavLink
            to="/draw"
            className="btn-signature-draw px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm tracking-wide"
          >
            <span>DRAW</span>
            <ArrowRight size={14} className="stroke-[2.5]" />
          </NavLink>
        </div>
      </div>

      <ConnectModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onSuccess={() => setCurrentUser(getCurrentUser())}
      />
    </header>
  );
}
