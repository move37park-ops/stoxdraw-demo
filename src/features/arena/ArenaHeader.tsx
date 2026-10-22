import type { ArenaSummary } from '../../domain/arena';

interface ArenaHeaderProps {
  hotArenas: ArenaSummary[];
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
}

const CORE_TICKERS = ['NVDA', 'TSLA', 'AAPL'];

export function ArenaHeader({
  hotArenas,
  selectedTicker,
  onSelectTicker,
}: ArenaHeaderProps) {
  const displayedArenas = CORE_TICKERS.map(
    t => hotArenas.find(a => a.ticker === t)
  ).filter((a): a is ArenaSummary => Boolean(a));

  return (
    <div className="w-full mb-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {displayedArenas.map((arena) => {
          const isSelected = arena.ticker === selectedTicker;

          return (
            <button
              key={arena.ticker}
              type="button"
              onClick={() => onSelectTicker(arena.ticker)}
              className={`flex flex-col justify-between text-left p-4 rounded-lg border transition-all duration-150 ${
                isSelected
                  ? 'bg-zinc-900 text-zinc-100 border-zinc-700 ring-1 ring-zinc-700'
                  : 'bg-zinc-950 text-zinc-200 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2 w-full">
                <div className="flex items-center gap-2">
                  <span className={`font-semibold font-mono text-base tracking-tight ${
                    isSelected ? 'text-zinc-100' : 'text-zinc-200'
                  }`}>
                    ${arena.ticker}
                  </span>
                  <span className="text-xs text-zinc-400 truncate">
                    {arena.name}
                  </span>
                </div>
                <span className="text-xs font-mono text-zinc-300 font-medium">
                  ${arena.currentPrice.toFixed(2)}
                </span>
              </div>

              <div className="w-full pt-2 border-t border-zinc-850/60">
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
                <div className="flex items-center justify-between text-[11px] mt-1.5 font-mono">
                  <span className="text-emerald-400 font-medium">
                    BULL {arena.bullPct}%
                  </span>
                  <span className="text-zinc-500">
                    {arena.participantsCount}명 참여
                  </span>
                  <span className="text-rose-400 font-medium">
                    BEAR {arena.bearPct}%
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
