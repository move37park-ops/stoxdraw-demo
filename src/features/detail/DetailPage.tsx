import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MessageSquare, Share2, PenTool, RefreshCw, Lock, Users, Send } from 'lucide-react';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId } from '../../data/session';
import { getStockHistory } from '../../data/market';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecast } from '../../domain/resolution';
import { aggregateCrowd } from '../../domain/crowd';
import { ForecastChart } from '../../components/ForecastChart';
import { StatusBadge } from '../../components/StatusBadge';
import { ResponseBanner } from '../../components/ResponseBanner';
import { formatPct, formatRelativeTime, formatDateShort, formatCurrency } from '../../domain/format';
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
      <div className="p-12 text-center text-[#71767b]">
        예측을 찾을 수 없습니다.
        <div className="mt-4">
          <button onClick={() => navigate('/')} className="btn-outline">
            홈으로 돌아가기
          </button>
        </div>
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

  // 사용자가 해당 예측 조건(종목·기간·모드)에 참여했는지 확인 (익명 사용자 포함!)
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
          text: forecast.comment,
          url,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(url);
      alert('링크가 복사되었습니다!');
    }
  };

  return (
    <div className="w-full min-h-[100dvh] lg:min-h-0 flex flex-col pb-4">
      {/* Top Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-black/85 backdrop-blur-md border-b border-[#1b1e26]">
        <button
          onClick={() => navigate(-1)}
          className="p-1 rounded-full text-[#71767b] hover:text-white transition"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="font-bold text-white text-[16px]">Forecast</span>
      </div>

      <div className="p-4">
        {/* Parent Reference (§9.2) */}
        {forecast.parentId && (
          <ResponseBanner
            parentAuthorHandle={parentAuthor?.handle}
            parentId={forecast.parentId}
          />
        )}

        {/* Author Info */}
        <div className="flex items-center gap-3 mb-4">
          <img
            src={author?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
            alt={author?.name || '익명'}
            className="w-11 h-11 rounded-full object-cover border border-[#272a33]"
          />
          <div>
            <div className="font-bold text-white text-[15px]">{author?.name || '익명 예측가'}</div>
            <div className="text-[#71767b] text-[13px]">@{author?.handle || 'anon'}</div>
          </div>
        </div>

        {/* Ticker Meta Bar */}
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2.5 py-1 rounded bg-[#181a24] text-white font-mono font-bold text-[13px] border border-[#2a2e3d]">
            {forecast.ticker}
          </span>
          <span className="text-[13px] text-[#9aa0a6] font-medium font-mono">
            {forecast.horizon === '5D' ? '1주(5D)' : '1개월(30D)'}
          </span>
          <span className="text-[#3f444d]">·</span>
          <span className="text-[13px] text-[#9aa0a6]">
            {forecast.mode === 'path' ? '경로 그리기' : '목표가 돌파'}
          </span>
          <div className="ml-auto">
            <StatusBadge
              status={status}
              isHit={isHit}
              label={forecast.mode === 'breakout' ? '목표 도달' : '적중'}
            />
          </div>
        </div>

        {/* Comment Text */}
        {forecast.comment && (
          <p className="text-[15px] text-white leading-relaxed my-3">
            {forecast.comment}
          </p>
        )}

        {/* Chart View */}
        <div className="my-3">
          <ForecastChart
            forecast={forecast}
            height={260}
            showCrowd={showCrowd}
            crowdPath={crowd.consensusPath}
            currentDateStr={currentDateStr}
          />
        </div>

        {/* Result & Evaluation Metrics */}
        {(status === 'LIVE' || status === 'RESOLVED') && (
          <div className="p-3.5 my-3 rounded-xl bg-[#11131a] border border-[#202430]">
            <div className="flex items-center justify-between text-[13px] mb-2">
              <span className="text-[#71767b]">기준가</span>
              <span className="font-mono text-white">{formatCurrency(forecast.basePrice)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px] mb-2">
              <span className="text-[#71767b]">
                {forecast.mode === 'breakout' ? '목표 가격' : '예측 변화율'}
              </span>
              <span className={`font-mono font-semibold ${result.forecastChangePct >= 0 ? 'text-[#38bdf8]' : 'text-[#f43f5e]'}`}>
                {forecast.mode === 'breakout'
                  ? `${formatCurrency(forecast.breakout?.price || 0)} (${formatPct(result.forecastChangePct)})`
                  : formatPct(result.forecastChangePct)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#71767b]">{status === 'LIVE' ? '현재 시장 변화율' : '최종 시장 변화율'}</span>
              <span className={`font-mono font-semibold ${result.actualChangePct >= 0 ? 'text-[#22c55e]' : 'text-[#f43f5e]'}`}>
                {formatPct(result.actualChangePct)} {
                  forecast.mode === 'breakout'
                    ? (result.breakoutHit ? '(✓ 목표 도달)' : status === 'LIVE' ? '(도달 대기)' : '(미도달)')
                    : status === 'LIVE'
                    ? (result.directionHit ? '(방향 일치 중)' : '')
                    : (result.directionHit ? '(✓ 적중)' : '(빗나감)')
                }
              </span>
            </div>
          </div>
        )}

        {/* Lifecycle Dates */}
        <div className="text-[12px] text-[#71767b] pb-3 border-b border-[#1b1e26] flex items-center gap-4">
          <span>작성일: {formatDateShort(forecast.baseDate)}</span>
          <span>만료일: {formatDateShort(forecast.evalDates[forecast.evalDates.length - 1])}</span>
        </div>

        {/* Social Metrics & Actions */}
        <div className="flex items-center justify-between py-3 border-b border-[#1b1e26] text-[#71767b]">
          <button
            onClick={() => repository.toggleLike(forecast.id)}
            className={`flex items-center gap-1.5 transition ${isLiked ? 'text-rose-500 font-semibold' : 'hover:text-rose-400'}`}
          >
            <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
            <span className="text-[13px]">{likesCount}</span>
          </button>
          <div className="flex items-center gap-1.5 text-[13px]">
            <MessageSquare size={18} />
            <span>{comments.length}</span>
          </div>
          <button onClick={handleShare} className="hover:text-white transition" title="공유하기">
            <Share2 size={18} />
          </button>
        </div>

        {/* Crowd Section */}
        <div className="my-5 p-4 rounded-xl bg-[#0c0d12] border border-[#1f222b]">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-[#a855f7]" />
              <span className="font-semibold text-white text-[14px]">Crowd 합의 (집단 예측)</span>
            </div>
            {!crowd.isColdStart && (
              <span className="text-xs text-[#71767b] font-mono">
                {crowd.participantsCount}명 참여
              </span>
            )}
          </div>

          {!hasParticipated ? (
            <div className="py-4 text-center">
              <div className="w-8 h-8 rounded-full bg-zinc-900 text-zinc-500 flex items-center justify-center mx-auto mb-2">
                <Lock size={15} />
              </div>
              <p className="text-[13px] text-[#71767b] mb-3">
                먼저 이 종목에 예측을 남기면 Crowd의 집단 예측이 공개됩니다.
              </p>
              <button
                onClick={handleDrawResponse}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-[#4facfe] to-[#a18cd1] text-black font-semibold text-xs hover:brightness-110 shadow-sm"
              >
                예측하고 Crowd 보기
              </button>
            </div>
          ) : crowd.isColdStart ? (
            <div className="py-3 text-center text-[#71767b] text-[13px]">
              <p className="font-medium text-white mb-0.5">아직 참여자가 적어요</p>
              <p className="text-xs">5명 이상 참여하면 집단 합의 궤적이 공개됩니다.</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between text-[13px] mb-2">
                <span className="text-[#9aa0a6]">Crowd 평균 전망</span>
                <span className="font-mono font-semibold text-purple-400">
                  {forecast.mode === 'path'
                    ? formatPct(crowd.consensusChangePct || 0)
                    : `${crowd.upPct}% 상승 예측`}
                </span>
              </div>
              <button
                onClick={() => setShowCrowd(!showCrowd)}
                className="w-full mt-2 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-semibold hover:bg-purple-500/25 transition"
              >
                {showCrowd ? '차트에서 Crowd 숨기기' : '차트에 Crowd 궤적 겹쳐보기'}
              </button>
            </div>
          )}
        </div>

        {/* Responses to this Forecast (§9.2) */}
        {children.length > 0 && (
          <div className="my-5">
            <h4 className="font-semibold text-white text-[14px] mb-3">
              이 Forecast에 대한 응답 ({children.length})
            </h4>
            <div className="flex flex-col gap-2">
              {children.map(child => {
                const childAuthor = child.authorId ? repository.getUser(child.authorId) : null;
                return (
                  <div
                    key={child.id}
                    onClick={() => navigate(`/f/${child.id}`)}
                    className="p-3 rounded-xl bg-[#0e0f14] border border-[#1b1e26] hover:border-[#2f3442] cursor-pointer transition"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-semibold text-white text-[13px]">
                        @{childAuthor?.handle || 'anon'}
                      </span>
                      <span className="text-[#71767b] text-[11px]">
                        {formatRelativeTime(child.lockedAt)}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#c4c7cf] line-clamp-2">
                      {child.comment || `${child.ticker} 예측 응답`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div className="my-6">
          <h4 className="font-semibold text-white text-[14px] mb-3">
            댓글 ({comments.length})
          </h4>

          {currentUser ? (
            <form onSubmit={handleAddComment} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="의견을 남겨보세요..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-xl bg-[#14161f] border border-[#272b38] text-white text-[13px] placeholder-[#71767b] focus:outline-none focus:border-[#38bdf8]"
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="p-2.5 rounded-xl bg-white text-black disabled:opacity-40 hover:bg-zinc-200 transition"
              >
                <Send size={15} />
              </button>
            </form>
          ) : (
            <div className="p-3 rounded-xl bg-[#0c0d12] border border-[#1b1e26] text-center text-xs text-[#71767b] mb-4">
              댓글을 작성하려면 계정 연결이 필요합니다.
            </div>
          )}

          <div className="flex flex-col gap-3">
            {comments.map(c => (
              <div key={c.id} className="flex gap-2.5 text-[13px]">
                <img
                  src={c.authorAvatar}
                  alt={c.authorName}
                  className="w-7 h-7 rounded-full object-cover mt-0.5 border border-[#272a33]"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{c.authorName}</span>
                    <span className="text-[#71767b] text-xs">@{c.authorHandle}</span>
                    <span className="text-[#3f444d] text-[10px]">·</span>
                    <span className="text-[#71767b] text-xs">{formatRelativeTime(c.createdAt)}</span>
                  </div>
                  <p className="text-[#d1d5db] mt-0.5">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Primary CTA: [나도 그리기] (§3.4 One Primary Action, §8) */}
      <div className="sticky bottom-0 w-full px-4 py-3 bg-black/90 backdrop-blur-md border-t border-[#1b1e26] z-30 flex justify-end mt-4">
        <button
          onClick={handleDrawResponse}
          className="w-full sm:w-auto px-6 py-3 rounded-full bg-gradient-to-r from-[#4facfe] to-[#a18cd1] text-black font-bold text-[15px] flex items-center justify-center gap-2 hover:brightness-110 shadow-[0_4px_20px_rgba(79,172,254,0.3)] border border-white/20 active:scale-95 transition-all"
        >
          {status === 'RESOLVED' ? (
            <>
              <RefreshCw size={16} className="stroke-[2.5]" />
              다시 그리기
            </>
          ) : (
            <>
              <PenTool size={16} className="stroke-[2.5]" />
              나도 그리기
            </>
          )}
        </button>
      </div>
    </div>
  );
}
