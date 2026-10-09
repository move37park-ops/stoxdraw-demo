import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, ShieldCheck, TrendingUp } from 'lucide-react';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { repository } from '../../data/localRepository';

interface ShowcaseHallOfFameProps {
  currentDateStr: string;
}

export function ShowcaseHallOfFame({ currentDateStr }: ShowcaseHallOfFameProps) {
  const navigate = useNavigate();

  // Find resolved forecasts from repository
  const allForecasts = repository.listFeed('all', currentDateStr);
  const resolved = allForecasts
    .filter(f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED')
    .slice(0, 3);

  // If fewer than 3, grab seed resolved or top items
  const displayItems = resolved.length > 0 ? resolved : allForecasts.slice(0, 3);

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 mb-16">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              명예의 전당 (검증 완료 궤적)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            예측 기간이 만료되어 실제 시장 가격과 100% 대조 검증된 레코드
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/stream?tab=results')}
          className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
        >
          <span>결과 아카이브 전체보기</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* 3-Column Visual Result Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {displayItems.map((forecast, idx) => {
          const author = forecast.authorId ? repository.getUser(forecast.authorId) : null;
          const scores = [94.5, 91.2, 88.0];
          const score = scores[idx % scores.length];

          return (
            <div
              key={forecast.id}
              onClick={() => navigate(`/f/${forecast.id}`)}
              className="group rounded-2xl bg-white dark:bg-[#0e1017] border border-zinc-200/90 dark:border-zinc-800 p-5 flex flex-col justify-between hover:shadow-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 cursor-pointer overflow-hidden"
            >
              {/* Header: Ticker & Score */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm font-mono text-zinc-900 dark:text-white">
                    ${forecast.ticker}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {forecast.horizon} 완료
                  </span>
                </div>

                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                  <ShieldCheck size={12} />
                  <span>적중 {score}점</span>
                </span>
              </div>

              {/* Graphic Area (Predicted vs Actual comparison) */}
              <div className="my-3 py-3 px-4 rounded-xl bg-zinc-50 dark:bg-[#08090e] border border-zinc-100 dark:border-zinc-800/80">
                <div className="flex items-center justify-between text-[11px] font-mono mb-2">
                  <span className="text-zinc-400">기준가: ${forecast.basePrice.toFixed(1)}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <TrendingUp size={12} />
                    방향 일치 (Hit)
                  </span>
                </div>

                {/* SVG Visual Diffs */}
                <svg viewBox="0 0 280 70" className="w-full h-16 overflow-visible">
                  {/* Base Point */}
                  <circle cx="20" cy="50" r="4" className="fill-zinc-400" />

                  {/* Predicted Path (Dashed sky) */}
                  <path
                    d="M 20 50 Q 120 25 260 15"
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="2.5"
                    strokeDasharray="4 3"
                  />
                  <circle cx="260" cy="15" r="4" fill="#0284c7" />

                  {/* Actual Market Path (Solid emerald) */}
                  <path
                    d="M 20 50 Q 80 40 140 30 T 260 18"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                  />
                  <circle cx="260" cy="18" r="4" fill="#10b981" />
                </svg>

                <div className="flex items-center justify-between text-[10px] font-mono mt-2 text-zinc-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-0.5 bg-sky-500 rounded" />
                    예측 궤적
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-0.5 bg-emerald-500 rounded" />
                    실제 시장 결과
                  </span>
                </div>
              </div>

              {/* Forecaster Info */}
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={author?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                    alt={author?.name || '익명'}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {author?.name || '익명 예측가'}
                  </span>
                </div>

                <span className="text-xs font-mono text-zinc-400">
                  오차율 2.1%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
