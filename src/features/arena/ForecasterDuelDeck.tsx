import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Forecast } from '../../domain/types';
import { CompactForecastCard } from '../../components/CompactForecastCard';

interface ForecasterDuelDeckProps {
  forecasts: Forecast[];
  currentDateStr?: string;
  activeLayerIds: string[];
  onToggleLayer: (id: string) => void;
  onDrawFirst: () => void;
}

type StanceFilter = 'all' | 'bull' | 'bear';

const LAYER_COLORS = ['#DFC15D', '#10b981', '#f43f5e'];

export function ForecasterDuelDeck({
  forecasts,
  currentDateStr = '2026-10-05',
  activeLayerIds,
  onToggleLayer,
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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStanceFilter('all')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              stanceFilter === 'all'
                ? 'bg-zinc-100 text-black'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            전체 {forecasts.length}
          </button>
          <button
            type="button"
            onClick={() => setStanceFilter('bull')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              stanceFilter === 'bull'
                ? 'bg-emerald-500 text-black font-semibold'
                : 'bg-zinc-900 text-emerald-400 border border-zinc-800 hover:bg-zinc-850'
            }`}
          >
            Bull {bullForecasts.length}
          </button>
          <button
            type="button"
            onClick={() => setStanceFilter('bear')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              stanceFilter === 'bear'
                ? 'bg-rose-500 text-white font-semibold'
                : 'bg-zinc-900 text-rose-400 border border-zinc-800 hover:bg-zinc-850'
            }`}
          >
            Bear {bearForecasts.length}
          </button>
        </div>

        <span className="hidden sm:inline text-xs text-zinc-500">
          최대 3개 예측 경로 중첩 비교 가능
        </span>
      </div>

      {filtered.length > 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800 overflow-hidden">
          {filtered.map(forecast => {
            const activeIdx = activeLayerIds.indexOf(forecast.id);
            const isActive = activeIdx !== -1;
            const layerColor = isActive ? LAYER_COLORS[activeIdx % LAYER_COLORS.length] : undefined;

            return (
              <CompactForecastCard
                key={forecast.id}
                forecast={forecast}
                currentDateStr={currentDateStr}
                isActiveLayer={isActive}
                layerColor={layerColor}
                onToggleLayer={onToggleLayer}
                borderless={true}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 px-4 rounded-lg bg-zinc-950 border border-zinc-800">
          <p className="text-xs text-zinc-400 mb-4">
            등록된 예측이 없습니다.
          </p>
          <button
            type="button"
            onClick={onDrawFirst}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-white hover:bg-zinc-200 text-black font-medium text-xs transition"
          >
            <span>첫 5D 예측 그리기</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
