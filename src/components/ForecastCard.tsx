import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageSquare, Share2 } from 'lucide-react';
import type { Forecast } from '../domain/types';
import { repository } from '../data/localRepository';
import { deriveForecastStatus } from '../domain/lifecycle';
import { resolveForecast } from '../domain/resolution';
import { getStockHistory } from '../data/market';
import { ForecastChart } from './ForecastChart';
import { StatusBadge } from './StatusBadge';
import { ResponseBanner } from './ResponseBanner';
import { formatPct, formatRelativeTime } from '../domain/format';

interface ForecastCardProps {
  forecast: Forecast;
  currentDateStr?: string;
  onCommentClick?: (forecastId: string) => void;
}

export function ForecastCard({
  forecast,
  currentDateStr = '2026-10-05',
  onCommentClick,
}: ForecastCardProps) {
  const navigate = useNavigate();
  const author = forecast.authorId ? repository.getUser(forecast.authorId) : null;
  const parent = forecast.parentId ? repository.getForecast(forecast.parentId) : null;
  const parentAuthor = parent && parent.authorId ? repository.getUser(parent.authorId) : null;

  const isLiked = repository.isLiked(forecast.id);
  const likesCount = repository.getLikesCount(forecast.id);
  const commentsCount = repository.listComments(forecast.id).length;

  const status = deriveForecastStatus(forecast, currentDateStr);
  const stockBars = getStockHistory(forecast.ticker);
  const visibleBars = stockBars.filter(b => b.date <= currentDateStr);
  const result = resolveForecast(forecast, visibleBars);
  const isHit = forecast.mode === 'breakout' ? result.breakoutHit : result.directionHit;

  const handleCardClick = () => {
    navigate(`/f/${forecast.id}`);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    repository.toggleLike(forecast.id);
  };

  const handleDrawResponse = (e: React.MouseEvent) => {
    e.stopPropagation();
    // [나도 그리기] → 원본 Forecast의 종목, 기간, 모드를 계승하여 Draw로 직행
    navigate(`/draw?parent=${forecast.id}&ticker=${forecast.ticker}&horizon=${forecast.horizon}&mode=${forecast.mode}`);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/f/${forecast.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `STOXDRAW — ${forecast.ticker} ${forecast.horizon} Forecast`,
          text: forecast.comment || `${forecast.ticker} 미래 주가 예측을 확인하고 함께 예측해 보세요!`,
          url,
        });
      } catch {
        // Fallback
      }
    } else {
      navigator.clipboard.writeText(url);
      alert('예측 링크가 복사되었습니다!');
    }
  };

  return (
    <article
      onClick={handleCardClick}
      className="p-4 border-b border-[#1b1e26] hover:bg-[#0c0d12]/50 transition-colors cursor-pointer"
    >
      {/* 1. 파생 관계 배너 */}
      {forecast.parentId && (
        <ResponseBanner
          parentAuthorHandle={parentAuthor?.handle}
          parentId={forecast.parentId}
        />
      )}

      {/* 2. 작성자 헤더 */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <img
            src={author?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
            alt={author?.name || '익명'}
            className="w-9 h-9 rounded-full object-cover border border-[#272a33]"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white text-[14px]">
                {author?.name || '익명 예측가'}
              </span>
              <span className="text-[#71767b] text-[13px]">
                @{author?.handle || 'anon'}
              </span>
              <span className="text-[#3f444d] text-[11px]">·</span>
              <span className="text-[#71767b] text-[12px]">
                {formatRelativeTime(forecast.lockedAt)}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleShare}
          className="text-[#71767b] hover:text-white p-1 rounded-full hover:bg-zinc-800 transition"
          title="공유하기"
        >
          <Share2 size={16} />
        </button>
      </div>

      {/* 3. 종목 및 메타 칩 바 */}
      <div className="flex items-center gap-2 mb-2">
        <span className="px-2 py-0.5 rounded bg-[#181a24] text-white font-mono font-bold text-[12px] border border-[#2a2e3d]">
          {forecast.ticker}
        </span>
        <span className="text-[12px] text-[#9aa0a6] font-medium font-mono">
          {forecast.horizon === '5D' ? '1주(5D)' : '1개월(30D)'}
        </span>
        <span className="text-[#3f444d] text-[10px]">·</span>
        <span className="text-[12px] text-[#9aa0a6]">
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

      {/* 4. 코멘트 본문 (글이 차트보다 먼저 노출되는 자연스러운 피드 위계) */}
      {forecast.comment && (
        <p className="text-[14px] text-[#e6e8ec] leading-relaxed my-2.5">
          {forecast.comment}
        </p>
      )}

      {/* 5. Forecast Chart (SVG) */}
      <div className="my-2">
        <ForecastChart
          forecast={forecast}
          height={180}
          currentDateStr={currentDateStr}
        />
      </div>

      {/* 6. 결과 요약 바 (LIVE 또는 RESOLVED인 경우) */}
      {(status === 'LIVE' || status === 'RESOLVED') && (
        <div className="flex items-center justify-between px-3 py-2 my-2.5 rounded-lg bg-[#11131a] border border-[#202430] text-[13px]">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-[#71767b] text-[11px] block">
                {forecast.mode === 'breakout' ? '목표 가격' : '예측 변화율'}
              </span>
              <span className={`font-mono font-semibold ${result.forecastChangePct >= 0 ? 'text-[#38bdf8]' : 'text-[#f43f5e]'}`}>
                {forecast.mode === 'breakout'
                  ? `$${forecast.breakout?.price.toFixed(2)} (${formatPct(result.forecastChangePct)})`
                  : formatPct(result.forecastChangePct)}
              </span>
            </div>
            <div className="h-6 w-px bg-[#262a36]" />
            <div>
              <span className="text-[#71767b] text-[11px] block">{status === 'LIVE' ? '현재가 변화' : '최종 결과'}</span>
              <span className={`font-mono font-semibold ${result.actualChangePct >= 0 ? 'text-[#22c55e]' : 'text-[#f43f5e]'}`}>
                {formatPct(result.actualChangePct)}
              </span>
            </div>
          </div>

          <div>
            {forecast.mode === 'breakout' ? (
              result.breakoutHit ? (
                <span className="text-[#38bdf8] font-semibold text-[12px] flex items-center gap-1">
                  ✓ 목표가 도달 {result.hitDate && `(${result.hitDate.slice(5).replace('-', '/')})`}
                </span>
              ) : (
                <span className="text-[#71767b] font-medium text-[12px]">
                  {status === 'LIVE' ? '도달 대기 중' : '목표가 미도달'}
                </span>
              )
            ) : status === 'LIVE' ? (
              <span className={result.directionHit ? "text-[#38bdf8] font-semibold text-[12px]" : "text-[#71767b] font-medium text-[12px]"}>
                {result.directionHit ? '방향 일치 중' : `오차 ${result.endErrorPct}%`}
              </span>
            ) : result.directionHit ? (
              <span className="text-[#38bdf8] font-semibold text-[12px] flex items-center gap-1">
                ✓ 방향 적중
              </span>
            ) : (
              <span className="text-[#71767b] font-medium text-[12px]">
                오차 {result.endErrorPct}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* 7. 소셜 액션 & 핵심 CTA [나도 그리기] */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#161820]">
        <div className="flex items-center gap-5 text-[#71767b]">
          {/* Like */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-[13px] transition ${
              isLiked ? 'text-rose-500 font-semibold' : 'hover:text-rose-400'
            }`}
          >
            <Heart
              size={17}
              fill={isLiked ? 'currentColor' : 'none'}
            />
            <span>{likesCount > 0 ? likesCount : ''}</span>
          </button>

          {/* Comment */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onCommentClick) onCommentClick(forecast.id);
              else navigate(`/f/${forecast.id}`);
            }}
            className="flex items-center gap-1.5 text-[13px] hover:text-[#38bdf8] transition"
          >
            <MessageSquare size={17} />
            <span>{commentsCount > 0 ? commentsCount : ''}</span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-[13px] hover:text-white transition"
          >
            <Share2 size={16} />
          </button>
        </div>

        {/* Primary Action Button: DRAW */}
        <button
          onClick={handleDrawResponse}
          className="btn-signature-draw px-4 py-1.5 rounded-full text-xs tracking-wide"
        >
          DRAW
        </button>
      </div>
    </article>
  );
}
