import { useEffect, useRef, useState } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';
import type { Forecast, PathPoint } from '../domain/types';
import { computeForecastDigest } from '../domain/audit';
import { formatPct } from '../domain/format';
import { getEloTierInfo, formatSignedLp, DEFAULT_ELO } from '../domain/elo';
import { track } from '../lib/analytics';

interface ShareTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  forecast: Forecast;
  authorHandle?: string;
  crowdPath?: PathPoint[];
  crowdChangePct?: number;
  scoreTotal?: number;
  scoreGrade?: string;
  eloDeltaLp?: number;
  authorElo?: number;
}

export function ShareTicketModal({
  isOpen,
  onClose,
  forecast,
  authorHandle = 'anon_user',
  crowdPath,
  crowdChangePct,
  scoreTotal,
  scoreGrade,
  eloDeltaLp,
  authorElo = DEFAULT_ELO,
}: ShareTicketModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copiedType, setCopiedType] = useState<'text' | 'link' | null>(null);

  const path = forecast.path || [];
  const targetPrice =
    path.length > 0 ? path[path.length - 1].price : forecast.basePrice;
  const changePct =
    forecast.basePrice > 0
      ? ((targetPrice - forecast.basePrice) / forecast.basePrice) * 100
      : 0;
  const isBull = changePct >= 0;
  const divergencePct =
    crowdChangePct !== undefined ? changePct - crowdChangePct : null;
  const digest = computeForecastDigest(forecast);
  const tierInfo = getEloTierInfo(authorElo);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/f/${forecast.id}`
      : `https://stoxdraw.com/f/${forecast.id}`;

  const shareSnippet = [
    `STOXDRAW · ${forecast.ticker} 20일 예측`,
    `예측자: @${authorHandle} (${tierInfo.krTitle} · ${authorElo} LP)`,
    `20일 목표: $${forecast.basePrice.toLocaleString('en-US')} -> $${targetPrice.toLocaleString('en-US')} (${formatPct(changePct)})`,
    eloDeltaLp !== undefined && scoreTotal !== undefined
      ? `정산 점수: ${scoreTotal.toFixed(1)}점 (${scoreGrade}등급) · ${formatSignedLp(eloDeltaLp)}`
      : divergencePct !== null
      ? `군집 중앙값 대비: ${divergencePct >= 0 ? '+' : ''}${divergencePct.toFixed(1)}%p`
      : null,
    forecast.comment ? `시나리오: "${forecast.comment}"` : null,
    `${shareUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1200;
    const H = 630;
    canvas.width = W;
    canvas.height = H;

    // 1. Pure Dark Geist Terminal Canvas
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);

    // Subtle Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    for (let x = 60; x < W; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 60; y < H; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Outer Frame
    ctx.strokeStyle = '#262626';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(24, 24, W - 48, H - 48);

    // Top Header Bar
    ctx.fillStyle = '#0c0c0e';
    ctx.fillRect(25, 25, W - 50, 68);
    ctx.strokeStyle = '#262626';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(25, 93);
    ctx.lineTo(W - 25, 93);
    ctx.stroke();

    // Brand Title (Editorial Serif)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 26px "Times Newer Roman", "Tinos", "Instrument Serif", Didot, "Bodoni MT", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('STOXDRAW', 56, 68);

    ctx.fillStyle = '#3291ff';
    ctx.font = '600 14px "Pretendard Variable", "Pretendard", sans-serif';
    ctx.fillText('· BTC/USDT 20D FORECAST & TIER PROOF', 185, 65);

    ctx.fillStyle = '#888888';
    ctx.font = '500 12px "Pretendard Variable", "Pretendard", sans-serif';
    ctx.textAlign = 'right';
    const verCount = forecast.versions?.length ?? 1;
    ctx.fillText(
      `BASE ${forecast.baseDate} · v${verCount} LOCKED · ${digest.slice(0, 14)}...`,
      W - 56,
      65
    );

    // Left Column: Ticker, Tier Badge, Target Return
    const leftX = 56;
    ctx.textAlign = 'left';

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 44px "Pretendard Variable", "Pretendard", sans-serif';
    ctx.fillText(forecast.ticker, leftX, 168);

    ctx.fillStyle = tierInfo.accentHex;
    ctx.font = '700 16px "Pretendard Variable", "Pretendard", sans-serif';
    ctx.fillText(
      `@${authorHandle}  ·  ${tierInfo.krTitle} (${tierInfo.tier} ${authorElo} LP)`,
      leftX,
      204
    );

    ctx.fillStyle = '#888888';
    ctx.font = '600 13px "Pretendard Variable", "Pretendard", sans-serif';
    ctx.fillText('D+20 목표 수익률', leftX, 256);

    const accentColor = isBull ? '#00e599' : '#f43f5e';
    ctx.fillStyle = accentColor;
    ctx.font = '700 62px "Pretendard Variable", "Pretendard", sans-serif';
    ctx.fillText(formatPct(changePct), leftX, 322);

    ctx.fillStyle = '#ededed';
    ctx.font = '600 18px "Pretendard Variable", "Pretendard", sans-serif';
    ctx.fillText(
      `$${forecast.basePrice.toLocaleString('en-US')}  →  $${targetPrice.toLocaleString('en-US')}`,
      leftX,
      358
    );

    // Score or Crowd Comparison Box
    ctx.fillStyle = '#111113';
    ctx.strokeStyle = '#27272a';
    ctx.fillRect(leftX, 390, 440, 86);
    ctx.strokeRect(leftX, 390, 440, 86);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 13px sans-serif';
    if (scoreTotal !== undefined) {
      ctx.fillText('20일 채점 결과', leftX + 20, 420);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 22px "Pretendard Variable", "Pretendard", sans-serif';
      ctx.fillText(
        `${scoreTotal.toFixed(1)} / 100점 (${scoreGrade}등급)  ·  ${
          eloDeltaLp !== undefined ? formatSignedLp(eloDeltaLp) : ''
        }`,
        leftX + 20,
        454
      );
    } else {
      ctx.fillText('중앙값 대비', leftX + 20, 420);
      ctx.fillStyle = '#3291ff';
      ctx.font = '700 20px "Pretendard Variable", "Pretendard", sans-serif';
      const crowdText =
        crowdChangePct !== undefined
          ? `Crowd 중앙값 ${formatPct(crowdChangePct)} 대비 ${formatPct(divergencePct!)}p`
          : `점 ${forecast.anchors?.length ?? 3}개 · 20일 경로`;
      ctx.fillText(crowdText, leftX + 20, 454);
    }

    // Thesis Comment Footer
    ctx.fillStyle = '#888888';
    ctx.font = '400 14px sans-serif';
    const shortComment =
      (forecast.comment || '').length > 52
        ? `${forecast.comment.slice(0, 52)}...`
        : forecast.comment || '차트 위에 직접 그린 20일 가격 시나리오';
    ctx.fillText(`"${shortComment}"`, leftX, 535);

    // Right Column: Mini 20-Day Polyline Trajectory Chart
    const chartX = 540;
    const chartY = 135;
    const chartW = 590;
    const chartH = 410;

    ctx.fillStyle = '#0b0b0e';
    ctx.strokeStyle = '#262626';
    ctx.fillRect(chartX, chartY, chartW, chartH);
    ctx.strokeRect(chartX, chartY, chartW, chartH);

    const allPrices = [
      forecast.basePrice,
      ...path.map(p => p.price),
      ...(crowdPath ? crowdPath.map(p => p.price) : []),
    ];
    const minP = Math.min(...allPrices) * 0.985;
    const maxP = Math.max(...allPrices) * 1.015;

    const toX = (stepIdx: number, totalSteps: number) =>
      chartX + 40 + (stepIdx / Math.max(1, totalSteps)) * (chartW - 80);
    const toY = (price: number) => {
      const ratio = (price - minP) / Math.max(1, maxP - minP);
      return chartY + chartH - 45 - ratio * (chartH - 90);
    };

    // Base Price Horizontal Dashed Line
    const baseY = toY(forecast.basePrice);
    ctx.strokeStyle = '#333333';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(chartX + 20, baseY);
    ctx.lineTo(chartX + chartW - 20, baseY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Crowd Median Path if available
    if (crowdPath && crowdPath.length > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(toX(0, crowdPath.length), baseY);
      crowdPath.forEach((pt, idx) => {
        ctx.lineTo(toX(idx + 1, crowdPath.length), toY(pt.price));
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // User 20-Day Interpolated Polyline
    if (path.length > 0) {
      ctx.strokeStyle = '#3291ff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(toX(0, path.length), baseY);
      path.forEach((pt, idx) => {
        ctx.lineTo(toX(idx + 1, path.length), toY(pt.price));
      });
      ctx.stroke();

      // Anchor Dots
      const anchors = forecast.anchors || [{ day: path.length, price: targetPrice }];
      anchors.forEach(a => {
        const ax = toX(a.day, path.length);
        const ay = toY(a.price);
        ctx.fillStyle = '#0b0b0e';
        ctx.strokeStyle = '#3291ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ax, ay, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    ctx.fillStyle = '#888888';
    ctx.font = '600 12px "Pretendard Variable", "Pretendard", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('D-0 ANCHOR', chartX + 36, chartY + chartH - 16);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#3291ff';
    ctx.fillText('D+20 INTERPOLATED PATH', chartX + chartW - 36, chartY + chartH - 16);
  }, [
    isOpen,
    forecast,
    authorHandle,
    authorElo,
    tierInfo,
    targetPrice,
    changePct,
    isBull,
    crowdPath,
    crowdChangePct,
    divergencePct,
    scoreTotal,
    scoreGrade,
    eloDeltaLp,
    digest,
    path,
  ]);

  if (!isOpen) return null;

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `stoxdraw-btc-20d-${forecast.id}.png`;
    link.href = url;
    link.click();
    track('share_clicked', { method: 'download_png', forecastId: forecast.id });
  };

  const handleCopyText = async (type: 'text' | 'link') => {
    const text = type === 'link' ? shareUrl : shareSnippet;
    await navigator.clipboard.writeText(text);
    setCopiedType(type);
    track('share_clicked', { method: type, forecastId: forecast.id });
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.78)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-[10px] p-5 space-y-4"
        style={{
          backgroundColor: 'var(--v-canvas)',
          boxShadow: 'var(--v-shadow-stack)',
          color: 'var(--v-ink)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between pb-3"
          style={{ borderBottom: '1px solid var(--v-hairline)' }}
        >
          <div>
            <h3 className="v-heading-16">
              예측 공유 카드
            </h3>
            <p className="v-caption" style={{ color: 'var(--v-mute)' }}>
              20일 예측 경로와 티어 정보가 담긴 검증 이미지입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="v-btn-secondary h-7 w-7 p-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* Canvas Preview */}
        <div
          className="w-full rounded-[6px] overflow-hidden"
          style={{ boxShadow: 'var(--v-shadow-border)' }}
        >
          <canvas ref={canvasRef} className="w-full h-auto block" />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              className="v-btn-primary h-8 px-3.5 text-xs font-semibold"
            >
              <Download size={13} />
              PNG 다운로드
            </button>
            <button
              type="button"
              onClick={() => handleCopyText('text')}
              className="v-btn-secondary h-8 px-3 text-xs"
            >
              {copiedType === 'text' ? <Check size={12} /> : <Copy size={12} />}
              {copiedType === 'text' ? '텍스트 복사됨' : '텍스트 복사'}
            </button>
            <button
              type="button"
              onClick={() => handleCopyText('link')}
              className="v-btn-secondary h-8 px-3 text-xs"
            >
              {copiedType === 'link' ? <Check size={12} /> : <Copy size={12} />}
              {copiedType === 'link' ? '링크 복사됨' : '링크 복사'}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="v-btn-secondary h-8 px-3 text-xs"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
