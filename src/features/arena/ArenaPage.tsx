import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { repository } from '../../data/localRepository';
import { computeArenaSummary, getHotArenas } from '../../domain/arena';
import { aggregateCrowd } from '../../domain/crowd';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { ArenaHeader } from './ArenaHeader';
import { ArenaHeroStage } from './ArenaHeroStage';
import { ForecasterDuelDeck } from './ForecasterDuelDeck';
import { CrowdDistributionView } from './CrowdDistributionView';
import { CompactForecastCard } from '../../components/CompactForecastCard';
import type { Forecast, Horizon, Mode } from '../../domain/types';

interface ArenaPageProps {
  currentDateStr: string;
}

type ArenaTab = 'duel' | 'distribution' | 'resolved';

export function ArenaPage({ currentDateStr }: ArenaPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlTicker = searchParams.get('ticker') || localStorage.getItem('last_arena_ticker') || 'NVDA';
  const [ticker, setTicker] = useState<string>(urlTicker.toUpperCase());
  const [horizon, setHorizon] = useState<Horizon>('5D');
  const [mode, setMode] = useState<Mode>('path');
  const [activeTab, setActiveTab] = useState<ArenaTab>('duel');
  const [activeLayerIds, setActiveLayerIds] = useState<string[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>(() => repository.listFeed('all', currentDateStr));

  const loadData = useCallback(() => {
    setForecasts(repository.listFeed('all', currentDateStr));
  }, [currentDateStr]);

  useEffect(() => {
    loadData();
    const unsub = repository.subscribe(loadData);
    return () => unsub();
  }, [loadData]);

  // Keep ticker in sync with URL
  const handleSelectTicker = (newTicker: string) => {
    setTicker(newTicker);
    localStorage.setItem('last_arena_ticker', newTicker);
    const params = new URLSearchParams(searchParams);
    params.set('ticker', newTicker);
    setSearchParams(params);
    setActiveLayerIds([]); // Reset overlaid layers when switching asset
  };

  // Toggle layer on main chart (max 3 layers)
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
    navigate(`/draw?ticker=${ticker}&horizon=${horizon}&mode=${mode}`);
  };

  const handleDuel = (targetForecast: Forecast) => {
    navigate(`/draw?parent=${targetForecast.id}&ticker=${targetForecast.ticker}&horizon=${targetForecast.horizon}&mode=${targetForecast.mode}`);
  };

  // Computed Arena Data
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

  const resolvedForecasts = useMemo(
    () => forecasts.filter(f => f.ticker === ticker && deriveForecastStatus(f, currentDateStr) === 'RESOLVED'),
    [forecasts, ticker, currentDateStr]
  );

  return (
    <div className="w-full flex flex-col">
      {/* 1. Hot Arenas Carousel Header */}
      <ArenaHeader
        hotArenas={hotArenas}
        selectedTicker={ticker}
        onSelectTicker={handleSelectTicker}
      />

      {/* 2. Main Hero Stage (Integrated Chart Canvas) */}
      <ArenaHeroStage
        ticker={ticker}
        horizon={horizon}
        mode={mode}
        currentDateStr={currentDateStr}
        crowd={crowd}
        arenaSummary={arenaSummary}
        activeLayerForecasts={activeLayerForecasts}
        onHorizonChange={setHorizon}
        onModeChange={setMode}
        onDrawClick={handleDrawClick}
        onRemoveLayer={handleRemoveLayer}
      />

      {/* 3. Sub-Tab Navigator & Deck */}
      <div className="w-full mt-4">
        {/* Navigation Tabs - Pill Buttons */}
        <div className="flex items-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('duel')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
              activeTab === 'duel'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            궤적 배틀 덱 ({arenaSummary.topForecasts.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('distribution')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
              activeTab === 'distribution'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            군중 기대치 분포
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('resolved')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
              activeTab === 'resolved'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            검증 결과 아카이브 ({resolvedForecasts.length})
          </button>
        </div>

        {/* Tab 1: Duel Deck */}
        {activeTab === 'duel' && (
          <ForecasterDuelDeck
            forecasts={arenaSummary.topForecasts}
            activeLayerIds={activeLayerIds}
            onToggleLayer={handleToggleLayer}
            onDuel={handleDuel}
            onDrawFirst={handleDrawClick}
          />
        )}

        {/* Tab 2: Distribution View */}
        {activeTab === 'distribution' && (
          <CrowdDistributionView
            ticker={ticker}
            horizon={horizon}
            basePrice={arenaSummary.currentPrice}
            forecasts={forecasts}
          />
        )}

        {/* Tab 3: Resolved Archive */}
        {activeTab === 'resolved' && (
          <div className="space-y-3">
            {resolvedForecasts.length > 0 ? (
              resolvedForecasts.map(f => (
                <CompactForecastCard
                  key={f.id}
                  forecast={f}
                  onDuel={handleDuel}
                />
              ))
            ) : (
              <div className="text-center py-12 px-4 rounded-3xl bg-white dark:bg-[#0e1017] border border-zinc-200/80 dark:border-zinc-800">
                <p className="text-xs sm:text-sm text-zinc-500">
                  아직 {ticker} 종목의 검증 완료된 예측이 없습니다.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
