import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId } from '../../data/session';
import { computeArenaSummary, getHotArenas } from '../../domain/arena';
import { aggregateCrowd } from '../../domain/crowd';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { ArenaHeader } from './ArenaHeader';
import { ArenaHeroStage } from './ArenaHeroStage';
import { ForecasterDuelDeck } from './ForecasterDuelDeck';
import { CompactForecastCard } from '../../components/CompactForecastCard';
import type { Forecast, Horizon, Mode } from '../../domain/types';

interface ArenaPageProps {
  currentDateStr: string;
}

type ArenaTab = 'live' | 'resolved';

export function ArenaPage({ currentDateStr }: ArenaPageProps) {
  const { ticker: paramTicker } = useParams<{ ticker?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeTicker = (paramTicker || searchParams.get('ticker') || localStorage.getItem('last_arena_ticker') || 'NVDA').toUpperCase();
  const [ticker, setTicker] = useState<string>(activeTicker);
  const [horizon] = useState<Horizon>('5D');
  const [mode] = useState<Mode>('path');
  const [activeTab, setActiveTab] = useState<ArenaTab>('live');
  const [activeLayerIds, setActiveLayerIds] = useState<string[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>(() => repository.listFeed('all', currentDateStr));

  useEffect(() => {
    if (activeTicker && activeTicker !== ticker) {
      setTicker(activeTicker);
      localStorage.setItem('last_arena_ticker', activeTicker);
      setActiveLayerIds([]);
    }
  }, [activeTicker, ticker]);

  const loadData = useCallback(() => {
    setForecasts(repository.listFeed('all', currentDateStr));
  }, [currentDateStr]);

  useEffect(() => {
    loadData();
    const unsub = repository.subscribe(loadData);
    return () => unsub();
  }, [loadData]);

  const handleSelectTicker = (newTicker: string) => {
    setTicker(newTicker);
    localStorage.setItem('last_arena_ticker', newTicker);
    setActiveLayerIds([]);
    navigate(`/arena/${newTicker}`);
  };

  const handleToggleLayer = (forecastId: string) => {
    setActiveLayerIds(prev => {
      if (prev.includes(forecastId)) {
        return prev.filter(id => id !== forecastId);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), forecastId];
      }
      return [...prev, forecastId];
    });
  };

  const handleRemoveLayer = (forecastId: string) => {
    setActiveLayerIds(prev => prev.filter(id => id !== forecastId));
  };

  const handleDrawClick = () => {
    navigate(`/draw?ticker=${ticker}`);
  };

  const hotArenas = useMemo(
    () => getHotArenas(forecasts, currentDateStr, horizon),
    [forecasts, currentDateStr, horizon]
  );

  const arenaSummary = useMemo(
    () => computeArenaSummary(ticker, forecasts, currentDateStr, horizon, mode),
    [ticker, forecasts, currentDateStr, horizon, mode]
  );

  const crowd = useMemo(
    () => aggregateCrowd(forecasts, ticker, horizon, mode),
    [forecasts, ticker, horizon, mode]
  );

  const activeLayerForecasts = useMemo(
    () => forecasts.filter(f => activeLayerIds.includes(f.id)),
    [forecasts, activeLayerIds]
  );

  const liveForecasts = useMemo(
    () => arenaSummary.topForecasts.filter(f => deriveForecastStatus(f, currentDateStr) !== 'RESOLVED'),
    [arenaSummary.topForecasts, currentDateStr]
  );

  const resolvedForecasts = useMemo(
    () => forecasts.filter(f => f.ticker === ticker && deriveForecastStatus(f, currentDateStr) === 'RESOLVED'),
    [forecasts, ticker, currentDateStr]
  );

  const currentUser = getCurrentUser();
  const anonId = getOrCreateAnonId();
  const hasParticipated = useMemo(() => {
    return forecasts.some(
      f =>
        f.ticker === ticker &&
        ((currentUser && f.authorId === currentUser.id) || (!currentUser && f.anonId === anonId))
    );
  }, [forecasts, ticker, currentUser, anonId]);

  return (
    <div className="w-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
          마켓 컨센서스
        </h1>
        <span className="text-xs text-zinc-400">
          종목별 시장 컨센서스 및 참여자 5D 예측 현황
        </span>
      </div>

      <ArenaHeader
        hotArenas={hotArenas}
        selectedTicker={ticker}
        onSelectTicker={handleSelectTicker}
      />

      <ArenaHeroStage
        ticker={ticker}
        horizon={horizon}
        mode={mode}
        currentDateStr={currentDateStr}
        crowd={crowd}
        arenaSummary={arenaSummary}
        activeLayerForecasts={activeLayerForecasts}
        hasParticipated={hasParticipated}
        onDrawClick={handleDrawClick}
        onRemoveLayer={handleRemoveLayer}
      />

      <div className="w-full">
        <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('live')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition ${
              activeTab === 'live'
                ? 'bg-zinc-100 text-black'
                : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800'
            }`}
          >
            진행 중 ({liveForecasts.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('resolved')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition ${
              activeTab === 'resolved'
                ? 'bg-zinc-100 text-black'
                : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800'
            }`}
          >
            정산 완료 ({resolvedForecasts.length})
          </button>
        </div>

        {activeTab === 'live' ? (
          <ForecasterDuelDeck
            forecasts={liveForecasts}
            currentDateStr={currentDateStr}
            activeLayerIds={activeLayerIds}
            onToggleLayer={handleToggleLayer}
            onDrawFirst={handleDrawClick}
          />
        ) : (
          <div>
            {resolvedForecasts.length > 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800 overflow-hidden">
                {resolvedForecasts.map(f => (
                  <CompactForecastCard
                    key={f.id}
                    forecast={f}
                    currentDateStr={currentDateStr}
                    borderless={true}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 px-4 rounded-lg bg-zinc-950 border border-zinc-800">
                <p className="text-xs text-zinc-400">
                  정산 완료된 기록이 없습니다. 상단 시점을 [10.12 만기]로 전환해 보세요.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
