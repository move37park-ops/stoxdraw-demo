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

  // Bullish vs Bearish count
  let bullCount = 0;
  let bearCount = 0;
  matched.forEach(f => {
    let target = f.basePrice;
    if (f.mode === 'path' && f.path && f.path.length > 0) {
      target = f.path[f.path.length - 1].price;
    } else if (f.mode === 'breakout' && f.breakout) {
      target = f.breakout.price;
    }
    if (target >= basePrice) bullCount++;
    else bearCount++;
  });

  const total = matched.length;
  const bullRatio = total > 0 ? (bullCount / total) * 100 : 50;

  let skewText = '균형적 (Neutral)';
  let skewColor = 'text-zinc-300';
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
    <div className="w-full p-4 sm:p-5 rounded-2xl bg-[#0c0e14] border border-[#1b1f2b]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1b1f2b]">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-sky-400" />
          <h3 className="font-bold text-white text-sm">
            군중 기대치 분포 (Expectation Distribution)
          </h3>
        </div>
        <span className="text-xs text-zinc-400 font-mono">
          총 {total}개 예측 표본
        </span>
      </div>

      {/* Skew & Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="p-3 rounded-xl bg-[#12151f] border border-[#202534]">
          <div className="text-[11px] text-zinc-400 flex items-center gap-1 mb-1">
            <Compass size={13} className="text-sky-400" />
            <span>시장 센티먼트 왜도 (Skewness)</span>
          </div>
          <div className={`text-sm font-bold ${skewColor}`}>
            {skewText}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">
            Bull {bullRatio.toFixed(0)}% vs Bear {(100 - bullRatio).toFixed(0)}%
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#12151f] border border-[#202534]">
          <div className="text-[11px] text-zinc-400 flex items-center gap-1 mb-1">
            <TrendingUp size={13} className="text-emerald-400" />
            <span>현재 기준가</span>
          </div>
          <div className="text-sm font-bold font-mono text-white">
            ${basePrice.toFixed(2)}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">
            평가 기간: {horizon === '5D' ? '5거래일 (1주일)' : '30거래일 (약 1.5개월)'}
          </div>
        </div>
      </div>

      {/* Histogram Bars */}
      <div className="space-y-2.5">
        <div className="text-xs font-semibold text-zinc-300 mb-1">
          목표 가격 구간별 군중 밀집도 (Price Density)
        </div>

        {buckets.map((b, i) => {
          const isHighest = b.pct === maxPct && b.pct > 0;

          return (
            <div key={i} className="flex items-center gap-2 sm:gap-3 text-xs">
              <span className="w-24 sm:w-28 text-right font-mono text-zinc-400 text-[11px] truncate">
                {b.label}
              </span>

              <div className="flex-1 h-6 rounded-md bg-[#141722] p-0.5 relative overflow-hidden flex items-center">
                <div
                  className={`h-full rounded transition-all duration-500 ${
                    isHighest
                      ? 'bg-gradient-to-r from-sky-500 to-emerald-400'
                      : 'bg-gradient-to-r from-zinc-700 to-zinc-600'
                  }`}
                  style={{ width: `${Math.max(b.pct, 2)}%` }}
                />
                <span className="absolute right-2 text-[10px] font-mono text-zinc-300">
                  {b.count}명 ({b.pct}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quant Insight Footer */}
      <div className="mt-5 p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300 flex items-start gap-2">
        <AlertCircle size={16} className="text-sky-400 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px]">
          <strong>퀀트 인사이트:</strong> 이 기대치 분포 데이터는 단순 가격 예측을 넘어
          시장의 과열도와 꼬리 위험(Tail Risk)을 수치화한 데이터 객체로 기록됩니다.
        </p>
      </div>
    </div>
  );
}
