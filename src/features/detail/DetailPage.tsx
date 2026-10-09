import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MessageSquare, Share2, Lock, Send, CheckCircle2 } from 'lucide-react';
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
import type { Forecast, Comment } from '../../domain/types';

interface DetailPageProps {
  currentDateStr: string;
}

export function DetailPage({ currentDateStr }: DetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [forecast, setForecast] = useState<Forecast | undefined>(() => id ? repository.getForecast(id) : undefined);
  const [children, setChildren] = useState<Forecast[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showCrowd, setShowCrowd] = useState(false);

  const currentUser = getCurrentUser();

  const reloadData = () => {
    if (!id) return;
    const f = repository.getForecast(id);
    setForecast(f);
    if (f) {
      setChildren(repository.listChildren(f.id));
      setComments(repository.listComments(f.id));
    }
  };

  useEffect(() => {
    reloadData();
    const unsub = repository.subscribe(reloadData);
    return () => unsub();
  }, [id, currentDateStr]);

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

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser) return;
    repository.addComment(forecast.id, currentUser, newComment.trim());
    setNewComment('');
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
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white mb-6 transition"
      >
        <ArrowLeft size={16} />
        <span>돌아가기</span>
      </button>

      {/* Main Detail Card */}
      <div className="rounded-3xl bg-white dark:bg-[#0e1017] border border-zinc-200/90 dark:border-zinc-800 p-6 sm:p-9 shadow-sm mb-6">
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
        <div className="flex items-center justify-between mb-6 pb-5 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-3.5">
            <img
              src={author?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
              alt={author?.name || '익명'}
              className="w-12 h-12 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base text-zinc-900 dark:text-white">
                  {author?.name || '익명 예측가'}
                </span>
                {author && author.completedCount > 5 && (
                  <CheckCircle2 size={15} className="text-sky-500" />
                )}
              </div>
              <div className="text-xs text-zinc-400 font-mono">
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
          <span className="px-3 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-mono font-bold text-xs">
            ${forecast.ticker}
          </span>
          <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-xs font-semibold">
            {forecast.horizon === '5D' ? '1주일 (5D)' : '1개월 (30D)'}
          </span>
          <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium">
            {forecast.mode === 'path' ? '경로 예측' : '돌파 예측'}
          </span>
          <span className="text-xs font-mono text-zinc-400 ml-auto">
            기준가 ${forecast.basePrice.toFixed(2)}
          </span>
        </div>

        {/* Comment quote */}
        {forecast.comment && (
          <p className="text-base text-zinc-800 dark:text-zinc-200 leading-relaxed my-4">
            {forecast.comment}
          </p>
        )}

        {/* Interactive Full Chart Area */}
        <div className="my-6 rounded-2xl bg-zinc-50 dark:bg-[#07080b] border border-zinc-100 dark:border-zinc-800/80 p-4">
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
          <div className="p-4 my-5 rounded-2xl bg-zinc-50 dark:bg-[#12141c] border border-zinc-200/80 dark:border-zinc-800">
            <div className="grid grid-cols-3 gap-4 text-xs font-mono">
              <div>
                <span className="text-zinc-400 block text-[11px] mb-1">기준 가격</span>
                <span className="font-bold text-zinc-900 dark:text-white text-sm">
                  {formatCurrency(forecast.basePrice)}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[11px] mb-1">
                  {forecast.mode === 'breakout' ? '목표 가격' : '예측 변화율'}
                </span>
                <span className={`font-bold text-sm ${result.forecastChangePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {forecast.mode === 'breakout'
                    ? `${formatCurrency(forecast.breakout?.price || 0)} (${formatPct(result.forecastChangePct)})`
                    : formatPct(result.forecastChangePct)}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[11px] mb-1">
                  {status === 'LIVE' ? '현재 시장 변화율' : '최종 시장 변화율'}
                </span>
                <span className={`font-bold text-sm ${result.actualChangePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {formatPct(result.actualChangePct)} {
                    status === 'RESOLVED' && (result.directionHit ? '(✓ 적중)' : '(빗나감)')
                  }
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Crowd Reveal / Blind Lock Card (§8) */}
        <div className="my-5 p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-900 dark:text-white">
                군중 컨센서스 (Crowd Consensus)
              </span>
              <span className="text-[11px] font-mono text-zinc-500">
                {crowd.participantsCount}명 참여
              </span>
            </div>

            {hasParticipated ? (
              <button
                type="button"
                onClick={() => setShowCrowd(!showCrowd)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  showCrowd
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
                }`}
              >
                {showCrowd ? '군중 선 숨기기' : '차트에 군중 선 띄우기'}
              </button>
            ) : (
              <span className="text-xs text-zinc-500 flex items-center gap-1 font-medium">
                <Lock size={12} />
                내 예측을 제출해야 공개됩니다
              </span>
            )}
          </div>
        </div>

        {/* Actions bar (Like, Share, Duel CTA) */}
        <div className="flex items-center justify-between pt-5 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => repository.toggleLike(forecast.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition ${
                isLiked
                  ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-transparent'
              }`}
            >
              <Heart size={14} className={isLiked ? 'fill-sky-500' : ''} />
              <span>{likesCount}</span>
            </button>

            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition"
            >
              <Share2 size={14} />
              <span>공유</span>
            </button>
          </div>

          <button
            onClick={handleDrawResponse}
            className="btn-signature-draw px-5 py-2.5 rounded-full text-xs sm:text-sm tracking-wide"
          >
            DRAW
          </button>
        </div>
      </div>

      {/* Derived Responses Section (§9.3) */}
      {children.length > 0 && (
        <div className="rounded-3xl bg-white dark:bg-[#0e1017] border border-zinc-200/90 dark:border-zinc-800 p-6 mb-6">
          <h3 className="font-bold text-sm text-zinc-900 dark:text-white mb-4">
            이 예측에서 파생된 반박 궤적 ({children.length}개)
          </h3>
          <div className="space-y-2.5">
            {children.map(child => {
              const childAuthor = child.authorId ? repository.getUser(child.authorId) : null;
              return (
                <div
                  key={child.id}
                  onClick={() => navigate(`/f/${child.id}`)}
                  className="p-3.5 rounded-2xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between cursor-pointer transition"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={childAuthor?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover"
                    />
                    <div>
                      <span className="font-semibold text-xs text-zinc-900 dark:text-white">
                        {childAuthor?.name || '익명'}의 반박 궤적
                      </span>
                      <p className="text-[11px] text-zinc-500 line-clamp-1">{child.comment}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                    보기 →
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comments Section */}
      <div className="rounded-3xl bg-white dark:bg-[#0e1017] border border-zinc-200/90 dark:border-zinc-800 p-6 sm:p-8">
        <h3 className="font-bold text-sm text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
          <MessageSquare size={16} />
          <span>댓글 ({comments.length})</span>
        </h3>

        {/* Comment Input */}
        {currentUser ? (
          <form onSubmit={handleAddComment} className="flex items-center gap-2.5 mb-6">
            <img
              src={currentUser.avatarUrl}
              alt=""
              className="w-8 h-8 rounded-full object-cover"
            />
            <div className="flex-1 flex items-center bg-zinc-100 dark:bg-zinc-800/80 rounded-full px-4 py-1.5 border border-zinc-200 dark:border-zinc-700">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="의견을 남겨보세요..."
                className="w-full bg-transparent text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="p-1 text-sky-500 disabled:opacity-30 hover:scale-110 transition"
              >
                <Send size={15} />
              </button>
            </div>
          </form>
        ) : (
          <div className="p-3.5 mb-6 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-500 text-center">
            댓글을 남기려면 상단에서 먼저 로그인하세요.
          </div>
        )}

        {/* Comments List */}
        <div className="space-y-4">
          {comments.map(c => (
            <div key={c.id} className="flex items-start gap-3">
              <img
                src={c.authorAvatar}
                alt=""
                className="w-8 h-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-xs text-zinc-900 dark:text-white">{c.authorName}</span>
                  <span className="text-[11px] text-zinc-400 font-mono">@{c.authorHandle}</span>
                  <span className="text-[10px] text-zinc-400 font-mono">· {formatRelativeTime(c.createdAt)}</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {c.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
