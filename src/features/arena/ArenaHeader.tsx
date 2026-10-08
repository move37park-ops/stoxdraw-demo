import { useRef } from 'react';
import { Flame, ChevronLeft, ChevronRight } from 'lucide-react';
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
    <div className="w-full bg-[#07080b] border-b border-[#1b1e26] py-2 px-3 sm:px-4">
      {/* Title & Quick Info */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
          <Flame size={15} className="text-amber-400 fill-amber-400/20" />
          <span>HOT FORECAST ARENAS</span>
          <span className="text-[10px] text-zinc-400 font-normal hidden sm:inline">
            · 실시간 예측 배틀 종목
          </span>
        </div>

        {/* Scroll Controls (Desktop) */}
        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="p-1 rounded-md bg-[#13151c] text-zinc-400 hover:text-white border border-[#222634] transition"
            title="이전 종목"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="p-1 rounded-md bg-[#13151c] text-zinc-400 hover:text-white border border-[#222634] transition"
            title="다음 종목"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {hotArenas.map(arena => {
          const isSelected = arena.ticker === selectedTicker;

          return (
            <button
              key={arena.ticker}
              type="button"
              onClick={() => onSelectTicker(arena.ticker)}
              className={`flex-shrink-0 text-left p-2.5 rounded-xl border transition-all duration-150 min-w-[145px] sm:min-w-[160px] ${
                isSelected
                  ? 'bg-gradient-to-b from-[#11192e] to-[#0c101c] border-sky-500 shadow-md shadow-sky-500/15 ring-1 ring-sky-500/50'
                  : 'bg-[#0d0f14] border-[#1e222c] hover:border-[#2f3545] hover:bg-[#12151d]'
              }`}
            >
              {/* Top row: Ticker + Live Count */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: arena.logoColor }}
                  />
                  <span className="font-bold text-[13px] text-white font-mono">
                    ${arena.ticker}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {arena.participantsCount}명
                </span>
              </div>

              {/* Price & Name */}
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-zinc-400 truncate max-w-[80px]">
                  {arena.name}
                </span>
                <span className="font-mono text-white font-medium">
                  ${arena.currentPrice.toFixed(1)}
                </span>
              </div>

              {/* Bull vs Bear Mini Sentiment Bar */}
              <div className="w-full">
                <div className="w-full h-1.5 rounded-full bg-zinc-800 flex overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${arena.bullPct}%` }}
                  />
                  <div
                    className="h-full bg-rose-400 transition-all duration-300"
                    style={{ width: `${arena.bearPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] font-mono mt-0.5 text-zinc-400">
                  <span className="text-emerald-400">Bull {arena.bullPct}%</span>
                  <span className="text-rose-400">Bear {arena.bearPct}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
