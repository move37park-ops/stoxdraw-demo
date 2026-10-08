import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, TrendingUp, Users, PenTool, Share2 } from 'lucide-react';
import { STOCKS, getCurrentStockPrice, getStockHistory } from '../../data/market';
import { getNextTradingDays, getHorizonTradingDays } from '../../domain/tradingCalendar';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId } from '../../data/session';
import { aggregateCrowd } from '../../domain/crowd';
import { PathCanvas } from './PathCanvas';
import { BreakoutCanvas } from './BreakoutCanvas';
import { ForecastChart } from '../../components/ForecastChart';
import { ConnectModal } from '../auth/ConnectModal';
import { formatPct, formatCurrency } from '../../domain/format';
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
    <div className="w-full min-h-[100dvh] lg:min-h-0 flex flex-col pb-8">
      {/* Top Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-black/85 backdrop-blur-md border-b border-[#1b1e26]">
        <button
          onClick={() => {
            if (step === 'stock' || isResponse) navigate(-1);
            else if (step === 'horizon') setStep('stock');
            else if (step === 'mode') setStep('horizon');
            else if (step === 'draw') setStep('mode');
            else if (step === 'preview') setStep('draw');
            else navigate('/');
          }}
          className="p-1 rounded-full text-[#71767b] hover:text-white transition"
        >
          <ArrowLeft size={20} />
        </button>

        <span className="font-bold text-white text-[15px]">
          {step === 'stock' && '종목 선택 (Stock)'}
          {step === 'horizon' && '예측 기간 (Horizon)'}
          {step === 'mode' && '예측 모드 (Mode)'}
          {step === 'draw' && `${ticker} · ${horizon}`}
          {step === 'preview' && '예측 확인 (Preview)'}
          {step === 'reveal' && 'Crowd Reveal'}
        </span>

        <div className="w-5" />
      </div>

      <div className="p-4 max-w-lg mx-auto w-full flex-1 flex flex-col justify-center">
        {/* Step 1: Stock Selection (§11) */}
        {step === 'stock' && (
          <div>
            <h3 className="text-xl font-bold text-white mb-2">예측할 종목을 선택하세요</h3>
            <p className="text-xs text-[#71767b] mb-4">주요 테크 및 모멘텀 종목</p>

            <div className="grid grid-cols-1 gap-2">
              {STOCKS.map(s => {
                const price = getCurrentStockPrice(s.ticker, currentDateStr);
                return (
                  <button
                    key={s.ticker}
                    onClick={() => handleStockSelect(s.ticker)}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-[#0e0f14] border border-[#1b1e26] hover:border-[#38bdf8] hover:bg-[#14161f] transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white"
                        style={{ backgroundColor: s.logoColor }}
                      >
                        {s.ticker.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-white font-mono">{s.ticker}</div>
                        <div className="text-xs text-[#71767b]">{s.name}</div>
                      </div>
                    </div>
                    <div className="text-right font-mono font-semibold text-white">
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
              <span className="px-2.5 py-1 rounded bg-[#181a24] text-white font-mono font-bold text-xs border border-[#2a2e3d]">
                {ticker}
              </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">예측 기간을 선택하세요</h3>
            <p className="text-xs text-[#71767b] mb-6">5거래일(5D)과 21거래일(30D) 중 선택하세요.</p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleHorizonSelect('5D')}
                className={`p-6 rounded-2xl border text-center transition ${
                  horizon === '5D'
                    ? 'bg-[#14161f] border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.25)]'
                    : 'bg-[#0e0f14] border-[#1b1e26] hover:border-zinc-700'
                }`}
              >
                <div className="text-3xl font-extrabold text-white font-mono mb-2">5D</div>
                <div className="text-xs text-[#9aa0a6]">5거래일 (약 1주일)</div>
              </button>

              <button
                onClick={() => handleHorizonSelect('30D')}
                className={`p-6 rounded-2xl border text-center transition ${
                  horizon === '30D'
                    ? 'bg-[#14161f] border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.25)]'
                    : 'bg-[#0e0f14] border-[#1b1e26] hover:border-zinc-700'
                }`}
              >
                <div className="text-3xl font-extrabold text-white font-mono mb-2">30D</div>
                <div className="text-xs text-[#9aa0a6]">21거래일 (약 1개월)</div>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Mode Selection */}
        {step === 'mode' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-0.5 rounded bg-[#181a24] text-white font-mono font-bold text-xs border border-[#2a2e3d]">
                {ticker}
              </span>
              <span className="text-xs text-[#9aa0a6]">{horizon}</span>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">예측 방식을 선택하세요</h3>
            <p className="text-xs text-[#71767b] mb-6">경로를 직접 그릴 것인지, 목표 가격 돌파를 예측할 것인지 결정합니다.</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleModeSelect('path')}
                className="p-4 rounded-2xl bg-[#0e0f14] border border-[#1b1e26] hover:border-[#38bdf8] text-left transition flex items-start gap-4"
              >
                <div className="p-3 rounded-xl bg-blue-500/10 text-[#38bdf8]">
                  <PenTool size={22} />
                </div>
                <div>
                  <div className="font-bold text-white text-[15px] mb-1">경로 (Path) — 직접 그리기</div>
                  <div className="text-xs text-[#71767b] leading-relaxed">
                    앞으로 가격이 어떻게 움직일지 차트 위에 손으로 미래 궤적을 직접 그립니다.
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleModeSelect('breakout')}
                className="p-4 rounded-2xl bg-[#0e0f14] border border-[#1b1e26] hover:border-[#38bdf8] text-left transition flex items-start gap-4"
              >
                <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
                  <TrendingUp size={22} />
                </div>
                <div>
                  <div className="font-bold text-white text-[15px] mb-1">돌파 (Breakout) — 목표가 도달</div>
                  <div className="text-xs text-[#71767b] leading-relaxed">
                    특정 가격을 상향 돌파하거나 하회할 것인지를 하나의 가격과 방향으로 예측합니다.
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Draw Canvas Interaction */}
        {step === 'draw' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#181a24] text-white font-mono font-bold text-xs border border-[#2a2e3d]">
                  {ticker}
                </span>
                <span className="text-xs text-[#9aa0a6]">{horizon}</span>
                <span className="text-[#3f444d]">·</span>
                <span className="text-xs text-[#9aa0a6] capitalize">
                  {mode === 'path' ? '경로 직접 그리기' : '목표가 돌파'}
                </span>
              </div>
              <div className="text-xs font-mono text-white">
                현재가: {formatCurrency(basePrice)}
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
                <div className="mt-2.5 px-3 py-2 rounded-lg bg-[#0e0f14] border border-[#1b1e26] flex items-center justify-between text-xs">
                  <span className="text-[#9aa0a6]">시작일: {evalDates[0]}</span>
                  <span className={hasEndTarget ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
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

            {/* Bottom Next Button */}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                disabled={!canProceedFromDraw}
                onClick={handleProceedToPreview}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#4facfe] to-[#a18cd1] text-black font-bold text-sm hover:brightness-110 disabled:opacity-40 disabled:saturate-0 disabled:brightness-75 transition-all shadow-[0_4px_20px_rgba(79,172,254,0.3)] border border-white/20"
              >
                {mode === 'path' && path.length === 0
                  ? '차트에 점을 찍어주세요'
                  : mode === 'path' && !hasEndTarget
                  ? `만료일(${lastEvalDate}) 점을 찍어주세요`
                  : '다음 (예측 확인)'}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Preview */}
        {step === 'preview' && (
          <div>
            <h3 className="text-xl font-bold text-white mb-2">예측을 확인하세요</h3>
            <p className="text-xs text-[#71767b] mb-4">확정(Lock) 후에는 위변조 방지를 위해 예측 내용을 수정할 수 없습니다.</p>

            {/* Preview Chart */}
            <div className="mb-4">
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
                height={220}
                currentDateStr={currentDateStr}
              />
            </div>

            {/* Optional Comment Input */}
            <div className="mb-6">
              <label className="text-xs text-[#71767b] block mb-1.5 font-medium">예측 근거나 생각 (선택)</label>
              <textarea
                rows={3}
                placeholder={`${ticker}에 대한 나의 생각이나 관점을 적어주세요...`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#0e0f14] border border-[#262a34] text-white text-sm placeholder-[#71767b] focus:outline-none focus:border-[#38bdf8]"
              />
            </div>

            {/* Actions: 수정하기 / 확정 */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('draw')}
                className="flex-1 py-3.5 rounded-full bg-[#14161f] border border-[#272b38] text-white font-semibold text-sm hover:bg-[#1a1d28] transition"
              >
                수정하기
              </button>
              <button
                type="button"
                onClick={handleLock}
                className="flex-1 py-3.5 rounded-full bg-gradient-to-r from-[#4facfe] to-[#a18cd1] text-black font-bold text-sm hover:brightness-110 transition-all shadow-[0_4px_20px_rgba(79,172,254,0.3)] border border-white/20"
              >
                확정하기 (Lock)
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Locked & Crowd Reveal */}
        {step === 'reveal' && lockedForecast && (
          <div className="text-center animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-500/20">
              <Check size={24} className="stroke-[2.5]" />
            </div>

            <h3 className="text-xl font-bold text-white mb-1">Forecast Locked!</h3>
            <p className="text-xs text-[#71767b] mb-4">
              예측이 불변으로 확정되었습니다. 이제 Crowd의 집단 예측과 비교합니다.
            </p>

            {/* Comparison Chart with Crowd */}
            <div className="my-3 text-left">
              <ForecastChart
                forecast={lockedForecast}
                height={240}
                showCrowd={!crowd.isColdStart}
                crowdPath={crowd.consensusPath}
                currentDateStr={currentDateStr}
              />
            </div>

            {/* Crowd Reveal Stats Bar */}
            <div className="p-4 my-3 rounded-xl bg-[#0e0f14] border border-[#1f222b] text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <Users size={14} className="text-purple-400" />
                  Crowd 비교
                </span>
                {!crowd.isColdStart && (
                  <span className="text-xs text-[#71767b] font-mono">{crowd.participantsCount} participants</span>
                )}
              </div>

              {crowd.isColdStart ? (
                <p className="text-xs text-[#71767b]">
                  아직 참여자가 적어요. 회원님이 첫 번째 예측가입니다!
                </p>
              ) : (
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#9aa0a6]">내 예측 전망:</span>
                    <span className="font-mono text-[#38bdf8] font-bold">
                      {mode === 'path' && path.length > 0
                        ? formatPct(((path[path.length - 1].price - basePrice) / basePrice) * 100)
                        : `${breakout.price} 돌파`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9aa0a6]">Crowd 합의치:</span>
                    <span className="font-mono text-purple-400 font-bold">
                      {mode === 'path'
                        ? formatPct(crowd.consensusChangePct || 0)
                        : `${crowd.upPct}% 상승`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Non-intrusive Account Connection for Anonymous Users */}
            {!getCurrentUser() && (
              <div className="p-3.5 my-3 rounded-xl bg-gradient-to-r from-[#121626] to-[#181328] border border-sky-500/30 text-left flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-white mb-0.5">내 예측을 영구 보존할까요?</div>
                  <div className="text-[11px] text-[#9aa0a6]">지갑/계정을 연결하면 내 프로필의 적중률 Record에 반영됩니다.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConnectOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-sky-500 text-black text-xs font-bold hover:bg-sky-400 whitespace-nowrap transition"
                >
                  계정 연결
                </button>
              </div>
            )}

            {/* Actions: 공유하기 / 상세보기 / Feed 이동 */}
            <div className="flex flex-col gap-2 mt-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/f/${lockedForecast.id}`);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                  }}
                  className="flex-1 py-3 rounded-xl bg-[#14161f] border border-[#272b38] text-white font-semibold text-xs hover:bg-[#1a1d28] transition flex items-center justify-center gap-1.5"
                >
                  <Share2 size={15} />
                  <span>{isCopied ? '링크 복사 완료!' : '내 예측 공유하기'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/f/${lockedForecast.id}`)}
                  className="flex-1 py-3 rounded-xl bg-[#14161f] border border-[#272b38] text-white font-semibold text-xs hover:bg-[#1a1d28] transition flex items-center justify-center gap-1.5"
                >
                  상세보기
                </button>
              </div>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#4facfe] to-[#a18cd1] text-black font-bold text-sm hover:brightness-110 transition-all shadow-[0_4px_20px_rgba(79,172,254,0.3)] border border-white/20 mb-3"
              >
                Feed로 이동하여 다른 예측 둘러보기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Progressive Onboarding Connect Modal */}
      <ConnectModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onSuccess={() => {
          setIsConnectOpen(false);
          navigate('/');
        }}
      />
    </div>
  );
}
