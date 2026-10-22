import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Check, Share2, Lock, FastForward } from 'lucide-react';
import { CORE_STOCKS, getCurrentStockPrice, getStockHistory, getStockLandmarks } from '../../data/market';
import { getNextTradingDays, getHorizonTradingDays } from '../../domain/tradingCalendar';
import { getRoundFor, getCountdownRemaining } from '../../domain/round';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId } from '../../data/session';
import { aggregateCrowd } from '../../domain/crowd';
import { resolveForecast } from '../../domain/resolution';
import { formatPct } from '../../domain/format';
import { calculateEloProjection, DEFAULT_ELO, formatSignedLp, getEloTierInfo } from '../../domain/elo';
import { PathCanvas } from './PathCanvas';
import { ForecastChart } from '../../components/ForecastChart';
import { ShareTicketModal } from '../../components/ShareTicketModal';
import { ConnectModal } from '../auth/ConnectModal';
import { track } from '../../lib/analytics';
import type { Horizon, Mode, PathPoint, Forecast } from '../../domain/types';

interface DrawWizardProps {
  currentDateStr: string;
  onDateChange?: (date: string) => void;
}

const QUICK_CHIPS = ['#실적모멘텀', '#눌림목반등', '#저항선돌파', '#단기차익실현'];

export function DrawWizard({ currentDateStr, onDateChange }: DrawWizardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const urlTicker = searchParams.get('ticker');
  const incomingState = location.state as { ticker?: string; path?: PathPoint[] } | null;
  const initialTicker = incomingState?.ticker || urlTicker || 'NVDA';
  const initialPath = incomingState?.path || [];

  const [ticker, setTicker] = useState<string>(initialTicker.toUpperCase());
  const [path, setPath] = useState<PathPoint[]>(initialPath);
  const [comment, setComment] = useState<string>('');
  const [isLocked, setIsLocked] = useState(false);
  const [lockedForecast, setLockedForecast] = useState<Forecast | null>(null);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const effectiveBaseDate = lockedForecast ? lockedForecast.baseDate : currentDateStr;
  const round = useMemo(() => getRoundFor(ticker, effectiveBaseDate), [ticker, effectiveBaseDate]);
  const [countdown, setCountdown] = useState(() => getCountdownRemaining(round.cutoffAt));

  useEffect(() => {
    setCountdown(getCountdownRemaining(round.cutoffAt));
    const timer = setInterval(() => {
      setCountdown(getCountdownRemaining(round.cutoffAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [round.cutoffAt]);

  const horizon: Horizon = '5D';
  const mode: Mode = 'path';

  const basePrice = lockedForecast ? lockedForecast.basePrice : getCurrentStockPrice(ticker, currentDateStr);
  const tradingDaysCount = getHorizonTradingDays(horizon);
  const evalDates = useMemo(
    () => (lockedForecast ? lockedForecast.evalDates : getNextTradingDays(currentDateStr, tradingDaysCount)),
    [lockedForecast, currentDateStr, tradingDaysCount]
  );
  const stockBars = getStockHistory(ticker);
  const pastBars = useMemo(
    () => stockBars.filter(b => b.date <= effectiveBaseDate).slice(-15),
    [stockBars, effectiveBaseDate]
  );
  const stockMeta = CORE_STOCKS.find(s => s.ticker === ticker) || CORE_STOCKS[0];
  const landmarks = useMemo(() => getStockLandmarks(ticker, basePrice), [ticker, basePrice]);

  const lastEvalDate = evalDates[evalDates.length - 1];
  const isPathComplete = path.length === evalDates.length && path.some(p => p.date === lastEvalDate);

  const handleTickerSwitch = (newTicker: string) => {
    if (newTicker === ticker) return;
    setTicker(newTicker);
    setPath([]);
    track('ticker_switched', { from: ticker, to: newTicker });
  };

  const handleChipClick = (chip: string) => {
    if (comment.includes(chip)) return;
    setComment(prev => (prev ? `${prev} ${chip}` : chip));
  };

  const handleLock = () => {
    if (!isPathComplete) return;

    const currentUser = getCurrentUser();
    const anonId = getOrCreateAnonId();

    const pathPct = path.map(p => parseFloat(((p.price - basePrice) / basePrice).toFixed(4)));

    const created = repository.createForecast({
      authorId: currentUser ? currentUser.id : null,
      anonId,
      ticker,
      horizon: '5D',
      mode: 'path',
      comment: comment.trim() || `${ticker} 5D 궤적 예측`,
      basePrice,
      baseDate: effectiveBaseDate,
      evalDates,
      path,
      pathPct,
      roundId: round.id,
    });

    track('forecast_locked', {
      ticker,
      roundId: round.id,
      hasComment: Boolean(comment.trim()),
    });

    setLockedForecast(created);
    setIsLocked(true);
  };

  const allForecasts = repository.listFeed('all', currentDateStr);
  const crowd = aggregateCrowd(allForecasts, ticker, horizon, mode);
  const currentUser = getCurrentUser();
  const userElo = currentUser?.elo ?? DEFAULT_ELO;

  const lockedResult = useMemo(() => {
    if (!lockedForecast) return null;
    const visibleBars = stockBars.filter(b => b.date <= currentDateStr);
    return resolveForecast(lockedForecast, visibleBars, crowd.consensusChangePct);
  }, [lockedForecast, stockBars, currentDateStr, crowd.consensusChangePct]);

  const draftTargetPrice = path[path.length - 1]?.price ?? basePrice;
  const draftChangePct = ((draftTargetPrice - basePrice) / basePrice) * 100;
  const draftProjection = useMemo(
    () => calculateEloProjection(draftChangePct, crowd.consensusChangePct, stockMeta.volatility),
    [draftChangePct, crowd.consensusChangePct, stockMeta.volatility]
  );

  const myTargetPrice = lockedForecast?.path?.[lockedForecast.path.length - 1]?.price ?? basePrice;
  const myChangePct = lockedForecast
    ? ((myTargetPrice - lockedForecast.basePrice) / lockedForecast.basePrice) * 100
    : 0;
  const crowdChangePct = crowd.consensusChangePct ?? 0;
  const divergencePct = myChangePct - crowdChangePct;

  const lockedEloProjection = useMemo(() => {
    if (!lockedForecast) return null;
    return calculateEloProjection(myChangePct, crowd.consensusChangePct, stockMeta.volatility);
  }, [lockedForecast, myChangePct, crowd.consensusChangePct, stockMeta.volatility]);

  const handleTimeSlipToResolved = () => {
    if (!lockedForecast || !onDateChange) return;
    const finalEvalDate = lockedForecast.evalDates[lockedForecast.evalDates.length - 1] || '2026-10-12';
    onDateChange(finalEvalDate);
  };

  const effectiveElo = userElo + (lockedResult?.eloSettlement?.deltaLp ?? 0);
  const userTier = getEloTierInfo(effectiveElo);

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft size={15} />
          <span>뒤로</span>
        </button>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-medium border ${userTier.badgeClass}`}>
            {userTier.tier} · {effectiveElo} LP
          </span>
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono">
            <span className="text-zinc-500">{round.id}</span>
            <span className="text-zinc-700">/</span>
            <span className="text-zinc-300 font-medium">마감 {countdown.formatted}</span>
          </div>
        </div>
      </div>

      {/* Step 1: Active Draw View (Single 1px Hairline Container, No Nested Cards) */}
      {!isLocked ? (
        <div className="rounded-lg bg-zinc-950 border border-zinc-800 divide-y divide-zinc-800 overflow-hidden">
          {/* Header & Stock Switching Pills */}
          <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">
                5D 주가 예측 작도
              </h2>
            </div>

            <div className="flex items-center gap-1 p-0.5 rounded-md bg-zinc-900 border border-zinc-800">
              {CORE_STOCKS.map(s => {
                const isSelected = s.ticker === ticker;
                return (
                  <button
                    key={s.ticker}
                    type="button"
                    onClick={() => handleTickerSwitch(s.ticker)}
                    className={`px-3 py-1 rounded text-xs font-mono font-medium transition ${
                      isSelected
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    ${s.ticker}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Canvas Component */}
          <div className="p-5 w-full" key={ticker}>
            <PathCanvas
              basePrice={basePrice}
              evalDates={evalDates}
              pastBars={pastBars}
              initialPath={path}
              volatility={stockMeta.volatility}
              landmarks={landmarks}
              crowdChangePct={crowd.consensusChangePct}
              onPathChange={setPath}
            />
          </div>

          {/* Slide-Up Confirmation & Elo Stake Section (Separated by 1px Hairline) */}
          {isPathComplete && (
            <div className="p-5 bg-zinc-950 space-y-3.5">
              {/* Live Elo Stake Summary */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800 text-xs font-mono tabular-nums">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800 font-sans font-medium text-[11px]">
                    {draftProjection.difficultyLabel}
                  </span>
                  <span className="text-zinc-500 font-sans">예상 정산</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="text-emerald-400">적중 {formatSignedLp(draftProjection.expectedWinLp)}</span>
                  <span className="text-zinc-600">/</span>
                  <span className="text-rose-400">실패 {formatSignedLp(draftProjection.expectedLossLp)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-300">
                  한 줄 근거 메모 (선택)
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {QUICK_CHIPS.map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleChipClick(chip)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono border transition ${
                        comment.includes(chip)
                          ? 'bg-zinc-800 border-zinc-600 text-white font-medium'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={2}
                placeholder={`${ticker} 5일 예측 근거 입력...`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full p-2.5 rounded-md bg-zinc-900 border border-zinc-800 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
              />

              <button
                type="button"
                onClick={handleLock}
                className="w-full py-2.5 rounded-md bg-white hover:bg-zinc-200 text-black font-medium text-sm flex items-center justify-center gap-2 transition"
              >
                <Lock size={14} className="stroke-[2.2]" />
                <span>예측 확정 및 시장 컨센서스 보기</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Step 2: Reveal & Elo Settlement View (Single 1px Hairline Container, No Nested Cards) */
        <div className="rounded-lg bg-zinc-950 border border-zinc-800 divide-y divide-zinc-800 overflow-hidden">
          <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Check size={14} className="stroke-[2.2]" />
              </div>
              <h2 className="text-base font-bold tracking-tight text-white">
                ${ticker} 예측 확정 완료
              </h2>
            </div>

            {onDateChange && lockedForecast && currentDateStr < lockedForecast.evalDates[lockedForecast.evalDates.length - 1] && (
              <button
                type="button"
                onClick={handleTimeSlipToResolved}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-mono font-medium transition"
              >
                <FastForward size={12} />
                <span>5일 뒤 정산 시뮬레이션</span>
              </button>
            )}
          </div>

          {/* 4-Column Metric Strip (1px Hairline Grid) */}
          {lockedForecast && (
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800 text-left font-mono tabular-nums">
              <div className="p-4">
                <div className="text-[11px] text-zinc-500 mb-1 font-sans">내 목표 수익률</div>
                <div className={`text-base font-semibold ${myChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatPct(myChangePct)} <span className="text-xs text-zinc-500 font-normal">(${myTargetPrice.toFixed(1)})</span>
                </div>
              </div>

              <div className="p-4">
                <div className="text-[11px] text-zinc-500 mb-1 font-sans">
                  시장 컨센서스 ({crowd.participantsCount}명)
                </div>
                <div className="text-base font-semibold text-white">
                  {formatPct(crowdChangePct)}
                </div>
              </div>

              <div className="p-4">
                <div className="text-[11px] text-zinc-500 mb-1 font-sans">예측 난이도</div>
                <div className="text-xs sm:text-sm font-medium text-white font-sans flex items-center gap-1.5">
                  <span>{lockedEloProjection?.difficultyLabel}</span>
                  <span className="font-mono text-[11px] text-zinc-500">
                    ({divergencePct >= 0 ? '+' : ''}{divergencePct.toFixed(1)}%p)
                  </span>
                </div>
              </div>

              <div className="p-4">
                <div className="text-[11px] text-zinc-500 mb-1 font-sans">
                  {lockedResult?.eloSettlement ? 'Elo 정산 완료' : '예상 Elo 변동'}
                </div>
                {lockedResult?.eloSettlement ? (
                  <div className="text-base font-semibold flex items-center gap-1.5">
                    <span className={lockedResult.eloSettlement.deltaLp >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {formatSignedLp(lockedResult.eloSettlement.deltaLp)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      ({lockedResult.score?.total}점)
                    </span>
                  </div>
                ) : lockedEloProjection ? (
                  <div className="text-sm font-semibold flex items-center gap-1">
                    <span className="text-emerald-400">{formatSignedLp(lockedEloProjection.expectedWinLp)}</span>
                    <span className="text-zinc-600">/</span>
                    <span className="text-rose-400">{formatSignedLp(lockedEloProjection.expectedLossLp)}</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Comparison Chart */}
          {lockedForecast && (
            <div className="p-5 bg-black text-left">
              <ForecastChart
                forecast={lockedForecast}
                height={260}
                showCrowd={true}
                crowdPath={crowd.consensusPath}
                currentDateStr={currentDateStr}
              />
            </div>
          )}

          {/* Action CTAs */}
          <div className="px-5 py-3.5 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate(`/arena/${ticker}`)}
              className="px-3.5 py-2 rounded-md text-xs font-medium bg-zinc-900 text-zinc-300 border border-zinc-800 hover:text-white hover:border-zinc-700 transition"
            >
              마켓 보기
            </button>

            {lockedForecast && (
              <button
                type="button"
                onClick={() => navigate(`/f/${lockedForecast.id}`)}
                className="px-3.5 py-2 rounded-md text-xs font-medium bg-zinc-900 text-white border border-zinc-800 hover:border-zinc-700 transition"
              >
                상세 성적표
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsShareOpen(true)}
              className="px-4 py-2 rounded-md bg-white hover:bg-zinc-200 text-black font-medium text-xs flex items-center gap-1.5 transition"
            >
              <Share2 size={13} />
              <span>티켓 공유 (PNG)</span>
            </button>
          </div>
        </div>
      )}

      {lockedForecast && (
        <ShareTicketModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          forecast={lockedForecast}
          authorHandle={currentUser?.handle || 'device_user'}
          crowdPath={crowd.consensusPath}
          crowdChangePct={crowd.consensusChangePct}
          scoreTotal={lockedResult?.score?.total}
          scoreGrade={lockedResult?.score?.grade}
          eloDeltaLp={lockedResult?.eloSettlement?.deltaLp}
          authorElo={effectiveElo}
        />
      )}

      <ConnectModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onSuccess={() => setIsConnectOpen(false)}
      />
    </div>
  );
}

export default DrawWizard;
