import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock,
  Unlock,
  Share2,
  CheckCircle2,
  History,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import './vercel-geist.css';
import { StudioCommandBar } from './StudioCommandBar';
import { Polyline20DCanvas, type OverlayRival } from './Polyline20DCanvas';
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
import { getBtc20DRound } from '../../domain/round';
import {
  buildInterpolatedTrajectory,
  buildPresetAnchors,
} from '../../domain/interpolation';
import { compute20DConsensusBand, aggregateCrowd } from '../../domain/crowd';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecast } from '../../domain/resolution';
import { calculateForecastScore } from '../../domain/scoring';
import {
  DEFAULT_ELO,
  getEloTierInfo,
  calculateEloProjection,
  settleEloRating,
} from '../../domain/elo';
import { computeForecastDigest } from '../../domain/audit';
import { formatPct } from '../../domain/format';
import type { AnchorPoint, Forecast, User } from '../../domain/types';

const RIVAL_SERIES_COLORS = [
  'var(--v-mute)',
  'var(--v-body)',
  'var(--v-ink)',
];

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
  const navigate = useNavigate();

  const [localTheme, setLocalTheme] = useState<'dark' | 'light'>('dark');
  const theme = propTheme ?? localTheme;
  const handleToggleTheme =
    propToggleTheme ??
    (() => setLocalTheme(prev => (prev === 'dark' ? 'light' : 'dark')));

  const [, setMarketTick] = useState(0);
  useEffect(() => {
    syncBinanceBtcDailyBars();
    const unsub = subscribeBtcMarket(() => setMarketTick(t => t + 1));
    return () => unsub();
  }, []);

  const round = useMemo(
    () => getBtc20DRound(DEFAULT_BASE_DATE, currentDateStr),
    [currentDateStr]
  );

  const baseDate = round.baseDate;
  const evalDates = round.evalDates;
  const allBars = getBtcHistoryBars();
  const basePrice = getCurrentBtcPrice(baseDate);

  const historyBars = useMemo(
    () => allBars.filter(b => b.date <= baseDate).slice(-180),
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
    if (targetFutureBars.length === 0) {
      setAnimatedFutureCount(0);
      return;
    }
    setAnimatedFutureCount(prev => (prev >= targetFutureBars.length ? 1 : Math.max(1, prev)));
  }, [currentDateStr, targetFutureBars.length]);

  useEffect(() => {
    if (animatedFutureCount === 0 || animatedFutureCount >= targetFutureBars.length) {
      return;
    }
    const timer = window.setTimeout(() => {
      setAnimatedFutureCount(prev => Math.min(targetFutureBars.length, prev + 1));
    }, 55);
    return () => window.clearTimeout(timer);
  }, [animatedFutureCount, targetFutureBars.length]);

  const actualFutureBars = useMemo(
    () => targetFutureBars.slice(0, animatedFutureCount),
    [targetFutureBars, animatedFutureCount]
  );

  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    getCurrentUser()
  );
  const [allForecasts, setAllForecasts] = useState<Forecast[]>(() =>
    repository.listFeed('all', currentDateStr)
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

  const anonId = getOrCreateAnonId();

  const myForecasts = useMemo(() => {
    return currentUser
      ? allForecasts.filter(f => f.authorId === currentUser.id)
      : allForecasts.filter(f => f.anonId === anonId);
  }, [allForecasts, currentUser, anonId]);

  const myCurrentRoundForecast = useMemo(() => {
    return (
      myForecasts.find(
        f => f.ticker === BTC_TICKER && f.baseDate === baseDate
      ) || null
    );
  }, [myForecasts, baseDate]);

  const isConsensusUnlocked = Boolean(myCurrentRoundForecast);

  const [draftAnchors, setDraftAnchors] = useState<AnchorPoint[]>(() =>
    buildPresetAnchors(basePrice, 'dip_rally', 20)
  );
  const [commentText, setCommentText] = useState<string>('');
  const [overlaidRivals, setOverlaidRivals] = useState<OverlayRival[]>([]);
  const [shareModalForecast, setShareModalForecast] =
    useState<Forecast | null>(null);
  const [justSubmittedBanner, setJustSubmittedBanner] =
    useState<string | null>(null);

  useEffect(() => {
    if (!myCurrentRoundForecast) {
      setDraftAnchors(buildPresetAnchors(basePrice, 'dip_rally', 20));
    } else if (
      myCurrentRoundForecast.anchors &&
      myCurrentRoundForecast.anchors.length > 0
    ) {
      setDraftAnchors(myCurrentRoundForecast.anchors);
      setCommentText(myCurrentRoundForecast.comment || '');
    }
  }, [basePrice, myCurrentRoundForecast?.id]);

  const interpolated = useMemo(
    () => buildInterpolatedTrajectory(basePrice, evalDates, draftAnchors),
    [basePrice, evalDates, draftAnchors]
  );

  const liveForecasts = useMemo(
    () =>
      allForecasts.filter(
        f => f.ticker === BTC_TICKER && f.baseDate === baseDate
      ),
    [allForecasts, baseDate]
  );

  const consensusBand = useMemo(
    () => compute20DConsensusBand(liveForecasts, evalDates, basePrice),
    [liveForecasts, evalDates, basePrice]
  );

  const crowdAggregate = useMemo(
    () => aggregateCrowd(liveForecasts, BTC_TICKER, '20D', 'path'),
    [liveForecasts]
  );

  const liveElo = useMemo(() => {
    const base = currentUser?.elo ?? DEFAULT_ELO;
    let delta = 0;
    myForecasts.forEach(f => {
      if (deriveForecastStatus(f, currentDateStr) === 'RESOLVED') {
        const bars = allBars.filter(b => b.date <= currentDateStr);
        const res = resolveForecast(f, bars);
        if (res.eloSettlement) {
          delta += res.eloSettlement.deltaLp;
        }
      }
    });
    return base + delta;
  }, [currentUser, myForecasts, currentDateStr, allBars]);

  const tierInfo = getEloTierInfo(liveElo);

  const finalTargetPrice =
    interpolated.prices[interpolated.prices.length - 1] ?? basePrice;
  const finalChangePct =
    basePrice > 0 ? ((finalTargetPrice - basePrice) / basePrice) * 100 : 0;

  const crowdFinalMedian =
    consensusBand.length > 0
      ? consensusBand[consensusBand.length - 1].median
      : basePrice;
  const crowdFinalPct =
    basePrice > 0 ? ((crowdFinalMedian - basePrice) / basePrice) * 100 : 0;

  const topFinalMedian =
    consensusBand.length > 0
      ? consensusBand[consensusBand.length - 1].topForecasterMedian
      : basePrice;
  const topFinalPct =
    basePrice > 0 ? ((topFinalMedian - basePrice) / basePrice) * 100 : 0;

  const eloProjection = useMemo(
    () =>
      calculateEloProjection(
        finalChangePct,
        crowdFinalPct,
        BTC_DAILY_VOLATILITY,
        20
      ),
    [finalChangePct, crowdFinalPct]
  );

  const settledCloses = useMemo(
    () =>
      actualFutureBars
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map(b => b.close),
    [actualFutureBars]
  );

  const liveTrackingScore = useMemo(() => {
    if (settledCloses.length === 0) return null;
    return calculateForecastScore(
      interpolated.prices,
      settledCloses,
      basePrice,
      BTC_DAILY_VOLATILITY
    );
  }, [interpolated.prices, settledCloses, basePrice]);

  const liveTrackingSettlement = useMemo(() => {
    if (!liveTrackingScore) return null;
    return settleEloRating(
      liveTrackingScore,
      finalChangePct,
      crowdFinalPct,
      BTC_DAILY_VOLATILITY,
      20
    );
  }, [liveTrackingScore, finalChangePct, crowdFinalPct]);

  const handleSubmitOrUpdateForecast = () => {
    const cleanComment =
      commentText.trim() ||
      `BTC/USDT 향후 20일 목표가 $${finalTargetPrice.toLocaleString('en-US')} (${formatPct(finalChangePct)}) 시나리오`;

    if (!myCurrentRoundForecast) {
      const created = repository.createForecast({
        authorId: currentUser ? currentUser.id : null,
        anonId,
        ticker: BTC_TICKER,
        horizon: '20D',
        mode: 'path',
        comment: cleanComment,
        basePrice,
        baseDate,
        evalDates,
        anchors: draftAnchors,
        path: interpolated.path,
        pathPct: interpolated.pathPct,
        roundId: round.id,
      });
      setJustSubmittedBanner(
        `제출 완료. 다른 참여자의 예측이 열렸습니다.`
      );
      return created;
    } else {
      const previewForecast: Forecast = {
        ...myCurrentRoundForecast,
        path: interpolated.path,
        comment: cleanComment,
        lockedAt: new Date().toISOString(),
      };
      const digestHash = computeForecastDigest(previewForecast);
      const updated = repository.appendForecastVersion(
        myCurrentRoundForecast.id,
        {
          anchors: draftAnchors,
          prices: interpolated.prices,
          path: interpolated.path,
          pathPct: interpolated.pathPct,
          comment: cleanComment,
          digestHash,
        }
      );
      const verCount = updated?.versions?.length ?? 2;
      setJustSubmittedBanner(
        `v${verCount} 저장됨`
      );
      return updated;
    }
  };

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

  const cleanAnonSuffix =
    anonId.replace(/^anon[_-]?/i, '').slice(0, 4) || 'guest';
  const userHandle = currentUser
    ? currentUser.handle
    : `guest_${cleanAnonSuffix}`;

  const initialVersion =
    myCurrentRoundForecast?.versions &&
    myCurrentRoundForecast.versions.length > 1
      ? myCurrentRoundForecast.versions[0]
      : null;

  return (
    <div
      className="v-studio-root min-h-screen w-full flex flex-col"
      data-theme={theme}
    >
      <StudioCommandBar
        ticker={BTC_TICKER}
        studioDateStr={currentDateStr}
        onStudioDateChange={onDateChange}
        userHandle={userHandle}
        liveElo={liveElo}
        myForecasts={myForecasts}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <main
        id="main"
        className="flex-1 w-full max-w-[1360px] mx-auto relative"
        style={{
          borderLeft: '1px solid var(--v-hairline)',
          borderRight: '1px solid var(--v-hairline)',
        }}
      >
        <span className="v-crosshair -top-[5px] -left-[6px]" aria-hidden="true" />
        <span className="v-crosshair -top-[5px] -right-[6px]" aria-hidden="true" />

        {/* ZONE 1: Architectural Masthead Grid */}
        <section
          className="relative grid grid-cols-1 lg:grid-cols-12"
          style={{ borderBottom: '1px solid var(--v-hairline)' }}
        >
          <span className="v-crosshair -bottom-[6px] -left-[6px]" aria-hidden="true" />
          <span className="v-crosshair -bottom-[6px] -right-[6px]" aria-hidden="true" />

          {/* Left 8 Cols: Asset Identity */}
          <div
            className="lg:col-span-8 px-5 py-3.5 flex flex-wrap items-center justify-between gap-4"
            style={{ borderRight: '1px solid var(--v-hairline)' }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--v-primary)' }}
              />
              <h1 className="v-display-md" style={{ color: 'var(--v-ink)' }}>
                BTC/USDT
              </h1>
              <span
                className="v-mono text-xl font-bold"
                style={{ color: 'var(--v-ink)' }}
              >
                ${basePrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <span
                className="v-caption-mono px-2 py-0.5 rounded-[4px]"
                style={{
                  backgroundColor: 'var(--v-canvas-soft-2)',
                  color: 'var(--v-mute)',
                }}
              >
                실전 모드 · 20D
              </span>
            </div>
            <p className="v-caption hidden sm:block" style={{ color: 'var(--v-mute)' }}>
              차트 위 변곡점을 조정해 20일 시나리오를 완성하세요.
            </p>
          </div>

          {/* Right 4 Cols: User Tier Status & Share Action */}
          <div className="lg:col-span-4 px-5 py-3.5 flex items-center justify-between gap-3 bg-[var(--v-canvas-soft)]">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: tierInfo.accentHex }}
              />
              <span
                className="v-caption font-semibold"
                style={{ color: 'var(--v-ink)' }}
              >
                {tierInfo.krTitle} · {liveElo} LP
              </span>
              {tierInfo.nextTierElo && (
                <span
                  className="v-caption-mono text-xs truncate"
                  style={{ color: 'var(--v-mute)' }}
                >
                  (승급까지 {Math.max(0, tierInfo.nextTierElo - liveElo)} LP)
                </span>
              )}
            </div>
            {myCurrentRoundForecast && (
              <button
                type="button"
                onClick={() => setShareModalForecast(myCurrentRoundForecast)}
                className="v-btn-secondary h-8 px-2.5 text-xs flex-shrink-0"
                title="공유 카드 발급"
              >
                <Share2 size={12} />
                공유
              </button>
            )}
          </div>
        </section>

        {/* Submission Feedback Strip */}
        {justSubmittedBanner && (
          <div
            className="px-5 py-2.5 flex items-center justify-between gap-3"
            style={{
              backgroundColor: 'var(--v-bull-soft)',
              borderBottom: '1px solid var(--v-hairline)',
              color: 'var(--v-bull)',
            }}
          >
            <div className="flex items-center gap-2 v-caption font-semibold">
              <CheckCircle2 size={14} />
              <span>{justSubmittedBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setJustSubmittedBanner(null)}
              className="v-caption-mono underline"
            >
              닫기
            </button>
          </div>
        )}

        {/* ZONE 2: Core Studio Architectural Grid (8 Cols Canvas | 4 Cols Streamlined Console) */}
        <section
          className="relative grid grid-cols-1 lg:grid-cols-12"
          style={{ borderBottom: '1px solid var(--v-hairline)' }}
        >
          <span className="v-crosshair -bottom-[6px] -left-[6px]" aria-hidden="true" />
          <span className="v-crosshair -bottom-[6px] -right-[6px]" aria-hidden="true" />

          {/* Left 8 Columns: Interactive 20D Polyline Canvas */}
          <div
            className="lg:col-span-8 min-w-0"
            style={{ borderRight: '1px solid var(--v-hairline)' }}
          >
            <Polyline20DCanvas
              mode="live"
              ticker={BTC_TICKER}
              baseDate={baseDate}
              basePrice={basePrice}
              evalDates={evalDates}
              historyBars={historyBars}
              actualFutureBars={actualFutureBars}
              scaleFutureBars={targetFutureBars.length > 0 ? targetFutureBars : undefined}
              anchors={draftAnchors}
              onChangeAnchors={setDraftAnchors}
              isConsensusUnlocked={isConsensusUnlocked}
              allForecasts={liveForecasts}
              overlaidRivals={overlaidRivals}
              onRemoveOverlay={id =>
                setOverlaidRivals(prev => prev.filter(r => r.forecast.id !== id))
              }
              initialVersion={initialVersion}
            />
          </div>

          {/* Right 4 Columns: Streamlined Action Console */}
          <div className="lg:col-span-4 flex flex-col justify-between min-w-0">
            <div className="divide-y divide-[var(--v-hairline)]">
              {/* Block 1: D+20 Target Price & Expected LP Settlement */}
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="v-caption" style={{ color: 'var(--v-mute)' }}>
                      20일 뒤 목표가 ({evalDates[19]?.slice(5)})
                    </p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span
                        className="v-mono text-2xl sm:text-3xl font-bold tracking-tight"
                        style={{ color: 'var(--v-ink)' }}
                      >
                        $
                        {finalTargetPrice.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </span>
                      <span
                        className="v-mono text-sm font-bold px-2 py-0.5 rounded-[4px]"
                        style={{
                          backgroundColor:
                            finalChangePct >= 0
                              ? 'var(--v-bull-soft)'
                              : 'var(--v-bear-soft)',
                          color:
                            finalChangePct >= 0 ? 'var(--v-bull)' : 'var(--v-bear)',
                        }}
                      >
                        {formatPct(finalChangePct)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className="v-caption-mono text-xs px-2 py-0.5 rounded-[4px] inline-block"
                      style={{
                        backgroundColor: 'var(--v-canvas-soft-2)',
                        color: 'var(--v-warning)',
                      }}
                    >
                      {eloProjection.difficultyLabel}
                    </span>
                    <div className="v-mono text-xs font-bold mt-1.5">
                      <span style={{ color: 'var(--v-bull)' }}>
                        +{eloProjection.expectedWinLp} LP
                      </span>
                      <span className="mx-1" style={{ color: 'var(--v-mute)' }}>
                        /
                      </span>
                      <span style={{ color: 'var(--v-bear)' }}>
                        {eloProjection.expectedLossLp} LP
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Block 2: 4-Stage Checkpoints (D+5, D+10, D+15, D+20) */}
              <div className="grid grid-cols-4 divide-x divide-[var(--v-hairline)] bg-[var(--v-canvas-soft)]">
                {[5, 10, 15, 20].map(day => {
                  const price = interpolated.prices[day - 1] ?? basePrice;
                  const pct =
                    basePrice > 0 ? ((price - basePrice) / basePrice) * 100 : 0;
                  return (
                    <div key={day} className="p-3">
                      <p
                        className="v-caption-mono text-xs"
                        style={{ color: 'var(--v-mute)' }}
                      >
                        D+{day}
                      </p>
                      <p
                        className="v-mono text-xs font-semibold mt-0.5"
                        style={{ color: 'var(--v-ink)' }}
                      >
                        ${Math.round(price).toLocaleString('en-US')}
                      </p>
                      <p
                        className="v-caption-mono text-xs mt-0.5"
                        style={{
                          color: pct >= 0 ? 'var(--v-bull)' : 'var(--v-bear)',
                        }}
                      >
                        {formatPct(pct)}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Conditional Block: Live Tracking 100pt Scorecard (Only when D+5 ~ D+20 active) */}
              {liveTrackingScore && (
                <div
                  className="px-5 py-4 space-y-2.5"
                  style={{ backgroundColor: 'var(--v-canvas-soft-2)' }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="v-caption font-semibold"
                      style={{ color: 'var(--v-ink)' }}
                    >
                      실시간 채점 ({settledCloses.length}/20일 경과)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="v-caption-mono text-xs font-bold px-1.5 py-0.5 rounded-[4px]"
                        style={{
                          backgroundColor: 'var(--v-canvas)',
                          color: 'var(--v-bull)',
                          boxShadow: 'var(--v-shadow-border)',
                        }}
                      >
                        등급 {liveTrackingScore.grade} · {liveTrackingScore.total}점
                      </span>
                      {liveTrackingSettlement && (
                        <span
                          className="v-caption-mono text-xs font-bold px-1.5 py-0.5 rounded-[4px]"
                          style={{
                            backgroundColor:
                              liveTrackingSettlement.deltaLp >= 0
                                ? 'var(--v-bull-soft)'
                                : 'var(--v-bear-soft)',
                            color:
                              liveTrackingSettlement.deltaLp >= 0
                                ? 'var(--v-bull)'
                                : 'var(--v-bear)',
                          }}
                        >
                          {liveTrackingSettlement.deltaLp >= 0 ? '+' : ''}
                          {liveTrackingSettlement.deltaLp} LP
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 v-caption-mono text-xs">
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--v-mute)' }}>경로</span>
                        <strong>{liveTrackingScore.pathScore}/50</strong>
                      </div>
                      <div
                        className="w-full h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--v-canvas)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${(liveTrackingScore.pathScore / 50) * 100}%`,
                            backgroundColor: 'var(--v-bull)',
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--v-mute)' }}>방향</span>
                        <strong>{liveTrackingScore.directionScore}/30</strong>
                      </div>
                      <div
                        className="w-full h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--v-canvas)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${(liveTrackingScore.directionScore / 30) * 100}%`,
                            backgroundColor: 'var(--v-link)',
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--v-mute)' }}>목표</span>
                        <strong>{liveTrackingScore.targetScore}/20</strong>
                      </div>
                      <div
                        className="w-full h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--v-canvas)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${(liveTrackingScore.targetScore / 20) * 100}%`,
                            backgroundColor: 'var(--v-warning)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Block 3: Thesis Input & Primary Submit CTA */}
              <div className="p-5 space-y-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="thesis-input"
                    className="block v-caption"
                    style={{ color: 'var(--v-mute)' }}
                  >
                    예측 근거 메모 (선택)
                  </label>
                  <textarea
                    id="thesis-input"
                    rows={2}
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="예: D+7 단기 지지 확인 후 20일 우상향 돌파 전망"
                    className="w-full rounded-[4px] p-2.5 text-xs outline-none resize-none"
                    style={{
                      backgroundColor: 'var(--v-canvas-soft)',
                      color: 'var(--v-ink)',
                      boxShadow: 'var(--v-shadow-border)',
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSubmitOrUpdateForecast}
                  className="w-full v-btn-primary h-10 text-sm font-semibold"
                >
                  {!isConsensusUnlocked ? (
                    <>
                      <Unlock size={14} />
                      예측 제출하고 집단지성 열기
                    </>
                  ) : (
                    <>
                      <Layers size={14} />
                      v{(myCurrentRoundForecast?.versions?.length ?? 1) + 1} 수정본으로 저장
                    </>
                  )}
                </button>

                {myCurrentRoundForecast && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setShareModalForecast(myCurrentRoundForecast)
                      }
                      className="flex-1 v-btn-secondary h-8 text-xs"
                    >
                      <Share2 size={12} />
                      공유 카드
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/f/${myCurrentRoundForecast.id}`)}
                      className="flex-1 v-btn-secondary h-8 text-xs"
                    >
                      <ShieldCheck size={12} />
                      상세 기록
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Block 4 (Bottom): Append-Only Version Ledger */}
            <div
              className="px-5 py-3.5"
              style={{
                borderTop: '1px solid var(--v-hairline)',
                backgroundColor: 'var(--v-canvas-soft)',
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="v-caption flex items-center gap-1.5"
                  style={{ color: 'var(--v-mute)' }}
                >
                  <History size={12} />
                  버전 기록
                </span>
                <span
                  className="v-caption-mono text-xs"
                  style={{ color: 'var(--v-dim)' }}
                >
                  사후 삭제 불가
                </span>
              </div>

              {!myCurrentRoundForecast ||
              !myCurrentRoundForecast.versions ||
              myCurrentRoundForecast.versions.length === 0 ? (
                <p
                  className="v-caption text-xs"
                  style={{ color: 'var(--v-mute)' }}
                >
                  제출하면 최초 기록(v1)부터 순서대로 보존됩니다.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-24 overflow-y-auto">
                  {myCurrentRoundForecast.versions.map(ver => {
                    const endP = ver.prices[ver.prices.length - 1] ?? basePrice;
                    const pct =
                      basePrice > 0 ? ((endP - basePrice) / basePrice) * 100 : 0;
                    return (
                      <div
                        key={ver.version}
                        className="px-2.5 py-1.5 rounded-[4px] flex items-center justify-between v-caption-mono text-xs"
                        style={{
                          backgroundColor: 'var(--v-canvas)',
                          boxShadow: 'var(--v-shadow-border)',
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="px-1.5 py-0.5 rounded-[3px] font-semibold text-xs"
                            style={{
                              backgroundColor: 'var(--v-canvas-soft-2)',
                              color: 'var(--v-ink)',
                            }}
                          >
                            v{ver.version}
                          </span>
                          <span
                            className="truncate text-xs"
                            style={{ color: 'var(--v-body)' }}
                          >
                            목표 ${Math.round(endP).toLocaleString('en-US')} (
                            {formatPct(pct)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDraftAnchors(ver.anchors)}
                          className="hover:underline flex-shrink-0 ml-2 text-xs"
                          style={{ color: 'var(--v-mute)' }}
                        >
                          불러오기
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ZONE 3: Crowd Consensus & Peer Scenarios */}
        <section>
          {/* Section Header Bar */}
          <div
            className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-4"
            style={{
              backgroundColor: 'var(--v-canvas-soft)',
              borderBottom: '1px solid var(--v-hairline)',
            }}
          >
            <div className="flex items-center gap-3">
              <h2
                className="v-body-sm-strong"
                style={{ color: 'var(--v-ink)' }}
              >
                시장 집단지성 및 참여자 예측
              </h2>
              <span className="v-caption" style={{ color: 'var(--v-mute)' }}>
                {isConsensusUnlocked
                  ? `${liveForecasts.length}명 참여 중`
                  : '내 예측을 먼저 제출하면 공개됩니다'}
              </span>
            </div>
          </div>

          {!isConsensusUnlocked ? (
            /* Lean Single Locked State Panel */
            <div
              className="p-12 text-center space-y-3"
              style={{ borderBottom: '1px solid var(--v-hairline)' }}
            >
              <div
                className="w-9 h-9 rounded-full mx-auto flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--v-canvas-soft-2)',
                  color: 'var(--v-mute)',
                }}
              >
                <Lock size={15} />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <p
                  className="v-body-sm-strong"
                  style={{ color: 'var(--v-ink)' }}
                >
                  제출 전 블라인드 상태
                </p>
                <p className="v-caption" style={{ color: 'var(--v-mute)' }}>
                  편향 없는 예측을 위해 내 궤적을 먼저 제출하면 시장 중앙값과 상위 랭커의 예측이 열립니다.
                </p>
              </div>
            </div>
          ) : (
            /* Unlocked Flush 3-Column Metrics + Forecaster Grid */
            <div>
              <div
                className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--v-hairline)]"
                style={{ borderBottom: '1px solid var(--v-hairline)' }}
              >
                <div className="p-4 sm:p-5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span
                      className="v-caption"
                      style={{ color: 'var(--v-mute)' }}
                    >
                      내 예측
                    </span>
                    <span
                      className="v-caption-mono text-xs font-semibold px-1.5 py-0.5 rounded-[3px]"
                      style={{
                        backgroundColor: 'var(--v-canvas-soft-2)',
                        color:
                          finalChangePct - crowdFinalPct >= 0
                            ? 'var(--v-bull)'
                            : 'var(--v-bear)',
                      }}
                    >
                      중앙값 대비 {formatPct(finalChangePct - crowdFinalPct)}p
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span
                      className="v-mono text-xl font-bold"
                      style={{ color: 'var(--v-ink)' }}
                    >
                      ${Math.round(finalTargetPrice).toLocaleString('en-US')}
                    </span>
                    <span
                      className="v-mono text-sm font-semibold"
                      style={{
                        color:
                          finalChangePct >= 0
                            ? 'var(--v-bull)'
                            : 'var(--v-bear)',
                      }}
                    >
                      {formatPct(finalChangePct)}
                    </span>
                  </div>
                  <p
                    className="v-caption text-[11px]"
                    style={{ color: 'var(--v-mute)' }}
                  >
                    {eloProjection.difficultyLabel} · 적중 시 +{eloProjection.expectedWinLp} LP
                  </p>
                </div>

                <div className="p-4 sm:p-5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span
                      className="v-caption"
                      style={{ color: 'var(--v-mute)' }}
                    >
                      시장 중앙값
                    </span>
                    <span
                      className="v-caption-mono text-xs"
                      style={{ color: 'var(--v-mute)' }}
                    >
                      {crowdAggregate.participantsCount}명 참여
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span
                      className="v-mono text-xl font-bold"
                      style={{ color: 'var(--v-ink)' }}
                    >
                      ${Math.round(crowdFinalMedian).toLocaleString('en-US')}
                    </span>
                    <span
                      className="v-mono text-sm font-semibold"
                      style={{
                        color:
                          crowdFinalPct >= 0
                            ? 'var(--v-bull)'
                            : 'var(--v-bear)',
                      }}
                    >
                      {formatPct(crowdFinalPct)}
                    </span>
                  </div>
                  <p
                    className="v-caption text-[11px]"
                    style={{ color: 'var(--v-mute)' }}
                  >
                    상위 25~75% 분위 밴드 차트 표시
                  </p>
                </div>

                <div className="p-4 sm:p-5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span
                      className="v-caption"
                      style={{ color: 'var(--v-mute)' }}
                    >
                      상위 랭커 중앙값
                    </span>
                    <span
                      className="v-caption-mono text-xs font-semibold"
                      style={{ color: 'var(--v-bull)' }}
                    >
                      다이아·플래티넘
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span
                      className="v-mono text-xl font-bold"
                      style={{ color: 'var(--v-bull)' }}
                    >
                      ${Math.round(topFinalMedian).toLocaleString('en-US')}
                    </span>
                    <span
                      className="v-mono text-sm font-semibold"
                      style={{
                        color:
                          topFinalPct >= 0 ? 'var(--v-bull)' : 'var(--v-bear)',
                      }}
                    >
                      {formatPct(topFinalPct)}
                    </span>
                  </div>
                  <p
                    className="v-caption text-[11px]"
                    style={{ color: 'var(--v-mute)' }}
                  >
                    아래 카드를 눌러 차트에 궤적 겹쳐보기 가능
                  </p>
                </div>
              </div>

              {/* Flush Forecaster Matrix (1px hairline grid) */}
              <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px"
                style={{
                  backgroundColor: 'var(--v-hairline)',
                  borderBottom: '1px solid var(--v-hairline)',
                }}
              >
                {liveForecasts.map((fc, idx) => {
                  const author = fc.authorId
                    ? repository.getUser(fc.authorId)
                    : null;
                  const handle = author
                    ? author.handle
                    : `guest_${fc.anonId.slice(-4)}`;
                  const elo = author?.elo ?? DEFAULT_ELO;
                  const tier = getEloTierInfo(elo);
                  const path = fc.path || [];
                  const endP =
                    path.length > 0
                      ? path[path.length - 1].price
                      : fc.basePrice;
                  const pct =
                    fc.basePrice > 0
                      ? ((endP - fc.basePrice) / fc.basePrice) * 100
                      : 0;
                  const isOverlaid = overlaidRivals.some(
                    r => r.forecast.id === fc.id
                  );
                  const verCount = fc.versions?.length ?? 1;

                  return (
                    <div
                      key={fc.id}
                      className="p-4 sm:p-5 flex flex-col justify-between space-y-3 transition-colors"
                      style={{
                        backgroundColor: isOverlaid
                          ? 'var(--v-canvas-soft)'
                          : 'var(--v-canvas)',
                      }}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="v-caption-mono text-xs font-bold px-1.5 py-0.5 rounded-[3px] flex-shrink-0"
                              style={{
                                backgroundColor: 'var(--v-canvas-soft-2)',
                                color:
                                  idx < 3 ? 'var(--v-ink)' : 'var(--v-mute)',
                              }}
                            >
                              #{idx + 1}
                            </span>
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: tier.accentHex }}
                            />
                            <span
                              className="v-body-sm-strong truncate"
                              style={{ color: 'var(--v-ink)' }}
                            >
                              @{handle}
                            </span>
                            <span
                              className="v-caption-mono text-[11px] px-1.5 py-0.5 rounded-[3px] flex-shrink-0"
                              style={{
                                backgroundColor: 'var(--v-canvas-soft)',
                                color: tier.accentHex,
                              }}
                            >
                              {tier.krTitle}
                            </span>
                          </div>

                          <span
                            className="v-mono text-xs font-semibold flex-shrink-0"
                            style={{
                              color:
                                pct >= 0 ? 'var(--v-bull)' : 'var(--v-bear)',
                            }}
                          >
                            {formatPct(pct)}
                          </span>
                        </div>

                        <p
                          className="v-caption line-clamp-1"
                          style={{ color: 'var(--v-body)' }}
                        >
                          {fc.comment || '20일 변곡점 시계열 예측'}
                        </p>
                      </div>

                      <div className="pt-2.5 flex items-center justify-between gap-2 border-t border-[var(--v-hairline-subtle)]">
                        <span
                          className="v-caption-mono text-xs"
                          style={{ color: 'var(--v-mute)' }}
                        >
                          목표 ${Math.round(endP).toLocaleString('en-US')} · {elo} LP (v{verCount})
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleOverlayRival(fc, handle, elo)
                            }
                            className="v-btn-secondary h-6 px-2.5 text-[11px] font-medium"
                            style={{
                              backgroundColor: isOverlaid
                                ? 'var(--v-primary)'
                                : 'var(--v-canvas)',
                              color: isOverlaid
                                ? 'var(--v-on-primary)'
                                : 'var(--v-ink)',
                            }}
                          >
                            {isOverlaid ? '비교 해제' : 'VS 차트 대결'}
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/f/${fc.id}`)}
                            className="v-btn-secondary h-6 px-2 text-[11px]"
                          >
                            상세
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>

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
          authorElo={liveElo}
        />
      )}
    </div>
  );
}
