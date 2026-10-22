import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRoundFor, getCountdownRemaining } from '../../domain/round';
import { getEloTierInfo } from '../../domain/elo';
import type { Forecast } from '../../domain/types';

export interface TimeWarpStep {
  date: string;
  code: string;
  label: string;
  phase: 'OPEN' | 'LIVE' | 'RESOLVED';
}

export const STUDIO_TIME_STEPS: TimeWarpStep[] = [
  { date: '2026-10-05', code: 'D-0', label: 'Lock', phase: 'OPEN' },
  { date: '2026-10-06', code: 'D+1', label: 'Day 1', phase: 'LIVE' },
  { date: '2026-10-08', code: 'D+3', label: 'Day 3', phase: 'LIVE' },
  { date: '2026-10-12', code: 'D+5', label: 'Settled', phase: 'RESOLVED' },
];

interface StudioCommandBarProps {
  ticker: string;
  currentDateStr: string;
  onDateChange: (date: string) => void;
  userHandle: string;
  liveElo: number;
  myForecasts: Forecast[];
  activeForecastId: string | null;
  onSelectForecast: (forecastId: string | null) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export function StudioCommandBar({
  ticker,
  currentDateStr,
  onDateChange,
  userHandle,
  liveElo,
  myForecasts,
  activeForecastId,
  onSelectForecast,
  theme,
  onToggleTheme,
}: StudioCommandBarProps) {
  const round = getRoundFor(ticker, '2026-10-05');
  const tierInfo = getEloTierInfo(liveElo);

  const [countdown, setCountdown] = useState(() => getCountdownRemaining(round.cutoffAt));
  const [isTicketsOpen, setIsTicketsOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getCountdownRemaining(round.cutoffAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [round.cutoffAt]);

  const currentStep =
    STUDIO_TIME_STEPS.find(s => s.date === currentDateStr) || STUDIO_TIME_STEPS[0];

  const statusDotColor =
    currentStep.phase === 'OPEN'
      ? 'var(--v-bull)'
      : currentStep.phase === 'LIVE'
      ? 'var(--v-warning)'
      : 'var(--v-link)';

  return (
    <header
      className="sticky top-0 z-40 w-full"
      style={{
        backgroundColor: 'var(--v-canvas)',
        borderBottom: '1px solid var(--v-hairline)',
      }}
    >
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Left: Authentic Vercel Team / Project Scope Breadcrumb */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            to="/studio"
            onClick={() => onSelectForecast(null)}
            className="inline-flex items-center justify-center w-6 h-6 flex-shrink-0"
            title="STOXDRAW Studio"
          >
            <svg
              width="16"
              height="14"
              viewBox="0 0 76 65"
              fill="currentColor"
              aria-label="Vercel triangle mark"
              style={{ color: 'var(--v-ink)' }}
            >
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
            </svg>
          </Link>

          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="var(--v-hairline-strong)"
            strokeWidth="1.25"
            className="flex-shrink-0"
            aria-hidden="true"
          >
            <line x1="10" y1="2" x2="6" y2="14" />
          </svg>

          <div className="inline-flex items-center gap-2 min-w-0">
            <span
              className="text-[13px] font-medium truncate"
              style={{ color: 'var(--v-ink)' }}
            >
              {userHandle}
            </span>
            <span
              className="v-caption-mono px-1.5 py-0.5 rounded-full text-[10px]"
              style={{
                backgroundColor: 'var(--v-canvas-soft-2)',
                boxShadow: 'var(--v-shadow-border)',
                color: 'var(--v-body)',
              }}
            >
              {tierInfo.tier} · {liveElo} LP
            </span>
          </div>

          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="var(--v-hairline-strong)"
            strokeWidth="1.25"
            className="hidden sm:block flex-shrink-0"
            aria-hidden="true"
          >
            <line x1="10" y1="2" x2="6" y2="14" />
          </svg>

          <div className="hidden sm:inline-flex items-center gap-2">
            <span
              className="v-mono text-[13px] font-medium"
              style={{ color: 'var(--v-ink)' }}
            >
              {ticker.toLowerCase()}-w{round.weekNumber}
            </span>

            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full v-caption-mono text-[10px]"
              style={{
                backgroundColor: 'var(--v-canvas-soft)',
                boxShadow: 'var(--v-shadow-border)',
                color: 'var(--v-body)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: statusDotColor }}
              />
              <span>{currentStep.phase}</span>
              <span style={{ color: 'var(--v-dim)' }}>·</span>
              <span style={{ color: 'var(--v-mute)' }}>
                {currentStep.phase === 'OPEN'
                  ? countdown.formatted
                  : currentDateStr}
              </span>
            </span>
          </div>
        </div>

        {/* Center: Verification State Branch Switcher */}
        <div className="flex items-center gap-2">
          <div
            className="inline-flex items-center p-0.5 rounded-[6px]"
            style={{
              backgroundColor: 'var(--v-canvas-soft)',
              boxShadow: 'var(--v-shadow-border)',
            }}
            role="group"
            aria-label="Verification timeline"
          >
            {STUDIO_TIME_STEPS.map(step => {
              const active = step.date === currentDateStr;
              return (
                <button
                  key={step.date}
                  type="button"
                  onClick={() => onDateChange(step.date)}
                  className="px-2.5 py-1 rounded-[4px] text-xs transition-all flex items-center gap-1.5"
                  style={{
                    backgroundColor: active ? 'var(--v-primary)' : 'transparent',
                    color: active ? 'var(--v-on-primary)' : 'var(--v-mute)',
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  <span className="v-mono">{step.code}</span>
                  <span className="hidden md:inline text-[11px]">
                    {step.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Deployments / Locked Receipts Drawer, Theme Switch & Classic View */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTicketsOpen(prev => !prev)}
              className="v-btn-secondary"
            >
              <span>Receipts</span>
              <span className="v-kbd">{myForecasts.length}</span>
            </button>

            {isTicketsOpen && (
              <div
                className="absolute right-0 mt-2 w-80 rounded-[8px] p-3 z-50"
                style={{
                  backgroundColor: 'var(--v-canvas)',
                  boxShadow: 'var(--v-shadow-stack)',
                }}
              >
                <div
                  className="flex items-center justify-between pb-2 mb-2"
                  style={{ borderBottom: '1px solid var(--v-hairline)' }}
                >
                  <span className="v-body-sm-strong" style={{ color: 'var(--v-ink)' }}>
                    Immutable deployments
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectForecast(null);
                      setIsTicketsOpen(false);
                    }}
                    className="v-caption-mono underline"
                    style={{ color: 'var(--v-link)' }}
                  >
                    + New draft
                  </button>
                </div>

                {myForecasts.length === 0 ? (
                  <p className="v-caption py-4 text-center" style={{ color: 'var(--v-mute)' }}>
                    No locked trajectories in this session.
                  </p>
                ) : (
                  <div className="max-h-60 overflow-y-auto flex flex-col gap-1">
                    {myForecasts.map(f => {
                      const lastPrice =
                        f.path && f.path.length > 0
                          ? f.path[f.path.length - 1].price
                          : f.basePrice;
                      const pct =
                        f.basePrice > 0
                          ? ((lastPrice - f.basePrice) / f.basePrice) * 100
                          : 0;
                      const isSelected = activeForecastId === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            onSelectForecast(f.id);
                            setIsTicketsOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-[6px] flex items-center justify-between transition"
                          style={{
                            backgroundColor: isSelected
                              ? 'var(--v-canvas-soft-2)'
                              : 'transparent',
                            boxShadow: isSelected ? 'var(--v-shadow-border)' : 'none',
                          }}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className="v-mono text-xs font-medium"
                                style={{ color: 'var(--v-ink)' }}
                              >
                                {f.ticker}
                              </span>
                              <span
                                className="v-mono text-xs"
                                style={{
                                  color: pct >= 0 ? 'var(--v-bull)' : 'var(--v-bear)',
                                }}
                              >
                                {pct >= 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`}
                              </span>
                            </div>
                            <p
                              className="v-caption truncate max-w-[180px]"
                              style={{ color: 'var(--v-mute)' }}
                            >
                              {f.comment || 'No thesis'}
                            </p>
                          </div>
                          <span
                            className="v-caption-mono"
                            style={{ color: 'var(--v-mute)' }}
                          >
                            ${lastPrice.toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            className="v-btn-secondary v-mono"
            title="Switch between design.dark.md and design.md"
          >
            {theme === 'dark' ? 'Dark' : 'Light'}
          </button>

          <Link to="/" className="v-btn-secondary hidden sm:inline-flex">
            Classic
          </Link>
        </div>
      </div>
    </header>
  );
}
