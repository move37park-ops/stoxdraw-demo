import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Share2 } from 'lucide-react';
import { STOCKS, getCurrentStockPrice, getStockHistory } from '../../data/market';
import { getNextTradingDays, getHorizonTradingDays } from '../../domain/tradingCalendar';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId } from '../../data/session';
import { aggregateCrowd } from '../../domain/crowd';
import { PathCanvas } from './PathCanvas';
import { ForecastChart } from '../../components/ForecastChart';
import { ConnectModal } from '../auth/ConnectModal';
import { formatCurrency } from '../../domain/format';
import type { Horizon, Mode, PathPoint, Forecast } from '../../domain/types';

type Step = 'stock' | 'draw' | 'preview' | 'reveal';

interface DrawWizardProps {
  currentDateStr: string;
}

export function DrawWizard({ currentDateStr }: DrawWizardProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL Params from [YOUR DRAW]
  const parentId = searchParams.get('parent') || undefined;
  const initialTicker = searchParams.get('ticker') || 'NVDA';
  const horizon: Horizon = '5D'; // MVP 단일화: 5거래일(5D) 고정
  const mode: Mode = 'path';      // MVP 단일화: Path(경로 그리기) 고정

  const isResponse = Boolean(parentId);
  const [step, setStep] = useState<Step>(isResponse || searchParams.get('ticker') ? 'draw' : 'stock');

  const [ticker, setTicker] = useState<string>(initialTicker);
  const [path, setPath] = useState<PathPoint[]>([]);
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
    setStep('draw');
  };

  const canProceedFromDraw = path.length > 0 && hasEndTarget;

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
      horizon: '5D',
      mode: 'path',
      comment: comment.trim() || `${ticker} 5D 궤적 예측`,
      basePrice,
      baseDate: currentDateStr,
      evalDates,
      path,
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
            else if (step === 'draw') {
              if (isResponse) navigate(-1);
              else setStep('stock');
            }
            else if (step === 'preview') setStep('draw');
            else navigate('/record');
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
        >
          <ArrowLeft size={16} />
          <span>이전</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span className={step === 'stock' ? 'text-zinc-900 dark:text-white font-bold' : ''}>1. 종목 선택</span>
          <span>·</span>
          <span className={step === 'draw' ? 'text-zinc-900 dark:text-white font-bold' : ''}>2. 궤적 그리기 (5D)</span>
          <span>·</span>
          <span className={step === 'preview' || step === 'reveal' ? 'text-zinc-900 dark:text-white font-bold' : ''}>3. 제출 및 잠금</span>
        </div>
      </div>

      {/* Main Wizard Container Card */}
      <div className="rounded-3xl bg-[#0d0d10] border border-white/10 p-6 sm:p-10 shadow-none">
        {/* Step 1: Stock Selection */}
        {step === 'stock' && (
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
              예측할 종목을 선택하세요
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mb-6">
              미래 주가 궤적을 제시할 주요 테크 및 모멘텀 자산
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STOCKS.map(s => {
                const price = getCurrentStockPrice(s.ticker, currentDateStr);
                return (
                  <button
                    key={s.ticker}
                    onClick={() => handleStockSelect(s.ticker)}
                    className="flex items-center justify-between p-4 rounded-2xl bg-[#141418] hover:bg-[#181822] border border-white/10 transition text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm"
                        style={{ backgroundColor: s.logoColor }}
                      >
                        {s.ticker.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">
                          ${s.ticker}
                        </div>
                        <div className="text-xs text-zinc-400">{s.name}</div>
                      </div>
                    </div>
                    <div className="text-right font-semibold text-white text-sm">
                      {formatCurrency(price)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Draw Canvas Interaction (5D Path) */}
        {step === 'draw' && (
          <div>
            {parentId && (
              <div className="mb-4 px-4 py-2.5 rounded-2xl bg-[#141418] border border-white/10 text-white text-xs flex items-center justify-between">
                <span className="font-semibold">
                  YOUR DRAW : 상대 궤적에 맞서는 내 선 그리기
                </span>
                <span className="text-[11px] text-zinc-400">1:1 대결 모드</span>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-white text-black font-semibold text-xs">
                  ${ticker}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-zinc-900 border border-white/10 text-zinc-300 text-xs font-medium">
                  5D (5거래일)
                </span>
                <span className="text-xs text-zinc-400">
                  미래 궤적 그리기
                </span>
              </div>
              <div className="text-xs font-semibold text-white">
                기준가: {formatCurrency(basePrice)}
              </div>
            </div>

            <PathCanvas
              basePrice={basePrice}
              evalDates={evalDates}
              pastBars={pastBars}
              initialPath={path}
              onPathChange={setPath}
            />
            <div className="mt-3 px-4 py-2.5 rounded-xl bg-[#141418] border border-white/10 flex items-center justify-between text-xs">
              <span className="text-zinc-400">평가 시작일: {evalDates[0]}</span>
              <span className={hasEndTarget ? 'text-[#DFC15D] font-semibold' : 'text-zinc-400 font-semibold'}>
                {hasEndTarget ? '✓ 만료일 점 등록됨' : `만료일(${lastEvalDate}) 점을 찍어주세요`}
              </span>
            </div>

            {/* Bottom Next Pill Button */}
            <div className="mt-6">
              <button
                type="button"
                disabled={!canProceedFromDraw}
                onClick={handleProceedToPreview}
                className="w-full py-3.5 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-sm disabled:opacity-40 transition"
              >
                {path.length === 0
                  ? '차트에 점을 찍어 궤적을 그려주세요'
                  : !hasEndTarget
                  ? `만료일(${lastEvalDate}) 점을 찍어주세요`
                  : '다음: 예측 검토하기'}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Preview */}
        {step === 'preview' && (
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
              예측을 확인하세요
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mb-5">
              확정(Lock) 후에는 위변조 방지를 위해 타임스탬프와 함께 불변 객체로 박제됩니다.
            </p>

            {/* Preview Chart */}
            <div className="mb-5 rounded-2xl bg-[#050507] p-3 border border-white/10">
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
                  path,
                  rulesVersion: 'v1',
                }}
                height={230}
                currentDateStr={currentDateStr}
              />
            </div>

            {/* Optional Comment Input */}
            <div className="mb-6">
              <label className="text-xs text-zinc-400 block mb-1.5 font-medium">예측 근거나 생각 (선택)</label>
              <textarea
                rows={3}
                placeholder={`${ticker}에 대한 나의 생각이나 관점을 적어주세요...`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full p-3.5 rounded-2xl bg-[#141418] border border-white/10 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-white/30"
              />
            </div>

            {/* Actions: 수정하기 / 확정하기 */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('draw')}
                className="btn-flat-dark flex-1 py-3.5 text-sm"
              >
                수정하기
              </button>
              <button
                type="button"
                onClick={handleLock}
                className="btn-signature-draw flex-1 py-3.5 text-sm"
              >
                확정하기 (Lock)
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Locked & Crowd Reveal */}
        {step === 'reveal' && lockedForecast && (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-[#C5A059]/15 text-[#DFC15D] flex items-center justify-center mx-auto mb-4 border border-[#C5A059]/30">
              <Check size={28} className="stroke-[2.5]" />
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
              Forecast Locked!
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mb-6 max-w-md mx-auto">
              예측이 불변으로 확정되었습니다. 이제 Crowd의 집단 예측과 내 예측을 비교할 수 있습니다.
            </p>

            {/* My vs Crowd Comparison Chart */}
            <div className="mb-6 rounded-2xl bg-[#050507] p-4 border border-white/10">
              <ForecastChart
                forecast={lockedForecast}
                height={260}
                showCrowd={true}
                crowdPath={crowd.consensusPath}
                currentDateStr={currentDateStr}
              />
            </div>

            {/* Social Share & Detail Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                onClick={() => navigate(`/f/${lockedForecast.id}`)}
                className="btn-flat-white text-xs sm:text-sm px-5 py-3"
              >
                예측 상세 보기
              </button>
              <button
                onClick={() => navigate('/record')}
                className="btn-flat-dark text-xs sm:text-sm px-5 py-3"
              >
                내 기록 (Record) 확인
              </button>
              <button
                onClick={() => navigate(`/arena?ticker=${ticker}`)}
                className="btn-flat-dark text-xs sm:text-sm px-5 py-3"
              >
                아레나로 돌아가기
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/f/${lockedForecast.id}`);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className="btn-flat-dark text-xs sm:text-sm px-4 py-3 flex items-center justify-center gap-1.5"
              >
                <Share2 size={14} />
                <span>{isCopied ? '복사됨!' : '공유'}</span>
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
