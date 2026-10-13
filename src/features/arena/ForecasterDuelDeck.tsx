import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Forecast } from '../../domain/types';
import { CompactForecastCard } from '../../components/CompactForecastCard';

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
                ? 'bg-white text-black'
                : 'bg-[#141418] text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            전체 ({forecasts.length})
          </button>
          <button
            type="button"
            onClick={() => setStanceFilter('bull')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
              stanceFilter === 'bull'
                ? 'bg-emerald-500 text-black font-bold'
                : 'bg-[#141418] text-emerald-400 hover:bg-zinc-800 border border-white/10'
            }`}
          >
            Bull 진영 ({bullForecasts.length})
          </button>
          <button
            type="button"
            onClick={() => setStanceFilter('bear')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
              stanceFilter === 'bear'
                ? 'bg-rose-500 text-white font-bold'
                : 'bg-[#141418] text-rose-400 hover:bg-zinc-800 border border-white/10'
            }`}
          >
            Bear 진영 ({bearForecasts.length})
          </button>
        </div>

        <div className="hidden sm:flex items-center text-xs text-zinc-400 font-medium">
          YOUR DRAW 버튼으로 맞불 궤적 대결
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
        <div className="text-center py-16 px-4 rounded-2xl bg-[#0d0d10] border border-white/10">
          <h3 className="text-sm font-bold text-white mb-1">
            아직 이 조건의 예측이 없습니다
          </h3>
          <p className="text-xs text-zinc-400 mb-5">
            가장 먼저 미래 궤적을 제시하고 군중의 첫 기준점을 세워보세요!
          </p>
          <button
            type="button"
            onClick={onDrawFirst}
            className="btn-signature-draw px-5 py-2.5 rounded-full text-xs tracking-wide"
          >
            <span>DRAW</span>
            <ArrowRight size={13} className="stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
}
