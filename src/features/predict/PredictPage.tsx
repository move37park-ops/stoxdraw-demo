import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';
import { PathCanvas, type OverlayRival } from './PathCanvas';
import { TicketPanel } from './TicketPanel';
import { BottomTabs } from './BottomTabs';
import { RoundCountdown } from './RoundCountdown';
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
import { getBtc7DRound } from '../../domain/round';
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

export function PredictPage({ currentDateStr, onDateChange }: PredictPageProps) {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [, setMarketTick] = useState(0);
  useEffect(() => {
    syncBinanceBtcDailyBars();
    const unsub = subscribeBtcMarket(() => setMarketTick(c => c + 1));
    return () => unsub();
  }, []);

  const round = useMemo(
    () => getBtc7DRound(DEFAULT_BASE_DATE, currentDateStr),
    [currentDateStr]
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

  const [animatedFutureCount, setAnimatedFutureCount] = useState<number>(0);

  useEffect(() => {
    const targetLen = targetFutureBars.length;
    if (targetLen === 0) return;

    const timer = window.setTimeout(() => {
      setAnimatedFutureCount(prev => {
        const start = prev === 0 || prev >= targetLen ? 1 : prev + 1;
        return Math.min(targetLen, start);
      });
    }, 55);
    return () => window.clearTimeout(timer);
  }, [currentDateStr, animatedFutureCount, targetFutureBars.length]);

  const effectiveFutureCount =
    targetFutureBars.length === 0
      ? 0
      : Math.min(targetFutureBars.length, Math.max(1, animatedFutureCount));

  const actualFutureBars = useMemo(
    () => targetFutureBars.slice(0, effectiveFutureCount),
    [targetFutureBars, effectiveFutureCount]
  );

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
  const isConsensusUnlocked = Boolean(myCurrentRoundForecast);

  const realizedDailyVol = useMemo(
    () =>
      calculateRealizedDailyVolatility(
        historyBars.map((b) => b.close),
        BTC_DAILY_VOLATILITY
      ),
    [historyBars]
  );

  const authorEloMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const u of repository.listAllUsers()) {
      map[u.id] = u.elo ?? DEFAULT_ELO;
    }
    if (currentUser) {
      map[currentUser.id] = currentUser.elo ?? DEFAULT_ELO;
    }
    return map;
  }, [currentUser]);

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

  useEffect(() => {
    if (!presetParam || !VALID_PRESETS.has(presetParam)) return;
    const timer = window.setTimeout(() => {
      if (!isConsensusUnlocked && isRoundOpen) {
        setDraftAnchors(buildPresetAnchors(basePrice, presetParam, horizonDays));
        setActivePreset(presetParam);
      }
      const next = new URLSearchParams(searchParams);
      next.delete('preset');
      setSearchParams(next, { replace: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [presetParam, basePrice, horizonDays, isConsensusUnlocked, isRoundOpen, searchParams, setSearchParams]);

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
    return draftAnchors;
  }, [myCurrentRoundForecast, draftAnchors]);

  const effectiveComment = myCurrentRoundForecast
    ? myCurrentRoundForecast.comment || ''
    : commentText;

  const handleChangeAnchors = useCallback(
    (next: AnchorPoint[]) => {
      if (isConsensusUnlocked || !isRoundOpen) return;
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
    [isConsensusUnlocked, isRoundOpen, horizonDays]
  );

  const handleApplyPreset = useCallback(
    (preset: TrajectoryPresetId) => {
      if (isConsensusUnlocked || !isRoundOpen) return;
      const next = buildPresetAnchors(basePrice, preset, horizonDays);
      setActivePreset(preset);
      setDraftAnchors(next);
      track('canvas_completed', { anchorsCount: next.length, source: 'preset', preset });
    },
    [isConsensusUnlocked, isRoundOpen, basePrice, horizonDays]
  );

  useEffect(() => {
    const onLoadPreset = (e: Event) => {
      if (isConsensusUnlocked || !isRoundOpen) return;
      const detail = (e as CustomEvent<TrajectoryPresetId | undefined>).detail;
      const preset: TrajectoryPresetId = detail || 'pullback_bounce';
      setActivePreset(preset);
      setDraftAnchors(buildPresetAnchors(basePrice, preset, horizonDays));
    };
    window.addEventListener('op:load-preset', onLoadPreset);
    return () => window.removeEventListener('op:load-preset', onLoadPreset);
  }, [basePrice, horizonDays, isConsensusUnlocked, isRoundOpen]);

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
    () =>
      actualFutureBars
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map(b => b.close),
    [actualFutureBars]
  );

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
      if (isConsensusUnlocked || !isRoundOpen) return;
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
    [isConsensusUnlocked, isRoundOpen, horizonDays]
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
        '예측이 제출되었습니다(수정 불가). 아래에서 집단 전망 리포트를 확인해 보세요.',
        'Forecast submitted and locked. Explore the crowd insights report below.'
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

      {/* Market Instrument Strip + 2-Column DeepBook Workbench: 8 Chart Box | 4 Ticket Box */}
      <div className="px-4 sm:px-6 pt-3 pb-5">
        <header
          className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pb-2.5 mb-3"
          style={{ borderBottom: '1px solid var(--op-line)' }}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
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

              <div className="flex items-baseline gap-2 op-mono">
                <span
                  className="text-[15.5px] font-semibold"
                  style={{ color: 'var(--op-ink)' }}
                >
                  ${basePrice.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>

            <p className="text-[12px] leading-snug" style={{ color: 'var(--op-ink-2)' }}>
              <span className="font-medium" style={{ color: 'var(--op-ink)' }}>
                {t('실전 예측', 'Live Forecast')}
              </span>
              <span className="mx-1.5" style={{ color: 'var(--op-ink-3)' }}>·</span>
              {t(
                '예측 경로 제출 시 집단 전망이 공개되며, 7일 예측 종료 후 평가 결과에 따라 평판 점수(LP)가 반영됩니다.',
                'Submit a 7-day forecast to unlock crowd insights and update your reputation LP at evaluation.'
              )}
            </p>
          </div>

          <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <dt style={{ color: 'var(--op-ink-3)' }}>{t('예측 종료', 'Forecast End')}</dt>
              <dd className="op-mono font-medium" style={{ color: 'var(--op-ink)' }}>
                {expiryDate.slice(5)}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt style={{ color: 'var(--op-ink-3)' }}>{t('제출 마감', 'Submission Lock')}</dt>
              <dd className="op-mono font-medium" style={{ color: 'var(--op-ink)' }}>
                <RoundCountdown cutoffAt={round.cutoffAt} />
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt style={{ color: 'var(--op-ink-3)' }}>{t('예측 참여자', 'Forecasters')}</dt>
              <dd className="op-mono font-medium" style={{ color: 'var(--op-ink)' }}>
                {t(`${liveForecasts.length}명`, `${liveForecasts.length}`)}
              </dd>
            </div>
          </dl>
        </header>

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
              readOnly={isConsensusUnlocked || !isRoundOpen}
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
              basePrice={basePrice}
              evalDates={evalDates}
              anchors={effectiveAnchors}
              interpolatedPrices={interpolated.prices}
              pathCompleted={pathCompleted}
              isSubmitted={isConsensusUnlocked}
              isRoundOpen={isRoundOpen}
              roundStatus={round.status}
              myForecast={myCurrentRoundForecast}
              eloProjection={eloProjection}
              liveTrackingScore={liveTrackingScore}
              liveTrackingSettlement={liveTrackingSettlement}
              settledCount={settledCloses.length}
              commentText={effectiveComment}
              onChangeComment={setCommentText}
              onSubmit={handleSubmitForecast}
              onResetToToday={() => onDateChange?.(DEFAULT_BASE_DATE)}
              onOpenShare={fc => setShareModalForecast(fc)}
              onViewDetail={fcId => navigate(`/f/${fcId}`)}
              onApplyPreset={handleApplyPreset}
              activePreset={activePreset}
            />
          </div>
        </section>
      </div>

      {/* Flush Bottom Intelligence & Participation Tabs */}
      <BottomTabs
        basePrice={basePrice}
        baseDate={baseDate}
        expiryDate={expiryDate}
        historyBars={historyBars}
        isConsensusUnlocked={isConsensusUnlocked}
        myForecast={myCurrentRoundForecast}
        userPrices={isConsensusUnlocked ? interpolated.prices : EMPTY_PRICES}
        forecasts={liveForecasts}
        consensusBand={consensusBand}
        overlaidRivals={overlaidRivals}
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
