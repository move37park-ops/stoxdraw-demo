import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { computeArenaSummary } from '../../domain/arena';
import { STOCKS, getStockHistory } from '../../data/market';
import type { Forecast } from '../../domain/types';

const CORE_TICKERS = ['NVDA', 'TSLA', 'AAPL'];

const EN_STOCK_NAMES: Record<string, string> = {
  NVDA: 'NVIDIA',
  TSLA: 'Tesla',
  AAPL: 'Apple',
  MSFT: 'Microsoft',
  AMZN: 'Amazon',
  META: 'Meta',
  GOOGL: 'Alphabet',
  AMD: 'AMD',
  NFLX: 'Netflix',
  PLTR: 'Palantir',
};

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
  const [isBenchmarksOpen, setIsBenchmarksOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsBenchmarksOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const coreStocks = STOCKS.filter(s => CORE_TICKERS.includes(s.ticker));
  const benchmarkStocks = STOCKS.filter(s => !CORE_TICKERS.includes(s.ticker));
  const activeBenchmark = benchmarkStocks.find(s => s.ticker === selectedTicker);

  const renderMiniSparkline = (ticker: string) => {
    const bars = getStockHistory(ticker)
      .filter(b => b.date <= currentDateStr)
      .slice(-12);
    if (bars.length < 2) return null;
    const prices = bars.map(b => b.close);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min || 1;
    const w = 64;
    const h = 20;
    const pad = 2;

    const pts = prices.map((p, i) => {
      const x = pad + (i / (prices.length - 1)) * (w - pad * 2);
      const y = pad + (h - pad * 2) * (1 - (p - min) / span);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const isUp = prices[prices.length - 1] >= prices[0];

    return (
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="overflow-visible hidden sm:block flex-shrink-0"
        aria-hidden="true"
      >
        <polyline
          fill="none"
          stroke={isUp ? 'var(--v-bull)' : 'var(--v-bear)'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pts.join(' ')}
        />
      </svg>
    );
  };

  return (
    <section
      aria-label="Core market instruments"
      className="w-full"
      style={{
        backgroundColor: 'var(--v-canvas)',
        borderBottom: '1px solid var(--v-hairline)',
      }}
    >
      <div
        className="max-w-[1360px] mx-auto grid grid-cols-2 lg:grid-cols-12"
        style={{
          borderLeft: '1px solid var(--v-hairline)',
          borderRight: '1px solid var(--v-hairline)',
        }}
      >
        {/* 3 Active Core Markets (3 cols each = 9 cols on desktop) */}
        {coreStocks.map(stock => {
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
              className="lg:col-span-3 relative px-4 py-2.5 text-left transition-colors flex items-center justify-between gap-3 min-w-0"
              style={{
                backgroundColor: isSelected
                  ? 'var(--v-canvas-soft)'
                  : 'transparent',
                borderRight: '1px solid var(--v-hairline)',
              }}
            >
              {/* Left: Ticker + Price + Peer count */}
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="v-mono text-xs font-semibold"
                    style={{
                      color: isSelected ? 'var(--v-ink)' : 'var(--v-body)',
                    }}
                  >
                    ${stock.ticker}
                  </span>
                  <span
                    className="v-mono text-xs"
                    style={{ color: 'var(--v-ink)' }}
                  >
                    ${summary.currentPrice.toFixed(2)}
                  </span>
                </div>
                <div className="v-caption-mono mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--v-mute)' }}>
                  <span>{EN_STOCK_NAMES[stock.ticker] || stock.name}</span>
                  <span>·</span>
                  <span>{summary.participantsCount} peers</span>
                </div>
              </div>

              {/* Center: 15D Sparkline */}
              {renderMiniSparkline(stock.ticker)}

              {/* Right: Crowd Median + Bull% */}
              <div className="text-right flex-shrink-0">
                <div
                  className="v-mono text-xs font-semibold"
                  style={{
                    color: isPositive ? 'var(--v-bull)' : 'var(--v-bear)',
                  }}
                >
                  {isPositive ? '+' : ''}
                  {summary.medianChangePct.toFixed(1)}%
                </div>
                <div className="v-caption-mono mt-0.5" style={{ color: 'var(--v-mute)' }}>
                  {summary.bullPct}% Bull
                </div>
              </div>

              {/* Subtle 2px Bottom Bull/Bear Sentiment Split */}
              <div
                className="absolute bottom-0 left-0 right-0 h-[2px] flex overflow-hidden"
                style={{ opacity: isSelected ? 0.9 : 0.35 }}
              >
                <div
                  style={{
                    width: `${summary.bullPct}%`,
                    backgroundColor: 'var(--v-bull)',
                  }}
                />
                <div
                  style={{
                    width: `${100 - summary.bullPct}%`,
                    backgroundColor: 'var(--v-bear)',
                  }}
                />
              </div>
            </button>
          );
        })}

        {/* 4th Column (3 cols on desktop): +7 Benchmarks Popover Selector */}
        <div
          ref={dropdownRef}
          className="lg:col-span-3 relative flex items-stretch"
        >
          <button
            type="button"
            onClick={() => setIsBenchmarksOpen(prev => !prev)}
            className="w-full px-4 py-2.5 text-left transition-colors flex items-center justify-between gap-2"
            style={{
              backgroundColor: activeBenchmark
                ? 'var(--v-canvas-soft)'
                : 'transparent',
            }}
          >
            <div className="min-w-0">
              {activeBenchmark ? (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="v-mono text-xs font-semibold"
                      style={{ color: 'var(--v-ink)' }}
                    >
                      ${activeBenchmark.ticker}
                    </span>
                    <span
                      className="v-caption-mono"
                      style={{ color: 'var(--v-body)' }}
                    >
                      ${computeArenaSummary(
                        activeBenchmark.ticker,
                        forecasts,
                        currentDateStr,
                        '5D',
                        'path'
                      ).currentPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="v-caption-mono mt-0.5" style={{ color: 'var(--v-mute)' }}>
                    {EN_STOCK_NAMES[activeBenchmark.ticker] || activeBenchmark.name} · Benchmark
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="v-mono text-xs font-medium"
                    style={{ color: 'var(--v-body)' }}
                  >
                    + {benchmarkStocks.length} Benchmarks
                  </div>
                  <div
                    className="v-caption-mono mt-0.5 truncate"
                    style={{ color: 'var(--v-mute)' }}
                  >
                    MSFT · AMZN · GOOGL · META · AMD...
                  </div>
                </>
              )}
            </div>

            <span
              className="v-btn-secondary px-2 py-1 flex-shrink-0"
              style={{ color: 'var(--v-mute)' }}
            >
              <span className="v-caption-mono">Switch</span>
              <ChevronDown size={12} />
            </span>
          </button>

          {isBenchmarksOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-72 rounded-[8px] p-1.5 z-50"
              style={{
                backgroundColor: 'var(--v-canvas)',
                boxShadow: 'var(--v-shadow-stack)',
              }}
            >
              <div
                className="px-2.5 py-1.5 v-caption-mono uppercase"
                style={{
                  color: 'var(--v-mute)',
                  borderBottom: '1px solid var(--v-hairline)',
                }}
              >
                Extended S&P 500 benchmarks
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {benchmarkStocks.map(stock => {
                  const summary = computeArenaSummary(
                    stock.ticker,
                    forecasts,
                    currentDateStr,
                    '5D',
                    'path'
                  );
                  const isSelected = selectedTicker === stock.ticker;
                  return (
                    <button
                      key={stock.ticker}
                      type="button"
                      onClick={() => {
                        onSelectTicker(stock.ticker);
                        setIsBenchmarksOpen(false);
                      }}
                      className="w-full px-2.5 py-2 rounded-[5px] flex items-center justify-between text-left transition"
                      style={{
                        backgroundColor: isSelected
                          ? 'var(--v-canvas-soft-2)'
                          : 'transparent',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="v-mono text-xs font-medium"
                          style={{ color: 'var(--v-ink)' }}
                        >
                          ${stock.ticker}
                        </span>
                        <span
                          className="v-caption"
                          style={{ color: 'var(--v-mute)' }}
                        >
                          {EN_STOCK_NAMES[stock.ticker] || stock.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 v-mono text-xs">
                        <span style={{ color: 'var(--v-body)' }}>
                          ${summary.currentPrice.toFixed(2)}
                        </span>
                        {isSelected && (
                          <Check size={12} style={{ color: 'var(--v-ink)' }} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
