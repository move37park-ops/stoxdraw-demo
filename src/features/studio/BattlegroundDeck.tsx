import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThumbsUp } from 'lucide-react';
import { repository } from '../../data/localRepository';
import { getStockHistory, STOCKS } from '../../data/market';
import { computePriceDistribution } from '../../domain/arena';
import { buildDailySettlementRows, computeForecastDigest } from '../../domain/audit';
import { calculateForecastScore } from '../../domain/scoring';
import { getEloTierInfo, DEFAULT_ELO, calculateEloProjection } from '../../domain/elo';
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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'duels' | 'distribution' | 'ledger'>('duels');
  const [stanceFilter, setStanceFilter] = useState<'all' | 'bull' | 'bear'>('all');
  const [, setLikeTick] = useState(0);

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

  const allEnriched = useMemo(() => {
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

        const eloProj = calculateEloProjection(
          changePct,
          undefined,
          stockMeta.volatility
        );

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
          eloProj,
          score,
        };
      });
  }, [allTickerForecasts, actualCloses, stockMeta.volatility]);

  const bullCount = allEnriched.filter(i => i.changePct >= 0).length;
  const bearCount = allEnriched.filter(i => i.changePct < 0).length;

  const enrichedForecasts = useMemo(() => {
    return allEnriched.filter(item => {
      if (stanceFilter === 'bull') return item.changePct >= 0;
      if (stanceFilter === 'bear') return item.changePct < 0;
      return true;
    });
  }, [allEnriched, stanceFilter]);

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
              label: `Peer deployments (${allEnriched.length})`,
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
            {(
              [
                { id: 'all', label: `All ${allEnriched.length}` },
                { id: 'bull', label: `Bull ${bullCount}` },
                { id: 'bear', label: `Bear ${bearCount}` },
              ] as const
            ).map(filter => {
              const active = stanceFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setStanceFilter(filter.id)}
                  className="px-2.5 py-0.5 rounded-[4px] v-caption-mono transition"
                  style={{
                    backgroundColor: active
                      ? 'var(--v-canvas-soft-2)'
                      : 'transparent',
                    color: active
                      ? 'var(--v-ink)'
                      : filter.id === 'bull'
                      ? 'var(--v-bull)'
                      : filter.id === 'bear'
                      ? 'var(--v-bear)'
                      : 'var(--v-mute)',
                    boxShadow: active ? 'var(--v-shadow-border)' : 'none',
                  }}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* TAB 1: 1-Line Vercel Deployment Rows (Fused CompactForecastCard + Duel Controls) */}
      {activeTab === 'duels' && (
        <div>
          {enrichedForecasts.length === 0 ? (
            <div className="p-10 text-center">
              <p className="v-body-sm" style={{ color: 'var(--v-mute)' }}>
                No locked trajectories match the current filter for {ticker}.
              </p>
            </div>
          ) : (
            <div>
              {enrichedForecasts.map((item, rowIdx) => {
                const overlaidObj = overlaidRivals.find(
                  r => r.forecast.id === item.forecast.id
                );
                const isOverlaid = Boolean(overlaidObj);
                const isAuditing = lockedForecast?.id === item.forecast.id;
                const isBull = item.changePct >= 0;
                const isLiked = repository.isLiked(item.forecast.id);
                const likesCount = repository.getLikesCount(item.forecast.id);

                const pts = item.forecast.path || [];
                const prices = [item.forecast.basePrice, ...pts.map(p => p.price)];
                const minP = Math.min(...prices);
                const maxP = Math.max(...prices);
                const span = Math.max(1e-4, maxP - minP);
                const w = 88;
                const h = 24;
                const pad = 3;
                const sparkPoints = prices
                  .map((p, idx) => {
                    const x = pad + (idx / Math.max(1, prices.length - 1)) * (w - pad * 2);
                    const y = pad + (h - pad * 2) * (1 - (p - minP) / span);
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(' ');
                const lastPtCoords = sparkPoints.split(' ').pop()?.split(',') || ['85', '12'];
                const strokeColor = isOverlaid
                  ? overlaidObj!.colorVar
                  : isBull
                  ? 'var(--v-bull)'
                  : 'var(--v-bear)';

                return (
                  <div
                    key={item.forecast.id}
                    className="relative px-5 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 transition-colors"
                    style={{
                      backgroundColor:
                        isOverlaid || isAuditing
                          ? 'var(--v-canvas-soft)'
                          : 'var(--v-canvas)',
                      borderBottom:
                        rowIdx < enrichedForecasts.length - 1
                          ? '1px solid var(--v-hairline-subtle)'
                          : 'none',
                    }}
                  >
                    {/* Left Active Overlay Color Bar */}
                    {isOverlaid && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px]"
                        style={{ backgroundColor: overlaidObj!.colorVar }}
                      />
                    )}

                    {/* Col 1: Forecaster Handle + Target + Thesis */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: isBull ? 'var(--v-bull)' : 'var(--v-bear)',
                        }}
                      />

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/u/${item.handle}`)}
                          className="v-mono text-xs font-medium hover:underline"
                          style={{ color: 'var(--v-ink)' }}
                        >
                          @{item.handle}
                        </button>
                        <span
                          className="v-caption-mono px-1.5 py-0.2 rounded-[4px]"
                          style={{
                            backgroundColor: 'var(--v-canvas-soft-2)',
                            boxShadow: 'var(--v-shadow-border)',
                            color: 'var(--v-mute)',
                          }}
                        >
                          {item.tier} · {item.elo}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-1.5 flex-shrink-0 v-mono">
                        <span
                          className="text-xs font-semibold"
                          style={{
                            color: isBull ? 'var(--v-bull)' : 'var(--v-bear)',
                          }}
                        >
                          {isBull ? '+' : ''}
                          {item.changePct.toFixed(2)}%
                        </span>
                        <span
                          className="v-caption-mono"
                          style={{ color: 'var(--v-body)' }}
                        >
                          (${item.targetPrice.toFixed(2)})
                        </span>
                      </div>

                      <p
                        onClick={() => onSelectForecastToAudit(item.forecast)}
                        className="v-body-sm truncate max-w-[340px] cursor-pointer hover:underline hidden md:block"
                        style={{ color: 'var(--v-mute)' }}
                        title={item.forecast.comment}
                      >
                        {item.forecast.comment || 'No directional thesis.'}
                      </p>
                    </div>

                    {/* Col 2: 5D Mini Sparkline + Elo Stake / Settled Score */}
                    <div className="hidden lg:flex items-center gap-4 flex-shrink-0">
                      <svg
                        width={w}
                        height={h}
                        viewBox={`0 0 ${w} ${h}`}
                        className="overflow-visible"
                        aria-hidden="true"
                      >
                        <line
                          x1="0"
                          y1={h / 2}
                          x2={w}
                          y2={h / 2}
                          stroke="var(--v-hairline)"
                          strokeDasharray="2 2"
                          strokeWidth="1"
                        />
                        <polyline
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={isOverlaid ? '2' : '1.5'}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={sparkPoints}
                        />
                        <circle
                          cx={lastPtCoords[0]}
                          cy={lastPtCoords[1]}
                          r="2.2"
                          fill={strokeColor}
                        />
                      </svg>

                      <div className="w-28 text-right v-caption-mono">
                        {item.score ? (
                          <span
                            className="font-medium"
                            style={{ color: 'var(--v-ink)' }}
                          >
                            {item.score.total.toFixed(1)} pts ({item.score.grade})
                          </span>
                        ) : (
                          <span>
                            <span style={{ color: 'var(--v-bull)' }}>
                              +{item.eloProj.expectedWinLp}
                            </span>
                            <span style={{ color: 'var(--v-dim)' }}> / </span>
                            <span style={{ color: 'var(--v-bear)' }}>
                              {item.eloProj.expectedLossLp} LP
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Col 3: Overlay, Counter-Draw, Like & Receipt Link */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
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
                        {isOverlaid ? 'Pinned' : 'Overlay'}
                      </button>

                      <button
                        type="button"
                        onClick={() => onStartDuel(item.forecast, item.handle)}
                        className="v-btn-secondary"
                      >
                        Counter-draw
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          repository.toggleLike(item.forecast.id);
                          setLikeTick(t => t + 1);
                        }}
                        className="v-btn-secondary px-2"
                        style={{
                          color: isLiked ? 'var(--v-ink)' : 'var(--v-mute)',
                        }}
                        title="Like trajectory"
                      >
                        <ThumbsUp size={11} />
                        {likesCount > 0 && (
                          <span className="v-caption-mono">{likesCount}</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate(`/f/${item.forecast.id}`)}
                        className="v-caption-mono px-1.5 hover:underline"
                        style={{ color: 'var(--v-mute)' }}
                        title="Open full prediction receipt"
                      >
                        Receipt ↗
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Shared-Scale Price Bucket Distribution (Flush Hairline Rows) */}
      {activeTab === 'distribution' && (
        <div>
          {priceBuckets.map((bucket, idx) => {
            const isAboveBase = bucket.min >= basePrice;
            return (
              <div
                key={bucket.label}
                className="px-5 py-3 grid items-center gap-4"
                style={{
                  gridTemplateColumns: '148px 1fr 100px',
                  borderBottom:
                    idx < priceBuckets.length - 1
                      ? '1px solid var(--v-hairline-subtle)'
                      : 'none',
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
