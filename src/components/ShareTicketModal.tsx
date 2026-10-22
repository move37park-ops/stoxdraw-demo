import { useEffect, useRef, useState } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';
import type { Forecast, PathPoint } from '../domain/types';
import { computeForecastDigest } from '../domain/audit';
import { formatPct } from '../domain/format';
import { getEloTierInfo, formatSignedLp, DEFAULT_ELO } from '../domain/elo';
import { getStockLandmarks } from '../data/market';
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
  const targetPrice = path.length > 0 ? path[path.length - 1].price : forecast.basePrice;
  const changePct = forecast.basePrice > 0
    ? ((targetPrice - forecast.basePrice) / forecast.basePrice) * 100
    : 0;
  const isBull = changePct >= 0;
  const divergencePct = crowdChangePct !== undefined ? changePct - crowdChangePct : null;
  const digest = computeForecastDigest(forecast);
  const tierInfo = getEloTierInfo(authorElo);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/f/${forecast.id}`
    : `https://stoxdraw.com/f/${forecast.id}`;

  const stepSummary = path
    .map((p, idx) => `D+${idx + 1} $${p.price.toFixed(1)}`)
    .join(' -> ');

  const shareSnippet = [
    `[STOXDRAW // 5D TRAJECTORY & ELO RECEIPT]`,
    `Instrument: $${forecast.ticker} (${forecast.roundId || '5D ROUND'}) | Forecaster: @${authorHandle} (${tierInfo.tier} · ${authorElo} LP)`,
    `Trajectory: Anchor $${forecast.basePrice.toFixed(2)} -> D+5 Target $${targetPrice.toFixed(2)} (${formatPct(changePct)})`,
    eloDeltaLp !== undefined
      ? `Settlement: ${scoreTotal?.toFixed(1)} pts (${scoreGrade}) | Elo ${formatSignedLp(eloDeltaLp)}`
      : divergencePct !== null
      ? `vs Crowd Median (${formatPct(crowdChangePct!)}): ${divergencePct >= 0 ? '+' : ''}${divergencePct.toFixed(1)}%p edge`
      : null,
    stepSummary ? `5D Vector: ${stepSummary}` : null,
    forecast.comment ? `Thesis: "${forecast.comment}"` : null,
    `Verify receipt: ${shareUrl}`,
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

    // 1. Pure Black Terminal Canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    // Subtle Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
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

    // Outer Border
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(24, 24, W - 48, H - 48);

    // Top Header Bar
    ctx.fillStyle = '#09090b';
    ctx.fillRect(25, 25, W - 50, 68);
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(25, 93);
    ctx.lineTo(W - 25, 93);
    ctx.stroke();

    // Brand & Ticket ID
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 20px "Geist", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('STOXDRAW', 56, 66);

    ctx.fillStyle = '#71717a';
    ctx.font = '500 13px "Geist Mono", monospace';
    ctx.fillText('· 5D FORECAST & ELO PROTOCOL', 175, 65);

    ctx.fillStyle = '#71717a';
    ctx.font = '500 12px "Geist Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`UTC ${forecast.baseDate} · DIGEST ${digest.slice(0, 14)}...`, W - 56, 65);

    // Left Column (Metrics & Thesis)
    const leftX = 56;
    ctx.textAlign = 'left';

    // Ticker & Stance Tag
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 48px "Geist", sans-serif';
    ctx.fillText(`$${forecast.ticker}`, leftX, 172);

    const stanceLabel = isBull ? 'BULLISH 5D' : 'BEARISH 5D';
    const accentColor = isBull ? '#10b981' : '#f43f5e';
    ctx.fillStyle = accentColor;
    ctx.font = '700 15px monospace';
    ctx.fillText(`${stanceLabel}  ·  @${authorHandle} (${tierInfo.tier} ${authorElo} LP)`, leftX, 206);

    // Target Return Hero Number
    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 14px "Pretendard Variable", sans-serif';
    ctx.fillText('5거래일 목표 수익률 및 예측 종가', leftX, 256);

    ctx.fillStyle = accentColor;
    ctx.font = '800 56px monospace';
    ctx.fillText(formatPct(changePct), leftX, 316);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 22px monospace';
    ctx.fillText(`$${forecast.basePrice.toFixed(2)}  ->  $${targetPrice.toFixed(2)}`, leftX, 353);

    // Comparison Box (Consensus & Elo Rating)
    ctx.fillStyle = '#09090b';
    ctx.fillRect(leftX, 385, 440, 96);
    ctx.strokeStyle = '#27272a';
    ctx.strokeRect(leftX, 385, 440, 96);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 13px monospace';
    ctx.fillText('MARKET CONSENSUS', leftX + 20, 415);
    ctx.fillText(eloDeltaLp !== undefined ? 'SETTLED ELO RATING' : 'VS CONSENSUS EDGE', leftX + 235, 415);

    ctx.fillStyle = '#e4e4e7';
    ctx.font = '700 24px monospace';
    ctx.fillText(crowdChangePct !== undefined ? formatPct(crowdChangePct) : 'LOCKED', leftX + 20, 452);

    ctx.fillStyle = '#DFC15D';
    ctx.font = '700 23px monospace';
    if (eloDeltaLp !== undefined) {
      ctx.fillStyle = eloDeltaLp >= 0 ? '#10b981' : '#f43f5e';
      ctx.fillText(`${formatSignedLp(eloDeltaLp)} (${scoreGrade || 'A'})`, leftX + 235, 452);
    } else if (divergencePct !== null) {
      ctx.fillText(`${divergencePct >= 0 ? '+' : ''}${divergencePct.toFixed(1)}%p EDGE`, leftX + 235, 452);
    } else {
      ctx.fillText(`${tierInfo.tier} ${authorElo} LP`, leftX + 235, 452);
    }

    // Comment Quote
    const commentText = forecast.comment || `${forecast.ticker} 5거래일 주가 예측`;
    const clippedComment = commentText.length > 52 ? commentText.slice(0, 52) + '...' : commentText;
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '500 16px "Pretendard Variable", sans-serif';
    ctx.fillText(`"${clippedComment}"`, leftX, 526);

    // Footer Callout
    ctx.fillStyle = '#64748B';
    ctx.font = '500 13px monospace';
    ctx.fillText('5일 주가 예측 및 Elo 레이팅 정산 · STOXDRAW ELO PROTOCOL', leftX, 572);

    // Right Column: Trajectory Chart Box
    const chartX = 540;
    const chartY = 125;
    const chartW = 604;
    const chartH = 445;

    ctx.fillStyle = '#0B101B';
    ctx.fillRect(chartX, chartY, chartW, chartH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.strokeRect(chartX, chartY, chartW, chartH);

    const landmarks = getStockLandmarks(forecast.ticker, forecast.basePrice);

    // Compute price scale for chart
    const prices = [
      forecast.basePrice,
      ...path.map(p => p.price),
      ...landmarks.map(l => l.price),
    ];
    if (crowdPath && crowdPath.length > 0) {
      crowdPath.forEach(p => prices.push(p.price));
    }
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const padP = (maxP - minP) * 0.25 || forecast.basePrice * 0.04;
    const lowP = minP - padP;
    const highP = maxP + padP;
    const rangeP = highP - lowP || 1;

    const padInX = 54;
    const padInY = 58;
    const innerW = chartW - padInX * 2;
    const innerH = chartH - padInY * 2;

    const totalSteps = Math.max(path.length, 5);
    const getStepX = (idx: number) => chartX + padInX + (idx / totalSteps) * innerW;
    const getPriceY = (p: number) => chartY + padInY + (1 - (p - lowP) / rangeP) * innerH;

    // Base Horizontal Line
    const baseY = getPriceY(forecast.basePrice);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(chartX + 24, baseY);
    ctx.lineTo(chartX + chartW - 24, baseY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`BASE $${forecast.basePrice.toFixed(1)}`, chartX + 30, baseY - 8);

    // Market Landmarks
    landmarks.forEach(lm => {
      const ly = getPriceY(lm.price);
      const isRes = lm.category !== 'support';
      ctx.strokeStyle = isRes ? 'rgba(56, 189, 248, 0.28)' : 'rgba(223, 193, 93, 0.28)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(chartX + 24, ly);
      ctx.lineTo(chartX + chartW - 24, ly);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = isRes ? '#38bdf8' : '#DFC15D';
      ctx.font = '600 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${lm.label} $${lm.price.toFixed(1)}`, chartX + chartW - 28, ly - 5);
    });

    // Crowd Wave Line (if present)
    if (crowdPath && crowdPath.length > 0) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(getStepX(0), baseY);
      crowdPath.forEach((p, idx) => {
        ctx.lineTo(getStepX(idx + 1), getPriceY(p.price));
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // User Forecast Path Line
    if (path.length > 0) {
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(getStepX(0), baseY);
      path.forEach((p, idx) => {
        ctx.lineTo(getStepX(idx + 1), getPriceY(p.price));
      });
      ctx.stroke();

      // Draw Nodes & Labels
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(getStepX(0), baseY, 5, 0, Math.PI * 2);
      ctx.fill();

      path.forEach((p, idx) => {
        const px = getStepX(idx + 1);
        const py = getPriceY(p.price);

        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`$${p.price.toFixed(1)}`, px, py - 14);

        ctx.fillStyle = '#94A3B8';
        ctx.font = '500 12px monospace';
        ctx.fillText(`D+${idx + 1}`, px, chartY + chartH - 18);
      });
    }

    // Legend inside Chart Box
    ctx.textAlign = 'right';
    ctx.font = '600 12px monospace';
    ctx.fillStyle = accentColor;
    ctx.fillText('— MY 5D PATH', chartX + chartW - 24, chartY + 28);
    if (crowdPath && crowdPath.length > 0) {
      ctx.fillStyle = '#a1a1aa';
      ctx.fillText('--- CONSENSUS', chartX + chartW - 145, chartY + 28);
    }
  }, [isOpen, forecast, authorHandle, crowdPath, crowdChangePct, scoreTotal, scoreGrade, eloDeltaLp, authorElo, tierInfo, isBull, changePct, targetPrice, divergencePct, digest]);

  if (!isOpen) return null;

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `stoxdraw-${forecast.ticker.toLowerCase()}-${forecast.id.slice(-5)}.png`;
    link.href = dataUrl;
    link.click();
    track('share_clicked', { method: 'download_png', forecastId: forecast.id });
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(shareSnippet);
    setCopiedType('text');
    track('share_clicked', { method: 'copy_snippet', forecastId: forecast.id });
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedType('link');
    track('share_clicked', { method: 'copy_link', forecastId: forecast.id });
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="relative w-full max-w-2xl rounded-[8px] overflow-hidden"
        style={{
          backgroundColor: 'var(--v-canvas)',
          boxShadow: 'var(--v-shadow-stack)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-3.5 flex items-center justify-between"
          style={{
            backgroundColor: 'var(--v-canvas-soft)',
            borderBottom: '1px solid var(--v-hairline)',
          }}
        >
          <span className="v-body-sm-strong" style={{ color: 'var(--v-ink)' }}>
            Export verified trajectory receipt
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ color: 'var(--v-mute)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Rendered Ticket Canvas Preview */}
        <div
          className="w-full"
          style={{
            backgroundColor: '#000000',
            borderBottom: '1px solid var(--v-hairline)',
          }}
        >
          <canvas ref={canvasRef} className="w-full h-auto block" />
        </div>

        {/* Copyable Text Snippet Preview */}
        <div
          className="p-4"
          style={{
            backgroundColor: 'var(--v-canvas-soft)',
            borderBottom: '1px solid var(--v-hairline)',
          }}
        >
          <pre
            className="v-caption-mono whitespace-pre-wrap leading-relaxed overflow-x-auto"
            style={{ color: 'var(--v-body)' }}
          >
            {shareSnippet}
          </pre>
        </div>

        {/* Actions */}
        <div
          className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-2"
          style={{ backgroundColor: 'var(--v-canvas)' }}
        >
          <button
            type="button"
            onClick={handleDownloadPng}
            className="v-btn-primary w-full"
          >
            <Download size={13} />
            <span>Download PNG</span>
          </button>

          <button
            type="button"
            onClick={handleCopySnippet}
            className="v-btn-secondary w-full h-9"
          >
            {copiedType === 'text' ? <Check size={13} /> : <Copy size={13} />}
            <span>{copiedType === 'text' ? 'Copied summary' : 'Copy summary'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="v-btn-secondary w-full h-9"
          >
            {copiedType === 'link' ? <Check size={13} /> : <Copy size={13} />}
            <span>{copiedType === 'link' ? 'Copied URL' : 'Copy receipt URL'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ShareTicketModal;
