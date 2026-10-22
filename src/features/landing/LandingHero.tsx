import { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { PenTool, ArrowUpRight, Lock, Check, Share2, RotateCcw } from 'lucide-react';
import { PathCanvas } from '../draw/PathCanvas';
import { ForecastChart } from '../../components/ForecastChart';
import { ShareTicketModal } from '../../components/ShareTicketModal';
import { getStockHistory, getCurrentStockPrice, getStockLandmarks, CORE_STOCKS } from '../../data/market';
import { getNextTradingDays, getHorizonTradingDays } from '../../domain/tradingCalendar';
import { getRoundFor, getCountdownRemaining } from '../../domain/round';
import { formatPct } from '../../domain/format';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId } from '../../data/session';
import { aggregateCrowd } from '../../domain/crowd';
import { calculateEloProjection, formatSignedLp } from '../../domain/elo';
import { track } from '../../lib/analytics';
import type { PathPoint, Forecast } from '../../domain/types';

interface LandingHeroProps {
  currentDateStr?: string;
}

export function LandingHero({ currentDateStr = '2026-10-05' }: LandingHeroProps) {
  const navigate = useNavigate();
  const [ticker, setTicker] = useState<string>('NVDA');
  const [draftPath, setDraftPath] = useState<PathPoint[]>([]);
  const [lockedForecast, setLockedForecast] = useState<Forecast | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const stockMeta = CORE_STOCKS.find(s => s.ticker === ticker) || CORE_STOCKS[0];

  const round = useMemo(() => getRoundFor(ticker, currentDateStr), [ticker, currentDateStr]);
  const [countdown, setCountdown] = useState(() => getCountdownRemaining(round.cutoffAt));

  useEffect(() => {
    setCountdown(getCountdownRemaining(round.cutoffAt));
    const timer = setInterval(() => {
      setCountdown(getCountdownRemaining(round.cutoffAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [round.cutoffAt]);

  const basePrice = getCurrentStockPrice(ticker, currentDateStr);
  const tradingDaysCount = getHorizonTradingDays('5D');
  const evalDates = useMemo(() => getNextTradingDays(currentDateStr, tradingDaysCount), [currentDateStr, tradingDaysCount]);
  const stockBars = getStockHistory(ticker);
  const pastBars = useMemo(() => stockBars.filter(b => b.date <= currentDateStr).slice(-15), [stockBars, currentDateStr]);
  const landmarks = useMemo(() => getStockLandmarks(ticker, basePrice), [ticker, basePrice]);

  const allForecasts = useMemo(() => repository.listFeed('all', currentDateStr), [currentDateStr, lockedForecast]);
  const crowd = useMemo(() => aggregateCrowd(allForecasts, ticker, '5D', 'path'), [allForecasts, ticker]);
  const currentUser = getCurrentUser();

  const isMiniComplete = draftPath.length === evalDates.length && evalDates.length > 0;
  const lastDraftPoint = draftPath.length > 0 ? draftPath[draftPath.length - 1] : null;
  const draftChangePct = lastDraftPoint ? ((lastDraftPoint.price - basePrice) / basePrice) * 100 : null;

  const eloProjection = useMemo(() => {
    if (draftChangePct === null) return null;
    return calculateEloProjection(
      draftChangePct,
      crowd.consensusChangePct,
      stockMeta.volatility
    );
  }, [draftChangePct, crowd.consensusChangePct, stockMeta.volatility]);

  const handleInstantLock = () => {
    if (!isMiniComplete) {
      navigate(`/draw?ticker=${ticker}`);
      return;
    }

    const anonId = getOrCreateAnonId();
    const pathPct = draftPath.map(p => parseFloat(((p.price - basePrice) / basePrice).toFixed(4)));

    const created = repository.createForecast({
      authorId: currentUser ? currentUser.id : null,
      anonId,
      ticker,
      horizon: '5D',
      mode: 'path',
      comment: `${ticker} 5D 궤적 예측`,
      basePrice,
      baseDate: currentDateStr,
      evalDates,
      path: draftPath,
      pathPct,
      roundId: round.id,
    });

    track('forecast_locked', {
      ticker,
      roundId: round.id,
      source: 'landing_hero_onestop',
    });

    setLockedForecast(created);
  };

  const handleProceedToDraw = () => {
    track('share_landing', { action: 'mini_canvas_proceed', ticker, points: draftPath.length });
    navigate(`/draw?ticker=${ticker}`, {
      state: {
        ticker,
        path: draftPath,
      },
    });
  };

  return (
    <section className="relative w-full pt-10 pb-14 sm:pt-16 sm:pb-20 border-b border-zinc-800 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Direct, Evidence-First Typography & Actions */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="font-mono text-zinc-300 tabular-nums">{round.id}</span>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-300 font-medium font-mono tabular-nums">마감 {countdown.formatted}</span>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                5D Price Forecast & Elo Protocol
              </p>
              <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-[1.15]">
                5일 주가 예측과
                <br />
                Elo 레이팅 정산
              </h1>
            </div>

            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-md">
              차트 위에 향후 5거래일 예상 주가 경로를 그리면 시장 컨센서스가 공개되고, 만기일 실제 종가 오차율로 Elo 레이팅이 정산됩니다.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={isMiniComplete && !lockedForecast ? handleInstantLock : handleProceedToDraw}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-white hover:bg-zinc-200 text-black font-medium text-sm transition"
              >
                {isMiniComplete && !lockedForecast ? (
                  <>
                    <Lock size={14} className="stroke-[2.2]" />
                    <span>${ticker} 예측 확정</span>
                  </>
                ) : (
                  <>
                    <PenTool size={14} className="stroke-[2.2]" />
                    <span>5D 예측 그리기</span>
                  </>
                )}
              </button>

              <NavLink
                to="/"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md bg-transparent hover:bg-zinc-900 text-zinc-300 hover:text-white font-medium text-sm border border-zinc-800 hover:border-zinc-700 transition"
              >
                <span>대시보드 이동</span>
                <ArrowUpRight size={14} className="text-zinc-500" />
              </NavLink>
            </div>
          </div>

          {/* Right Column: Interactive 5D Canvas (1px Hairline Container, No Nested Cards) */}
          <div className="lg:col-span-7">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800 overflow-hidden">
              
              {/* Top Bar: Ticker Switcher */}
              <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-xs font-medium text-white">
                    {lockedForecast ? '예측 확정됨 · 시장 컨센서스 공개' : '5D 예측 캔버스'}
                  </span>
                  <span className="text-xs text-zinc-400 font-mono tabular-nums">${basePrice.toFixed(2)}</span>
                </div>

                <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-md border border-zinc-800">
                  {CORE_STOCKS.map(s => (
                    <button
                      key={s.ticker}
                      type="button"
                      onClick={() => {
                        setTicker(s.ticker);
                        setDraftPath([]);
                        setLockedForecast(null);
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition ${
                        ticker === s.ticker
                          ? 'bg-zinc-800 text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      ${s.ticker}
                    </button>
                  ))}
                </div>
              </div>

              {!lockedForecast ? (
                <>
                  <div className="p-4 sm:p-5 w-full" key={ticker}>
                    <PathCanvas
                      basePrice={basePrice}
                      evalDates={evalDates}
                      pastBars={pastBars}
                      volatility={stockMeta.volatility}
                      landmarks={landmarks}
                      crowdChangePct={crowd.consensusChangePct}
                      compact={true}
                      onPathChange={setDraftPath}
                    />
                  </div>

                  <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-zinc-950">
                    {draftChangePct !== null && eloProjection ? (
                      <div className="flex items-center gap-2.5 text-xs font-mono tabular-nums">
                        <span>
                          <span className="text-zinc-500 font-sans">목표 </span>
                          <span className="text-white font-medium">${lastDraftPoint?.price.toFixed(2)}</span>{' '}
                          <span className={draftChangePct >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                            ({formatPct(draftChangePct)})
                          </span>
                        </span>
                        <span className="text-zinc-700">·</span>
                        <span>
                          <span className="text-emerald-400 font-medium">{formatSignedLp(eloProjection.expectedWinLp)}</span>
                          <span className="text-zinc-600"> / </span>
                          <span className="text-rose-400">{formatSignedLp(eloProjection.expectedLossLp)}</span>
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-500">
                        우측 5일 구간을 드래그해 예상 경로를 그리세요
                      </span>
                    )}

                    <div className="flex items-center gap-2 ml-auto">
                      {isMiniComplete && (
                        <button
                          type="button"
                          onClick={handleProceedToDraw}
                          className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 transition"
                        >
                          메모 추가
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleInstantLock}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition ${
                          isMiniComplete
                            ? 'bg-white text-black hover:bg-zinc-200'
                            : 'bg-zinc-900 text-zinc-200 border border-zinc-800 hover:bg-zinc-800'
                        }`}
                      >
                        <Lock size={12} />
                        <span>{isMiniComplete ? '즉시 확정 (컨센서스 보기)' : '풀 캔버스'}</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="divide-y divide-zinc-800">
                  <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400" />
                      <span className="font-medium text-white">
                        ${ticker} 시장 컨센서스 ({crowd.participantsCount}명 참여)
                      </span>
                    </div>
                    {eloProjection && (
                      <span className="font-mono text-zinc-300 tabular-nums">
                        예상 정산 <span className="text-emerald-400 font-medium">{formatSignedLp(eloProjection.expectedWinLp)}</span> / <span className="text-rose-400">{formatSignedLp(eloProjection.expectedLossLp)}</span>
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <ForecastChart
                      forecast={lockedForecast}
                      height={220}
                      showCrowd={true}
                      crowdPath={crowd.consensusPath}
                      currentDateStr={currentDateStr}
                    />
                  </div>

                  <div className="px-4 py-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLockedForecast(null);
                        setDraftPath([]);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition"
                    >
                      <RotateCcw size={13} />
                      <span>다시 그리기</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/f/${lockedForecast.id}`)}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-900 text-zinc-200 border border-zinc-800 hover:border-zinc-700 transition"
                      >
                        상세 보기
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsShareOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium bg-white text-black hover:bg-zinc-200 transition"
                      >
                        <Share2 size={13} />
                        <span>티켓 공유</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>

      {lockedForecast && (
        <ShareTicketModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          forecast={lockedForecast}
          authorHandle={currentUser?.handle || 'device_user'}
          crowdPath={crowd.consensusPath}
          crowdChangePct={crowd.consensusChangePct}
        />
      )}
    </section>
  );
}

export default LandingHero;
