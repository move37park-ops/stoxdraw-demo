import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, PenTool, ArrowRight, Lock, CheckCircle2 } from 'lucide-react';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId } from '../../data/session';
import { getHotArenas } from '../../domain/arena';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecast } from '../../domain/resolution';
import { getStockHistory } from '../../data/market';
import { getEloTierInfo, DEFAULT_ELO, formatSignedLp } from '../../domain/elo';
import { formatPct } from '../../domain/format';
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

  // 1. My Workspace Elo & Forecast Stats
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
    const avgScore = scoredCount > 0 ? Math.round(scoreSum / scoredCount) : null;
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

  // 2. Market Arenas (Vercel Project Cards)
  const arenas = useMemo(() => {
    const allHot = getHotArenas(forecasts, currentDateStr, '5D');
    return CORE_TICKERS.map(t => allHot.find(a => a.ticker === t)).filter(
      (a): a is NonNullable<typeof a> => Boolean(a)
    );
  }, [forecasts, currentDateStr]);

  // 3. Top Elo Leaderboard Preview
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

  // 4. Filtered Forecast Stream
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
      .slice(-10);
    if (bars.length < 2) return null;
    const prices = bars.map(b => b.close);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const w = 76;
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
        <path
          d={`M ${pts.join(' L ')}`}
          fill="none"
          stroke={isUp ? '#10b981' : '#f43f5e'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Search & Action Bar (Vercel Dashboard Toolbar Pattern) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="종목 티커($NVDA, $TSLA, $AAPL) 또는 참여자 검색..."
            className="w-full pl-9 pr-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/arena')}
            className="px-3 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 transition"
          >
            전체 종목 아레나
          </button>
          <button
            type="button"
            onClick={() => navigate('/draw')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-white hover:bg-zinc-200 text-black text-xs font-medium transition"
          >
            <PenTool size={13} />
            <span>새 5D 예측 등록</span>
          </button>
        </div>
      </div>

      {/* Main 12-Column Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar (4 Cols): User Scope Summary, Recent Activity, Top Elo */}
        <div className="lg:col-span-4 space-y-6">
          {/* 1. My Elo Rating Card (Single Container + 1px Hairline Dividers) */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800 overflow-hidden">
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-zinc-400">내 Elo 레이팅</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${myStats.tierInfo.badgeClass}`}
                >
                  {myStats.tierInfo.tier}
                </span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-zinc-100">
                    {myStats.liveElo.toLocaleString()} LP
                  </span>
                  {myStats.deltaSum !== 0 && (
                    <span
                      className={`text-xs font-medium ${
                        myStats.deltaSum >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      ({formatSignedLp(myStats.deltaSum)})
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/record')}
                  className="text-xs font-sans text-zinc-400 hover:text-zinc-100 transition"
                >
                  내 기록 →
                </button>
              </div>

              {/* Progress to next tier */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 mb-1.5">
                  <span>티어 진행률 ({myStats.tierInfo.progressPct}%)</span>
                  <span>
                    {myStats.tierInfo.nextTierElo
                      ? `다음 티어까지 ${myStats.tierInfo.nextTierElo - myStats.liveElo} LP`
                      : '최고 티어'}
                  </span>
                </div>
                <div className="w-full h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-zinc-100 transition-all duration-300"
                    style={{ width: `${myStats.tierInfo.progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 3-Column Hairline Stats */}
            <div className="grid grid-cols-3 divide-x divide-zinc-800 text-center font-mono">
              <div className="py-2.5 px-2">
                <div className="text-[11px] text-zinc-500 font-sans">등록 예측</div>
                <div className="text-xs font-semibold text-zinc-100 mt-0.5">
                  {myStats.totalCount}건
                </div>
              </div>
              <div className="py-2.5 px-2">
                <div className="text-[11px] text-zinc-500 font-sans">정산 완료</div>
                <div className="text-xs font-semibold text-zinc-100 mt-0.5">
                  {myStats.resolvedCount}건
                </div>
              </div>
              <div className="py-2.5 px-2">
                <div className="text-[11px] text-zinc-500 font-sans">
                  {myStats.avgScore !== null ? '평균 점수' : '적중률'}
                </div>
                <div className="text-xs font-semibold text-zinc-100 mt-0.5">
                  {myStats.avgScore !== null
                    ? `${myStats.avgScore}점`
                    : myStats.hitRate !== null
                    ? `${myStats.hitRate}%`
                    : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* 2. My Active Forecasts */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-xs font-semibold text-zinc-300">내 최근 예측</h2>
              <button
                type="button"
                onClick={() => navigate('/record')}
                className="text-xs text-zinc-500 hover:text-zinc-200 transition"
              >
                전체 보기
              </button>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800 overflow-hidden">
              {myForecasts.length > 0 ? (
                myForecasts.slice(0, 3).map(f => {
                  const target =
                    f.path && f.path.length > 0
                      ? f.path[f.path.length - 1].price
                      : f.basePrice;
                  const pct = ((target - f.basePrice) / f.basePrice) * 100;
                  const st = deriveForecastStatus(f, currentDateStr);
                  return (
                    <div
                      key={f.id}
                      onClick={() => navigate(`/f/${f.id}`)}
                      className="p-3 hover:bg-zinc-900/50 transition cursor-pointer flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            st === 'RESOLVED' ? 'bg-zinc-400' : 'bg-emerald-400'
                          }`}
                        />
                        <span className="font-semibold text-zinc-100">${f.ticker}</span>
                        <span className={pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {formatPct(pct)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-400">
                        <span>${target.toFixed(1)}</span>
                        <span className="text-[11px] font-sans text-zinc-500">
                          {st === 'RESOLVED' ? '정산됨' : '진행 중'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-5 text-center">
                  <p className="text-xs text-zinc-400 mb-3">
                    아직 등록한 5일 주가 예측이 없습니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/draw')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 text-black text-xs font-medium transition"
                  >
                    <span>첫 5D 예측 등록하기</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 3. Top Elo Ranking Preview */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-xs font-semibold text-zinc-300">Elo 리더보드 상위</h2>
              <button
                type="button"
                onClick={() => navigate('/leaderboard')}
                className="text-xs text-zinc-500 hover:text-zinc-200 transition"
              >
                순위표 →
              </button>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800 overflow-hidden">
              {topUsers.map((u, idx) => (
                <div
                  key={u.id}
                  onClick={() => navigate(`/u/${u.handle}`)}
                  className="px-3.5 py-2.5 hover:bg-zinc-900/50 transition cursor-pointer flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-zinc-500 w-4">#{idx + 1}</span>
                    <img
                      src={u.avatarUrl}
                      alt={u.name}
                      className="w-6 h-6 rounded-full object-cover border border-zinc-800 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-zinc-100 truncate">{u.name}</span>
                        <CheckCircle2 size={11} className="text-zinc-500 flex-shrink-0" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono flex-shrink-0">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] border ${u.tierInfo.badgeClass}`}
                    >
                      {u.tierInfo.tier}
                    </span>
                    <span className="font-semibold text-zinc-100 w-16 text-right">
                      {u.liveElo.toLocaleString()} LP
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Main Column (8 Cols): Market Project Cards & Live Deployment Rows */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. Market Arenas (Vercel Project Cards Grid) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-xs font-semibold text-zinc-300">종목 워크스페이스 (Markets)</h2>
              <span className="text-[11px] text-zinc-500 font-mono">
                5거래일 라운드 · 기준일 {currentDateStr}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {arenas.map(arena => {
                const hasParticipated = myForecasts.some(f => f.ticker === arena.ticker);

                return (
                  <div
                    key={arena.ticker}
                    onClick={() => navigate(`/arena/${arena.ticker}`)}
                    className="group rounded-lg border border-zinc-800 bg-zinc-950 hover:border-zinc-700 transition cursor-pointer flex flex-col justify-between divide-y divide-zinc-800/80"
                  >
                    <div className="p-4">
                      {/* Project Header */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-base text-zinc-100 group-hover:underline">
                              ${arena.ticker}
                            </span>
                            <span className="text-xs text-zinc-500">{arena.name}</span>
                          </div>
                          <div className="text-sm font-mono font-semibold text-zinc-200 mt-0.5">
                            ${arena.currentPrice.toFixed(2)}
                          </div>
                        </div>
                        {renderArenaSparkline(arena.ticker)}
                      </div>

                      {/* Consensus & Bull/Bear Bar */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-zinc-500 font-sans text-[11px]">5D 컨센서스</span>
                          {hasParticipated ? (
                            <span
                              className={
                                arena.medianChangePct >= 0
                                  ? 'text-emerald-400 font-medium'
                                  : 'text-rose-400 font-medium'
                              }
                            >
                              {formatPct(arena.medianChangePct)} (${arena.medianTargetPrice})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 font-sans">
                              <Lock size={10} className="text-zinc-500" />
                              <span>예측 시 공개</span>
                            </span>
                          )}
                        </div>

                        <div className="w-full h-1 rounded-full bg-zinc-800 flex overflow-hidden">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${arena.bullPct}%` }}
                          />
                          <div
                            className="h-full bg-rose-500"
                            style={{ width: `${arena.bearPct}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                          <span className="text-emerald-400">BULL {arena.bullPct}%</span>
                          <span className="text-rose-400">BEAR {arena.bearPct}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="px-4 py-2.5 flex items-center justify-between text-xs">
                      <span className="text-zinc-500 font-mono text-[11px]">
                        {arena.participantsCount}명 참여
                      </span>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          navigate(`/draw?ticker=${arena.ticker}`);
                        }}
                        className="text-zinc-300 hover:text-white font-medium inline-flex items-center gap-1 transition"
                      >
                        <span>예측 등록</span>
                        <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Recent Forecast Deployments (Single Container + 1px Hairline Rows) */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold text-zinc-300">최근 등록된 5D 예측</h2>
                <span className="text-xs font-mono text-zinc-500">
                  ({filteredForecasts.length})
                </span>
              </div>

              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'all', label: '전체' },
                    { id: 'live', label: '진행 중' },
                    { id: 'resolved', label: '정산 완료' },
                  ] as const
                ).map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                      statusFilter === tab.id
                        ? 'bg-zinc-100 text-black'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800 overflow-hidden">
              {filteredForecasts.length > 0 ? (
                filteredForecasts.slice(0, 10).map(forecast => (
                  <CompactForecastCard
                    key={forecast.id}
                    forecast={forecast}
                    currentDateStr={currentDateStr}
                    borderless={true}
                  />
                ))
              ) : (
                <div className="py-12 px-4 text-center">
                  <p className="text-xs text-zinc-400">
                    조건에 일치하는 예측 기록이 없습니다.
                  </p>
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
