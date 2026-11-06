import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, UserCheck } from 'lucide-react';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId } from '../../data/session';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecast } from '../../domain/resolution';
import { getBtcHistoryBars } from '../../data/btcMarket';
import {
  getEloTierInfo,
  DEFAULT_ELO,
  formatSignedLp,
  type EloTierInfo,
} from '../../domain/elo';
import type { User, Forecast, EloTier } from '../../domain/types';

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
  latestForecast?: Forecast;
}

const USER_META: Record<
  string,
  {
    defaultScore: number;
    baseElo: number;
  }
> = {
  u_quant: {
    defaultScore: 91.4,
    baseElo: 1890,
  },
  u_alpha: {
    defaultScore: 87.8,
    baseElo: 1820,
  },
  u_satoshi: {
    defaultScore: 83.5,
    baseElo: 1640,
  },
  u_bull: {
    defaultScore: 79.2,
    baseElo: 1460,
  },
  u_macro: {
    defaultScore: 73.6,
    baseElo: 1240,
  },
  u_rookie: {
    defaultScore: 65.0,
    baseElo: 980,
  },
};

const TIER_FILTERS: {
  id: 'ALL' | EloTier;
  label: string;
  minLp?: string;
  color?: string;
}[] = [
  { id: 'ALL', label: '전체' },
  { id: 'DIAMOND', label: '다이아몬드', minLp: '1,800+', color: '#3291ff' },
  { id: 'PLATINUM', label: '플래티넘', minLp: '1,600+', color: '#00e599' },
  { id: 'GOLD', label: '골드', minLp: '1,400+', color: '#f5a623' },
  { id: 'SILVER', label: '실버', minLp: '1,200+', color: '#a1a1aa' },
  { id: 'BRONZE', label: '브론즈', minLp: '1,000+', color: '#71717a' },
];

export function LeaderboardPage({ currentDateStr }: LeaderboardPageProps) {
  const navigate = useNavigate();
  const [tierFilter, setTierFilter] = useState<'ALL' | EloTier>('ALL');
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = repository.subscribe(() => setTick(t => t + 1));
    return () => unsub();
  }, []);

  const currentUser = getCurrentUser();
  const anonId = getOrCreateAnonId();
  const allForecasts = repository.listFeed('all', currentDateStr);

  const rankedUsers: RankedUser[] = useMemo(() => {
    const rawUsers = repository.listAllUsers();
    const btcBars = getBtcHistoryBars().filter(b => b.date <= currentDateStr);

    const scored = rawUsers.map(u => {
      const forecasts = repository.listByUser(u.id);
      const resolved = forecasts.filter(
        f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED'
      );

      const meta = USER_META[u.id] || {
        defaultScore: 72.0,
        baseElo: u.elo ?? DEFAULT_ELO,
      };

      const baseElo = u.elo ?? meta.baseElo;

      let hitCount = 0;
      let scoreSum = 0;
      let scoreCount = 0;
      let errorSum = 0;
      let netLpDelta = 0;

      resolved.forEach(f => {
        const res = resolveForecast(f, btcBars);
        if (res.directionHit) hitCount++;
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

      const liveElo = Math.max(700, baseElo + netLpDelta);
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
        resolved.length > 0
          ? `${(errorSum / resolved.length).toFixed(2)}%`
          : `${Math.max(1.1, (100 - meta.defaultScore) * 0.16).toFixed(2)}%`;

      return {
        ...u,
        rank: 0,
        liveElo,
        netLpDelta,
        tierInfo,
        score,
        accuracy,
        verifiedCount: resolved.length + u.completedCount,
        totalCount: forecasts.length + u.forecastsCount,
        avgMae,
        latestForecast: forecasts[0],
      };
    });

    return scored
      .sort((a, b) => b.liveElo - a.liveElo || b.score - a.score)
      .map((u, idx) => ({ ...u, rank: idx + 1 }));
  }, [currentDateStr, allForecasts]);

  const filteredUsers = useMemo(() => {
    if (tierFilter === 'ALL') return rankedUsers;
    return rankedUsers.filter(u => u.tierInfo.tier === tierFilter);
  }, [rankedUsers, tierFilter]);

  const cleanAnonSuffix =
    anonId.replace(/^anon[_-]?/i, '').slice(0, 4) || 'guest';
  const userHandle = currentUser
    ? currentUser.handle
    : `guest_${cleanAnonSuffix}`;
  const myRankedEntry = currentUser
    ? rankedUsers.find(u => u.id === currentUser.id)
    : undefined;
  const myElo = myRankedEntry?.liveElo ?? currentUser?.elo ?? DEFAULT_ELO;
  const myTierInfo = getEloTierInfo(myElo);

  return (
    <div className="w-full relative">
      <span className="v-crosshair -top-[5px] -left-[6px]" aria-hidden="true" />
      <span className="v-crosshair -top-[5px] -right-[6px]" aria-hidden="true" />

      {/* 1. Compact Header & My Tier Summary */}
      <section
        className="relative px-5 py-4 flex flex-wrap items-center justify-between gap-4"
        style={{ borderBottom: '1px solid var(--v-hairline)' }}
      >
        <span className="v-crosshair -bottom-[6px] -left-[6px]" aria-hidden="true" />
        <span className="v-crosshair -bottom-[6px] -right-[6px]" aria-hidden="true" />

        <div>
          <h1 className="v-display-md" style={{ color: 'var(--v-ink)' }}>
            리더보드
          </h1>
          <p className="v-caption mt-0.5" style={{ color: 'var(--v-mute)' }}>
            20일 예측 경로의 일별 오차율과 방향 적중률을 반영한 평판(LP) 순위입니다.
          </p>
        </div>

        {/* My Standing & Quick Navigation */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className="h-8 px-3 rounded-[5px] inline-flex items-center gap-2 text-xs"
            style={{
              backgroundColor: 'var(--v-canvas-soft)',
              boxShadow: 'var(--v-shadow-border)',
            }}
          >
            <span
              className="w-2 h-2 rounded-[1.5px] flex-shrink-0"
              style={{ backgroundColor: myTierInfo.accentHex }}
            />
            <span style={{ color: 'var(--v-mute)' }}>내 등급</span>
            <span className="font-semibold" style={{ color: 'var(--v-ink)' }}>
              {myTierInfo.krTitle}
            </span>
            <span
              className="v-mono font-semibold"
              style={{ color: myTierInfo.accentHex }}
            >
              {myElo.toLocaleString('en-US')} LP
            </span>
            {myRankedEntry && (
              <span className="v-mono" style={{ color: 'var(--v-mute)' }}>
                (#{myRankedEntry.rank})
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate(`/u/${userHandle}`)}
            className="v-btn-secondary h-8 px-3 text-xs"
          >
            <UserCheck size={12} />
            내 기록 보기
          </button>

          <button
            type="button"
            onClick={() => navigate('/studio')}
            className="v-btn-primary h-8 px-3.5 text-xs font-semibold"
          >
            실전 예측하기
          </button>
        </div>
      </section>

      {/* 2. Unified Tier Filter Bar */}
      <section
        className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-3"
        style={{
          backgroundColor: 'var(--v-canvas-soft)',
          borderBottom: '1px solid var(--v-hairline)',
        }}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {TIER_FILTERS.map(tf => {
            const active = tierFilter === tf.id;
            return (
              <button
                key={tf.id}
                type="button"
                onClick={() => setTierFilter(tf.id)}
                className="h-7 px-2.5 rounded-[5px] inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: active ? 'var(--v-primary)' : 'var(--v-canvas)',
                  color: active ? 'var(--v-on-primary)' : 'var(--v-body)',
                  boxShadow: active ? 'none' : 'var(--v-shadow-border)',
                }}
              >
                {tf.color && (
                  <span
                    className="w-2 h-2 rounded-[1.5px] flex-shrink-0"
                    style={{ backgroundColor: tf.color }}
                  />
                )}
                <span>{tf.label}</span>
                {tf.minLp && (
                  <span
                    className="v-mono text-[11px]"
                    style={{
                      color: active ? 'var(--v-on-primary)' : 'var(--v-mute)',
                      opacity: active ? 0.8 : 1,
                    }}
                  >
                    {tf.minLp}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <span className="v-caption-mono text-xs" style={{ color: 'var(--v-mute)' }}>
          검증 참여자 {filteredUsers.length}명
        </span>
      </section>

      {/* 3. Single Clean Ranking Table */}
      <section>
        <div className="overflow-x-auto">
          <table className="v-audit-table">
            <thead>
              <tr>
                <th className="w-16">순위</th>
                <th>예측자</th>
                <th>티어</th>
                <th className="v-numeric">평판 LP</th>
                <th className="v-numeric">20일 평균 점수</th>
                <th className="v-numeric">방향 적중률</th>
                <th className="v-numeric">평균 오차율</th>
                <th className="v-numeric">검증 횟수</th>
                <th className="v-numeric">최근 예측</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-12 text-center v-caption"
                    style={{ color: 'var(--v-mute)' }}
                  >
                    해당 티어에 속한 예측자가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const isMe = currentUser?.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      style={{
                        backgroundColor: isMe
                          ? 'var(--v-canvas-soft)'
                          : undefined,
                      }}
                    >
                      <td className="v-mono font-bold">
                        <span
                          style={{
                            color:
                              u.rank <= 3 ? 'var(--v-ink)' : 'var(--v-mute)',
                          }}
                        >
                          {u.rank}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() => navigate(`/u/${u.handle}`)}
                          className="text-left group inline-flex items-baseline gap-2"
                        >
                          <span
                            className="v-body-sm-strong group-hover:underline"
                            style={{ color: 'var(--v-ink)' }}
                          >
                            @{u.handle}
                          </span>
                          <span
                            className="v-caption text-xs"
                            style={{ color: 'var(--v-mute)' }}
                          >
                            {u.name}
                          </span>
                        </button>
                      </td>

                      <td>
                        <span className="inline-flex items-center gap-1.5 v-caption font-semibold">
                          <span
                            className="w-2 h-2 rounded-[1.5px] flex-shrink-0"
                            style={{ backgroundColor: u.tierInfo.accentHex }}
                          />
                          <span style={{ color: 'var(--v-ink)' }}>
                            {u.tierInfo.krTitle}
                          </span>
                        </span>
                      </td>

                      <td className="v-numeric font-semibold">
                        <span style={{ color: 'var(--v-ink)' }}>
                          {u.liveElo.toLocaleString('en-US')} LP
                        </span>
                        {u.netLpDelta !== 0 && (
                          <span
                            className="ml-1.5 text-xs"
                            style={{
                              color:
                                u.netLpDelta >= 0
                                  ? 'var(--v-bull)'
                                  : 'var(--v-bear)',
                            }}
                          >
                            ({formatSignedLp(u.netLpDelta)})
                          </span>
                        )}
                      </td>

                      <td
                        className="v-numeric font-semibold"
                        style={{ color: 'var(--v-ink)' }}
                      >
                        {u.score.toFixed(1)}점
                      </td>

                      <td
                        className="v-numeric font-semibold"
                        style={{ color: 'var(--v-bull)' }}
                      >
                        {u.accuracy}
                      </td>

                      <td
                        className="v-numeric"
                        style={{ color: 'var(--v-mute)' }}
                      >
                        ±{u.avgMae}
                      </td>

                      <td
                        className="v-numeric"
                        style={{ color: 'var(--v-body)' }}
                      >
                        {u.verifiedCount}회
                      </td>

                      <td className="v-numeric">
                        {u.latestForecast ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/f/${u.latestForecast!.id}`)
                            }
                            className="v-btn-secondary h-6 px-2.5 text-[11px]"
                          >
                            궤적 보기 <ArrowUpRight size={11} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigate(`/u/${u.handle}`)}
                            className="v-btn-secondary h-6 px-2.5 text-[11px]"
                          >
                            기록 보기
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
