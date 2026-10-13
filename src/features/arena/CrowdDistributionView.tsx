import { useMemo } from 'react';
import type { Forecast, Horizon } from '../../domain/types';
import { computePriceDistribution } from '../../domain/arena';
import { BarChart3, TrendingUp, AlertCircle, Compass } from 'lucide-react';

interface CrowdDistributionViewProps {
  ticker: string;
  horizon: Horizon;
  basePrice: number;
  forecasts: Forecast[];
}

export function CrowdDistributionView({
  ticker,
  horizon,
  basePrice,
  forecasts,
}: CrowdDistributionViewProps) {
  const buckets = useMemo(
    () => computePriceDistribution(ticker, forecasts, basePrice, horizon),
    [ticker, forecasts, basePrice, horizon]
  );

  const matched = forecasts.filter(f => f.ticker === ticker && f.horizon === horizon);
  const maxPct = Math.max(...buckets.map(b => b.pct), 1);

  // Bullish count
  let bullCount = 0;
  matched.forEach(f => {
    let target = f.basePrice;
    if (f.mode === 'path' && f.path && f.path.length > 0) {
      target = f.path[f.path.length - 1].price;
    } else if (f.mode === 'breakout' && f.breakout) {
      target = f.breakout.price;
    }
    if (target >= basePrice) bullCount++;
  });

  const total = matched.length;
  const bullRatio = total > 0 ? (bullCount / total) * 100 : 50;

  let skewText = '균형적 (Neutral)';
  let skewColor = 'text-zinc-200';
  if (bullRatio >= 65) {
    skewText = '극단적 상방 쏠림 (Extreme Bull Skew)';
    skewColor = 'text-emerald-400';
  } else if (bullRatio >= 55) {
    skewText = '온건한 상방 편향 (Moderate Bull Skew)';
    skewColor = 'text-emerald-400';
  } else if (bullRatio <= 35) {
    skewText = '극단적 하방 쏠림 (Extreme Bear Skew)';
    skewColor = 'text-rose-400';
  } else if (bullRatio <= 45) {
    skewText = '온건한 하방 편향 (Moderate Bear Skew)';
    skewColor = 'text-rose-400';
  }

  return (
    <div className="w-full p-6 sm:p-8 rounded-2xl bg-[#0d0d10] border border-white/10">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <BarChart3 size={18} className="text-[#DFC15D]" />
          <h3 className="font-bold text-white text-base">
            군중 기대치 분포 (Expectation Distribution)
          </h3>
        </div>
        <span className="text-xs text-zinc-400 font-mono">
          총 {total}개 예측 표본
        </span>
      </div>

      {/* Skew & Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-[#141418] border border-white/10">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5 mb-1.5 font-medium">
            <Compass size={14} className="text-zinc-300" />
            <span>시장 센티먼트 왜도 (Skewness)</span>
          </div>
          <div className={`text-base font-bold ${skewColor}`}>
            {skewText}
          </div>
          <div className="text-xs text-zinc-400 mt-1 font-mono">
            Bull {bullRatio.toFixed(0)}% vs Bear {(100 - bullRatio).toFixed(0)}%
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#141418] border border-white/10">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5 mb-1.5 font-medium">
            <TrendingUp size={14} className="text-emerald-400" />
            <span>현재 기준가</span>
          </div>
          <div className="text-base font-bold font-mono text-white">
            ${basePrice.toFixed(2)}
          </div>
          <div className="text-xs text-zinc-400 mt-1 font-mono">
            평가 기간: {horizon === '5D' ? '5거래일 (1주일)' : '30거래일 (약 1.5개월)'}
          </div>
        </div>
      </div>

      {/* Histogram Bars */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-zinc-300 mb-2">
          목표 가격 구간별 군중 밀집도 (Price Density)
        </div>

        {buckets.map((b, i) => {
          const isHighest = b.pct === maxPct && b.pct > 0;

          return (
            <div key={i} className="flex items-center gap-3 text-xs">
              <span className="w-28 sm:w-32 text-right font-mono text-zinc-400 text-xs truncate">
                {b.label}
              </span>

              <div className="flex-1 h-7 rounded-lg bg-[#181820] border border-white/5 p-0.5 relative overflow-hidden flex items-center">
                <div
                  className={`h-full rounded-md transition-all duration-500 ${
                    isHighest
                      ? 'bg-emerald-500'
                      : 'bg-zinc-700'
                  }`}
                  style={{ width: `${Math.max(b.pct, 2)}%` }}
                />
                <span className="absolute right-2.5 text-[11px] font-mono font-medium text-zinc-200">
                  {b.count}명 ({b.pct}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quant Insight Footer */}
      <div className="mt-6 p-4 rounded-xl bg-[#141418] border border-white/10 text-xs text-zinc-300 flex items-start gap-2.5">
        <AlertCircle size={17} className="text-zinc-400 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed text-xs">
          <strong className="text-white">퀀트 인사이트:</strong> 이 기대치 분포 데이터는 단순 가격 예측을 넘어
          시장의 과열도와 꼬리 위험(Tail Risk)을 수치화한 데이터 객체로 기록됩니다.
        </p>
      </div>
    </div>
  );
}
