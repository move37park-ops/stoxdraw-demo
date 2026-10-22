import { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { repository } from '../../data/localRepository';
import { getStockHistory } from '../../data/market';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecast } from '../../domain/resolution';
import { getEloTierInfo, DEFAULT_ELO, formatSignedLp } from '../../domain/elo';
import { CompactForecastCard } from '../../components/CompactForecastCard';

interface LandingOutlookSectionProps {
  currentDateStr?: string;
}

export function LandingOutlookSection({ currentDateStr = '2026-10-05' }: LandingOutlookSectionProps) {
  const navigate = useNavigate();

  const featuredForecasts = useMemo(() => {
    const all = repository.listFeed('all', currentDateStr);
    const nvda = all.find(f => f.ticker === 'NVDA');
    const tsla = all.find(f => f.ticker === 'TSLA');
    const aapl = all.find(f => f.ticker === 'AAPL');
    return [nvda, tsla, aapl].filter((f): f is NonNullable<typeof f> => Boolean(f));
  }, [currentDateStr]);

  const topNavigators = useMemo(() => {
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
  }, [currentDateStr]);

  return (
    <div className="w-full bg-black">
      
      {/* 1. Live Forecasts & Elo Leaderboard Preview */}
      <section className="py-12 sm:py-16 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left 7 Cols: Live Forecast Deployments */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white tracking-tight">
                  실시간 예측 등록 현황
                </h2>
                <NavLink
                  to="/arena"
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white transition"
                >
                  <span>마켓 전체</span>
                  <ArrowRight size={13} />
                </NavLink>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800 overflow-hidden">
                {featuredForecasts.map(f => (
                  <CompactForecastCard
                    key={f.id}
                    forecast={f}
                    currentDateStr={currentDateStr}
                    borderless={true}
                  />
                ))}
              </div>
            </div>

            {/* Right 5 Cols: Top Elo Participants */}
            <div className="lg:col-span-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Elo 랭킹 TOP 4
                </h2>
                <NavLink
                  to="/leaderboard"
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white transition"
                >
                  <span>리더보드</span>
                  <ArrowRight size={13} />
                </NavLink>
              </div>

              <div className="rounded-lg bg-zinc-950 border border-zinc-800 divide-y divide-zinc-800 overflow-hidden">
                {topNavigators.map((nav, idx) => (
                  <div
                    key={nav.id}
                    onClick={() => navigate(`/u/${nav.handle}`)}
                    className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-zinc-900/40 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-5 text-xs font-mono font-medium text-zinc-500 tabular-nums">
                        #{idx + 1}
                      </span>
                      <img
                        src={nav.avatarUrl}
                        alt={nav.name}
                        className="w-8 h-8 rounded-full object-cover border border-zinc-800 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs sm:text-sm font-medium text-white truncate">
                            {nav.name}
                          </span>
                          <CheckCircle2 size={12} className="text-zinc-400 flex-shrink-0" />
                        </div>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          @{nav.handle}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 font-mono tabular-nums flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${nav.tierInfo.badgeClass}`}>
                        {nav.tierInfo.tier}
                      </span>
                      <div className="text-right">
                        <div className="text-xs sm:text-sm font-semibold text-white">
                          {nav.liveElo.toLocaleString()} LP
                        </div>
                        {nav.deltaSum !== 0 && (
                          <div className={`text-[10px] font-medium ${nav.deltaSum >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatSignedLp(nav.deltaSum)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. 3-Step Protocol (1px Hairline Grid) */}
      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-800 overflow-hidden">
            <div className="p-5">
              <div className="text-[11px] font-mono text-zinc-500 mb-1">01 · DRAW</div>
              <h3 className="text-sm font-semibold text-white mb-1.5">5거래일 주가 경로 작도</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                월가 목표가와 옵션 지지선이 표시된 차트 위에 향후 5일간의 예상 주가 경로를 그립니다.
              </p>
            </div>

            <div className="p-5">
              <div className="text-[11px] font-mono text-zinc-500 mb-1">02 · CONSENSUS & STAKE</div>
              <h3 className="text-sm font-semibold text-white mb-1.5">시장 컨센서스 및 LP 스테이킹</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                예측 확정 즉시 참여자 중앙값 컨센서스가 공개되고, 예측 난이도에 따른 예상 Elo 변동폭(+Win / -Loss)이 책정됩니다.
              </p>
            </div>

            <div className="p-5">
              <div className="text-[11px] font-mono text-zinc-500 mb-1">03 · SETTLEMENT</div>
              <h3 className="text-sm font-semibold text-white mb-1.5">실제 종가 정산 및 티어 승급</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                만기일 실제 종가 오차율(100점 만점)을 정밀 계산하여 Elo 레이팅(Bronze → Master)이 자동 갱신됩니다.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

export default LandingOutlookSection;
