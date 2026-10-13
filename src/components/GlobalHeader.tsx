import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { User as UserIcon, LogOut, ChevronDown, Sparkles, PenTool } from 'lucide-react';
import { getCurrentUser, subscribeSession, logout } from '../data/session';
import { ConnectModal } from '../features/auth/ConnectModal';
import type { User } from '../domain/types';

interface GlobalHeaderProps {
  currentDateStr: string;
  onDateChange: (date: string) => void;
}

export function GlobalHeader({ currentDateStr, onDateChange }: GlobalHeaderProps) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentUser());
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  }, []);

  useEffect(() => {
    const unsub = subscribeSession(setCurrentUser);
    return () => unsub();
  }, []);

  const handleProfileClick = () => {
    if (currentUser) {
      navigate('/record');
    } else {
      setIsConnectOpen(true);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-md border-b border-white/10 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          {/* 1. Left: Brand Logo (초록색 점 제거, 깔끔한 텍스트 로고) & Navigation Menu */}
          <div className="flex items-center gap-8">
            <NavLink to="/" className="flex items-center group">
              <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-zinc-300 transition">
                STOXDRAW
              </span>
            </NavLink>

            {/* 통일된 공통 목차 */}
            <nav className="hidden md:flex items-center gap-7 type-caption font-medium text-zinc-400">
              <NavLink
                to="/arena"
                className={({ isActive }) =>
                  `transition ${isActive ? 'text-white font-semibold' : 'hover:text-white'}`
                }
              >
                아레나
              </NavLink>
              <NavLink
                to="/stream"
                className={({ isActive }) =>
                  `transition ${isActive ? 'text-white font-semibold' : 'hover:text-white'}`
                }
              >
                탐색 피드
              </NavLink>
              <NavLink
                to="/leaderboard"
                className={({ isActive }) =>
                  `transition ${isActive ? 'text-white font-semibold' : 'hover:text-white'}`
                }
              >
                리더보드
              </NavLink>
            </nav>
          </div>

          {/* 2. Right: Time Selector, DRAW CTA & Profile */}
          <div className="flex items-center gap-3">
            {/* Simulation Date Selector */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 type-caption font-mono">
              <span className="text-[12px] text-zinc-500">시점:</span>
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

            {/* Global DRAW Button (월가 샴페인 브래스 골드 액센트) */}
            <NavLink
              to="/draw"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#C5A059] hover:bg-[#d4af37] text-black font-semibold type-caption transition shadow-sm"
            >
              <PenTool size={13} className="stroke-[2.2]" />
              <span>DRAW</span>
            </NavLink>

            {/* Profile Button / Avatar */}
            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center gap-2 p-1 pl-2.5 pr-2 rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition text-white group"
                  title="Profile"
                >
                  <span className="type-caption font-medium max-w-[90px] truncate text-zinc-300 group-hover:text-white">
                    {currentUser.handle}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-zinc-800 border border-white/10 text-white font-bold text-xs flex items-center justify-center">
                    {currentUser.avatarUrl ? (
                      <img
                        src={currentUser.avatarUrl}
                        alt="Profile"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      currentUser.handle[0].toUpperCase()
                    )}
                  </div>
                  <ChevronDown size={13} className="text-zinc-400 group-hover:text-white transition" />
                </button>

                {/* Profile Dropdown Menu */}
                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-[#111116] border border-white/10 shadow-2xl p-1.5 z-50 type-caption">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate('/record');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 text-zinc-200 hover:text-white text-left transition font-medium"
                    >
                      <UserIcon size={14} className="text-zinc-300" />
                      <span>내 프로필 & 기록</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate('/draw');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 text-zinc-200 hover:text-white text-left transition font-medium"
                    >
                      <Sparkles size={14} className="text-zinc-300" />
                      <span>새 궤적 그리기</span>
                    </button>
                    <div className="my-1 border-t border-white/5" />
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 text-left transition"
                    >
                      <LogOut size={14} />
                      <span>로그아웃</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleProfileClick}
                className="flex items-center gap-2 py-1.5 px-3 sm:px-4 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 text-zinc-200 hover:text-white transition group type-caption font-medium"
                title="Profile"
              >
                <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 group-hover:text-white transition">
                  <UserIcon size={12} />
                </div>
                <span>Profile</span>
              </button>
            )}

          </div>
        </div>
      </header>

      {/* Auth Connect Modal */}
      <ConnectModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onSuccess={() => {
          navigate('/record');
        }}
      />
    </>
  );
}
export default GlobalHeader;
