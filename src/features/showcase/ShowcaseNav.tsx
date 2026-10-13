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
    // Ensure clean OpenAI dark theme matches reference
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  }, []);

  useEffect(() => {
    const unsub = subscribeSession(setCurrentUser);
    return () => unsub();
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-md border-b border-white/10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Left: Brand Logo & Navigation */}
        <div className="flex items-center gap-8">
          <NavLink to="/" className="flex items-center group">
            <span className="font-extrabold text-base sm:text-lg tracking-tight text-white group-hover:text-zinc-300 transition">
              STOXDRAW
            </span>
          </NavLink>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400">
            <NavLink
              to="/arena"
              className={({ isActive }) =>
                `transition ${
                  isActive ? 'text-white font-semibold' : 'hover:text-white'
                }`
              }
            >
              아레나
            </NavLink>

            <NavLink
              to="/stream"
              className={({ isActive }) =>
                `transition ${
                  isActive ? 'text-white font-semibold' : 'hover:text-white'
                }`
              }
            >
              피드
            </NavLink>

            <NavLink
              to="/record"
              className={({ isActive }) =>
                `transition ${
                  isActive ? 'text-white font-semibold' : 'hover:text-white'
                }`
              }
            >
              내 기록
            </NavLink>
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Time Machine Selector (Flat Dark Pill) */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono">
            <span className="text-[10px] text-zinc-500">시점:</span>
            <select
              value={currentDateStr}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer text-zinc-200"
            >
              <option value="2026-09-28" className="bg-zinc-900 text-white">9/28 (과거)</option>
              <option value="2026-10-05" className="bg-zinc-900 text-white">10/05 (현재)</option>
              <option value="2026-10-08" className="bg-zinc-900 text-white">10/08 (미래+3)</option>
              <option value="2026-10-12" className="bg-zinc-900 text-white">10/12 (미래+7)</option>
              <option value="2026-10-26" className="bg-zinc-900 text-white">10/26 (미래+21)</option>
            </select>
          </div>

          {/* User Profile or Login */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              <NavLink
                to="/record"
                className="flex items-center gap-2 p-1 pl-2.5 rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition"
              >
                <span className="text-xs font-medium text-zinc-200 hidden sm:inline">
                  {currentUser.name}
                </span>
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-6 h-6 rounded-full object-cover"
                />
              </NavLink>
              <button
                type="button"
                onClick={logout}
                title="로그아웃"
                className="p-1.5 text-zinc-400 hover:text-white"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsConnectOpen(true)}
              className="text-xs sm:text-sm font-medium text-zinc-400 hover:text-white px-3 py-1.5"
            >
              로그인
            </button>
          )}

          {/* Primary Flat White Pill Button (OpenAI Reference Style) */}
          <NavLink
            to="/draw"
            className="rounded-full bg-white text-black font-semibold px-4 sm:px-5 py-2 text-xs sm:text-sm hover:bg-zinc-200 transition-colors inline-flex items-center gap-1.5"
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
