import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { repository } from '../../data/localRepository';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecast } from '../../domain/resolution';
import { getStockHistory } from '../../data/market';
import { getEloTierInfo, DEFAULT_ELO, formatSignedLp, type EloTierInfo } from '../../domain/elo';
import type { User } from '../../domain/types';

interface LeaderboardPageProps {
  currentDateStr: string;
}

interface RankedUser extends User {
  rank: number;
  liveElo: number;
  netLpDelta: number;
  tierInfo: EloTierInfo;
  score: number;
  accuracy: string;
  verifiedCount: number;
  totalCount: number;
  avgMae: string;
  specialty: string;
  category: 'tech' | 'momentum' | 'macro';
}

const USER_META: Record<
  string,
  {
    specialty: string;
    category: 'tech' | 'momentum' | 'macro';
    defaultScore: number;
    baseElo: number;
  }
> = {
  u_quant: {
    specialty: 'Volatility-normalized path & mean reversion',
    category: 'momentum',
    defaultScore: 89.4,
    baseElo: 1920,
  },
  u_alpha: {
    specialty: 'Semiconductor & hyperscaler gamma inflection',
    category: 'tech',
    defaultScore: 86.2,
    baseElo: 1760,
  },
  u_bull: {
    specialty: 'AI infrastructure & earnings momentum',
    category: 'tech',
    defaultScore: 80.5,
    baseElo: 1490,
  },
  u_macro: {
    specialty: 'Rates-driven swing & liquidity regimes',
    category: 'macro',
    defaultScore: 76.4,
    baseElo: 1320,
  },
};

export function LeaderboardPage({ currentDateStr }: LeaderboardPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | 'tech' | 'momentum' | 'macro'>('all');

  const rankedUsers: RankedUser[] = useMemo(() => {
    const rawUsers = repository.listAllUsers();

    const scored = rawUsers.map(u => {
      const forecasts = repository.listByUser(u.id);
      const resolved = forecasts.filter(
        f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED'
      );

      const meta = USER_META[u.id] || {
        specialty: '5D equity trajectory analysis',
        category: 'tech' as const,
        defaultScore: 74.0,
        baseElo: u.elo ?? DEFAULT_ELO,
      };

      const baseElo = u.elo ?? meta.baseElo;

      let hitCount = 0;
      let scoreSum = 0;
      let scoreCount = 0;
      let errorSum = 0;
      let netLpDelta = 0;

      resolved.forEach(f => {
        const stockBars = getStockHistory(f.ticker);
        const visibleBars = stockBars.filter(b => b.date <= currentDateStr);
        const res = resolveForecast(f, visibleBars);
        const isHit = f.mode === 'breakout' ? res.breakoutHit : res.directionHit;
        if (isHit) hitCount++;
        if (res.score) {
          scoreSum += res.score.total;
          scoreCount++;
        }
        if (res.endErrorPct !== undefined) {
          errorSum += res.endErrorPct;
        }
        if (res.eloSettlement) {
          netLpDelta += res.eloSettlement.deltaLp;
        }
      });

      const liveElo = Math.max(800, baseElo + netLpDelta);
      const tierInfo = getEloTierInfo(liveElo);

      const score =
        scoreCount > 0
          ? parseFloat((scoreSum / scoreCount).toFixed(1))
          : meta.defaultScore;
      const accuracy =
        resolved.length > 0
          ? `${Math.round((hitCount / resolved.length) * 100)}%`
          : `${Math.round(meta.defaultScore)}%`;
      const avgMae =
        resolved.length > 0 && errorSum > 0
          ? `±${(errorSum / resolved.length).toFixed(1)}%`
          : '±3.4%';

      return {
        ...u,
        rank: 1,
        liveElo,
        netLpDelta,
        tierInfo,
        score,
        accuracy,
        verifiedCount: resolved.length || u.completedCount,
        totalCount: forecasts.length || u.forecastsCount,
        avgMae,
        specialty: meta.specialty,
        category: meta.category,
      };
    });

    scored.sort((a, b) => b.liveElo - a.liveElo);
    return scored.map((u, i) => ({ ...u, rank: i + 1 }));
  }, [currentDateStr]);

  const filtered =
    activeTab === 'all'
      ? rankedUsers
      : rankedUsers.filter(u => u.category === activeTab);

  const top3 = rankedUsers.slice(0, 3);

  return (
    <div className="w-full">
      {/* ZONE 1: Architectural Masthead Band */}
      <div
        className="relative grid grid-cols-1 lg:grid-cols-12"
        style={{ borderBottom: '1px solid var(--v-hairline)' }}
      >
        <span className="v-crosshair" style={{ bottom: -6, left: -6 }} />
        <span className="v-crosshair" style={{ bottom: -6, right: -6 }} />

        <div
          className="lg:col-span-7 px-5 py-5 flex flex-col justify-center gap-2 min-w-0"
          style={{ borderRight: '1px solid var(--v-hairline)' }}
        >
          <div
            className="flex items-center gap-2 v-caption-mono uppercase"
            style={{ color: 'var(--v-mute)' }}
          >
            <span style={{ color: 'var(--v-ink)' }}>Quantitative Elo standings</span>
            <span style={{ color: 'var(--v-dim)' }}>·</span>
            <span>As of {currentDateStr}</span>
          </div>
          <h1 className="v-display-hero">
            <span style={{ color: 'var(--v-ink)' }}>
              Forecasters ranked by verified 5-day trajectory precision.{' '}
            </span>
            <span style={{ color: 'var(--v-mute)', fontWeight: 400 }}>
              Ratings settle automatically against real Friday market closes using time-weighted path skill and contrarian Elo stakes.
            </span>
          </h1>
        </div>

        <div className="lg:col-span-5 grid grid-cols-3 min-w-0">
          <div
            className="p-4 sm:p-5 flex flex-col justify-between min-w-0"
            style={{ borderRight: '1px solid var(--v-hairline)' }}
          >
            <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
              Rating engine
            </span>
            <div className="mt-2">
              <p
                className="v-mono text-xl font-semibold tracking-tight"
                style={{ color: 'var(--v-ink)' }}
              >
                K = 32
              </p>
              <p className="v-caption-mono mt-0.5" style={{ color: 'var(--v-mute)' }}>
                Zero-inflation Elo
              </p>
            </div>
          </div>

          <div
            className="p-4 sm:p-5 flex flex-col justify-between min-w-0"
            style={{ borderRight: '1px solid var(--v-hairline)' }}
          >
            <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
              Hybrid rubric
            </span>
            <div className="mt-2">
              <p
                className="v-mono text-xl font-semibold tracking-tight"
                style={{ color: 'var(--v-ink)' }}
              >
                50·30·20
              </p>
              <p className="v-caption-mono mt-0.5" style={{ color: 'var(--v-mute)' }}>
                Path · Dir · Target
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 flex flex-col justify-between min-w-0">
            <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
              Season leader
            </span>
            <div className="mt-2">
              <p
                className="v-mono text-xl font-semibold tracking-tight"
                style={{ color: 'var(--v-bull)' }}
              >
                {top3[0]?.liveElo ?? 1920} LP
              </p>
              <p className="v-caption-mono mt-0.5" style={{ color: 'var(--v-mute)' }}>
                @{top3[0]?.handle ?? 'quant_craft'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ZONE 2: Top 3 Podium (Flush 3-Column Architectural Grid) */}
      <div
        className="relative grid grid-cols-1 md:grid-cols-3"
        style={{ borderBottom: '1px solid var(--v-hairline)' }}
      >
        <span className="v-crosshair" style={{ bottom: -6, left: -6 }} />
        <span className="v-crosshair" style={{ bottom: -6, right: -6 }} />

        {top3.map((user, idx) => (
          <div
            key={user.id}
            onClick={() => navigate(`/u/${user.handle}`)}
            className="flex flex-col justify-between cursor-pointer transition-colors"
            style={{
              backgroundColor:
                idx === 0 ? 'var(--v-canvas-soft)' : 'var(--v-canvas)',
              borderRight: idx < 2 ? '1px solid var(--v-hairline)' : 'none',
            }}
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span
                  className="v-mono text-xs font-semibold px-2 py-0.5 rounded-[4px]"
                  style={{
                    backgroundColor:
                      idx === 0 ? 'var(--v-primary)' : 'var(--v-canvas-soft-2)',
                    color:
                      idx === 0 ? 'var(--v-on-primary)' : 'var(--v-ink)',
                    boxShadow: idx === 0 ? 'none' : 'var(--v-shadow-border)',
                  }}
                >
                  Rank #{user.rank}
                </span>

                <span
                  className="v-caption-mono px-2 py-0.5 rounded-[4px]"
                  style={{
                    backgroundColor: 'var(--v-canvas-soft-2)',
                    boxShadow: 'var(--v-shadow-border)',
                    color: 'var(--v-ink)',
                  }}
                >
                  {user.tierInfo.tier} · {user.liveElo} LP
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <div
                    className="v-mono text-base font-semibold hover:underline"
                    style={{ color: 'var(--v-ink)' }}
                  >
                    @{user.handle}
                  </div>
                  <div
                    className="v-caption mt-0.5"
                    style={{ color: 'var(--v-mute)' }}
                  >
                    {user.name}
                  </div>
                </div>

                {user.netLpDelta !== 0 && (
                  <span
                    className="v-mono text-xs font-semibold"
                    style={{
                      color:
                        user.netLpDelta >= 0
                          ? 'var(--v-bull)'
                          : 'var(--v-bear)',
                    }}
                  >
                    {formatSignedLp(user.netLpDelta)}
                  </span>
                )}
              </div>

              <p
                className="v-body-sm mt-3 line-clamp-2"
                style={{ color: 'var(--v-body)' }}
              >
                {user.bio}
              </p>
            </div>

            <div
              className="grid grid-cols-3 text-center"
              style={{
                borderTop: '1px solid var(--v-hairline-subtle)',
                backgroundColor: 'var(--v-canvas)',
              }}
            >
              <div
                className="py-2.5 px-2"
                style={{ borderRight: '1px solid var(--v-hairline-subtle)' }}
              >
                <div
                  className="v-caption-mono text-[10px] uppercase"
                  style={{ color: 'var(--v-mute)' }}
                >
                  Mean score
                </div>
                <div
                  className="v-mono text-xs font-semibold mt-0.5"
                  style={{ color: 'var(--v-ink)' }}
                >
                  {user.score}
                </div>
              </div>
              <div
                className="py-2.5 px-2"
                style={{ borderRight: '1px solid var(--v-hairline-subtle)' }}
              >
                <div
                  className="v-caption-mono text-[10px] uppercase"
                  style={{ color: 'var(--v-mute)' }}
                >
                  Hit rate
                </div>
                <div
                  className="v-mono text-xs font-semibold mt-0.5"
                  style={{ color: 'var(--v-bull)' }}
                >
                  {user.accuracy}
                </div>
              </div>
              <div className="py-2.5 px-2">
                <div
                  className="v-caption-mono text-[10px] uppercase"
                  style={{ color: 'var(--v-mute)' }}
                >
                  Mean error
                </div>
                <div
                  className="v-mono text-xs font-semibold mt-0.5"
                  style={{ color: 'var(--v-body)' }}
                >
                  {user.avgMae}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ZONE 3: Full Semantic Leaderboard Table */}
      <div>
        <div
          className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--v-canvas-soft)',
            borderBottom: '1px solid var(--v-hairline)',
          }}
        >
          <span
            className="v-caption-mono uppercase"
            style={{ color: 'var(--v-ink)' }}
          >
            Verified forecaster directory ({filtered.length})
          </span>

          <div className="flex items-center gap-1">
            {(
              [
                { id: 'all', label: 'All strategies' },
                { id: 'tech', label: 'Big Tech' },
                { id: 'momentum', label: 'Momentum' },
                { id: 'macro', label: 'Macro' },
              ] as const
            ).map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
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

        <div className="overflow-x-auto">
          <table className="v-audit-table">
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Forecaster</th>
                <th scope="col">Tier</th>
                <th scope="col" className="hidden md:table-cell">
                  Focus strategy
                </th>
                <th scope="col" className="v-numeric">
                  Settled / Total
                </th>
                <th scope="col" className="v-numeric">
                  Mean score
                </th>
                <th scope="col" className="v-numeric">
                  Hit rate
                </th>
                <th scope="col" className="v-numeric">
                  Mean error
                </th>
                <th scope="col" className="v-numeric">
                  Elo rating
                </th>
                <th scope="col" className="v-numeric">
                  Dossier
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr
                  key={user.id}
                  onClick={() => navigate(`/u/${user.handle}`)}
                  className="cursor-pointer"
                >
                  <td className="v-mono font-medium" style={{ color: 'var(--v-mute)' }}>
                    #{user.rank}
                  </td>
                  <td>
                    <div className="flex items-baseline gap-2">
                      <span
                        className="v-mono text-xs font-semibold hover:underline"
                        style={{ color: 'var(--v-ink)' }}
                      >
                        @{user.handle}
                      </span>
                      <span
                        className="v-caption hidden sm:inline"
                        style={{ color: 'var(--v-mute)' }}
                      >
                        {user.name}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      className="v-caption-mono px-1.5 py-0.5 rounded-[4px]"
                      style={{
                        backgroundColor: 'var(--v-canvas-soft-2)',
                        boxShadow: 'var(--v-shadow-border)',
                        color: 'var(--v-body)',
                      }}
                    >
                      {user.tierInfo.tier}
                    </span>
                  </td>
                  <td
                    className="hidden md:table-cell v-caption"
                    style={{ color: 'var(--v-mute)' }}
                  >
                    {user.specialty}
                  </td>
                  <td className="v-numeric" style={{ color: 'var(--v-body)' }}>
                    {user.verifiedCount} / {user.totalCount}
                  </td>
                  <td className="v-numeric font-medium">
                    {user.score.toFixed(1)}
                  </td>
                  <td
                    className="v-numeric"
                    style={{ color: 'var(--v-bull)' }}
                  >
                    {user.accuracy}
                  </td>
                  <td
                    className="v-numeric"
                    style={{ color: 'var(--v-mute)' }}
                  >
                    {user.avgMae}
                  </td>
                  <td className="v-numeric font-semibold">
                    <span>{user.liveElo} LP</span>
                    {user.netLpDelta !== 0 && (
                      <span
                        className="ml-1.5 text-[11px]"
                        style={{
                          color:
                            user.netLpDelta >= 0
                              ? 'var(--v-bull)'
                              : 'var(--v-bear)',
                        }}
                      >
                        ({formatSignedLp(user.netLpDelta)})
                      </span>
                    )}
                  </td>
                  <td className="v-numeric">
                    <span
                      className="v-caption-mono hover:underline"
                      style={{ color: 'var(--v-mute)' }}
                    >
                      Inspect →
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default LeaderboardPage;
