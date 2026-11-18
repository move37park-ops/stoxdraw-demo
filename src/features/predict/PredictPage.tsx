import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { PathCanvas, type OverlayRival } from './PathCanvas';
import { TicketPanel, type RoundLeaderEntry } from './TicketPanel';
import { BottomTabs } from './BottomTabs';
import { ShareTicketModal } from '../../components/ShareTicketModal';
import { repository } from '../../data/localRepository';
import {
  getCurrentUser,
  getOrCreateAnonId,
  subscribeSession,
} from '../../data/session';
import {
  BTC_TICKER,
  BTC_DAILY_VOLATILITY,
  DEFAULT_BASE_DATE,
  getBtcHistoryBars,
  getCurrentBtcPrice,
  syncBinanceBtcDailyBars,
  subscribeBtcMarket,
} from '../../data/btcMarket';
import { getBtc7DRound, getDailyRollingBtcRounds } from '../../domain/round';
import {
  buildInterpolatedTrajectory,
  buildPresetAnchors,
  isPathComplete,
  normalizeAnchors,
  MAX_ANCHORS,
  type TrajectoryPresetId,
} from '../../domain/interpolation';
import { computeConsensusBand, aggregateCrowd } from '../../domain/crowd';
import { calculateForecastScore, calculateRealizedDailyVolatility } from '../../domain/scoring';
import {
  DEFAULT_ELO,
  calculateEloProjection,
  settleEloRating,
} from '../../domain/elo';
import { formatPct } from '../../domain/format';
import { track } from '../../lib/analytics';
import { useI18n } from '../../lib/i18nCore';
import type { AnchorPoint, Forecast, User } from '../../domain/types';

const EMPTY_PRICES: number[] = [];
const EMPTY_ANCHORS: AnchorPoint[] = [];
const ROLLING_ROUND_COUNT = 15; // 2026-09-18 (Evaluated) ~ 2026-10-02 (Open)

const RIVAL_SERIES_COLORS = [
  '#a855f7',
  '#eab308',
  '#ec4899',
];

const VALID_PRESETS = new Set<TrajectoryPresetId>([
  'dip_rally',
  'breakout',
  'pullback_bounce',
  'bear_slide',
  'range_up',
]);

interface PredictPageProps {
  currentDateStr: string;
  onDateChange?: (newDate: string) => void;
}

export function PredictPage({ currentDateStr }: PredictPageProps) {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [, setMarketTick] = useState(0);
  useEffect(() => {
    syncBinanceBtcDailyBars();
    const unsub = subscribeBtcMarket(() => setMarketTick(c => c + 1));
    return () => unsub();
  }, []);

  const dailyRounds = useMemo(
    () => getDailyRollingBtcRounds(DEFAULT_BASE_DATE, currentDateStr, ROLLING_ROUND_COUNT, 7),
    [currentDateStr]
  );

  const roundParam = searchParams.get('round');
  const [selectedBaseDate, setSelectedBaseDate] = useState<string>(() => {
    if (roundParam && dailyRounds.some(r => r.baseDate === roundParam)) {
      return roundParam;
    }
    return DEFAULT_BASE_DATE;
  });

  const selectedRoundIdx = useMemo(() => {
    const idx = dailyRounds.findIndex(r => r.baseDate === selectedBaseDate);
    return idx >= 0 ? idx : 0;
  }, [dailyRounds, selectedBaseDate]);

  const round = useMemo(
    () =>
      dailyRounds[selectedRoundIdx] ??
      getBtc7DRound(selectedBaseDate, currentDateStr, 7),
    [dailyRounds, selectedRoundIdx, selectedBaseDate, currentDateStr]
  );

  const baseDate = round.baseDate;
  const evalDates = round.evalDates;
  const horizonDays = evalDates.length || 7;
  const allBars = getBtcHistoryBars();
  const basePrice = getCurrentBtcPrice(baseDate);

  const historyBars = useMemo(
    () => allBars.filter(b => b.date <= baseDate).slice(-245),
    [allBars, baseDate]
  );

  const targetFutureBars = useMemo(() => {
    const map = new Map(allBars.map(b => [b.date, b]));
    return evalDates
      .filter(d => currentDateStr > baseDate && d <= currentDateStr)
      .map(d => map.get(d) || null)
      .filter((b): b is NonNullable<typeof b> => b !== null);
  }, [allBars, evalDates, currentDateStr, baseDate]);

  const actualFutureBars = targetFutureBars;

  const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentUser());
  const [allForecasts, setAllForecasts] = useState<Forecast[]>(() =>
    repository.listFeed('all', currentDateStr)
  );

  useEffect(() => {
    const unsubRepo = repository.subscribe(() => {
      setAllForecasts(repository.listFeed('all', currentDateStr));
    });
    const unsubSession = subscribeSession(() => {
      setCurrentUser(getCurrentUser());
      setAllForecasts(repository.listFeed('all', currentDateStr));
    });
    return () => {
      unsubRepo();
      unsubSession();
    };
  }, [currentDateStr]);

  const anonId = useMemo(() => getOrCreateAnonId(), []);

  const myForecasts = useMemo(() => {
    return currentUser
      ? allForecasts.filter(f => f.authorId === currentUser.id)
      : allForecasts.filter(f => f.anonId === anonId);
  }, [allForecasts, currentUser, anonId]);

  const myCurrentRoundForecast = useMemo(() => {
    return (
      myForecasts.find(f => f.ticker === BTC_TICKER && f.baseDate === baseDate) ||
      null
    );
  }, [myForecasts, baseDate]);

  const isRoundOpen = round.status === 'OPEN';
  const hasSubmittedCurrentRound = Boolean(myCurrentRoundForecast);
  // Blind guard applies ONLY to today's Open round before user locks in; past rounds (Tracking/Evaluated) are Open Archive
  const isConsensusUnlocked = !isRoundOpen || hasSubmittedCurrentRound;

  const realizedDailyVol = useMemo(
    () =>
      calculateRealizedDailyVolatility(
        historyBars.map((b) => b.close),
        BTC_DAILY_VOLATILITY
      ),
    [historyBars]
  );

  const userById = useMemo(
    () => new Map(repository.listAllUsers().map(u => [u.id, u])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allForecasts]
  );

  const authorEloMap = useMemo(() => {
    const map: Record<string, number> = {};
    userById.forEach(u => {
      map[u.id] = u.elo ?? DEFAULT_ELO;
    });
    if (currentUser) {
      map[currentUser.id] = currentUser.elo ?? DEFAULT_ELO;
    }
    return map;
  }, [userById, currentUser]);

  const presetParam = searchParams.get('preset') as TrajectoryPresetId | null;

  const [draftAnchors, setDraftAnchors] = useState<AnchorPoint[]>(() => {
    if (myCurrentRoundForecast?.anchors && myCurrentRoundForecast.anchors.length > 0) {
      return myCurrentRoundForecast.anchors;
    }
    if (presetParam && VALID_PRESETS.has(presetParam)) {
      return buildPresetAnchors(basePrice, presetParam, horizonDays);
    }
    return [];
  });
  const [activePreset, setActivePreset] = useState<TrajectoryPresetId | null>(() =>
    presetParam && VALID_PRESETS.has(presetParam) ? presetParam : null
  );
  const [commentText, setCommentText] = useState<string>(
    () => myCurrentRoundForecast?.comment || ''
  );
  const [overlaidRivals, setOverlaidRivals] = useState<OverlayRival[]>([]);
  const [shareModalForecast, setShareModalForecast] = useState<Forecast | null>(null);
  const [justSubmittedBanner, setJustSubmittedBanner] = useState<string | null>(null);
  const [isToastPaused, setIsToastPaused] = useState<boolean>(false);
  const toastPopoverRef = useRef<HTMLDivElement>(null);
  const priorFocusBeforeToastRef = useRef<HTMLElement | null>(null);
  const supportsAriaNotify =
    typeof document !== 'undefined' && 'ariaNotify' in document;

  const handleSelectRound = useCallback(
    (nextBaseDate: string) => {
      if (nextBaseDate === baseDate) return;
      setSelectedBaseDate(nextBaseDate);
      setOverlaidRivals([]);
      setShareModalForecast(null);
      track('round_changed', { targetDate: nextBaseDate, source: 'daily_nav' });
    },
    [baseDate]
  );

  useEffect(() => {
    if (!presetParam || !VALID_PRESETS.has(presetParam)) return;
    const timer = window.setTimeout(() => {
      if (!hasSubmittedCurrentRound && isRoundOpen) {
        setDraftAnchors(buildPresetAnchors(basePrice, presetParam, horizonDays));
        setActivePreset(presetParam);
      }
      const next = new URLSearchParams(searchParams);
      next.delete('preset');
      setSearchParams(next, { replace: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [presetParam, basePrice, horizonDays, hasSubmittedCurrentRound, isRoundOpen, searchParams, setSearchParams]);

  useEffect(() => {
    const toastEl = toastPopoverRef.current;
    if (!toastEl) return;
    const handleToggle = (event: Event) => {
      const toggleEvent = event as ToggleEvent;
      if (toggleEvent.newState === 'closed') {
        setJustSubmittedBanner(null);
        setIsToastPaused(false);
        const activeEl = document.activeElement;
        if (activeEl && toastEl.contains(activeEl)) {
          priorFocusBeforeToastRef.current?.focus();
        }
        priorFocusBeforeToastRef.current = null;
      }
    };
    toastEl.addEventListener('toggle', handleToggle);
    return () => toastEl.removeEventListener('toggle', handleToggle);
  }, []);

  useEffect(() => {
    const toastEl = toastPopoverRef.current;
    if (!toastEl) return;

    if (justSubmittedBanner) {
      if (document.activeElement instanceof HTMLElement && !toastEl.contains(document.activeElement)) {
        priorFocusBeforeToastRef.current = document.activeElement;
      }
      if (typeof toastEl.showPopover === 'function' && !toastEl.matches(':popover-open')) {
        try {
          toastEl.showPopover();
        } catch {
          // ignore if element is not connected
        }
      }
      if (supportsAriaNotify) {
        (document as Document & { ariaNotify?: (msg: string) => void }).ariaNotify?.(
          justSubmittedBanner
        );
      }
    } else if (typeof toastEl.hidePopover === 'function' && toastEl.matches(':popover-open')) {
      try {
        toastEl.hidePopover();
      } catch {
        // ignore if already closed
      }
    }
  }, [justSubmittedBanner, supportsAriaNotify]);

  useEffect(() => {
    if (!justSubmittedBanner || isToastPaused) return;
    const timer = window.setTimeout(() => {
      setJustSubmittedBanner(null);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [justSubmittedBanner, isToastPaused]);

  const effectiveAnchors = useMemo(() => {
    if (myCurrentRoundForecast?.anchors && myCurrentRoundForecast.anchors.length > 0) {
      return myCurrentRoundForecast.anchors;
    }
    return isRoundOpen ? draftAnchors : EMPTY_ANCHORS;
  }, [myCurrentRoundForecast, isRoundOpen, draftAnchors]);

  const effectiveComment = myCurrentRoundForecast
    ? myCurrentRoundForecast.comment || ''
    : isRoundOpen
    ? commentText
    : '';

  const handleChangeAnchors = useCallback(
    (next: AnchorPoint[]) => {
      if (hasSubmittedCurrentRound || !isRoundOpen) return;
      setDraftAnchors(prev => {
        if (prev.length === 0 && next.length > 0) {
          track('canvas_first_touch', { day: next[0].day });
        }
        const wasComplete = isPathComplete(prev, horizonDays);
        const nowComplete = isPathComplete(next, horizonDays);
        if (!wasComplete && nowComplete) {
          track('canvas_completed', { anchorsCount: next.length, source: 'draw' });
        }
        return next;
      });
      setActivePreset(null);
    },
    [hasSubmittedCurrentRound, isRoundOpen, horizonDays]
  );

  const handleApplyPreset = useCallback(
    (preset: TrajectoryPresetId) => {
      if (hasSubmittedCurrentRound || !isRoundOpen) return;
      const next = buildPresetAnchors(basePrice, preset, horizonDays);
      setActivePreset(preset);
      setDraftAnchors(next);
      track('canvas_completed', { anchorsCount: next.length, source: 'preset', preset });
    },
    [hasSubmittedCurrentRound, isRoundOpen, basePrice, horizonDays]
  );

  useEffect(() => {
    const onLoadPreset = (e: Event) => {
      if (hasSubmittedCurrentRound || !isRoundOpen) return;
      const detail = (e as CustomEvent<TrajectoryPresetId | undefined>).detail;
      const preset: TrajectoryPresetId = detail || 'pullback_bounce';
      setActivePreset(preset);
      setDraftAnchors(buildPresetAnchors(basePrice, preset, horizonDays));
    };
    window.addEventListener('op:load-preset', onLoadPreset);
    return () => window.removeEventListener('op:load-preset', onLoadPreset);
  }, [basePrice, horizonDays, hasSubmittedCurrentRound, isRoundOpen]);

  const pathCompleted = useMemo(
    () => isPathComplete(effectiveAnchors, horizonDays),
    [effectiveAnchors, horizonDays]
  );

  const interpolated = useMemo(
    () =>
      pathCompleted
        ? buildInterpolatedTrajectory(basePrice, evalDates, effectiveAnchors)
        : { prices: [], path: [], pathPct: [] },
    [pathCompleted, basePrice, evalDates, effectiveAnchors]
  );

  const liveForecasts = useMemo(
    () => allForecasts.filter(f => f.ticker === BTC_TICKER && f.baseDate === baseDate),
    [allForecasts, baseDate]
  );

  const consensusBand = useMemo(
    () =>
      computeConsensusBand(
        liveForecasts,
        evalDates,
        basePrice,
        undefined,
        authorEloMap
      ),
    [liveForecasts, evalDates, basePrice, authorEloMap]
  );

  const crowdAggregate = useMemo(
    () => aggregateCrowd(liveForecasts, BTC_TICKER, '7D', 'path'),
    [liveForecasts]
  );

  const bullishSharePct = useMemo(() => {
    if (liveForecasts.length === 0) return 50;
    let bull = 0;
    let total = 0;
    for (const fc of liveForecasts) {
      const p = fc.path;
      if (!p || p.length === 0 || fc.basePrice <= 0) continue;
      total += 1;
      if (p[p.length - 1].price >= fc.basePrice) bull += 1;
    }
    return total > 0 ? Math.round((bull / total) * 100) : 50;
  }, [liveForecasts]);

  const finalTargetPrice =
    pathCompleted && interpolated.prices.length > 0
      ? interpolated.prices[interpolated.prices.length - 1]
      : null;
  const finalChangePct =
    finalTargetPrice !== null && basePrice > 0
      ? ((finalTargetPrice - basePrice) / basePrice) * 100
      : 0;

  const crowdFinalMedian =
    consensusBand.length > 0
      ? consensusBand[consensusBand.length - 1].median
      : basePrice;
  const crowdFinalPct =
    basePrice > 0 ? ((crowdFinalMedian - basePrice) / basePrice) * 100 : 0;

  const myUserElo = currentUser?.elo ?? DEFAULT_ELO;
  const cohortMeanElo = useMemo(() => {
    const elos = liveForecasts.map(f => authorEloMap[f.authorId || ''] ?? DEFAULT_ELO);
    if (elos.length === 0) return DEFAULT_ELO;
    return elos.reduce((sum, e) => sum + e, 0) / elos.length;
  }, [liveForecasts, authorEloMap]);

  const eloProjection = useMemo(
    () =>
      calculateEloProjection(
        finalChangePct,
        crowdFinalPct,
        realizedDailyVol,
        horizonDays,
        locale,
        myUserElo,
        cohortMeanElo
      ),
    [finalChangePct, crowdFinalPct, realizedDailyVol, horizonDays, locale, myUserElo, cohortMeanElo]
  );

  const settledCloses = useMemo(
    () => actualFutureBars.map(b => b.close),
    [actualFutureBars]
  );

  const actualLatestPrice =
    settledCloses.length > 0 ? settledCloses[settledCloses.length - 1] : null;
  const actualLatestChangePct =
    actualLatestPrice !== null && basePrice > 0
      ? ((actualLatestPrice - basePrice) / basePrice) * 100
      : null;

  const { avgRoundScore, leaderEntry } = useMemo(() => {
    if (isRoundOpen || settledCloses.length === 0 || liveForecasts.length === 0) {
      return { avgRoundScore: null as number | null, leaderEntry: null as RoundLeaderEntry | null };
    }
    let scoreSum = 0;
    let count = 0;
    let best: RoundLeaderEntry | null = null;

    for (const fc of liveForecasts) {
      if (!fc.path || fc.path.length === 0 || fc.basePrice <= 0) continue;
      const prices = fc.path.map(pt => pt.price);
      const s = calculateForecastScore(prices, settledCloses, fc.basePrice, realizedDailyVol);
      scoreSum += s.total;
      count += 1;
      const author = fc.authorId ? userById.get(fc.authorId) : undefined;
      const handle = author
        ? author.handle
        : `guest_${fc.anonId.replace(/^anon[_-]?/i, '').slice(-4) || 'user'}`;
      const elo = author?.elo ?? DEFAULT_ELO;
      const endPrice = prices[prices.length - 1];
      const changePct = ((endPrice - fc.basePrice) / fc.basePrice) * 100;

      if (!best || s.total > best.score || (s.total === best.score && elo > best.elo)) {
        best = {
          forecast: fc,
          handle,
          elo,
          score: s.total,
          changePct,
        };
      }
    }

    return {
      avgRoundScore: count > 0 ? parseFloat((scoreSum / count).toFixed(1)) : null,
      leaderEntry: best,
    };
  }, [isRoundOpen, settledCloses, liveForecasts, realizedDailyVol, userById]);

  const liveTrackingScore = useMemo(() => {
    if (settledCloses.length === 0 || interpolated.prices.length === 0) return null;
    return calculateForecastScore(
      interpolated.prices,
      settledCloses,
      basePrice,
      realizedDailyVol
    );
  }, [interpolated.prices, settledCloses, basePrice, realizedDailyVol]);

  const peerTrackingScores = useMemo(() => {
    if (settledCloses.length === 0) return [];
    const myForecastId = myCurrentRoundForecast?.id;
    return liveForecasts
      .filter(f => f.id !== myForecastId && f.mode === 'path' && f.path && f.path.length > 0)
      .map(f =>
        calculateForecastScore(
          f.path!.map(pt => pt.price),
          settledCloses,
          f.basePrice,
          realizedDailyVol
        ).total
      );
  }, [settledCloses, liveForecasts, myCurrentRoundForecast?.id, realizedDailyVol]);

  const liveTrackingSettlement = useMemo(() => {
    if (!liveTrackingScore) return null;
    return settleEloRating(
      liveTrackingScore,
      finalChangePct,
      crowdFinalPct,
      realizedDailyVol,
      horizonDays,
      locale,
      {
        peerScores: peerTrackingScores,
        userElo: myUserElo,
        cohortMeanElo,
      }
    );
  }, [
    liveTrackingScore,
    finalChangePct,
    crowdFinalPct,
    realizedDailyVol,
    horizonDays,
    locale,
    peerTrackingScores,
    myUserElo,
    cohortMeanElo,
  ]);

  const handleSelectTargetPriceFromLadder = useCallback(
    (price: number) => {
      if (hasSubmittedCurrentRound || !isRoundOpen) return;
      setActivePreset(null);
      setDraftAnchors(prev => {
        const normalized = normalizeAnchors(prev, horizonDays, MAX_ANCHORS);
        const withoutExpiry = normalized.filter(a => a.day !== horizonDays);
        const head =
          withoutExpiry.length >= MAX_ANCHORS
            ? withoutExpiry.slice(0, MAX_ANCHORS - 1)
            : withoutExpiry;
        return [...head, { day: horizonDays, price: parseFloat(price.toFixed(2)) }];
      });
    },
    [hasSubmittedCurrentRound, isRoundOpen, horizonDays]
  );

  const handleSubmitForecast = () => {
    if (
      myCurrentRoundForecast ||
      !isRoundOpen ||
      !isPathComplete(effectiveAnchors, horizonDays) ||
      finalTargetPrice === null
    ) {
      return;
    }

    const cleanComment =
      effectiveComment.trim() ||
      t(
        `BTC/USDT 향후 ${horizonDays}일 목표가 $${finalTargetPrice.toLocaleString('en-US')} (${formatPct(finalChangePct)}) 예측 경로`,
        `BTC/USDT ${horizonDays}D forecast path targeting $${finalTargetPrice.toLocaleString('en-US')} (${formatPct(finalChangePct)})`
      );

    const created = repository.createForecast({
      authorId: currentUser ? currentUser.id : null,
      anonId,
      ticker: BTC_TICKER,
      horizon: '7D',
      mode: 'path',
      comment: cleanComment,
      basePrice,
      baseDate,
      evalDates,
      anchors: effectiveAnchors,
      path: interpolated.path,
      pathPct: interpolated.pathPct,
      roundId: round.id,
    });
    track('forecast_locked', {
      forecastId: created.id,
      horizon: '7D',
      anchorsCount: effectiveAnchors.length,
      targetPct: parseFloat(finalChangePct.toFixed(2)),
    });
    setJustSubmittedBanner(
      t(
        '예측이 확정되었습니다. 이제 차트와 하단에서 집단 중앙 경로(Crowd Path)를 확인할 수 있습니다.',
        'Forecast locked. Crowd Path and peer forecasts are now unlocked.'
      )
    );
  };

  const handleToggleOverlayRival = useCallback(
    (forecast: Forecast, handle: string, elo: number) => {
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
    },
    []
  );

  const handleRemoveOverlayRival = useCallback((id: string) => {
    setOverlaidRivals(prev => prev.filter(r => r.forecast.id !== id));
  }, []);

  const isLeaderOverlaid = Boolean(
    leaderEntry && overlaidRivals.some(r => r.forecast.id === leaderEntry.forecast.id)
  );

  const handleToggleLeaderOverlay = useCallback(() => {
    if (!leaderEntry) return;
    handleToggleOverlayRival(leaderEntry.forecast, leaderEntry.handle, leaderEntry.elo);
  }, [leaderEntry, handleToggleOverlayRival]);

  const handleNavigateProfile = useCallback(
    (handle: string) => navigate(`/u/${handle}`),
    [navigate]
  );

  const handleNavigateDetail = useCallback(
    (id: string) => navigate(`/f/${id}`),
    [navigate]
  );

  const cleanAnonSuffix = anonId.replace(/^anon[_-]?/i, '').slice(0, 4) || 'guest';
  const userHandle = currentUser ? currentUser.handle : `guest_${cleanAnonSuffix}`;

  const expiryDate = evalDates[evalDates.length - 1] || baseDate;
  const prevRound = dailyRounds[selectedRoundIdx + 1] ?? null;
  const nextRound = selectedRoundIdx > 0 ? dailyRounds[selectedRoundIdx - 1] : null;

  return (
    <div className="w-full op-view-enter">
      {/* Persistent Toast Region (Bottom Floating Popover) */}
      <div role="region" aria-label={t('알림', 'Notifications')}>
        {!supportsAriaNotify && (
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {justSubmittedBanner ?? ''}
          </div>
        )}
        <div
          id="forecast-saved-toast"
          ref={toastPopoverRef}
          popover="manual"
          className="op-toast-popover"
          onMouseEnter={() => setIsToastPaused(true)}
          onMouseLeave={() => setIsToastPaused(false)}
          onFocusCapture={() => setIsToastPaused(true)}
          onBlurCapture={e => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setIsToastPaused(false);
            }
          }}
        >
          {justSubmittedBanner && (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2
                  size={16}
                  className="flex-shrink-0"
                  style={{ color: 'var(--op-bull)' }}
                  aria-hidden="true"
                />
                <span className="text-[0.8125rem] font-medium leading-[1.45]" style={{ color: 'var(--op-ink)' }}>
                  {justSubmittedBanner}
                </span>
              </div>
              <button
                type="button"
                popoverTarget="forecast-saved-toast"
                popoverTargetAction="hide"
                onClick={() => setJustSubmittedBanner(null)}
                aria-label={t('알림 닫기', 'Close notification')}
                className="p-1 rounded-[4px] flex-shrink-0 transition-colors hover:bg-[var(--op-panel)]"
                style={{ color: 'var(--op-ink-3)' }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Single Compact Header (Market Quote + Daily Forecast Navigation) + 2-Column Workbench */}
      <div className="px-4 sm:px-6 pt-3 pb-5">
        <header
          className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3"
          style={{ borderBottom: '1px solid var(--op-line)' }}
        >
          {/* Left: Instrument & Base Price */}
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-2">
              <img
                src="/btc-logo.png"
                alt=""
                width={20}
                height={20}
                className="w-5 h-5 rounded-full flex-shrink-0 object-contain"
                aria-hidden="true"
              />
              <h1
                className="text-[15.5px] font-semibold tracking-tight"
                style={{ color: 'var(--op-ink)' }}
              >
                BTC/USDT
              </h1>
            </div>

            <div className="flex items-baseline gap-1.5 op-mono">
              <span
                className="text-[15.5px] font-semibold"
                style={{ color: 'var(--op-ink)' }}
              >
                ${basePrice.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              {!isRoundOpen && (
                <span className="text-[11px]" style={{ color: 'var(--op-ink-3)' }}>
                  {t('기준가', 'Base')}
                </span>
              )}
            </div>
          </div>

          {/* Right: Clean Daily Round Navigator (← Prev | Range · Status | Next → | Today) */}
          <nav
            aria-label={t('일간 라운드 날짜 이동', 'Daily forecast round navigation')}
            className="flex flex-wrap items-center gap-1.5"
          >
            <button
              type="button"
              disabled={!prevRound}
              onClick={() => prevRound && handleSelectRound(prevRound.baseDate)}
              className="op-btn-ghost h-7 px-2 text-[12px] op-mono disabled:opacity-35 disabled:cursor-not-allowed"
              aria-label={t('하루 전 라운드 보기', 'Previous day round')}
            >
              <ChevronLeft size={13} aria-hidden="true" />
              <span>{prevRound ? prevRound.baseDate.slice(5).replace('-', '.') : '-'}</span>
            </button>

            <div
              className="px-2.5 h-7 rounded-[2px] inline-flex items-center gap-2 op-mono text-[12px]"
              style={{
                backgroundColor: 'var(--op-panel)',
                border: '1px solid var(--op-line-strong)',
              }}
            >
              <span className="font-semibold" style={{ color: 'var(--op-ink)' }}>
                {baseDate.slice(5).replace('-', '.')} → {expiryDate.slice(5).replace('-', '.')}
              </span>
              <span
                className="px-1.5 py-0.2 rounded-[2px] text-[10.5px] font-semibold"
                style={
                  round.status === 'OPEN'
                    ? {
                        backgroundColor: 'var(--op-orange-soft)',
                        color: 'var(--op-orange)',
                      }
                    : round.status === 'LIVE'
                    ? {
                        backgroundColor: 'rgba(50, 145, 255, 0.14)',
                        color: 'var(--op-smart)',
                      }
                    : {
                        backgroundColor: 'rgba(0, 229, 153, 0.12)',
                        color: 'var(--op-bull)',
                      }
                }
              >
                {round.status === 'OPEN'
                  ? 'OPEN'
                  : round.status === 'LIVE'
                  ? `TRACKING ${settledCloses.length}/7`
                  : 'EVALUATED 7/7'}
              </span>
            </div>

            <button
              type="button"
              disabled={!nextRound}
              onClick={() => nextRound && handleSelectRound(nextRound.baseDate)}
              className="op-btn-ghost h-7 px-2 text-[12px] op-mono disabled:opacity-35 disabled:cursor-not-allowed"
              aria-label={t('다음 날 라운드 보기', 'Next day round')}
            >
              <span>{nextRound ? nextRound.baseDate.slice(5).replace('-', '.') : '-'}</span>
              <ChevronRight size={13} aria-hidden="true" />
            </button>

            {!isRoundOpen && (
              <button
                type="button"
                onClick={() => handleSelectRound(DEFAULT_BASE_DATE)}
                className="h-7 px-2.5 rounded-[2px] text-[11.5px] font-semibold op-mono cursor-pointer transition-colors"
                style={{
                  backgroundColor: 'var(--op-orange)',
                  color: 'var(--op-on-orange)',
                }}
              >
                Today
              </button>
            )}
          </nav>
        </header>

        {/* 2-Column Integrated Workbench: 8 Col Chart | 4 Col Round Context Panel */}
        <section
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch"
        >
          <div
            className="lg:col-span-8 min-w-0 rounded-[2px] overflow-hidden"
            style={{
              backgroundColor: 'var(--op-canvas)',
              border: '1px solid var(--op-line-strong)',
            }}
          >
            <PathCanvas
              mode="live"
              ticker={BTC_TICKER}
              hideAssetBadge={true}
              baseDate={baseDate}
              basePrice={basePrice}
              evalDates={evalDates}
              historyBars={historyBars}
              actualFutureBars={actualFutureBars}
              scaleFutureBars={targetFutureBars}
              anchors={effectiveAnchors}
              onChangeAnchors={handleChangeAnchors}
              readOnly={hasSubmittedCurrentRound || !isRoundOpen}
              isConsensusUnlocked={isConsensusUnlocked}
              consensusBand={consensusBand}
              overlaidRivals={overlaidRivals}
            />
          </div>

          <div
            className="lg:col-span-4 min-w-0 rounded-[2px] overflow-hidden"
            style={{
              backgroundColor: 'var(--op-panel)',
              border: '1px solid var(--op-line-strong)',
            }}
          >
            <TicketPanel
              baseDate={baseDate}
              basePrice={basePrice}
              evalDates={evalDates}
              anchors={effectiveAnchors}
              interpolatedPrices={interpolated.prices}
              pathCompleted={pathCompleted}
              isSubmitted={hasSubmittedCurrentRound}
              isRoundOpen={isRoundOpen}
              roundStatus={round.status}
              myForecast={myCurrentRoundForecast}
              eloProjection={eloProjection}
              liveTrackingScore={liveTrackingScore}
              liveTrackingSettlement={liveTrackingSettlement}
              settledCount={settledCloses.length}
              participantsCount={liveForecasts.length}
              crowdMedianPrice={crowdFinalMedian}
              crowdChangePct={crowdFinalPct}
              bullishSharePct={bullishSharePct}
              avgRoundScore={avgRoundScore}
              leaderEntry={leaderEntry}
              isLeaderOverlaid={isLeaderOverlaid}
              onToggleLeaderOverlay={handleToggleLeaderOverlay}
              actualLatestPrice={actualLatestPrice}
              actualLatestChangePct={actualLatestChangePct}
              commentText={effectiveComment}
              onChangeComment={setCommentText}
              onSubmit={handleSubmitForecast}
              onResetToToday={() => handleSelectRound(DEFAULT_BASE_DATE)}
              onOpenShare={fc => setShareModalForecast(fc)}
              onViewDetail={fcId => navigate(`/f/${fcId}`)}
              onApplyPreset={handleApplyPreset}
              activePreset={activePreset}
            />
          </div>
        </section>
      </div>

      {/* Unified Crowd Summary & Score-Sorted Forecaster Table */}
      <BottomTabs
        basePrice={basePrice}
        baseDate={baseDate}
        expiryDate={expiryDate}
        historyBars={historyBars}
        roundStatus={round.status}
        isConsensusUnlocked={isConsensusUnlocked}
        myForecast={myCurrentRoundForecast}
        userPrices={hasSubmittedCurrentRound ? interpolated.prices : EMPTY_PRICES}
        forecasts={liveForecasts}
        consensusBand={consensusBand}
        overlaidRivals={overlaidRivals}
        settledCloses={settledCloses}
        realizedDailyVol={realizedDailyVol}
        settledCount={settledCloses.length}
        actualLatestPrice={actualLatestPrice}
        actualLatestChangePct={actualLatestChangePct}
        avgRoundScore={avgRoundScore}
        leaderHandle={leaderEntry?.handle ?? null}
        onToggleOverlay={handleToggleOverlayRival}
        onRemoveOverlay={handleRemoveOverlayRival}
        onNavigateProfile={handleNavigateProfile}
        onNavigateDetail={handleNavigateDetail}
        onSelectTargetPrice={handleSelectTargetPriceFromLadder}
      />

      {shareModalForecast && (
        <ShareTicketModal
          isOpen={Boolean(shareModalForecast)}
          onClose={() => setShareModalForecast(null)}
          forecast={shareModalForecast}
          authorHandle={userHandle}
          crowdPath={crowdAggregate.consensusPath}
          crowdChangePct={crowdFinalPct}
          scoreTotal={liveTrackingScore?.total}
          scoreGrade={liveTrackingScore?.grade}
          eloDeltaLp={liveTrackingSettlement?.deltaLp}
          authorElo={currentUser?.elo ?? DEFAULT_ELO}
        />
      )}
    </div>
  );
}
