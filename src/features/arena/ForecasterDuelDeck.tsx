import { useState } from 'react';
import type { Forecast } from '../../domain/types';
import { CompactForecastCard } from '../../components/CompactForecastCard';
import { Swords, TrendingUp, TrendingDown, Users } from 'lucide-react';

interface ForecasterDuelDeckProps {
  forecasts: Forecast[];
  activeLayerIds: string[];
  onToggleLayer: (id: string) => void;
  onDuel: (forecast: Forecast) => void;
  onDrawFirst: () => void;
}

type StanceFilter = 'all' | 'bull' | 'bear';

const LAYER_COLORS = ['#f59e0b', '#c084fc', '#10b981', '#f43f5e', '#0284c7'];

export function ForecasterDuelDeck({
  forecasts,
  activeLayerIds,
  onToggleLayer,
  onDuel,
  onDrawFirst,
}: ForecasterDuelDeckProps) {
  const [stanceFilter, setStanceFilter] = useState<StanceFilter>('all');

  const bullForecasts = forecasts.filter(f => {
    let target = f.basePrice;
    if (f.mode === 'path' && f.path && f.path.length > 0) {
      target = f.path[f.path.length - 1].price;
    } else if (f.mode === 'breakout' && f.breakout) {
      target = f.breakout.price;
    }
    return target >= f.basePrice;
  });

  const bearForecasts = forecasts.filter(f => {
    let target = f.basePrice;
    if (f.mode === 'path' && f.path && f.path.length > 0) {
      target = f.path[f.path.length - 1].price;
    } else if (f.mode === 'breakout' && f.breakout) {
      target = f.breakout.price;
    }
    return target < f.basePrice;
  });

  const filtered = stanceFilter === 'bull'
    ? bullForecasts
    : stanceFilter === 'bear'
    ? bearForecasts
    : forecasts;

  return (
    <div className="w-full">
      {/* Sub Header: Stance Filter Pills */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setStanceFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
              stanceFilter === 'all'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            전체 ({forecasts.length})
          </button>
          <button
            type="button"
            onClick={() => setStanceFilter('bull')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
              stanceFilter === 'bull'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/40'
            }`}
          >
            <TrendingUp size={13} />
            <span>Bull 진영 ({bullForecasts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setStanceFilter('bear')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
              stanceFilter === 'bear'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800/40'
            }`}
          >
            <TrendingDown size={13} />
            <span>Bear 진영 ({bearForecasts.length})</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
          <Swords size={14} className="text-amber-500" />
          <span>반박 버튼으로 1:1 결투</span>
        </div>
      </div>

      {/* Forecast Cards Deck */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {filtered.map(forecast => {
            const activeIdx = activeLayerIds.indexOf(forecast.id);
            const isActive = activeIdx !== -1;
            const layerColor = isActive ? LAYER_COLORS[activeIdx % LAYER_COLORS.length] : undefined;

            return (
              <CompactForecastCard
                key={forecast.id}
                forecast={forecast}
                isActiveLayer={isActive}
                layerColor={layerColor}
                onToggleLayer={onToggleLayer}
                onDuel={onDuel}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 px-4 rounded-3xl bg-white dark:bg-[#0e1017] border border-zinc-200/80 dark:border-zinc-800">
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sky-500 flex items-center justify-center mx-auto mb-3">
            <Users size={22} />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-1">
            아직 이 조건의 예측이 없습니다
          </h3>
          <p className="text-xs text-zinc-500 mb-5">
            가장 먼저 미래 궤적을 제시하고 군중의 첫 기준점을 세워보세요!
          </p>
          <button
            type="button"
            onClick={onDrawFirst}
            className="px-5 py-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold text-xs shadow-md transition"
          >
            첫 예측 남기기
          </button>
        </div>
      )}
    </div>
  );
}
