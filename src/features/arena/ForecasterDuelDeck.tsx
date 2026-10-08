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

const LAYER_COLORS = ['#f59e0b', '#c084fc', '#34d399', '#f43f5e', '#38bdf8'];

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
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setStanceFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              stanceFilter === 'all'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white bg-[#11131a] border border-[#1f222c]'
            }`}
          >
            전체 ({forecasts.length})
          </button>
          <button
            type="button"
            onClick={() => setStanceFilter('bull')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              stanceFilter === 'bull'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'text-zinc-400 hover:text-emerald-400 bg-[#11131a] border border-[#1f222c]'
            }`}
          >
            <TrendingUp size={13} />
            <span>Bull 진영 ({bullForecasts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setStanceFilter('bear')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              stanceFilter === 'bear'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'text-zinc-400 hover:text-rose-400 bg-[#11131a] border border-[#1f222c]'
            }`}
          >
            <TrendingDown size={13} />
            <span>Bear 진영 ({bearForecasts.length})</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-[11px] text-zinc-400">
          <Swords size={13} className="text-amber-400" />
          <span>반박 버튼으로 1:1 결투</span>
        </div>
      </div>

      {/* Forecast Cards Deck */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-2">
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
        <div className="text-center py-12 px-4 rounded-2xl bg-[#0c0e14] border border-[#1b1e28]">
          <div className="w-12 h-12 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto mb-3">
            <Users size={22} />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">
            아직 이 조건의 예측이 없습니다
          </h3>
          <p className="text-xs text-zinc-400 mb-4">
            가장 먼저 미래 궤적을 제시하고 군중의 첫 기준점을 세워보세요!
          </p>
          <button
            type="button"
            onClick={onDrawFirst}
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition"
          >
            첫 예측 남기기
          </button>
        </div>
      )}
    </div>
  );
}
