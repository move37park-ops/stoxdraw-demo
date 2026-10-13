import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Heart, Share2, Lock, CheckCircle2 } from 'lucide-react';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId } from '../../data/session';
import { getStockHistory } from '../../data/market';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecast } from '../../domain/resolution';
import { aggregateCrowd } from '../../domain/crowd';
import { ForecastChart } from '../../components/ForecastChart';
import { StatusBadge } from '../../components/StatusBadge';
import { ResponseBanner } from '../../components/ResponseBanner';
import { formatPct, formatRelativeTime, formatCurrency } from '../../domain/format';
import type { Forecast } from '../../domain/types';

interface DetailPageProps {
  currentDateStr: string;
}

export function DetailPage({ currentDateStr }: DetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [forecast, setForecast] = useState<Forecast | undefined>(() => id ? repository.getForecast(id) : undefined);
  const [children, setChildren] = useState<Forecast[]>([]);
  const [showCrowd, setShowCrowd] = useState(false);

  const currentUser = getCurrentUser();

  const reloadData = useCallback(() => {
    if (!id) return;
    const f = repository.getForecast(id);
    setForecast(f);
    if (f) {
      setChildren(repository.listChildren(f.id));
    }
  }, [id]);

  useEffect(() => {
    reloadData();
    const unsub = repository.subscribe(reloadData);
    return () => unsub();
  }, [reloadData, currentDateStr]);

  if (!forecast) {
    return (
      <div className="py-20 text-center text-zinc-500">
        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-2">예측을 찾을 수 없습니다.</p>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-semibold text-xs transition"
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  const author = forecast.authorId ? repository.getUser(forecast.authorId) : null;
  const parent = forecast.parentId ? repository.getForecast(forecast.parentId) : null;
  const parentAuthor = parent && parent.authorId ? repository.getUser(parent.authorId) : null;

  const isLiked = repository.isLiked(forecast.id);
  const likesCount = repository.getLikesCount(forecast.id);
  const status = deriveForecastStatus(forecast, currentDateStr);
  const stockBars = getStockHistory(forecast.ticker);
  const visibleBars = stockBars.filter(b => b.date <= currentDateStr);
  const result = resolveForecast(forecast, visibleBars);
  const isHit = forecast.mode === 'breakout' ? result.breakoutHit : result.directionHit;

  // Crowd 데이터 집계
  const allForecasts = repository.listFeed('all', currentDateStr);
  const crowd = aggregateCrowd(allForecasts, forecast.ticker, forecast.horizon, forecast.mode);

  const anonId = getOrCreateAnonId();
  const myForecasts = allForecasts.filter(f =>
    (currentUser && f.authorId === currentUser.id) ||
    (!currentUser && f.anonId && f.anonId === anonId)
  );
  const hasParticipated = myForecasts.some(f =>
    f.ticker === forecast.ticker && f.horizon === forecast.horizon && f.mode === forecast.mode
  ) || forecast.authorId === currentUser?.id || (!currentUser && forecast.anonId === anonId);

  const handleDrawResponse = () => {
    navigate(`/draw?parent=${forecast.id}&ticker=${forecast.ticker}&horizon=${forecast.horizon}&mode=${forecast.mode}`);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `STOXDRAW — ${forecast.ticker} Forecast`,
          text: forecast.comment || `${forecast.ticker} 미래 주가 예측 궤적을 확인해보세요.`,
          url,
        });
      } catch {
        // Fallback
      }
    } else {
      navigator.clipboard.writeText(url);
      alert('예측 링크가 클립보드에 복사되었습니다!');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-2">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white mb-6 transition"
      >
        <ArrowLeft size={16} />
        <span>돌아가기</span>
      </button>

      {/* Main Detail Card */}
      <div className="rounded-3xl bg-[#0d0d10] border border-white/10 p-6 sm:p-9 shadow-none mb-6">
        {/* Parent Reference banner if forked */}
        {forecast.parentId && (
          <div className="mb-5">
            <ResponseBanner
              parentAuthorHandle={parentAuthor?.handle}
              parentId={forecast.parentId}
            />
          </div>
        )}

        {/* Forecaster Profile Header */}
        <div className="flex items-center justify-between mb-6 pb-5 border-b border-white/10">
          <div className="flex items-center gap-3.5">
            <img
              src={author?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
              alt={author?.name || '익명'}
              className="w-12 h-12 rounded-full object-cover border border-white/10"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base text-white">
                  {author?.name || '익명 예측가'}
                </span>
                {author && author.completedCount > 5 && (
                  <CheckCircle2 size={15} className="text-[#DFC15D]" />
                )}
              </div>
              <div className="text-xs text-zinc-400">
                @{author?.handle || 'anon'} · {formatRelativeTime(forecast.lockedAt)}
              </div>
            </div>
          </div>

          <StatusBadge
            status={status}
            isHit={isHit}
            label={forecast.mode === 'breakout' ? '목표 도달' : '적중'}
          />
        </div>

        {/* Stock & Horizon Pills */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="px-3 py-1 rounded-full bg-white text-black font-semibold text-xs">
            ${forecast.ticker}
          </span>
          <span className="px-3 py-1 rounded-full bg-zinc-900 border border-white/10 text-zinc-300 text-xs font-medium">
            {forecast.horizon === '5D' ? '1주일 (5D)' : '1개월 (30D)'}
          </span>
          <span className="px-3 py-1 rounded-full bg-zinc-900 border border-white/10 text-zinc-300 text-xs font-medium">
            {forecast.mode === 'path' ? '경로 예측' : '돌파 예측'}
          </span>
          <span className="text-xs text-zinc-400 ml-auto">
            기준가 ${forecast.basePrice.toFixed(2)}
          </span>
        </div>

        {/* Comment quote */}
        {forecast.comment && (
          <p className="text-base text-zinc-200 leading-relaxed my-4">
            {forecast.comment}
          </p>
        )}

        {/* Interactive Full Chart Area */}
        <div className="my-6 rounded-2xl bg-[#050507] border border-white/10 p-4">
          <ForecastChart
            forecast={forecast}
            height={280}
            showCrowd={showCrowd}
            crowdPath={crowd.consensusPath}
            currentDateStr={currentDateStr}
          />
        </div>

        {/* Result & Evaluation Metrics */}
        {(status === 'LIVE' || status === 'RESOLVED') && (
          <div className="p-4 my-5 rounded-2xl bg-[#141418] border border-white/10">
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-zinc-400 block text-[11px] mb-1">기준 가격</span>
                <span className="font-bold text-white text-sm">
                  {formatCurrency(forecast.basePrice)}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[11px] mb-1">
                  {forecast.mode === 'breakout' ? '목표 가격' : '예측 변화율'}
                </span>
                <span className={`font-bold text-sm ${result.forecastChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {forecast.mode === 'breakout'
                    ? `${formatCurrency(forecast.breakout?.price || 0)} (${formatPct(result.forecastChangePct)})`
                    : formatPct(result.forecastChangePct)}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[11px] mb-1">
                  {status === 'LIVE' ? '현재 시장 변화율' : '최종 시장 변화율'}
                </span>
                <span className={`font-bold text-sm ${result.actualChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatPct(result.actualChangePct)}{' '}
                  {status === 'RESOLVED' && (
                    <span className={result.directionHit ? 'text-[#DFC15D] font-bold' : 'text-zinc-500'}>
                      {result.directionHit ? '(✓ 적중)' : '(빗나감)'}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Crowd Reveal / Blind Lock Card */}
        <div className="my-5 p-4 rounded-2xl bg-[#141418] border border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">
                군중 컨센서스 (Crowd Consensus)
              </span>
              <span className="text-[11px] text-zinc-400">
                {crowd.participantsCount}명 참여
              </span>
            </div>

            {hasParticipated ? (
              <button
                type="button"
                onClick={() => setShowCrowd(!showCrowd)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  showCrowd
                    ? 'bg-white text-black'
                    : 'bg-zinc-900 text-zinc-300 border border-white/15'
                }`}
              >
                {showCrowd ? '군중 선 숨기기' : '차트에 군중 선 띄우기'}
              </button>
            ) : (
              <span className="text-xs text-zinc-400 flex items-center gap-1 font-medium">
                <Lock size={12} />
                내 예측을 제출해야 공개됩니다
              </span>
            )}
          </div>
        </div>

        {/* Actions bar (Like, Share, Duel CTA) */}
        <div className="flex items-center justify-between pt-5 border-t border-white/10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => repository.toggleLike(forecast.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition ${
                isLiked
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : 'bg-[#141418] hover:bg-[#1c1c24] text-zinc-300 border-white/10'
              }`}
            >
              <Heart size={14} className={isLiked ? 'fill-rose-500' : ''} />
              <span>{likesCount}</span>
            </button>

            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-[#141418] hover:bg-[#1c1c24] text-zinc-300 border border-white/10 transition"
            >
              <Share2 size={14} />
              <span>공유</span>
            </button>
          </div>

          <button
            onClick={handleDrawResponse}
            className="btn-signature-draw px-5 py-2.5 rounded-full text-xs sm:text-sm tracking-wide"
          >
            <span>YOUR DRAW</span>
            <ArrowRight size={14} className="stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Derived Responses Section */}
      {children.length > 0 && (
        <div className="rounded-3xl bg-[#0d0d10] border border-white/10 p-6 mb-6">
          <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
            <span>이 예측에 맞선 YOUR DRAW 궤적</span>
            <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-[#DFC15D] border border-white/10 text-[11px] font-bold font-mono">
              {children.length}
            </span>
          </h3>
          <div className="space-y-2.5">
            {children.map(child => {
              const childAuthor = child.authorId ? repository.getUser(child.authorId) : null;
              return (
                <div
                  key={child.id}
                  onClick={() => navigate(`/f/${child.id}`)}
                  className="p-3.5 rounded-2xl bg-[#141418] hover:bg-[#181822] border border-white/10 flex items-center justify-between cursor-pointer transition"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={childAuthor?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover border border-white/10"
                    />
                    <div>
                      <span className="font-semibold text-xs text-white">
                        {childAuthor?.name || '익명'}의 대결 궤적
                      </span>
                      <p className="text-[11px] text-zinc-400 line-clamp-1">{child.comment}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[#DFC15D]">
                    보기 →
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
