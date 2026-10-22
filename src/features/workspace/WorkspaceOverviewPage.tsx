import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId } from '../../data/session';
import { getHotArenas } from '../../domain/arena';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecast } from '../../domain/resolution';
import { getStockHistory } from '../../data/market';
import { getEloTierInfo, DEFAULT_ELO, formatSignedLp } from '../../domain/elo';
import { CompactForecastCard } from '../../components/CompactForecastCard';
import type { Forecast } from '../../domain/types';

interface WorkspaceOverviewPageProps {
  currentDateStr: string;
}

const CORE_TICKERS = ['NVDA', 'TSLA', 'AAPL'];

export function WorkspaceOverviewPage({ currentDateStr }: WorkspaceOverviewPageProps) {
  const navigate = useNavigate();
  const [forecasts, setForecasts] = useState<Forecast[]>(() =>
    repository.listFeed('all', currentDateStr)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'resolved'>('all');

  const loadData = useCallback(() => {
    setForecasts(repository.listFeed('all', currentDateStr));
  }, [currentDateStr]);

  useEffect(() => {
    loadData();
    const unsub = repository.subscribe(loadData);
    return () => unsub();
  }, [loadData]);

  const currentUser = getCurrentUser();
  const anonId = getOrCreateAnonId();

  const myForecasts = useMemo(() => {
    return forecasts.filter(f =>
      currentUser ? f.authorId === currentUser.id : f.anonId === anonId
    );
  }, [forecasts, currentUser, anonId]);

  const myStats = useMemo(() => {
    const baseElo = currentUser?.elo ?? DEFAULT_ELO;
    let deltaSum = 0;
    let resolvedCount = 0;
    let hitCount = 0;
    let scoreSum = 0;
    let scoredCount = 0;

    myForecasts.forEach(f => {
      if (deriveForecastStatus(f, currentDateStr) === 'RESOLVED') {
        resolvedCount++;
        const bars = getStockHistory(f.ticker).filter(b => b.date <= currentDateStr);
        const res = resolveForecast(f, bars);
        if (res.directionHit) hitCount++;
        if (res.score) {
          scoreSum += res.score.total;
          scoredCount++;
        }
        if (res.eloSettlement) {
          deltaSum += res.eloSettlement.deltaLp;
        }
      }
    });

    const liveElo = Math.max(800, baseElo + deltaSum);
    const tierInfo = getEloTierInfo(liveElo);
    const avgScore = scoredCount > 0 ? (scoreSum / scoredCount).toFixed(1) : null;
    const hitRate = resolvedCount > 0 ? Math.round((hitCount / resolvedCount) * 100) : null;

    return {
      liveElo,
      deltaSum,
      tierInfo,
      totalCount: myForecasts.length,
      resolvedCount,
      avgScore,
      hitRate,
    };
  }, [myForecasts, currentUser, currentDateStr]);

  const arenas = useMemo(() => {
    const allHot = getHotArenas(forecasts, currentDateStr, '5D');
    return CORE_TICKERS.map(t => allHot.find(a => a.ticker === t)).filter(
      (a): a is NonNullable<typeof a> => Boolean(a)
    );
  }, [forecasts, currentDateStr]);

  const topUsers = useMemo(() => {
    const users = repository.listAllUsers();
    return users
      .map(u => {
        const list = repository.listByUser(u.id);
        const resolved = list.filter(f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED');
        let deltaSum = 0;
        resolved.forEach(f => {
          const bars = getStockHistory(f.ticker).filter(b => b.date <= currentDateStr);
          const res = resolveForecast(f, bars);
          if (res.eloSettlement) deltaSum += res.eloSettlement.deltaLp;
        });
        const liveElo = (u.elo ?? DEFAULT_ELO) + deltaSum;
        return {
          ...u,
          liveElo,
          deltaSum,
          tierInfo: getEloTierInfo(liveElo),
        };
      })
      .sort((a, b) => b.liveElo - a.liveElo)
      .slice(0, 4);
  }, [currentDateStr, forecasts]);

  const filteredForecasts = useMemo(() => {
    return forecasts.filter(f => {
      const st = deriveForecastStatus(f, currentDateStr);
      if (statusFilter === 'live' && st === 'RESOLVED') return false;
      if (statusFilter === 'resolved' && st !== 'RESOLVED') return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      const author = f.authorId ? repository.getUser(f.authorId) : null;
      const matchTicker = f.ticker.toLowerCase().includes(q);
      const matchComment = f.comment?.toLowerCase().includes(q);
      const matchAuthor =
        author?.name.toLowerCase().includes(q) || author?.handle.toLowerCase().includes(q);
      return Boolean(matchTicker || matchComment || matchAuthor);
    });
  }, [forecasts, currentDateStr, statusFilter, searchQuery]);

  const renderArenaSparkline = (ticker: string) => {
    const bars = getStockHistory(ticker)
      .filter(b => b.date <= currentDateStr)
      .slice(-12);
    if (bars.length < 2) return null;
    const prices = bars.map(b => b.close);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const w = 78;
    const h = 24;
    const pad = 2;

    const pts = prices.map((p, i) => {
      const x = pad + (i / (prices.length - 1)) * (w - pad * 2);
      const y = pad + (h - pad * 2) * (1 - (p - min) / range);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const isUp = prices[prices.length - 1] >= prices[0];

    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke={isUp ? 'var(--v-bull)' : 'var(--v-bear)'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="w-full">
      {/* ZONE 1: Architectural Masthead Band */}
      <div
        className="relative grid grid-cols-1 lg:grid-cols-12"
        style={{ borderBottom: '1px solid var(--v-hairline)' }}
      >
        <span className="v-crosshair" style={{ bottom: -6, left: -6 }} />
        <span className="v-crosshair" style={{ bottom: -6, right: -6 }} />

        {/* Left 7 Cols: Dual-Tone Vercel Headline */}
        <div
          className="lg:col-span-7 px-5 py-5 flex flex-col justify-center gap-2 min-w-0"
          style={{ borderRight: '1px solid var(--v-hairline)' }}
        >
          <div
            className="flex items-center gap-2 v-caption-mono uppercase"
            style={{ color: 'var(--v-mute)' }}
          >
            <span style={{ color: 'var(--v-ink)' }}>Workspace overview</span>
            <span style={{ color: 'var(--v-dim)' }}>·</span>
            <span>As of {currentDateStr}</span>
          </div>
          <h1 className="v-display-hero">
            <span style={{ color: 'var(--v-ink)' }}>
              Monitor live 5-day trajectory deployments across the market.{' '}
            </span>
            <span style={{ color: 'var(--v-mute)', fontWeight: 400 }}>
              Compare crowd consensus tension, inspect verified receipts, or open the studio to sculpt your call.
            </span>
          </h1>
        </div>

        {/* Right 5 Cols: Flush 3-Column Personal Telemetry Strip */}
        <div className="lg:col-span-5 grid grid-cols-3 min-w-0">
          <div
            className="p-4 sm:p-5 flex flex-col justify-between min-w-0"
            style={{ borderRight: '1px solid var(--v-hairline)' }}
          >
            <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
              Elo standing
            </span>
            <div className="mt-2">
              <p
                className="v-mono text-xl font-semibold tracking-tight"
                style={{ color: 'var(--v-ink)' }}
              >
                {myStats.liveElo} LP
              </p>
              <p className="v-caption-mono mt-0.5" style={{ color: 'var(--v-mute)' }}>
                {myStats.tierInfo.tier}
                {myStats.deltaSum !== 0
                  ? ` (${formatSignedLp(myStats.deltaSum)})`
                  : ' · active'}
              </p>
            </div>
          </div>

          <div
            className="p-4 sm:p-5 flex flex-col justify-between min-w-0"
            style={{ borderRight: '1px solid var(--v-hairline)' }}
          >
            <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
              My deployments
            </span>
            <div className="mt-2">
              <p
                className="v-mono text-xl font-semibold tracking-tight"
                style={{ color: 'var(--v-ink)' }}
              >
                {myStats.totalCount}
              </p>
              <p className="v-caption-mono mt-0.5" style={{ color: 'var(--v-mute)' }}>
                {myStats.resolvedCount} settled
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 flex flex-col justify-between min-w-0">
            <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
              Mean score
            </span>
            <div className="mt-2">
              <p
                className="v-mono text-xl font-semibold tracking-tight"
                style={{ color: 'var(--v-ink)' }}
              >
                {myStats.avgScore ? `${myStats.avgScore}` : '—'}
              </p>
              <button
                type="button"
                onClick={() => navigate('/record')}
                className="v-caption-mono mt-0.5 hover:underline text-left"
                style={{ color: 'var(--v-link)' }}
              >
                My record →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ZONE 2: 3 Core Market Arenas (Flush Architectural Grid) */}
      <div
        className="relative"
        style={{ borderBottom: '1px solid var(--v-hairline)' }}
      >
        <span className="v-crosshair" style={{ bottom: -6, left: -6 }} />
        <span className="v-crosshair" style={{ bottom: -6, right: -6 }} />

        <div
          className="px-5 py-2.5 flex items-center justify-between"
          style={{
            backgroundColor: 'var(--v-canvas-soft)',
            borderBottom: '1px solid var(--v-hairline)',
          }}
        >
          <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
            Core market arenas (5D round)
          </span>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="v-caption-mono hover:underline"
            style={{ color: 'var(--v-body)' }}
          >
            Open interactive Studio →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3">
          {arenas.map((arena, idx) => {
            const isPos = arena.medianChangePct >= 0;
            return (
              <div
                key={arena.ticker}
                onClick={() => navigate(`/studio/${arena.ticker}`)}
                className="cursor-pointer transition-colors flex flex-col justify-between"
                style={{
                  backgroundColor: 'var(--v-canvas)',
                  borderRight:
                    idx < 2 ? '1px solid var(--v-hairline)' : 'none',
                }}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span
                          className="v-mono text-base font-semibold"
                          style={{ color: 'var(--v-ink)' }}
                        >
                          ${arena.ticker}
                        </span>
                        <span
                          className="v-caption"
                          style={{ color: 'var(--v-mute)' }}
                        >
                          {arena.name}
                        </span>
                      </div>
                      <div
                        className="v-mono text-xl font-semibold tracking-tight mt-1"
                        style={{ color: 'var(--v-ink)' }}
                      >
                        ${arena.currentPrice.toFixed(2)}
                      </div>
                    </div>

                    {renderArenaSparkline(arena.ticker)}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between v-caption-mono">
                      <span style={{ color: 'var(--v-mute)' }}>
                        5D crowd median
                      </span>
                      <span
                        className="font-medium"
                        style={{
                          color: isPos ? 'var(--v-bull)' : 'var(--v-bear)',
                        }}
                      >
                        {isPos ? '+' : ''}
                        {arena.medianChangePct.toFixed(2)}% ($
                        {arena.medianTargetPrice.toFixed(2)})
                      </span>
                    </div>

                    <div
                      className="w-full h-1.5 rounded-[2px] flex overflow-hidden"
                      style={{ backgroundColor: 'var(--v-hairline)' }}
                    >
                      <div
                        style={{
                          width: `${arena.bullPct}%`,
                          backgroundColor: 'var(--v-bull)',
                        }}
                      />
                      <div
                        style={{
                          width: `${arena.bearPct}%`,
                          backgroundColor: 'var(--v-bear)',
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between v-caption-mono">
                      <span style={{ color: 'var(--v-bull)' }}>
                        Bull {arena.bullPct}%
                      </span>
                      <span style={{ color: 'var(--v-bear)' }}>
                        Bear {arena.bearPct}%
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="px-5 py-2.5 flex items-center justify-between v-caption-mono"
                  style={{
                    backgroundColor: 'var(--v-canvas-soft)',
                    borderTop: '1px solid var(--v-hairline-subtle)',
                  }}
                >
                  <span style={{ color: 'var(--v-mute)' }}>
                    {arena.participantsCount} locked peers
                  </span>
                  <span
                    className="inline-flex items-center gap-1"
                    style={{ color: 'var(--v-ink)' }}
                  >
                    <span>Sculpt in Studio</span>
                    <ArrowRight size={11} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ZONE 3: 12-Column Split — Left 8 Cols Deployment Stream | Right 4 Cols Standings & Vault */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left 8 Cols: Global Forecast Deployment Stream */}
        <div
          className="lg:col-span-8 min-w-0"
          style={{ borderRight: '1px solid var(--v-hairline)' }}
        >
          <div
            className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-3"
            style={{
              backgroundColor: 'var(--v-canvas-soft)',
              borderBottom: '1px solid var(--v-hairline)',
            }}
          >
            <div className="flex items-center gap-3 flex-1 min-w-[220px]">
              <span
                className="v-caption-mono uppercase whitespace-nowrap"
                style={{ color: 'var(--v-ink)' }}
              >
                Deployments ({filteredForecasts.length})
              </span>

              <div className="relative flex-1 max-w-xs">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--v-mute)' }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter by $ticker, @handle, or thesis..."
                  className="w-full h-7 pl-7 pr-2.5 rounded-[5px] text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--v-canvas)',
                    boxShadow: 'var(--v-shadow-border)',
                    color: 'var(--v-ink)',
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'live', label: 'Live' },
                  { id: 'resolved', label: 'Settled' },
                ] as const
              ).map(tab => {
                const active = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className="px-2.5 py-0.5 rounded-[4px] v-caption-mono transition"
                    style={{
                      backgroundColor: active
                        ? 'var(--v-canvas-soft-2)'
                        : 'transparent',
                      color: active ? 'var(--v-ink)' : 'var(--v-mute)',
                      boxShadow: active ? 'var(--v-shadow-border)' : 'none',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            {filteredForecasts.length > 0 ? (
              filteredForecasts.map(forecast => (
                <CompactForecastCard
                  key={forecast.id}
                  forecast={forecast}
                  currentDateStr={currentDateStr}
                  borderless={true}
                />
              ))
            ) : (
              <div className="p-12 text-center">
                <p className="v-body-sm" style={{ color: 'var(--v-mute)' }}>
                  No trajectory deployments match the current filter.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right 4 Cols: Top Elo Leaderboard Preview & My Locked Receipts */}
        <div className="lg:col-span-4 min-w-0 flex flex-col">
          {/* Block A: Top Elo Standings */}
          <div style={{ borderBottom: '1px solid var(--v-hairline)' }}>
            <div
              className="px-5 py-2.5 flex items-center justify-between"
              style={{
                backgroundColor: 'var(--v-canvas-soft)',
                borderBottom: '1px solid var(--v-hairline)',
              }}
            >
              <span
                className="v-caption-mono uppercase"
                style={{ color: 'var(--v-mute)' }}
              >
                Top Elo standings
              </span>
              <button
                type="button"
                onClick={() => navigate('/leaderboard')}
                className="v-caption-mono hover:underline"
                style={{ color: 'var(--v-body)' }}
              >
                Leaderboard →
              </button>
            </div>

            <div>
              {topUsers.map((u, idx) => (
                <div
                  key={u.id}
                  onClick={() => navigate(`/u/${u.handle}`)}
                  className="px-5 py-3 flex items-center justify-between cursor-pointer transition-colors"
                  style={{
                    borderBottom:
                      idx < topUsers.length - 1
                        ? '1px solid var(--v-hairline-subtle)'
                        : 'none',
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="v-caption-mono w-5"
                      style={{ color: 'var(--v-mute)' }}
                    >
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div
                        className="v-mono text-xs font-medium truncate hover:underline"
                        style={{ color: 'var(--v-ink)' }}
                      >
                        @{u.handle}
                      </div>
                      <div
                        className="v-caption truncate"
                        style={{ color: 'var(--v-mute)' }}
                      >
                        {u.name}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className="v-caption-mono px-1.5 py-0.2 rounded-[4px]"
                      style={{
                        backgroundColor: 'var(--v-canvas-soft-2)',
                        boxShadow: 'var(--v-shadow-border)',
                        color: 'var(--v-mute)',
                      }}
                    >
                      {u.tierInfo.tier}
                    </span>
                    <span
                      className="v-mono text-xs font-semibold w-16 text-right"
                      style={{ color: 'var(--v-ink)' }}
                    >
                      {u.liveElo} LP
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Block B: My Session Receipts */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div
                className="px-5 py-2.5 flex items-center justify-between"
                style={{
                  backgroundColor: 'var(--v-canvas-soft)',
                  borderBottom: '1px solid var(--v-hairline)',
                }}
              >
                <span
                  className="v-caption-mono uppercase"
                  style={{ color: 'var(--v-mute)' }}
                >
                  My locked receipts ({myForecasts.length})
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/record')}
                  className="v-caption-mono hover:underline"
                  style={{ color: 'var(--v-body)' }}
                >
                  All records →
                </button>
              </div>

              {myForecasts.length > 0 ? (
                <div>
                  {myForecasts.slice(0, 4).map((f, idx) => {
                    const target =
                      f.path && f.path.length > 0
                        ? f.path[f.path.length - 1].price
                        : f.basePrice;
                    const pct =
                      f.basePrice > 0
                        ? ((target - f.basePrice) / f.basePrice) * 100
                        : 0;
                    const st = deriveForecastStatus(f, currentDateStr);
                    return (
                      <div
                        key={f.id}
                        onClick={() => navigate(`/f/${f.id}`)}
                        className="px-5 py-3 flex items-center justify-between cursor-pointer"
                        style={{
                          borderBottom:
                            idx < Math.min(3, myForecasts.length - 1)
                              ? '1px solid var(--v-hairline-subtle)'
                              : 'none',
                        }}
                      >
                        <div className="flex items-center gap-2 v-mono text-xs">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              backgroundColor:
                                st === 'RESOLVED'
                                  ? 'var(--v-link)'
                                  : pct >= 0
                                  ? 'var(--v-bull)'
                                  : 'var(--v-bear)',
                            }}
                          />
                          <span
                            className="font-semibold"
                            style={{ color: 'var(--v-ink)' }}
                          >
                            ${f.ticker}
                          </span>
                          <span
                            style={{
                              color:
                                pct >= 0 ? 'var(--v-bull)' : 'var(--v-bear)',
                            }}
                          >
                            {pct >= 0 ? '+' : ''}
                            {pct.toFixed(2)}%
                          </span>
                        </div>

                        <div className="v-caption-mono flex items-center gap-2">
                          <span style={{ color: 'var(--v-body)' }}>
                            ${target.toFixed(2)}
                          </span>
                          <span style={{ color: 'var(--v-mute)' }}>
                            Receipt ↗
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center space-y-3">
                  <p className="v-body-sm" style={{ color: 'var(--v-mute)' }}>
                    No locked trajectories in this session yet. Sculpt your first 5D call in the studio.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="v-btn-primary w-full"
                  >
                    Launch Trajectory Studio
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkspaceOverviewPage;
