import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
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

const USER_META: Record<string, { specialty: string; category: 'tech' | 'momentum' | 'macro'; defaultScore: number; baseElo: number }> = {
  u_quant: { specialty: '퀀트 모멘텀 & 변동성 돌파', category: 'momentum', defaultScore: 89.4, baseElo: 1920 },
  u_alpha: { specialty: '빅테크 & 반도체 변곡점', category: 'tech', defaultScore: 86.2, baseElo: 1760 },
  u_bull: { specialty: 'AI 성장주 추세 분석', category: 'tech', defaultScore: 80.5, baseElo: 1490 },
  u_macro: { specialty: '금리 & 매크로 스윙', category: 'macro', defaultScore: 76.4, baseElo: 1320 },
};

export function LeaderboardPage({ currentDateStr }: LeaderboardPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | 'tech' | 'momentum' | 'macro'>('all');

  const rankedUsers: RankedUser[] = useMemo(() => {
    const rawUsers = repository.listAllUsers();

    const scored = rawUsers.map(u => {
      const forecasts = repository.listByUser(u.id);
      const resolved = forecasts.filter(f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED');

      const meta = USER_META[u.id] || {
        specialty: '5D 주가 궤적 분석',
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

      const score = scoreCount > 0 ? parseFloat((scoreSum / scoreCount).toFixed(1)) : meta.defaultScore;
      const accuracy = resolved.length > 0
        ? `${Math.round((hitCount / resolved.length) * 100)}%`
        : `${Math.round(meta.defaultScore)}%`;
      const avgMae = resolved.length > 0 && errorSum > 0
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

  const filtered = activeTab === 'all'
    ? rankedUsers
    : rankedUsers.filter(u => u.category === activeTab);

  const top3 = rankedUsers.slice(0, 3);

  return (
    <div className="w-full">
      {/* Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
            Elo 리더보드
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            실제 시장 종가 정산 기준 참여자 순위
          </p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'all', label: '전체' },
            { id: 'tech', label: '빅테크' },
            { id: 'momentum', label: '모멘텀' },
            { id: 'macro', label: '매크로' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as 'all' | 'tech' | 'momentum' | 'macro')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === tab.id
                  ? 'bg-zinc-100 text-black'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {top3.map((user) => (
          <div
            key={user.id}
            onClick={() => navigate(`/u/${user.handle}`)}
            className={`group rounded-lg p-4 border transition-all cursor-pointer flex flex-col justify-between bg-zinc-950 ${
              user.rank === 1
                ? 'border-zinc-700 ring-1 ring-zinc-700/60'
                : 'border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-black text-zinc-300 border border-zinc-800 font-mono tabular-nums">
                  #{user.rank}
                </span>

                <div className={`px-2 py-0.5 rounded-md text-xs font-medium font-mono tabular-nums flex items-center gap-1 border ${user.tierInfo.badgeClass}`}>
                  <span>{user.tierInfo.tier}</span>
                  <span>·</span>
                  <span>{user.liveElo.toLocaleString()} LP</span>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-10 h-10 rounded-full object-cover border border-zinc-800"
                />
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-sm text-zinc-100 group-hover:underline transition">
                      {user.name}
                    </span>
                    <CheckCircle2 size={13} className="text-zinc-400" />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono tabular-nums">
                    <span>@{user.handle}</span>
                    {user.netLpDelta !== 0 && (
                      <span className={user.netLpDelta >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                        ({formatSignedLp(user.netLpDelta)})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-xs text-zinc-400 line-clamp-2 mb-3">
                {user.bio}
              </p>
            </div>

            <div className="pt-3 border-t border-zinc-850/60 grid grid-cols-3 gap-2 text-center font-mono tabular-nums">
              <div>
                <div className="text-[11px] text-zinc-500 font-sans">평균 점수</div>
                <div className="text-xs font-medium text-zinc-200 mt-0.5">{user.score}점</div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500 font-sans">적중률</div>
                <div className="text-xs font-medium text-emerald-400 mt-0.5">{user.accuracy}</div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500 font-sans">평균 오차</div>
                <div className="text-xs font-medium text-zinc-300 mt-0.5">{user.avgMae}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Full Leaderboard Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-zinc-900/60 text-zinc-400 text-xs border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4 text-left font-medium">순위</th>
                <th className="py-3 px-4 text-left font-medium">참여자</th>
                <th className="py-3 px-4 text-left font-medium">티어</th>
                <th className="py-3 px-4 text-left font-medium hidden md:table-cell">분야</th>
                <th className="py-3 px-4 text-right font-medium">평균 점수</th>
                <th className="py-3 px-4 text-right font-medium">Elo 레이팅</th>
                <th className="py-3 px-4 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => navigate(`/u/${user.handle}`)}
                  className="hover:bg-zinc-900/40 transition cursor-pointer"
                >
                  <td className="py-3 px-4 text-left font-mono font-medium text-zinc-400">
                    #{user.rank}
                  </td>
                  <td className="py-3 px-4 text-left">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="w-7 h-7 rounded-full object-cover border border-zinc-800"
                      />
                      <div>
                        <div className="font-medium text-zinc-100 flex items-center gap-1 text-xs sm:text-sm">
                          <span>{user.name}</span>
                          <CheckCircle2 size={12} className="text-zinc-400" />
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono">
                          @{user.handle}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-left">
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium border ${user.tierInfo.badgeClass}`}>
                      {user.tierInfo.tier}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-left text-xs text-zinc-400 hidden md:table-cell">
                    {user.specialty}
                  </td>
                  <td className="py-3 px-4 text-right text-xs font-mono text-zinc-200">
                    {user.score}점
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    <span className="font-semibold text-zinc-100 text-xs sm:text-sm">
                      {user.liveElo.toLocaleString()} LP
                    </span>
                    {user.netLpDelta !== 0 && (
                      <span className={`ml-1.5 text-xs font-medium ${user.netLpDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ({formatSignedLp(user.netLpDelta)})
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <ArrowRight size={13} className="inline text-zinc-500" />
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
