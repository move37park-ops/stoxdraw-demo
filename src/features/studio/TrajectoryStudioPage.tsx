import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import './vercel-geist.css';
import { StudioCommandBar } from './StudioCommandBar';
import { TickerTensionStrip } from './TickerTensionStrip';
import { SplitHorizonCanvas, type OverlayRival } from './SplitHorizonCanvas';
import { TelemetryMintConsole } from './TelemetryMintConsole';
import { BattlegroundDeck } from './BattlegroundDeck';
import { ShareTicketModal } from '../../components/ShareTicketModal';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId, subscribeSession } from '../../data/session';
import { getCurrentStockPrice, getStockHistory, STOCKS } from '../../data/market';
import { getRoundFor } from '../../domain/round';
import { aggregateCrowd } from '../../domain/crowd';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecast } from '../../domain/resolution';
import { DEFAULT_ELO } from '../../domain/elo';
import type { Forecast, User } from '../../domain/types';

const RIVAL_SERIES_COLORS = [
  'var(--v-cyan)',
  'var(--v-violet)',
  'var(--v-magenta)',
];

function buildInitialDraft(ticker: string, basePrice: number): number[] {
  const meta = STOCKS.find(s => s.ticker === ticker) || STOCKS[0];
  const unit = basePrice * meta.volatility;
  const curve = [0.35, 0.75, 0.55, 1.15, 1.55];
  return curve.map(m => parseFloat((basePrice + unit * m).toFixed(2)));
}

interface TrajectoryStudioPageProps {
  currentDateStr: string;
  onDateChange: (date: string) => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export function TrajectoryStudioPage({
  currentDateStr,
  onDateChange,
  theme: propTheme,
  onToggleTheme: propToggleTheme,
}: TrajectoryStudioPageProps) {
  const params = useParams<{ ticker?: string }>();
  const [searchParams] = useSearchParams();

  const initialTicker = (
    params.ticker ||
    searchParams.get('ticker') ||
    'NVDA'
  ).toUpperCase();

  const [localTheme, setLocalTheme] = useState<'dark' | 'light'>('dark');
  const theme = propTheme ?? localTheme;
  const handleToggleTheme =
    propToggleTheme ??
    (() => setLocalTheme(prev => (prev === 'dark' ? 'light' : 'dark')));

  const [selectedTicker, setSelectedTicker] = useState<string>(
    STOCKS.some(s => s.ticker === initialTicker) ? initialTicker : 'NVDA'
  );

  useEffect(() => {
    if (params.ticker) {
      const upper = params.ticker.toUpperCase();
      if (STOCKS.some(s => s.ticker === upper) && upper !== selectedTicker) {
        setSelectedTicker(upper);
      }
    }
  }, [params.ticker, selectedTicker]);

  // Unified timeline date from App.tsx (defaults to '2026-10-02' D-0 Lock)
  const studioDateStr = currentDateStr;
  const setStudioDateStr = onDateChange;

  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    getCurrentUser()
  );
  const [allForecasts, setAllForecasts] = useState<Forecast[]>(() =>
    repository.listFeed('all', currentDateStr)
  );

  const [activeForecastId, setActiveForecastId] = useState<string | null>(null);
  const [overlaidRivals, setOverlaidRivals] = useState<OverlayRival[]>([]);
  const [duelTarget, setDuelTarget] = useState<{
    forecast: Forecast;
    handle: string;
  } | null>(null);
  const [shareModalForecast, setShareModalForecast] = useState<Forecast | null>(
    null
  );

  useEffect(() => {
    const refresh = () => {
      setAllForecasts(repository.listFeed('all', currentDateStr));
      setCurrentUser(getCurrentUser());
    };
    const unsubRepo = repository.subscribe(refresh);
    const unsubSession = subscribeSession(refresh);
    return () => {
      unsubRepo();
      unsubSession();
    };
  }, [currentDateStr]);

  const round = useMemo(
    () => getRoundFor(selectedTicker, '2026-10-05'),
    [selectedTicker]
  );

  const baseDate = round.baseDate;
  const evalDates = round.evalDates;
  const basePrice = useMemo(
    () => getCurrentStockPrice(selectedTicker, baseDate),
    [selectedTicker, baseDate]
  );

  const [draftMap, setDraftMap] = useState<Record<string, number[]>>(() => ({
    [selectedTicker]: buildInitialDraft(
      selectedTicker,
      getCurrentStockPrice(selectedTicker, round.baseDate)
    ),
  }));

  const currentDraftPrices = useMemo(() => {
    if (draftMap[selectedTicker] && draftMap[selectedTicker].length === 5) {
      return draftMap[selectedTicker];
    }
    return buildInitialDraft(selectedTicker, basePrice);
  }, [draftMap, selectedTicker, basePrice]);

  const handleUpdateDraftPrices = (nextPrices: number[]) => {
    setDraftMap(prev => ({
      ...prev,
      [selectedTicker]: nextPrices,
    }));
  };

  const handleSelectTicker = (nextTicker: string) => {
    setSelectedTicker(nextTicker);
    setActiveForecastId(null);
    setDuelTarget(null);
    setOverlaidRivals([]);
  };

  const tickerForecasts = useMemo(
    () => allForecasts.filter(f => f.ticker === selectedTicker),
    [allForecasts, selectedTicker]
  );

  const crowdAggregate = useMemo(
    () => aggregateCrowd(allForecasts, selectedTicker, '5D', 'path'),
    [allForecasts, selectedTicker]
  );

  const anonId = getOrCreateAnonId();
  const myForecasts = useMemo(() => {
    return currentUser
      ? allForecasts.filter(f => f.authorId === currentUser.id)
      : allForecasts.filter(f => f.anonId === anonId);
  }, [allForecasts, currentUser, anonId]);

  const liveElo = useMemo(() => {
    const base = currentUser?.elo ?? DEFAULT_ELO;
    let delta = 0;
    myForecasts.forEach(f => {
      if (deriveForecastStatus(f, studioDateStr) === 'RESOLVED') {
        const bars = getStockHistory(f.ticker).filter(
          b => b.date <= studioDateStr
        );
        const res = resolveForecast(f, bars);
        if (res.eloSettlement) {
          delta += res.eloSettlement.deltaLp;
        }
      }
    });
    return base + delta;
  }, [currentUser, myForecasts, studioDateStr]);

  const lockedForecast = useMemo(
    () =>
      activeForecastId
        ? allForecasts.find(f => f.id === activeForecastId) || null
        : null,
    [activeForecastId, allForecasts]
  );

  const handleToggleOverlayRival = (
    forecast: Forecast,
    handle: string,
    elo: number
  ) => {
    setOverlaidRivals(prev => {
      const exists = prev.some(r => r.forecast.id === forecast.id);
      if (exists) {
        return prev.filter(r => r.forecast.id !== forecast.id);
      }
      const nextList = prev.length >= 3 ? prev.slice(1) : prev;
      const usedColors = new Set(nextList.map(r => r.colorVar));
      const availableColor =
        RIVAL_SERIES_COLORS.find(c => !usedColors.has(c)) ||
        RIVAL_SERIES_COLORS[nextList.length % RIVAL_SERIES_COLORS.length];

      return [
        ...nextList,
        {
          forecast,
          authorHandle: handle,
          authorElo: elo,
          colorVar: availableColor,
        },
      ];
    });
  };

  const handleStartDuel = (forecast: Forecast, handle: string) => {
    setActiveForecastId(null);
    setDuelTarget({ forecast, handle });

    setOverlaidRivals(prev => {
      if (prev.some(r => r.forecast.id === forecast.id)) return prev;
      const user = forecast.authorId
        ? repository.getUser(forecast.authorId)
        : undefined;
      return [
        ...prev.slice(0, 2),
        {
          forecast,
          authorHandle: handle,
          authorElo: user?.elo ?? DEFAULT_ELO,
          colorVar: 'var(--v-violet)',
        },
      ];
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLockForecast = (comment: string) => {
    const path = evalDates.map((date, idx) => ({
      date,
      price: currentDraftPrices[idx] ?? basePrice,
    }));
    const pathPct = path.map(pt =>
      basePrice > 0
        ? parseFloat(((pt.price - basePrice) / basePrice).toFixed(4))
        : 0
    );

    const created = repository.createForecast({
      authorId: currentUser ? currentUser.id : null,
      anonId,
      ticker: selectedTicker,
      horizon: '5D',
      mode: 'path',
      comment,
      basePrice,
      baseDate,
      evalDates,
      path,
      pathPct,
      roundId: round.id,
      parentId: duelTarget ? duelTarget.forecast.id : undefined,
    });

    setDuelTarget(null);
    setActiveForecastId(created.id);
  };

  const cleanAnonSuffix = anonId.replace(/^anon[_-]?/i, '').slice(0, 4) || 'guest';
  const userHandle = currentUser
    ? currentUser.handle
    : `guest_${cleanAnonSuffix}`;

  const stockMeta = STOCKS.find(s => s.ticker === selectedTicker) || STOCKS[0];
  const crowdPct = crowdAggregate.consensusChangePct ?? 0;

  return (
    <div className="v-studio-root" data-theme={theme}>
      {/* ZONE 1: Top Command Bar */}
      <StudioCommandBar
        ticker={selectedTicker}
        studioDateStr={studioDateStr}
        onStudioDateChange={setStudioDateStr}
        userHandle={userHandle}
        liveElo={liveElo}
        myForecasts={myForecasts}
        activeForecastId={activeForecastId}
        onSelectForecast={id => {
          setActiveForecastId(id);
          if (id) {
            const found = allForecasts.find(f => f.id === id);
            if (found && found.ticker !== selectedTicker) {
              setSelectedTicker(found.ticker);
            }
          }
        }}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* ZONE 2: Slim 1-Row Instrument Strip */}
      <TickerTensionStrip
        selectedTicker={selectedTicker}
        onSelectTicker={handleSelectTicker}
        forecasts={allForecasts}
        currentDateStr={baseDate}
      />

      {/* VERCEL ARCHITECTURAL MASTHEAD BAND */}
      <div
        className="w-full"
        style={{ borderBottom: '1px solid var(--v-hairline)' }}
      >
        <div
          className="relative max-w-[1360px] mx-auto grid grid-cols-1 lg:grid-cols-12"
          style={{
            borderLeft: '1px solid var(--v-hairline)',
            borderRight: '1px solid var(--v-hairline)',
          }}
        >
          <span className="v-crosshair" style={{ top: -6, left: -6 }} />
          <span className="v-crosshair" style={{ top: -6, right: -6 }} />
          <span className="v-crosshair" style={{ bottom: -6, left: -6 }} />
          <span className="v-crosshair" style={{ bottom: -6, right: -6 }} />

          {/* Left 7 Cols: Signature Vercel Dual-Tone Inline Headline */}
          <div
            className="lg:col-span-7 px-5 py-5 flex flex-col justify-center gap-2 min-w-0"
            style={{ borderRight: '1px solid var(--v-hairline)' }}
          >
            <div
              className="flex items-center gap-2 flex-wrap v-caption-mono"
              style={{ color: 'var(--v-mute)' }}
            >
              <span style={{ color: 'var(--v-ink)' }}>01 Draw 5D path</span>
              <span style={{ color: 'var(--v-dim)' }}>→</span>
              <span>02 Lock prediction</span>
              <span style={{ color: 'var(--v-dim)' }}>→</span>
              <span>03 Score vs real closes</span>
            </div>
            <h1 className="v-display-hero">
              <span style={{ color: 'var(--v-ink)' }}>
                Draw the next 5 days of {selectedTicker} on the chart.{' '}
              </span>
              <span style={{ color: 'var(--v-mute)', fontWeight: 400 }}>
                Lock your prediction, challenge the crowd, and get scored against real market closes.
              </span>
            </h1>
          </div>

          {/* Right 5 Cols: Flush 3-Column Stat Strip with Dark Hairline Borders */}
          <div className="lg:col-span-5 grid grid-cols-3 min-w-0">
            <div
              className="p-4 sm:p-5 flex flex-col justify-between min-w-0"
              style={{ borderRight: '1px solid var(--v-hairline)' }}
            >
              <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
                Anchor close
              </span>
              <div className="mt-2">
                <p
                  className="v-mono text-xl font-semibold tracking-tight"
                  style={{ color: 'var(--v-ink)' }}
                >
                  ${basePrice.toFixed(2)}
                </p>
                <p className="v-caption-mono mt-0.5" style={{ color: 'var(--v-mute)' }}>
                  {baseDate}
                </p>
              </div>
            </div>

            <div
              className="p-4 sm:p-5 flex flex-col justify-between min-w-0"
              style={{ borderRight: '1px solid var(--v-hairline)' }}
            >
              <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
                Crowd median
              </span>
              <div className="mt-2">
                <p
                  className="v-mono text-xl font-semibold tracking-tight"
                  style={{ color: crowdPct >= 0 ? 'var(--v-bull)' : 'var(--v-bear)' }}
                >
                  {crowdPct >= 0 ? '+' : ''}
                  {crowdPct.toFixed(2)}%
                </p>
                <p className="v-caption-mono mt-0.5" style={{ color: 'var(--v-mute)' }}>
                  5D consensus
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-5 flex flex-col justify-between min-w-0">
              <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
                Daily volatility
              </span>
              <div className="mt-2">
                <p
                  className="v-mono text-xl font-semibold tracking-tight"
                  style={{ color: 'var(--v-ink)' }}
                >
                  {(stockMeta.volatility * 100).toFixed(1)}%
                </p>
                <p className="v-caption-mono mt-0.5" style={{ color: 'var(--v-mute)' }}>
                  {tickerForecasts.length} locked peers
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN STUDIO WORKSPACE CONTAINER */}
      <main
        id="main"
        className="relative max-w-[1360px] mx-auto"
        style={{
          borderLeft: '1px solid var(--v-hairline)',
          borderRight: '1px solid var(--v-hairline)',
        }}
      >
        <div className="relative grid grid-cols-1 lg:grid-cols-12">
          <span className="v-crosshair" style={{ bottom: -6, left: -6 }} />
          <span className="v-crosshair" style={{ bottom: -6, right: -6 }} />

          <div
            className="lg:col-span-8 min-w-0"
            style={{ borderRight: '1px solid var(--v-hairline)' }}
          >
            <SplitHorizonCanvas
              ticker={selectedTicker}
              baseDate={baseDate}
              basePrice={basePrice}
              evalDates={evalDates}
              currentDateStr={studioDateStr}
              draftPrices={currentDraftPrices}
              onChangeDraftPrices={handleUpdateDraftPrices}
              lockedForecast={lockedForecast}
              onExitLockedView={() => setActiveForecastId(null)}
              allTickerForecasts={tickerForecasts}
              overlaidRivals={overlaidRivals}
              onRemoveOverlay={id =>
                setOverlaidRivals(prev =>
                  prev.filter(r => r.forecast.id !== id)
                )
              }
              onClearOverlays={() => setOverlaidRivals([])}
              duelTarget={duelTarget}
              onCancelDuel={() => setDuelTarget(null)}
            />
          </div>

          <div className="lg:col-span-4 min-w-0">
            <TelemetryMintConsole
              ticker={selectedTicker}
              baseDate={baseDate}
              basePrice={basePrice}
              evalDates={evalDates}
              currentDateStr={studioDateStr}
              draftPrices={currentDraftPrices}
              onChangeDraftPrices={handleUpdateDraftPrices}
              crowdChangePct={crowdAggregate.consensusChangePct}
              lockedForecast={lockedForecast}
              duelTarget={duelTarget}
              onLockForecast={handleLockForecast}
              onOpenShareModal={f => setShareModalForecast(f)}
            />
          </div>
        </div>

        {/* Bottom Deck: Zone 5 */}
        <BattlegroundDeck
          ticker={selectedTicker}
          baseDate={baseDate}
          basePrice={basePrice}
          evalDates={evalDates}
          currentDateStr={studioDateStr}
          draftPrices={currentDraftPrices}
          lockedForecast={lockedForecast}
          onSelectForecastToAudit={f => {
            setActiveForecastId(f.id);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          allTickerForecasts={tickerForecasts}
          overlaidRivals={overlaidRivals}
          onToggleOverlayRival={handleToggleOverlayRival}
          onStartDuel={handleStartDuel}
        />
      </main>

      {/* Quiet Vercel Authorship Footer */}
      <footer
        className="w-full"
        style={{
          borderTop: '1px solid var(--v-hairline)',
          backgroundColor: 'var(--v-canvas)',
        }}
      >
        <div
          className="max-w-[1360px] mx-auto px-5 py-6 flex flex-wrap items-center justify-between gap-4"
          style={{
            borderLeft: '1px solid var(--v-hairline)',
            borderRight: '1px solid var(--v-hairline)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <svg
              width="14"
              height="12"
              viewBox="0 0 76 65"
              fill="currentColor"
              aria-label="Vercel triangle mark"
              style={{ color: 'var(--v-ink)' }}
            >
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
            </svg>
            <span className="v-caption" style={{ color: 'var(--v-mute)' }}>
              STOXDRAW Trajectory Studio · Authored with Geist Design System (design.md & design.dark.md)
            </span>
          </div>
          <p className="v-caption-mono" style={{ color: 'var(--v-mute)' }}>
            rules:v1 · hybrid-100pt (path:50 / dir:30 / target:20) · immutable-lock
          </p>
        </div>
      </footer>

      {shareModalForecast && (
        <ShareTicketModal
          isOpen={true}
          onClose={() => setShareModalForecast(null)}
          forecast={shareModalForecast}
          authorHandle={userHandle}
          crowdPath={crowdAggregate.consensusPath}
          crowdChangePct={crowdAggregate.consensusChangePct}
          authorElo={liveElo}
        />
      )}
    </div>
  );
}
