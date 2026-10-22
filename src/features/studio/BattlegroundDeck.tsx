import { useState, useMemo } from 'react';
import { repository } from '../../data/localRepository';
import { getStockHistory, STOCKS } from '../../data/market';
import { computePriceDistribution } from '../../domain/arena';
import { buildDailySettlementRows, computeForecastDigest } from '../../domain/audit';
import { calculateForecastScore } from '../../domain/scoring';
import { getEloTierInfo, DEFAULT_ELO } from '../../domain/elo';
import type { Forecast } from '../../domain/types';
import type { OverlayRival } from './SplitHorizonCanvas';

interface BattlegroundDeckProps {
  ticker: string;
  baseDate: string;
  basePrice: number;
  evalDates: string[];
  currentDateStr: string;
  draftPrices: number[];
  lockedForecast: Forecast | null;
  onSelectForecastToAudit: (forecast: Forecast) => void;
  allTickerForecasts: Forecast[];
  overlaidRivals: OverlayRival[];
  onToggleOverlayRival: (forecast: Forecast, handle: string, elo: number) => void;
  onStartDuel: (forecast: Forecast, handle: string) => void;
}

export function BattlegroundDeck({
  ticker,
  baseDate,
  basePrice,
  evalDates,
  currentDateStr,
  draftPrices,
  lockedForecast,
  onSelectForecastToAudit,
  allTickerForecasts,
  overlaidRivals,
  onToggleOverlayRival,
  onStartDuel,
}: BattlegroundDeckProps) {
  const [activeTab, setActiveTab] = useState<'duels' | 'distribution' | 'ledger'>('duels');
  const [stanceFilter, setStanceFilter] = useState<'all' | 'bull' | 'bear'>('all');

  const stockMeta = STOCKS.find(s => s.ticker === ticker) || STOCKS[0];
  const allBars = useMemo(() => getStockHistory(ticker), [ticker]);

  const actualCloses = useMemo(() => {
    if (currentDateStr <= baseDate) return [];
    const map = new Map(allBars.map(b => [b.date, b.close]));
    const closes: number[] = [];
    for (const d of evalDates) {
      if (d <= currentDateStr && map.has(d)) {
        closes.push(map.get(d)!);
      }
    }
    return closes;
  }, [allBars, evalDates, currentDateStr, baseDate]);

  const enrichedForecasts = useMemo(() => {
    return allTickerForecasts
      .filter(f => f.mode === 'path' && f.path && f.path.length > 0)
      .map(f => {
        const user = f.authorId ? repository.getUser(f.authorId) : undefined;
        const handle = user ? user.handle : `anon_${f.anonId.slice(0, 4)}`;
        const name = user ? user.name : 'Anonymous Forecaster';
        const elo = user?.elo ?? DEFAULT_ELO;
        const tier = getEloTierInfo(elo);

        const lastPt = f.path![f.path!.length - 1];
        const changePct =
          f.basePrice > 0 ? ((lastPt.price - f.basePrice) / f.basePrice) * 100 : 0;

        const score =
          actualCloses.length > 0
            ? calculateForecastScore(
                f.path!.map(p => p.price),
                actualCloses,
                f.basePrice,
                stockMeta.volatility
              )
            : null;

        return {
          forecast: f,
          handle,
          name,
          elo,
          tier: tier.tier,
          targetPrice: lastPt.price,
          changePct,
          score,
        };
      })
      .filter(item => {
        if (stanceFilter === 'bull') return item.changePct >= 0;
        if (stanceFilter === 'bear') return item.changePct < 0;
        return true;
      });
  }, [allTickerForecasts, actualCloses, stockMeta.volatility, stanceFilter]);

  const priceBuckets = useMemo(
    () => computePriceDistribution(ticker, allTickerForecasts, basePrice, '5D'),
    [ticker, allTickerForecasts, basePrice]
  );

  const activeAuditForecast: Forecast = useMemo(() => {
    if (lockedForecast) return lockedForecast;
    return {
      id: 'active-draft',
      authorId: null,
      anonId: 'local',
      ticker,
      horizon: '5D',
      mode: 'path',
      comment: 'Active studio draft trajectory',
      lockedAt: `${baseDate}T13:30:00Z`,
      basePrice,
      baseDate,
      evalDates,
      path: evalDates.map((d, i) => ({
        date: d,
        price: draftPrices[i] ?? basePrice,
      })),
      rulesVersion: 'v1',
    };
  }, [lockedForecast, ticker, baseDate, basePrice, evalDates, draftPrices]);

  const settlementRows = useMemo(
    () => buildDailySettlementRows(activeAuditForecast, allBars, currentDateStr),
    [activeAuditForecast, allBars, currentDateStr]
  );

  const auditDigest = useMemo(
    () => computeForecastDigest(activeAuditForecast),
    [activeAuditForecast]
  );

  return (
    <section
      aria-label="Social battleground and verification ledger"
      style={{
        backgroundColor: 'var(--v-canvas)',
        borderTop: '1px solid var(--v-hairline)',
      }}
    >
      {/* Flush Deck Navigation Bar */}
      <div
        className="px-5 flex flex-wrap items-center justify-between gap-3"
        style={{
          backgroundColor: 'var(--v-canvas-soft)',
          borderBottom: '1px solid var(--v-hairline)',
        }}
      >
        <div className="flex items-center gap-6">
          {[
            {
              id: 'duels' as const,
              label: `Peer trajectories (${allTickerForecasts.length})`,
            },
            {
              id: 'distribution' as const,
              label: 'Friday close distribution',
            },
            {
              id: 'ledger' as const,
              label: 'Settlement audit ledger',
            },
          ].map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="relative py-3 text-xs font-medium transition-colors"
                style={{
                  color: active ? 'var(--v-ink)' : 'var(--v-mute)',
                }}
              >
                {tab.label}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ backgroundColor: 'var(--v-primary)' }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {activeTab === 'duels' && (
          <div className="flex items-center gap-1 py-1.5">
            {(['all', 'bull', 'bear'] as const).map(filter => {
              const active = stanceFilter === filter;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStanceFilter(filter)}
                  className="px-2 py-0.5 rounded-[4px] v-caption-mono transition"
                  style={{
                    backgroundColor: active
                      ? 'var(--v-canvas-soft-2)'
                      : 'transparent',
                    color: active ? 'var(--v-ink)' : 'var(--v-mute)',
                    boxShadow: active ? 'var(--v-shadow-border)' : 'none',
                  }}
                >
                  {filter === 'all'
                    ? 'All'
                    : filter === 'bull'
                    ? 'Bull (>=0%)'
                    : 'Bear (<0%)'}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* TAB 1: Flush Hairline 3-Column Bento Grid for Peer Trajectories */}
      {activeTab === 'duels' && (
        <div>
          {enrichedForecasts.length === 0 ? (
            <div className="p-10 text-center">
              <p className="v-body-sm" style={{ color: 'var(--v-mute)' }}>
                No locked trajectories match the current filter for {ticker}.
              </p>
            </div>
          ) : (
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px"
              style={{ backgroundColor: 'var(--v-hairline)' }}
            >
              {enrichedForecasts.map(item => {
                const isOverlaid = overlaidRivals.some(
                  r => r.forecast.id === item.forecast.id
                );
                const isAuditing = lockedForecast?.id === item.forecast.id;
                const isBull = item.changePct >= 0;

                const pts = item.forecast.path || [];
                const prices = [item.forecast.basePrice, ...pts.map(p => p.price)];
                const minP = Math.min(...prices);
                const maxP = Math.max(...prices);
                const span = Math.max(1e-4, maxP - minP);
                const sparkPoints = prices
                  .map((p, idx) => {
                    const x = (idx / Math.max(1, prices.length - 1)) * 120;
                    const y = 28 - ((p - minP) / span) * 22;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(' ');

                return (
                  <article
                    key={item.forecast.id}
                    className="p-5 flex flex-col justify-between transition"
                    style={{
                      backgroundColor: isOverlaid
                        ? 'var(--v-canvas-soft)'
                        : 'var(--v-canvas)',
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="v-mono text-xs font-medium truncate"
                            style={{ color: 'var(--v-ink)' }}
                          >
                            @{item.handle}
                          </span>
                          <span
                            className="v-caption-mono"
                            style={{ color: 'var(--v-mute)' }}
                          >
                            {item.tier} · {item.elo} LP
                          </span>
                        </div>

                        {item.score && (
                          <span
                            className="v-caption-mono font-medium"
                            style={{ color: 'var(--v-ink)' }}
                          >
                            {item.score.total.toFixed(1)} pts ({item.score.grade})
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div>
                          <span
                            className="v-caption-mono uppercase"
                            style={{ color: 'var(--v-mute)' }}
                          >
                            D+5 close
                          </span>
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span
                              className="v-mono text-lg font-semibold tracking-tight"
                              style={{ color: 'var(--v-ink)' }}
                            >
                              ${item.targetPrice.toFixed(2)}
                            </span>
                            <span
                              className="v-mono text-xs font-medium"
                              style={{
                                color: isBull
                                  ? 'var(--v-bull)'
                                  : 'var(--v-bear)',
                              }}
                            >
                              {isBull ? '+' : ''}
                              {item.changePct.toFixed(2)}%
                            </span>
                          </div>
                        </div>

                        <svg
                          width="124"
                          height="32"
                          viewBox="0 0 124 32"
                          className="overflow-visible"
                          aria-hidden="true"
                        >
                          <line
                            x1="0"
                            y1="16"
                            x2="120"
                            y2="16"
                            stroke="var(--v-hairline)"
                            strokeDasharray="2 2"
                            strokeWidth="1"
                          />
                          <polyline
                            fill="none"
                            stroke={isBull ? 'var(--v-bull)' : 'var(--v-bear)'}
                            strokeWidth="1.5"
                            points={sparkPoints}
                          />
                        </svg>
                      </div>

                      <p
                        className="v-body-sm mt-2.5 line-clamp-2"
                        style={{ color: 'var(--v-body)' }}
                      >
                        {item.forecast.comment || 'No directional thesis.'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleOverlayRival(
                              item.forecast,
                              item.handle,
                              item.elo
                            )
                          }
                          className="v-btn-secondary"
                          style={{
                            backgroundColor: isOverlaid
                              ? 'var(--v-primary)'
                              : 'var(--v-canvas)',
                            color: isOverlaid
                              ? 'var(--v-on-primary)'
                              : 'var(--v-ink)',
                          }}
                        >
                          {isOverlaid ? 'Pinned on canvas' : 'Overlay'}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onStartDuel(item.forecast, item.handle)
                          }
                          className="v-btn-secondary"
                        >
                          Counter-draw
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectForecastToAudit(item.forecast)}
                        className="v-caption-mono underline"
                        style={{
                          color: isAuditing
                            ? 'var(--v-link)'
                            : 'var(--v-mute)',
                        }}
                      >
                        {isAuditing ? 'Auditing' : 'Inspect'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Shared-Scale Price Bucket Distribution (Flush Hairline Rows) */}
      {activeTab === 'distribution' && (
        <div className="divide-y" style={{ borderColor: 'var(--v-hairline-subtle)' }}>
          {priceBuckets.map(bucket => {
            const isAboveBase = bucket.min >= basePrice;
            return (
              <div
                key={bucket.label}
                className="px-5 py-3 grid items-center gap-4"
                style={{
                  gridTemplateColumns: '148px 1fr 100px',
                }}
              >
                <span
                  className="v-caption-mono"
                  style={{ color: 'var(--v-ink)' }}
                >
                  {bucket.label}
                </span>

                <div
                  className="h-2 w-full rounded-[2px] overflow-hidden"
                  style={{ backgroundColor: 'var(--v-hairline)' }}
                >
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${bucket.pct}%`,
                      backgroundColor: isAboveBase
                        ? 'var(--v-bull)'
                        : 'var(--v-bear)',
                    }}
                  />
                </div>

                <span
                  className="v-caption-mono text-right"
                  style={{ color: 'var(--v-body)' }}
                >
                  {bucket.pct}% ({bucket.count})
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: Full-Width Edge-to-Edge Semantic Audit Table */}
      {activeTab === 'ledger' && (
        <div>
          <div
            className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-2"
            style={{
              backgroundColor: 'var(--v-canvas-soft)',
              borderBottom: '1px solid var(--v-hairline)',
            }}
          >
            <span className="v-caption" style={{ color: 'var(--v-mute)' }}>
              Time-weighted daily close verification as of {currentDateStr}
            </span>
            <span className="v-caption-mono" style={{ color: 'var(--v-mute)' }}>
              receipt: {auditDigest}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="v-audit-table">
              <caption className="sr-only">
                Daily settlement comparison between forecasted trajectory and observed market close
              </caption>
              <thead>
                <tr>
                  <th scope="col">Slot</th>
                  <th scope="col">Date</th>
                  <th scope="col" className="v-numeric">
                    Weight (w_t)
                  </th>
                  <th scope="col" className="v-numeric">
                    Forecast close
                  </th>
                  <th scope="col" className="v-numeric">
                    Forecast delta
                  </th>
                  <th scope="col" className="v-numeric">
                    Observed close
                  </th>
                  <th scope="col" className="v-numeric">
                    Observed delta
                  </th>
                  <th scope="col" className="v-numeric">
                    Abs error
                  </th>
                  <th scope="col">Direction</th>
                </tr>
              </thead>
              <tbody>
                {settlementRows.map(row => (
                  <tr key={row.slot}>
                    <th scope="row" className="v-mono font-medium">
                      {row.slot}
                    </th>
                    <td className="v-mono">{row.date}</td>
                    <td className="v-numeric">{row.weight}.0x</td>
                    <td className="v-numeric">${row.forecastPrice.toFixed(2)}</td>
                    <td
                      className="v-numeric"
                      style={{
                        color:
                          row.forecastChangePct >= 0
                            ? 'var(--v-bull)'
                            : 'var(--v-bear)',
                      }}
                    >
                      {row.forecastChangePct >= 0 ? '+' : ''}
                      {row.forecastChangePct.toFixed(2)}%
                    </td>
                    <td className="v-numeric">
                      {row.actualClose !== null
                        ? `$${row.actualClose.toFixed(2)}`
                        : 'Pending'}
                    </td>
                    <td
                      className="v-numeric"
                      style={{
                        color:
                          row.actualChangePct === null
                            ? 'var(--v-mute)'
                            : row.actualChangePct >= 0
                            ? 'var(--v-bull)'
                            : 'var(--v-bear)',
                      }}
                    >
                      {row.actualChangePct !== null
                        ? `${row.actualChangePct >= 0 ? '+' : ''}${row.actualChangePct.toFixed(
                            2
                          )}%`
                        : 'Pending'}
                    </td>
                    <td className="v-numeric">
                      {row.absErrorPct !== null
                        ? `${row.absErrorPct.toFixed(2)}%`
                        : 'Pending'}
                    </td>
                    <td>
                      {row.directionMatch === null ? (
                        <span
                          className="v-caption-mono"
                          style={{ color: 'var(--v-mute)' }}
                        >
                          Unsettled
                        </span>
                      ) : row.directionMatch ? (
                        <span
                          className="v-caption-mono"
                          style={{ color: 'var(--v-bull)' }}
                        >
                          Matched
                        </span>
                      ) : (
                        <span
                          className="v-caption-mono"
                          style={{ color: 'var(--v-bear)' }}
                        >
                          Diverged
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
