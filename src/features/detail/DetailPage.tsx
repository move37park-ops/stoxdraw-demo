import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Heart, Share2, Lock, CheckCircle2, FastForward } from 'lucide-react';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId } from '../../data/session';
import { getStockHistory, STOCKS } from '../../data/market';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecast } from '../../domain/resolution';
import { aggregateCrowd } from '../../domain/crowd';
import { buildDailySettlementRows } from '../../domain/audit';
import { calculateEloProjection, DEFAULT_ELO, formatSignedLp, getEloTierInfo } from '../../domain/elo';
import { ForecastChart } from '../../components/ForecastChart';
import { StatusBadge } from '../../components/StatusBadge';
import { ShareTicketModal } from '../../components/ShareTicketModal';
import { formatPct, formatRelativeTime, formatCurrency } from '../../domain/format';
import type { Forecast } from '../../domain/types';

interface DetailPageProps {
  currentDateStr: string;
  onDateChange?: (date: string) => void;
}

export function DetailPage({ currentDateStr, onDateChange }: DetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [forecast, setForecast] = useState<Forecast | undefined>(() => id ? repository.getForecast(id) : undefined);
  const [showCrowd, setShowCrowd] = useState(true);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const currentUser = getCurrentUser();

  const reloadData = useCallback(() => {
    if (!id) return;
    setForecast(repository.getForecast(id));
  }, [id]);

  useEffect(() => {
    reloadData();
    const unsub = repository.subscribe(reloadData);
    return () => unsub();
  }, [reloadData, currentDateStr]);

  if (!forecast) {
    return (
      <div className="py-20 text-center text-zinc-500">
        <p className="text-sm font-medium text-zinc-300 mb-3">예측 기록을 찾을 수 없습니다.</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-md bg-white text-black font-medium text-xs hover:bg-zinc-200 transition"
        >
          홈으로 이동
        </button>
      </div>
    );
  }

  const author = forecast.authorId ? repository.getUser(forecast.authorId) : null;
  const authorElo = author?.elo ?? DEFAULT_ELO;

  const isLiked = repository.isLiked(forecast.id);
  const likesCount = repository.getLikesCount(forecast.id);
  const status = deriveForecastStatus(forecast, currentDateStr);
  const stockBars = getStockHistory(forecast.ticker);
  const stockMeta = STOCKS.find(s => s.ticker === forecast.ticker) || STOCKS[0];
  const visibleBars = stockBars.filter(b => b.date <= currentDateStr);

  const allForecasts = repository.listFeed('all', currentDateStr);
  const crowd = aggregateCrowd(allForecasts, forecast.ticker, forecast.horizon, forecast.mode);

  const result = resolveForecast(forecast, visibleBars, crowd.consensusChangePct);
  const isHit = forecast.mode === 'breakout' ? result.breakoutHit : result.directionHit;

  const settledElo = result.eloSettlement ? authorElo + result.eloSettlement.deltaLp : authorElo;
  const authorTier = getEloTierInfo(settledElo);

  const eloProjection = useMemo(
    () => calculateEloProjection(result.forecastChangePct, crowd.consensusChangePct, stockMeta.volatility),
    [result.forecastChangePct, crowd.consensusChangePct, stockMeta.volatility]
  );

  const settlementRows = useMemo(
    () => buildDailySettlementRows(forecast, stockBars, currentDateStr),
    [forecast, stockBars, currentDateStr]
  );

  const anonId = getOrCreateAnonId();
  const myForecasts = allForecasts.filter(f =>
    (currentUser && f.authorId === currentUser.id) ||
    (!currentUser && f.anonId && f.anonId === anonId)
  );
  const hasParticipated = myForecasts.some(f =>
    f.ticker === forecast.ticker && f.horizon === forecast.horizon && f.mode === forecast.mode
  ) || forecast.authorId === currentUser?.id || (!currentUser && forecast.anonId === anonId);

  const handleDrawTicker = () => {
    navigate(`/draw?ticker=${forecast.ticker}`);
  };

  const handleTimeSlipToResolved = () => {
    if (!onDateChange) return;
    const finalDate = forecast.evalDates[forecast.evalDates.length - 1] || '2026-10-12';
    onDateChange(finalDate);
  };

  return (
    <div className="w-full max-w-5xl mx-auto pb-12">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition"
        >
          <ArrowLeft size={15} />
          <span>뒤로</span>
        </button>

        {onDateChange && status !== 'RESOLVED' && (
          <button
            type="button"
            onClick={handleTimeSlipToResolved}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-mono transition"
          >
            <FastForward size={12} className="text-zinc-400" />
            <span>만기 시점({forecast.evalDates[forecast.evalDates.length - 1]?.slice(5)}) 정산 보기</span>
          </button>
        )}
      </div>

      {/* Main Detail Container (Single 1px Hairline Surface, No Nested Cards) */}
      <div className="rounded-lg bg-zinc-950 border border-zinc-800 divide-y divide-zinc-800 overflow-hidden">
        {/* 1. Header: Author + Ticker + Status + Thesis */}
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              onClick={() => author && navigate(`/u/${author.handle}`)}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <img
                src={author?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                alt={author?.name || '익명'}
                className="w-10 h-10 rounded-full object-cover border border-zinc-800"
              />
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-sm sm:text-base text-zinc-100 group-hover:underline">
                    {author?.name || '익명'}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border tabular-nums ${authorTier.badgeClass}`}>
                    {authorTier.tier} · {settledElo} LP
                  </span>
                  {author && author.completedCount > 5 && (
                    <CheckCircle2 size={13} className="text-zinc-400" />
                  )}
                </div>
                <div className="text-xs text-zinc-500 font-mono mt-0.5">
                  @{author?.handle || 'anon'} · {formatRelativeTime(forecast.lockedAt)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono tabular-nums">
              <span
                onClick={() => navigate(`/arena/${forecast.ticker}`)}
                className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 font-medium text-xs cursor-pointer hover:border-zinc-700 transition"
              >
                ${forecast.ticker} · {formatCurrency(forecast.basePrice)}
              </span>
              <StatusBadge
                status={status}
                isHit={isHit}
                label="적중"
              />
            </div>
          </div>

          {forecast.comment && (
            <p className="text-sm text-zinc-300 leading-relaxed mt-4 pt-3.5 border-t border-zinc-800/80">
              "{forecast.comment}"
            </p>
          )}
        </div>

        {/* 2. 4-Column Metric Summary Strip (1px Hairline Grid) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800 font-mono tabular-nums">
          <div className="p-4">
            <div className="text-[11px] text-zinc-400 font-sans mb-0.5">예측 목표</div>
            <div className={`text-sm sm:text-base font-semibold ${result.forecastChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatPct(result.forecastChangePct)}
            </div>
          </div>

          <div className="p-4">
            <div className="text-[11px] text-zinc-400 font-sans mb-0.5">시장 컨센서스</div>
            <div className="text-sm sm:text-base font-semibold text-zinc-100">
              {hasParticipated && crowd.consensusChangePct !== undefined ? formatPct(crowd.consensusChangePct) : '잠김'}
            </div>
          </div>

          <div className="p-4">
            <div className="text-[11px] text-zinc-400 font-sans mb-0.5">예측 난이도</div>
            <div className="text-xs sm:text-sm font-medium text-zinc-200 font-sans">
              {eloProjection.difficultyLabel}
            </div>
          </div>

          <div className="p-4">
            <div className="text-[11px] text-zinc-400 font-sans mb-0.5">
              {result.eloSettlement ? 'Elo 정산 완료' : 'Elo 스테이크'}
            </div>
            {result.eloSettlement ? (
              <div className="text-sm sm:text-base font-semibold flex items-center gap-1.5">
                <span className={result.eloSettlement.deltaLp >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {formatSignedLp(result.eloSettlement.deltaLp)}
                </span>
                {result.score && (
                  <span className="text-xs text-zinc-400">({result.score.total}점)</span>
                )}
              </div>
            ) : (
              <div className="text-xs sm:text-sm font-medium">
                <span className="text-emerald-400">{formatSignedLp(eloProjection.expectedWinLp)}</span>
                <span className="text-zinc-600"> / </span>
                <span className="text-rose-400">{formatSignedLp(eloProjection.expectedLossLp)}</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Chart Area with Integrated Consensus Toggle */}
        <div className="p-5 bg-black">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-medium text-zinc-300">
              5일 주가 경로 차트
            </span>
            {hasParticipated ? (
              <button
                type="button"
                onClick={() => setShowCrowd(!showCrowd)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                  showCrowd
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                }`}
              >
                {showCrowd ? '시장 컨센서스 표시 중' : '시장 컨센서스 숨김'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDrawTicker}
                className="text-[11px] text-zinc-300 hover:text-white flex items-center gap-1 font-medium"
              >
                <Lock size={11} className="text-zinc-400" />
                <span>내 예측 그리고 컨센서스 보기 →</span>
              </button>
            )}
          </div>

          <ForecastChart
            forecast={forecast}
            height={310}
            showCrowd={showCrowd && hasParticipated}
            crowdPath={crowd.consensusPath}
            currentDateStr={currentDateStr}
          />
        </div>

        {/* 4. Compact Skill Score Bars (Only when scored) */}
        {result.score && (
          <div className="p-5 bg-zinc-950 text-xs font-mono tabular-nums">
            <div className="flex items-center justify-between mb-3">
              <span className="font-sans font-medium text-zinc-200">
                정량 정확도 평가 ({result.score.total}점 · {result.score.grade}등급)
              </span>
              {result.eloSettlement && (
                <span className={`font-semibold ${result.eloSettlement.deltaLp >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  Elo {formatSignedLp(result.eloSettlement.deltaLp)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span className="font-sans">경로 밀착</span>
                  <span className="text-zinc-200 font-medium">{result.score.pathScore}/50</span>
                </div>
                <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-zinc-300" style={{ width: `${(result.score.pathScore / 50) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span className="font-sans">방향 적중</span>
                  <span className="text-zinc-200 font-medium">{result.score.directionScore}/30</span>
                </div>
                <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-emerald-400" style={{ width: `${(result.score.directionScore / 30) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span className="font-sans">종가 정밀도</span>
                  <span className="text-zinc-200 font-medium">{result.score.targetScore}/20</span>
                </div>
                <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-zinc-400" style={{ width: `${(result.score.targetScore / 20) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. Clean 5-Day Settlement Table with exact Vercel right-aligned numeric headers */}
        <div className="overflow-x-auto bg-zinc-950">
          <table className="w-full text-xs font-mono tabular-nums">
            <thead className="bg-zinc-900/60 text-zinc-400 text-xs border-b border-zinc-800">
              <tr>
                <th className="py-2.5 px-5 text-left font-medium">일자</th>
                <th className="py-2.5 px-5 text-right font-medium">예측가</th>
                <th className="py-2.5 px-5 text-right font-medium">실제 종가</th>
                <th className="py-2.5 px-5 text-right font-medium">오차율</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {settlementRows.map(row => (
                <tr key={row.date} className="hover:bg-zinc-900/30 transition">
                  <td className="py-2.5 px-5 text-left text-zinc-300">
                    <span className="font-medium text-zinc-100 mr-2">{row.slot}</span>
                    <span className="text-zinc-500">{row.date.slice(5)}</span>
                  </td>
                  <td className="py-2.5 px-5 text-right">
                    <span className="text-zinc-200">${row.forecastPrice.toFixed(2)}</span>{' '}
                    <span className={row.forecastChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      ({formatPct(row.forecastChangePct)})
                    </span>
                  </td>
                  <td className="py-2.5 px-5 text-right">
                    {row.settled && row.actualClose !== null ? (
                      <span className="text-zinc-200">${row.actualClose.toFixed(2)}</span>
                    ) : (
                      <span className="text-zinc-600">대기</span>
                    )}
                  </td>
                  <td className="py-2.5 px-5 text-right">
                    {row.settled && row.absErrorPct !== null ? (
                      <span className={row.absErrorPct <= 2.0 ? 'text-emerald-400 font-medium' : 'text-zinc-300'}>
                        ±{row.absErrorPct.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 6. Action Bar */}
        <div className="px-5 py-3.5 bg-zinc-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => repository.toggleLike(forecast.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition font-mono tabular-nums ${
                isLiked
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Heart size={13} className={isLiked ? 'fill-rose-500' : ''} />
              <span>{likesCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsShareOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition"
            >
              <Share2 size={13} />
              <span>티켓 공유</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleDrawTicker}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-white hover:bg-zinc-200 text-black font-medium text-xs transition"
          >
            <span>${forecast.ticker} 내 예측 그리기</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      <ShareTicketModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        forecast={forecast}
        authorHandle={author?.handle || 'anon_user'}
        crowdPath={hasParticipated ? crowd.consensusPath : undefined}
        crowdChangePct={hasParticipated ? crowd.consensusChangePct : undefined}
        scoreTotal={result.score?.total}
        scoreGrade={result.score?.grade}
        eloDeltaLp={result.eloSettlement?.deltaLp}
        authorElo={settledElo}
      />
    </div>
  );
}
