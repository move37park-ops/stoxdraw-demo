import { NavLink } from 'react-router-dom';

export function ShowcaseFooter() {
  return (
    <footer className="w-full border-t border-zinc-800 bg-black py-6 text-zinc-500 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="font-semibold text-zinc-200 tracking-tight font-mono">STOXDRAW</span>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-400">5D Stock Path & Quantitative Elo Rating</span>
        </div>

        <nav className="flex items-center gap-5 text-xs text-zinc-400">
          <NavLink to="/" end className="hover:text-zinc-100 transition">대시보드</NavLink>
          <NavLink to="/arena" className="hover:text-zinc-100 transition">종목 아레나</NavLink>
          <NavLink to="/draw" className="hover:text-zinc-100 transition">예측 등록</NavLink>
          <NavLink to="/leaderboard" className="hover:text-zinc-100 transition">리더보드</NavLink>
          <NavLink to="/record" className="hover:text-zinc-100 transition">내 기록</NavLink>
          <NavLink to="/home" className="hover:text-zinc-100 transition">서비스 소개 (/home)</NavLink>
        </nav>
      </div>
    </footer>
  );
}
