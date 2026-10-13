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
    <div className="w-full bg-[#0d0d10] border border-white/10 rounded-2xl p-4 mb-6 shadow-none">
      {/* Title & Quick Info */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
          <span>주요 예측 종목</span>
          <span className="text-[11px] text-zinc-500 font-normal">
            실시간 아레나
          </span>
        </div>

        {/* Scroll Controls (Desktop) */}
        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="p-1 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white transition"
            title="이전 종목"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="p-1 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white transition"
            title="다음 종목"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-3 overflow-x-auto no-scrollbar scroll-smooth pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {hotArenas.map((arena) => {
          const isSelected = arena.ticker === selectedTicker;

          return (
            <button
              key={arena.ticker}
              type="button"
              onClick={() => onSelectTicker(arena.ticker)}
              className={`flex flex-col justify-between flex-shrink-0 text-left p-3.5 rounded-xl border transition-all duration-150 min-w-[175px] sm:min-w-[190px] ${
                isSelected
                  ? 'bg-[#181824] text-white border-[#C5A059] shadow-md ring-1 ring-[#C5A059]/40'
                  : 'bg-[#121216] text-white border-white/10 hover:border-white/20 hover:bg-[#16161c]'
              }`}
            >
              {/* Top row: Ticker + Live Count */}
              <div className="flex items-center justify-between mb-2 w-full">
                <div className="flex items-center gap-1.5">
                  <span className={`font-bold font-mono text-sm tracking-tight ${
                    isSelected ? 'text-[#DFC15D]' : 'text-white'
                  }`}>
                    ${arena.ticker}
                  </span>
                  {isSelected && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#C5A059]/15 text-[#DFC15D] border border-[#C5A059]/30 leading-none">
                      선택
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  {arena.participantsCount}명
                </span>
              </div>

              {/* Price & Name */}
              <div className="flex items-center justify-between text-xs mb-3 w-full">
                <span className="text-zinc-400 truncate max-w-[95px]">
                  {arena.name}
                </span>
                <span className="font-semibold font-mono text-white text-xs">
                  ${arena.currentPrice.toFixed(1)}
                </span>
              </div>

              {/* Bull vs Bear Mini Sentiment Bar */}
              <div className="w-full pt-1.5 border-t border-white/5">
                <div className="w-full h-1.5 rounded-full bg-zinc-800 flex overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${arena.bullPct}%` }}
                  />
                  <div
                    className="h-full bg-rose-500 transition-all duration-300"
                    style={{ width: `${arena.bearPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] mt-1.5 font-mono">
                  <span className="text-emerald-400 font-medium">
                    Bull {arena.bullPct}%
                  </span>
                  <span className="text-rose-400 font-medium">
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
