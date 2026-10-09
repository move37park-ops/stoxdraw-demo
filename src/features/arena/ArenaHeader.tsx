import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ArenaSummary } from '../../domain/arena';

interface ArenaHeaderProps {
  hotArenas: ArenaSummary[];
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
}

export function ArenaHeader({
  hotArenas,
  selectedTicker,
  onSelectTicker,
}: ArenaHeaderProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const offset = direction === 'left' ? -240 : 240;
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full bg-white dark:bg-[#0c0e14] border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-3.5 mb-6 shadow-sm">
      {/* Title & Quick Info */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
          <span>주요 예측 종목</span>
          <span className="text-[11px] text-zinc-400 font-normal lowercase">
            · 실시간 아레나
          </span>
        </div>

        {/* Scroll Controls (Desktop) */}
        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="p-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            title="이전 종목"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="p-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            title="다음 종목"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-2.5 overflow-x-auto no-scrollbar scroll-smooth pb-0.5"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {hotArenas.map((arena) => {
          const isSelected = arena.ticker === selectedTicker;

          return (
            <button
              key={arena.ticker}
              type="button"
              onClick={() => onSelectTicker(arena.ticker)}
              className={`flex-shrink-0 text-left p-3 rounded-xl border transition-all duration-150 min-w-[155px] sm:min-w-[170px] ${
                isSelected
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-md ring-2 ring-zinc-900/10 dark:ring-white/20'
                  : 'bg-zinc-50 dark:bg-[#12141c] text-zinc-900 dark:text-white border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-[#171a24]'
              }`}
            >
              {/* Top row: Ticker + Live Count */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: arena.logoColor }}
                  />
                  <span className={`font-bold text-sm font-mono tracking-tight ${
                    isSelected ? 'text-white dark:text-zinc-900' : 'text-zinc-900 dark:text-white'
                  }`}>
                    ${arena.ticker}
                  </span>
                </div>
                <span className={`text-[10px] font-mono ${
                  isSelected ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-500 dark:text-zinc-400'
                }`}>
                  {arena.participantsCount}명
                </span>
              </div>

              {/* Price & Name */}
              <div className="flex items-center justify-between text-xs mb-2">
                <span className={`truncate max-w-[85px] ${
                  isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'
                }`}>
                  {arena.name}
                </span>
                <span className={`font-mono font-semibold ${
                  isSelected ? 'text-white dark:text-zinc-900' : 'text-zinc-900 dark:text-white'
                }`}>
                  ${arena.currentPrice.toFixed(1)}
                </span>
              </div>

              {/* Bull vs Bear Mini Sentiment Bar */}
              <div className="w-full">
                <div className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${arena.bullPct}%` }}
                  />
                  <div
                    className="h-full bg-rose-500 transition-all duration-300"
                    style={{ width: `${arena.bearPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] font-mono mt-1">
                  <span className={isSelected ? 'text-emerald-400 dark:text-emerald-600 font-bold' : 'text-emerald-600 dark:text-emerald-400'}>
                    Bull {arena.bullPct}%
                  </span>
                  <span className={isSelected ? 'text-rose-400 dark:text-rose-600 font-bold' : 'text-rose-600 dark:text-rose-400'}>
                    Bear {arena.bearPct}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
