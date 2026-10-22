import { computeArenaSummary } from '../../domain/arena';
import { STOCKS } from '../../data/market';
import type { Forecast } from '../../domain/types';

interface TickerTensionStripProps {
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  forecasts: Forecast[];
  currentDateStr: string;
}

export function TickerTensionStrip({
  selectedTicker,
  onSelectTicker,
  forecasts,
  currentDateStr,
}: TickerTensionStripProps) {
  return (
    <section
      aria-label="Market instruments"
      className="w-full"
      style={{
        backgroundColor: 'var(--v-canvas)',
        borderBottom: '1px solid var(--v-hairline)',
      }}
    >
      <div
        className="max-w-[1360px] mx-auto overflow-x-auto"
        style={{
          borderLeft: '1px solid var(--v-hairline)',
          borderRight: '1px solid var(--v-hairline)',
        }}
      >
        <div className="flex items-stretch min-w-max">
          {STOCKS.map(stock => {
            const summary = computeArenaSummary(
              stock.ticker,
              forecasts,
              currentDateStr,
              '5D',
              'path'
            );
            const isSelected = selectedTicker === stock.ticker;
            const isPositive = summary.medianChangePct >= 0;

            return (
              <button
                key={stock.ticker}
                type="button"
                onClick={() => onSelectTicker(stock.ticker)}
                className="relative px-4 py-3 text-left transition-colors flex flex-col justify-between min-w-[136px] flex-1"
                style={{
                  backgroundColor: isSelected
                    ? 'var(--v-canvas-soft)'
                    : 'transparent',
                  borderRight: '1px solid var(--v-hairline)',
                }}
              >
                {isSelected && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ backgroundColor: 'var(--v-primary)' }}
                  />
                )}

                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="v-mono text-xs font-medium"
                    style={{
                      color: isSelected ? 'var(--v-ink)' : 'var(--v-body)',
                    }}
                  >
                    {stock.ticker}
                  </span>
                  <span
                    className="v-mono text-xs"
                    style={{
                      color: isSelected ? 'var(--v-ink)' : 'var(--v-mute)',
                    }}
                  >
                    ${summary.currentPrice.toFixed(2)}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between gap-2">
                  <span
                    className="v-caption-mono text-[11px]"
                    style={{
                      color: isSelected
                        ? isPositive
                          ? 'var(--v-bull)'
                          : 'var(--v-bear)'
                        : 'var(--v-mute)',
                    }}
                  >
                    {isPositive ? '+' : ''}
                    {summary.medianChangePct.toFixed(1)}%
                  </span>
                  <span
                    className="v-caption-mono text-[10px]"
                    style={{ color: 'var(--v-dim)' }}
                  >
                    {summary.bullPct}% B
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
