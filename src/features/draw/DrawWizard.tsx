import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, TrendingUp, PenTool, Share2 } from 'lucide-react';
import { STOCKS, getCurrentStockPrice, getStockHistory } from '../../data/market';
import { getNextTradingDays, getHorizonTradingDays } from '../../domain/tradingCalendar';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId } from '../../data/session';
import { aggregateCrowd } from '../../domain/crowd';
import { PathCanvas } from './PathCanvas';
import { BreakoutCanvas } from './BreakoutCanvas';
import { ForecastChart } from '../../components/ForecastChart';
import { ConnectModal } from '../auth/ConnectModal';
import { formatCurrency } from '../../domain/format';
import type { Horizon, Mode, PathPoint, BreakoutTarget, Forecast } from '../../domain/types';

type Step = 'stock' | 'horizon' | 'mode' | 'draw' | 'preview' | 'reveal';

interface DrawWizardProps {
  currentDateStr: string;
}

export function DrawWizard({ currentDateStr }: DrawWizardProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL Params from [나도 그리기]
  const parentId = searchParams.get('parent') || undefined;
  const initialTicker = searchParams.get('ticker') || 'TSLA';
  const initialHorizon = (searchParams.get('horizon') as Horizon) || '5D';
  const initialMode = (searchParams.get('mode') as Mode) || 'path';

  const isResponse = Boolean(parentId);
  const [step, setStep] = useState<Step>(isResponse ? 'draw' : 'stock');

  const [ticker, setTicker] = useState<string>(initialTicker);
  const [horizon, setHorizon] = useState<Horizon>(initialHorizon);
  const [mode, setMode] = useState<Mode>(initialMode);

  const [path, setPath] = useState<PathPoint[]>([]);
  const [breakout, setBreakout] = useState<BreakoutTarget>({
    direction: 'up',
    price: Math.round(getCurrentStockPrice(initialTicker, currentDateStr) * 1.05 * 10) / 10,
  });
  const [comment, setComment] = useState<string>('');

  const [lockedForecast, setLockedForecast] = useState<Forecast | null>(null);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Stock metadata & dates
  const basePrice = getCurrentStockPrice(ticker, currentDateStr);
  const tradingDaysCount = getHorizonTradingDays(horizon);
  const evalDates = React.useMemo(() => getNextTradingDays(currentDateStr, tradingDaysCount), [currentDateStr, tradingDaysCount]);
  const stockBars = getStockHistory(ticker);
  const pastBars = React.useMemo(() => stockBars.filter(b => b.date <= currentDateStr).slice(-15), [stockBars, currentDateStr]);

  const lastEvalDate = evalDates[evalDates.length - 1];
  const hasEndTarget = path.some(p => p.date === lastEvalDate);

  const handleStockSelect = (selectedTicker: string) => {
    setTicker(selectedTicker);
    const newPrice = getCurrentStockPrice(selectedTicker, currentDateStr);
    setBreakout({ direction: 'up', price: Math.round(newPrice * 1.05 * 10) / 10 });
    setStep('horizon');
  };

  const handleHorizonSelect = (selectedHorizon: Horizon) => {
    setHorizon(selectedHorizon);
    setStep('mode');
  };

  const handleModeSelect = (selectedMode: Mode) => {
    setMode(selectedMode);
    setStep('draw');
  };

  const canProceedFromDraw = mode === 'path'
    ? (path.length > 0 && hasEndTarget)
    : Boolean(breakout);

  const handleProceedToPreview = () => {
    setStep('preview');
  };

  // Lock Forecast
  const handleLock = () => {
    const currentUser = getCurrentUser();
    const anonId = getOrCreateAnonId();

    const created = repository.createForecast({
      authorId: currentUser ? currentUser.id : null,
      anonId,
      ticker,
      horizon,
      mode,
      comment: comment.trim() || `${ticker} ${horizon} ${mode === 'path' ? '경로' : '돌파'} 예측`,
      basePrice,
      baseDate: currentDateStr,
      evalDates,
      path: mode === 'path' ? path : undefined,
      breakout: mode === 'breakout' ? breakout : undefined,
      parentId,
    });

    setLockedForecast(created);
    setStep('reveal');
  };

  // Crowd computation for reveal step
  const allForecasts = repository.listFeed('all', currentDateStr);
  const crowd = aggregateCrowd(allForecasts, ticker, horizon, mode);

  return (
    <div className="w-full max-w-3xl mx-auto py-2">
      {/* Top Navigation Step Indicators */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => {
            if (step === 'stock' || isResponse) navigate(-1);
            else if (step === 'horizon') setStep('stock');
            else if (step === 'mode') setStep('horizon');
            else if (step === 'draw') setStep('mode');
            else if (step === 'preview') setStep('draw');
            else navigate('/');
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
        >
          <ArrowLeft size={16} />
          <span>이전 단계</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400">
          <span className={step === 'stock' ? 'text-zinc-900 dark:text-white font-bold' : ''}>1.종목</span>
          <span>·</span>
          <span className={step === 'horizon' ? 'text-zinc-900 dark:text-white font-bold' : ''}>2.기간</span>
          <span>·</span>
          <span className={step === 'mode' ? 'text-zinc-900 dark:text-white font-bold' : ''}>3.방식</span>
          <span>·</span>
          <span className={step === 'draw' ? 'text-zinc-900 dark:text-white font-bold' : ''}>4.그리기</span>
          <span>·</span>
          <span className={step === 'preview' || step === 'reveal' ? 'text-zinc-900 dark:text-white font-bold' : ''}>5.잠금</span>
        </div>
      </div>

      {/* Main Wizard Container Card */}
      <div className="rounded-3xl bg-white dark:bg-[#0e1017] border border-zinc-200/90 dark:border-zinc-800 p-6 sm:p-10 shadow-sm">
        {/* Step 1: Stock Selection */}
        {step === 'stock' && (
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-2">
              예측할 종목을 선택하세요
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 mb-6">
              미래 주가 궤적을 제시할 주요 테크 및 모멘텀 자산
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STOCKS.map(s => {
                const price = getCurrentStockPrice(s.ticker, currentDateStr);
                return (
                  <button
                    key={s.ticker}
                    onClick={() => handleStockSelect(s.ticker)}
                    className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-800 transition text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm"
                        style={{ backgroundColor: s.logoColor }}
                      >
                        {s.ticker.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-zinc-900 dark:text-white font-mono text-sm">
                          ${s.ticker}
                        </div>
                        <div className="text-xs text-zinc-500">{s.name}</div>
                      </div>
                    </div>
                    <div className="text-right font-mono font-semibold text-zinc-900 dark:text-white text-sm">
                      {formatCurrency(price)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Horizon Selection */}
        {step === 'horizon' && (
          <div>
            <div className="mb-4">
              <span className="px-3 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-mono font-bold text-xs">
                ${ticker}
              </span>
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-2">
              예측 기간을 선택하세요
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 mb-6">
              단기 스윙(5일)과 중기 트렌드(30일) 중 원하는 평가 기간을 설정합니다.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => handleHorizonSelect('5D')}
                className={`p-7 rounded-2xl border text-center transition ${
                  horizon === '5D'
                    ? 'bg-sky-50/70 dark:bg-[#0f1424] border-sky-500 shadow-md ring-2 ring-sky-500/20'
                    : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                }`}
              >
                <div className="text-4xl font-extrabold text-zinc-900 dark:text-white font-mono mb-2">5D</div>
                <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">5거래일 (약 1주일)</div>
                <p className="text-[11px] text-zinc-400 mt-1">실적이나 단기 모멘텀 이벤트 예측에 적합</p>
              </button>

              <button
                onClick={() => handleHorizonSelect('30D')}
                className={`p-7 rounded-2xl border text-center transition ${
                  horizon === '30D'
                    ? 'bg-sky-50/70 dark:bg-[#0f1424] border-sky-500 shadow-md ring-2 ring-sky-500/20'
                    : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                }`}
              >
                <div className="text-4xl font-extrabold text-zinc-900 dark:text-white font-mono mb-2">30D</div>
                <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">21거래일 (약 1개월)</div>
                <p className="text-[11px] text-zinc-400 mt-1">월간 가격 사이클과 지지/저항선 예측에 적합</p>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Mode Selection */}
        {step === 'mode' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-mono font-bold text-xs">
                ${ticker}
              </span>
              <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-xs">
                {horizon}
              </span>
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-2">
              예측 방식을 선택하세요
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 mb-6">
              손으로 매일의 가격 경로를 그릴지, 목표 가격 돌파 여부만 예측할지 결정합니다.
            </p>

            <div className="flex flex-col gap-3.5">
              <button
                onClick={() => handleModeSelect('path')}
                className="p-5 rounded-2xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-800 text-left transition flex items-start gap-4"
              >
                <div className="p-3 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                  <PenTool size={24} />
                </div>
                <div>
                  <div className="font-bold text-zinc-900 dark:text-white text-base mb-1">
                    경로 (Path) — 궤적 직접 그리기
                  </div>
                  <div className="text-xs text-zinc-500 leading-relaxed">
                    앞으로 가격이 어떻게 움직일지 차트 위에 손으로 미래 궤적을 직접 그립니다.
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleModeSelect('breakout')}
                className="p-5 rounded-2xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-800 text-left transition flex items-start gap-4"
              >
                <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <div className="font-bold text-zinc-900 dark:text-white text-base mb-1">
                    돌파 (Breakout) — 목표가 도달
                  </div>
                  <div className="text-xs text-zinc-500 leading-relaxed">
                    특정 가격을 상향 돌파하거나 하회할 것인지를 하나의 목표가와 방향으로 예측합니다.
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Draw Canvas Interaction */}
        {step === 'draw' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-mono font-bold text-xs">
                  ${ticker}
                </span>
                <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-xs">
                  {horizon}
                </span>
                <span className="text-xs text-zinc-400">
                  {mode === 'path' ? '경로 직접 그리기' : '목표가 돌파'}
                </span>
              </div>
              <div className="text-xs font-mono font-bold text-zinc-900 dark:text-white">
                기준가: {formatCurrency(basePrice)}
              </div>
            </div>

            {mode === 'path' ? (
              <>
                <PathCanvas
                  basePrice={basePrice}
                  evalDates={evalDates}
                  pastBars={pastBars}
                  initialPath={path}
                  onPathChange={setPath}
                />
                <div className="mt-3 px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <span className="text-zinc-500 font-mono">시작일: {evalDates[0]}</span>
                  <span className={hasEndTarget ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-500 font-semibold'}>
                    {hasEndTarget ? '✓ 만료일 점 등록됨' : `만료일(${lastEvalDate}) 점을 찍어주세요`}
                  </span>
                </div>
              </>
            ) : (
              <BreakoutCanvas
                basePrice={basePrice}
                value={breakout}
                onChange={setBreakout}
              />
            )}

            {/* Bottom Next Pill Button */}
            <div className="mt-6">
              <button
                type="button"
                disabled={!canProceedFromDraw}
                onClick={handleProceedToPreview}
                className="w-full py-4 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-sm disabled:opacity-40 shadow-lg active:scale-95 transition"
              >
                {mode === 'path' && path.length === 0
                  ? '차트에 점을 찍어주세요'
                  : mode === 'path' && !hasEndTarget
                  ? `만료일(${lastEvalDate}) 점을 찍어주세요`
                  : '다음 (예측 확인하기)'}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Preview */}
        {step === 'preview' && (
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-2">
              예측을 확인하세요
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 mb-5">
              확정(Lock) 후에는 위변조 방지를 위해 타임스탬프와 함께 불변 객체로 박제됩니다.
            </p>

            {/* Preview Chart */}
            <div className="mb-5 rounded-2xl bg-zinc-50 dark:bg-[#07080b] p-3 border border-zinc-200/80 dark:border-zinc-800">
              <ForecastChart
                forecast={{
                  id: 'preview_temp',
                  authorId: null,
                  anonId: 'preview',
                  ticker,
                  horizon,
                  mode,
                  comment: '',
                  lockedAt: `${currentDateStr}T09:00:00Z`,
                  basePrice,
                  baseDate: currentDateStr,
                  evalDates,
                  path: mode === 'path' ? path : undefined,
                  breakout: mode === 'breakout' ? breakout : undefined,
                  rulesVersion: 'v1',
                }}
                height={230}
                currentDateStr={currentDateStr}
              />
            </div>

            {/* Optional Comment Input */}
            <div className="mb-6">
              <label className="text-xs text-zinc-500 block mb-1.5 font-medium">예측 근거나 생각 (선택)</label>
              <textarea
                rows={3}
                placeholder={`${ticker}에 대한 나의 생각이나 관점을 적어주세요...`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
              />
            </div>

            {/* Actions: 수정하기 / 확정하기 */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('draw')}
                className="flex-1 py-3.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-sm transition"
              >
                수정하기
              </button>
              <button
                type="button"
                onClick={handleLock}
                className="flex-1 py-3.5 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-sm shadow-lg active:scale-95 transition"
              >
                확정하기 (Lock)
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Locked & Crowd Reveal */}
        {step === 'reveal' && lockedForecast && (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-200 dark:border-emerald-800">
              <Check size={28} className="stroke-[2.5]" />
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-2">
              Forecast Locked!
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 mb-6 max-w-md mx-auto">
              예측이 불변으로 확정되었습니다. 이제 Crowd의 집단 예측과 내 예측을 비교할 수 있습니다.
            </p>

            {/* My vs Crowd Comparison Chart */}
            <div className="mb-6 rounded-2xl bg-zinc-50 dark:bg-[#07080b] p-4 border border-zinc-200/80 dark:border-zinc-800">
              <ForecastChart
                forecast={lockedForecast}
                height={260}
                showCrowd={true}
                crowdPath={crowd.consensusPath}
                currentDateStr={currentDateStr}
              />
            </div>

            {/* Social Share & Detail Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate(`/f/${lockedForecast.id}`)}
                className="px-6 py-3 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs sm:text-sm shadow-sm transition"
              >
                내 예측 상세 및 댓글 보기
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/f/${lockedForecast.id}`);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className="px-6 py-3 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-1.5"
              >
                <Share2 size={15} />
                <span>{isCopied ? '링크 복사 완료!' : '예측 카드 공유'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <ConnectModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onSuccess={() => setIsConnectOpen(false)}
      />
    </div>
  );
}
