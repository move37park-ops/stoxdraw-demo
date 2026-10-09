import { useNavigate } from 'react-router-dom';
import { ArrowRight, Swords, ThumbsUp, TrendingUp, TrendingDown } from 'lucide-react';
import type { Forecast } from '../../domain/types';
import { repository } from '../../data/localRepository';
import { formatPct } from '../../domain/format';

interface ShowcaseBattleSectionProps {
  forecasts: Forecast[];
  searchFilter: string;
}

export function ShowcaseBattleSection({
  forecasts,
  searchFilter,
}: ShowcaseBattleSectionProps) {
  const navigate = useNavigate();

  // Filter forecasts
  const filtered = forecasts.filter((f) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      f.ticker.toLowerCase().includes(q) ||
      f.comment.toLowerCase().includes(q) ||
      (f.authorId && f.authorId.toLowerCase().includes(q))
    );
  }).slice(0, 6);

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 mb-16">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            실시간 예측 배틀
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            지금 가장 뜨거운 논쟁이 벌어지고 있는 상위 포캐스터들의 궤적
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/arena')}
          className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
        >
          <span>전체 배틀 보기</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* 3-Column / 6-Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((forecast) => {
          const author = forecast.authorId ? repository.getUser(forecast.authorId) : null;
          const likesCount = repository.getLikesCount(forecast.id);
          const isLiked = repository.isLiked(forecast.id);

          // Change calculation
          let targetPrice = forecast.basePrice;
          if (forecast.mode === 'path' && forecast.path && forecast.path.length > 0) {
            targetPrice = forecast.path[forecast.path.length - 1].price;
          } else if (forecast.mode === 'breakout' && forecast.breakout) {
            targetPrice = forecast.breakout.price;
          }

          const changePct = forecast.basePrice > 0
            ? ((targetPrice - forecast.basePrice) / forecast.basePrice) * 100
            : 0;
          const isBull = changePct >= 0;

          // Mini SVG path generator
          const prices = forecast.path && forecast.path.length > 0
            ? [forecast.basePrice, ...forecast.path.map(p => p.price)]
            : [forecast.basePrice, targetPrice];
          const min = Math.min(...prices);
          const max = Math.max(...prices);
          const range = max - min || 1;
          const w = 120;
          const h = 40;
          const pad = 4;

          const points = prices.map((p, idx) => {
            const x = pad + (idx / (prices.length - 1)) * (w - pad * 2);
            const norm = (p - min) / range;
            const y = pad + (h - pad * 2) * (1 - norm);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          });
          const pathD = `M ${points.join(' L ')}`;

          return (
            <div
              key={forecast.id}
              onClick={() => navigate(`/f/${forecast.id}`)}
              className="group rounded-2xl bg-white dark:bg-[#0e1017] border border-zinc-200/90 dark:border-zinc-800 p-5 flex flex-col justify-between hover:shadow-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 cursor-pointer"
            >
              {/* Top Header: Stock Ticker + Return Badge */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm font-mono text-zinc-900 dark:text-white">
                    ${forecast.ticker}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {forecast.horizon} · ${forecast.basePrice.toFixed(1)}
                  </span>
                </div>

                <span
                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    isBull
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                  }`}
                >
                  {isBull ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  <span>{formatPct(changePct)}</span>
                </span>
              </div>

              {/* Sparkline Graphic Area */}
              <div className="my-3 py-2 px-3 rounded-xl bg-zinc-50 dark:bg-[#08090e] border border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-zinc-400 font-mono">예상 목표가</div>
                  <div className="text-sm font-bold font-mono text-zinc-900 dark:text-white">
                    ${targetPrice.toFixed(1)}
                  </div>
                </div>

                <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isBull ? '#10b981' : '#f43f5e'}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx={pad + (w - pad * 2)}
                    cy={pad + (h - pad * 2) * (1 - (prices[prices.length - 1] - min) / range)}
                    r="3.5"
                    fill={isBull ? '#10b981' : '#f43f5e'}
                  />
                </svg>
              </div>

              {/* Commentary */}
              <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2 mb-4 leading-relaxed">
                {forecast.comment || `${forecast.ticker} 미래 궤적 예측`}
              </p>

              {/* Bottom Footer: Author & Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={author?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                    alt={author?.name || '익명'}
                    className="w-6 h-6 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                  />
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[90px]">
                    {author?.name || '익명'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/draw?parent=${forecast.id}&ticker=${forecast.ticker}&horizon=${forecast.horizon}&mode=${forecast.mode}`);
                    }}
                    title="반박선 긋기"
                    className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-amber-500 transition text-xs flex items-center gap-1"
                  >
                    <Swords size={12} />
                    <span className="text-[10px] font-semibold">반박</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => repository.toggleLike(forecast.id)}
                    className={`px-2 py-1 rounded-lg text-xs font-mono flex items-center gap-1 border transition ${
                      isLiked
                        ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:text-zinc-900'
                    }`}
                  >
                    <ThumbsUp size={11} className={isLiked ? 'fill-sky-500' : ''} />
                    <span>{likesCount}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
