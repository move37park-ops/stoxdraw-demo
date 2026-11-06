import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  ShieldCheck,
  Share2,
  History,
  Play,
  ArrowUpRight,
} from 'lucide-react';
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
import { formatPct } from '../../domain/format';
import { ShareTicketModal } from '../../components/ShareTicketModal';
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
  specialty: string;
  latestForecast?: Forecast;
}

const USER_META: Record<
  string,
  {
    specialty: string;
    defaultScore: number;
    baseElo: number;
  }
> = {
  u_quant: {
    specialty: 'BTC/USDT 20일 변동성 정규화 경로 & 파생상품 감마 변곡점',
    defaultScore: 91.4,
    baseElo: 1890,
  },
  u_alpha: {
    specialty: '현물 ETF 수급 사이클 & 온체인 장기보유자 물량 소화 분석',
    defaultScore: 87.8,
    baseElo: 1820,
  },
  u_satoshi: {
    specialty: '무기한 선물 펀딩비 과열 해소 & 눌림목 반등 변곡점 포착',
    defaultScore: 83.5,
    baseElo: 1640,
  },
  u_bull: {
    specialty: '글로벌 유동성(M2) 및 매크로 추세 추종 20일 시나리오',
    defaultScore: 79.2,
    baseElo: 1460,
  },
  u_macro: {
    specialty: '주요 매물대 지지·저항 리테스트 및 박스권 리스크 관리',
    defaultScore: 73.6,
    baseElo: 1240,
  },
  u_rookie: {
    specialty: '연습 위주 추세 예측',
    defaultScore: 65.0,
    baseElo: 980,
  },
};

const TIER_FILTERS: { id: 'ALL' | EloTier; label: string }[] = [
  { id: 'ALL', label: '전체 티어' },
  { id: 'DIAMOND', label: '다이아몬드 (1800+)' },
  { id: 'PLATINUM', label: '플래티넘 (1600+)' },
  { id: 'GOLD', label: '골드 (1400+)' },
  { id: 'SILVER', label: '실버 (1200+)' },
  { id: 'BRONZE', label: '브론즈 (1000+)' },
];

export function LeaderboardPage({ currentDateStr }: LeaderboardPageProps) {
  const navigate = useNavigate();
  const [tierFilter, setTierFilter] = useState<'ALL' | EloTier>('ALL');
  const [shareModalForecast, setShareModalForecast] =
    useState<Forecast | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = repository.subscribe(() => setTick(t => t + 1));
    return () => unsub();
  }, []);

  const currentUser = getCurrentUser();
  const anonId = getOrCreateAnonId();
  const allForecasts = repository.listFeed('all', currentDateStr);

  const myForecasts = useMemo(() => {
    return currentUser
      ? allForecasts.filter(f => f.authorId === currentUser.id)
      : allForecasts.filter(f => f.anonId === anonId);
  }, [allForecasts, currentUser, anonId]);

  const rankedUsers: RankedUser[] = useMemo(() => {
    const rawUsers = repository.listAllUsers();
    const btcBars = getBtcHistoryBars().filter(b => b.date <= currentDateStr);

    const scored = rawUsers.map(u => {
      const forecasts = repository.listByUser(u.id);
      const resolved = forecasts.filter(
        f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED'
      );

      const meta = USER_META[u.id] || {
        specialty: 'BTC/USDT 20일 시계열 예측',
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
        specialty: meta.specialty,
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
  const myElo = currentUser?.elo ?? DEFAULT_ELO;
  const myTierInfo = getEloTierInfo(myElo);
  const topThreeUsers = rankedUsers.slice(0, 3);

  return (
    <div className="w-full relative">
      <span className="v-crosshair -top-[5px] -left-[6px]" aria-hidden="true" />
      <span className="v-crosshair -top-[5px] -right-[6px]" aria-hidden="true" />

      {/* ZONE 1: Track & Prove Masthead Band */}
      <section
        className="relative px-5 py-4 flex flex-wrap items-center justify-between gap-4"
        style={{ borderBottom: '1px solid var(--v-hairline)' }}
      >
        <span className="v-crosshair -bottom-[6px] -left-[6px]" aria-hidden="true" />
        <span className="v-crosshair -bottom-[6px] -right-[6px]" aria-hidden="true" />

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="v-display-md" style={{ color: 'var(--v-ink)' }}>
              리더보드
            </h1>
            <span
              className="v-caption-mono text-xs font-semibold px-2 py-0.5 rounded-[4px]"
              style={{
                backgroundColor: 'var(--v-canvas-soft-2)',
                color: myTierInfo.accentHex,
              }}
            >
              내 티어: {myTierInfo.krTitle} · {myElo} LP
            </span>
          </div>
          <p className="v-caption mt-0.5" style={{ color: 'var(--v-mute)' }}>
            20일 예측의 오차와 방향으로 매긴 순위입니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/studio')}
            className="v-btn-primary h-8 px-3.5 text-xs font-semibold"
          >
            실전 모드
          </button>
          <button
            type="button"
            onClick={() => navigate('/practice')}
            className="v-btn-secondary h-8 px-3 text-xs"
          >
            <Play size={11} />
            연습 모드
          </button>
        </div>
      </section>

      {/* ZONE 2: Interactive 5-Column Tier Ladder Strip (Bronze ~ Diamond) */}
      <section
        className="relative grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[var(--v-hairline)]"
        style={{ borderBottom: '1px solid var(--v-hairline)' }}
      >
        <span className="v-crosshair -bottom-[6px] -left-[6px]" aria-hidden="true" />
        <span className="v-crosshair -bottom-[6px] -right-[6px]" aria-hidden="true" />

        {(
          [
            {
              tier: 'BRONZE' as EloTier,
              kr: '브론즈',
              range: '1,000+ LP',
              desc: '입문',
              color: '#71717a',
            },
            {
              tier: 'SILVER' as EloTier,
              kr: '실버',
              range: '1,200+ LP',
              desc: '기본 등급',
              color: '#a1a1aa',
            },
            {
              tier: 'GOLD' as EloTier,
              kr: '골드',
              range: '1,400+ LP',
              desc: '방향 적중',
              color: '#f5a623',
            },
            {
              tier: 'PLATINUM' as EloTier,
              kr: '플래티넘',
              range: '1,600+ LP',
              desc: '상위권',
              color: '#00e599',
            },
            {
              tier: 'DIAMOND' as EloTier,
              kr: '다이아몬드',
              range: '1,800+ LP',
              desc: '최상위',
              color: '#3291ff',
            },
          ] as const
        ).map(item => {
          const isSelected = tierFilter === item.tier;
          const isMyTier = myTierInfo.tier === item.tier;
          return (
            <button
              key={item.tier}
              type="button"
              onClick={() =>
                setTierFilter(prev => (prev === item.tier ? 'ALL' : item.tier))
              }
              className="p-4 text-left space-y-1 transition-colors"
              style={{
                backgroundColor: isSelected
                  ? 'var(--v-canvas-soft-2)'
                  : isMyTier
                  ? 'var(--v-canvas-soft)'
                  : 'var(--v-canvas)',
              }}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className="v-body-sm-strong flex items-center gap-1.5"
                  style={{ color: 'var(--v-ink)' }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.kr}
                </span>
                {isMyTier ? (
                  <span
                    className="v-caption-mono text-xs font-bold px-1.5 py-0.5 rounded-[3px]"
                    style={{
                      backgroundColor: 'var(--v-canvas-soft-2)',
                      color: item.color,
                      boxShadow: 'var(--v-shadow-border)',
                    }}
                  >
                    MY TIER
                  </span>
                ) : (
                  <span
                    className="v-caption-mono text-xs"
                    style={{ color: item.color }}
                  >
                    {item.tier}
                  </span>
                )}
              </div>
              <p
                className="v-caption-mono text-[11px]"
                style={{ color: 'var(--v-body)' }}
              >
                {item.range}
              </p>
              <p
                className="v-caption text-[11px]"
                style={{ color: 'var(--v-mute)' }}
              >
                {item.desc}
              </p>
            </button>
          );
        })}
      </section>

      {/* ZONE 2.5: Top 3 Forecasters Podium Grid */}
      {topThreeUsers.length > 0 && (
        <section style={{ borderBottom: '1px solid var(--v-hairline)' }}>
          <div
            className="px-5 py-2.5 flex items-center justify-between"
            style={{
              backgroundColor: 'var(--v-canvas-soft)',
              borderBottom: '1px solid var(--v-hairline)',
            }}
          >
            <span
              className="v-caption font-semibold"
              style={{ color: 'var(--v-ink)' }}
            >
              TOP 3 명예의 전당 (실시간 LP & 정확도 상위 랭커)
            </span>
            <span
              className="v-caption-mono text-xs"
              style={{ color: 'var(--v-mute)' }}
            >
              20D 정량 검증 완료
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--v-hairline)]">
            {topThreeUsers.map((u, idx) => (
              <div
                key={u.id}
                className="p-5 flex flex-col justify-between space-y-3"
                style={{
                  backgroundColor:
                    idx === 0 ? 'var(--v-canvas-soft)' : 'var(--v-canvas)',
                }}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className="v-caption-mono text-xs font-bold px-2 py-0.5 rounded-[4px]"
                      style={{
                        backgroundColor:
                          idx === 0
                            ? 'var(--v-primary)'
                            : 'var(--v-canvas-soft-2)',
                        color:
                          idx === 0 ? 'var(--v-on-primary)' : 'var(--v-ink)',
                      }}
                    >
                      RANK #{u.rank}
                    </span>
                    <span
                      className="v-caption-mono text-xs font-bold"
                      style={{ color: u.tierInfo.accentHex }}
                    >
                      {u.tierInfo.krTitle} · {u.liveElo} LP
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <button
                      type="button"
                      onClick={() => navigate(`/u/${u.handle}`)}
                      className="v-body-sm-strong hover:underline text-left"
                      style={{ color: 'var(--v-ink)' }}
                    >
                      @{u.handle}
                    </button>
                    <span
                      className="v-mono text-sm font-bold"
                      style={{ color: 'var(--v-bull)' }}
                    >
                      평균 {u.score}점 (적중 {u.accuracy})
                    </span>
                  </div>

                  {/* Score Gauge */}
                  <div
                    className="w-full h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--v-canvas-soft-2)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, u.score)}%`,
                        backgroundColor: u.tierInfo.accentHex,
                      }}
                    />
                  </div>

                  <p
                    className="v-caption text-[11px] line-clamp-1"
                    style={{ color: 'var(--v-mute)' }}
                  >
                    {u.specialty}
                  </p>
                </div>

                <div className="pt-2.5 flex items-center justify-between border-t border-[var(--v-hairline-subtle)]">
                  <span
                    className="v-caption-mono text-xs"
                    style={{ color: 'var(--v-mute)' }}
                  >
                    오차율 ±{u.avgMae} · 검증 {u.verifiedCount}회
                  </span>
                  {u.latestForecast ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/f/${u.latestForecast!.id}`)}
                      className="v-btn-secondary h-6 px-2.5 text-[11px]"
                    >
                      상세 보기 <ArrowUpRight size={11} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(`/u/${u.handle}`)}
                      className="v-btn-secondary h-6 px-2.5 text-[11px]"
                    >
                      프로필
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ZONE 3: My Verifiable Record & Version Ledger */}
      <section style={{ borderBottom: '1px solid var(--v-hairline)' }}>
        <div
          className="px-5 py-3 flex flex-wrap items-center justify-between gap-2"
          style={{
            backgroundColor: 'var(--v-canvas-soft)',
            borderBottom: '1px solid var(--v-hairline)',
          }}
        >
          <h2
            className="v-body-sm-strong flex items-center gap-2"
            style={{ color: 'var(--v-ink)' }}
          >
            <History size={13} />
            내 예측 기록 (@{userHandle})
          </h2>
          <span className="v-caption" style={{ color: 'var(--v-mute)' }}>
            최초본(v1) 및 수정본(v2+) 보존
          </span>
        </div>

        {myForecasts.length === 0 ? (
          <div className="p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="v-body-sm-strong" style={{ color: 'var(--v-ink)' }}>
                아직 기록이 없습니다.
              </p>
              <p className="v-caption mt-0.5" style={{ color: 'var(--v-mute)' }}>
                첫 예측을 제출해 보세요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/studio')}
              className="v-btn-primary h-8 px-4 text-xs"
            >
              예측하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--v-hairline)]">
            {myForecasts.map(fc => {
              const path = fc.path || [];
              const endP =
                path.length > 0 ? path[path.length - 1].price : fc.basePrice;
              const pct =
                fc.basePrice > 0
                  ? ((endP - fc.basePrice) / fc.basePrice) * 100
                  : 0;
              const verCount = fc.versions?.length ?? 1;

              return (
                <div
                  key={fc.id}
                  className="p-5 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span
                        className="v-caption-mono font-semibold"
                        style={{ color: 'var(--v-link)' }}
                      >
                        {fc.ticker} · 20일 예측 · 버전 v{verCount} 보존
                      </span>
                      <span
                        className="v-mono text-sm font-bold"
                        style={{
                          color: pct >= 0 ? 'var(--v-bull)' : 'var(--v-bear)',
                        }}
                      >
                        목표 ${Math.round(endP).toLocaleString('en-US')} (
                        {formatPct(pct)})
                      </span>
                    </div>
                    <p className="v-caption" style={{ color: 'var(--v-body)' }}>
                      {fc.comment}
                    </p>
                  </div>

                  <div className="pt-3 flex items-center justify-between gap-2 border-t border-[var(--v-hairline-subtle)]">
                    <span
                      className="v-caption-mono text-xs"
                      style={{ color: 'var(--v-mute)' }}
                    >
                      기준일 {fc.baseDate} (${fc.basePrice.toLocaleString('en-US')})
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShareModalForecast(fc)}
                        className="v-btn-secondary h-7 px-2.5 text-xs"
                      >
                        <Share2 size={11} />
                        공유 카드 이미지
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/f/${fc.id}`)}
                        className="v-btn-secondary h-7 px-2.5 text-xs"
                      >
                        <ShieldCheck size={11} />
                        상세
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ZONE 4: Official Forecaster Leaderboard Audit Table */}
      <section>
        <div
          className="px-5 py-3 flex flex-wrap items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--v-canvas-soft)',
            borderBottom: '1px solid var(--v-hairline)',
          }}
        >
          <h2
            className="v-body-sm-strong flex items-center gap-2"
            style={{ color: 'var(--v-ink)' }}
          >
            <Trophy size={14} style={{ color: 'var(--v-warning)' }} />
            BTC/USDT 20일 공식 검증 리더보드
          </h2>

          <div className="flex flex-wrap items-center gap-1">
            {TIER_FILTERS.map(tf => {
              const active = tierFilter === tf.id;
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTierFilter(tf.id)}
                  className="px-2.5 py-1 rounded-[5px] text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: active
                      ? 'var(--v-primary)'
                      : 'var(--v-canvas)',
                    color: active ? 'var(--v-on-primary)' : 'var(--v-mute)',
                    boxShadow: active ? 'none' : 'var(--v-shadow-border)',
                  }}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="v-audit-table">
            <thead>
              <tr>
                <th>순위</th>
                <th>포캐스터</th>
                <th>티어 등급 (브론즈~다이아몬드)</th>
                <th>주요 변곡점 분석 스타일</th>
                <th className="v-numeric">평판 LP</th>
                <th className="v-numeric">20D 채점 평균</th>
                <th className="v-numeric">방향 적중률</th>
                <th className="v-numeric">평균 오차율</th>
                <th className="v-numeric">기록</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id}>
                  <td className="v-mono font-bold">#{u.rank}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => navigate(`/u/${u.handle}`)}
                      className="text-left group"
                    >
                      <p
                        className="v-body-sm-strong group-hover:underline"
                        style={{ color: 'var(--v-ink)' }}
                      >
                        @{u.handle}
                      </p>
                      <p
                        className="v-caption text-[11px]"
                        style={{ color: 'var(--v-mute)' }}
                      >
                        {u.name}
                      </p>
                    </button>
                  </td>
                  <td>
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] v-caption-mono font-semibold"
                      style={{
                        backgroundColor: 'var(--v-canvas-soft)',
                        boxShadow: 'var(--v-shadow-border)',
                        color: 'var(--v-ink)',
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: u.tierInfo.accentHex }}
                      />
                      {u.tierInfo.krTitle} ({u.tierInfo.tier})
                    </span>
                  </td>
                  <td>
                    <span
                      className="v-caption"
                      style={{ color: 'var(--v-body)' }}
                    >
                      {u.specialty}
                    </span>
                  </td>
                  <td className="v-numeric font-semibold">
                    <span>{u.liveElo} LP</span>
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
                  <td className="v-numeric">
                    <div className="inline-flex flex-col items-end gap-1">
                      <span
                        className="font-bold"
                        style={{ color: 'var(--v-link)' }}
                      >
                        {u.score}점
                      </span>
                      <span
                        className="w-16 h-1.5 rounded-full overflow-hidden block"
                        style={{ backgroundColor: 'var(--v-canvas-soft-2)' }}
                      >
                        <span
                          className="h-full block rounded-full"
                          style={{
                            width: `${Math.min(100, u.score)}%`,
                            backgroundColor: u.tierInfo.accentHex,
                          }}
                        />
                      </span>
                    </div>
                  </td>
                  <td
                    className="v-numeric font-semibold"
                    style={{ color: 'var(--v-bull)' }}
                  >
                    {u.accuracy}
                  </td>
                  <td className="v-numeric" style={{ color: 'var(--v-mute)' }}>
                    ±{u.avgMae}
                  </td>
                  <td className="v-numeric">
                    {u.latestForecast ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setShareModalForecast(u.latestForecast!)
                          }
                          className="v-btn-secondary h-6 px-2 text-[11px]"
                          title="공유 카드 보기"
                        >
                          <Share2 size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/f/${u.latestForecast!.id}`)}
                          className="v-btn-secondary h-6 px-2 text-[11px]"
                        >
                          상세 <ArrowUpRight size={11} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate(`/u/${u.handle}`)}
                        className="v-btn-secondary h-6 px-2 text-[11px]"
                      >
                        프로필
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {shareModalForecast && (
        <ShareTicketModal
          isOpen={Boolean(shareModalForecast)}
          onClose={() => setShareModalForecast(null)}
          forecast={shareModalForecast}
          authorHandle={
            shareModalForecast.authorId
              ? repository.getUser(shareModalForecast.authorId)?.handle ||
                userHandle
              : userHandle
          }
          authorElo={
            shareModalForecast.authorId
              ? repository.getUser(shareModalForecast.authorId)?.elo ??
                DEFAULT_ELO
              : DEFAULT_ELO
          }
        />
      )}
    </div>
  );
}

export default LeaderboardPage;
