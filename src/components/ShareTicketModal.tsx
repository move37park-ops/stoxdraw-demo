import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';
import type { Forecast, PathPoint } from '../domain/types';
import { formatPct } from '../domain/format';
import { getEloTierInfo, formatSignedLp, DEFAULT_ELO } from '../domain/elo';
import { encodeForecastSharePayload } from '../domain/sharePayload';
import { getStockHistory } from '../data/market';
import { track } from '../lib/analytics';
import { localizeDataText, useI18n } from '../lib/i18nCore';

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
  const { locale, t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copiedType, setCopiedType] = useState<'text' | 'link' | null>(null);

  const path = useMemo(() => forecast.path || [], [forecast.path]);
  const targetPrice =
    path.length > 0 ? path[path.length - 1].price : forecast.basePrice;
  const changePct =
    forecast.basePrice > 0
      ? ((targetPrice - forecast.basePrice) / forecast.basePrice) * 100
      : 0;
  const isBull = changePct >= 0;
  const divergencePct =
    crowdChangePct !== undefined ? changePct - crowdChangePct : null;
  const tierInfo = getEloTierInfo(authorElo);

  const encodedPayload = useMemo(
    () =>
      encodeForecastSharePayload(forecast, {
        handle: authorHandle,
        elo: authorElo,
      }),
    [forecast, authorHandle, authorElo]
  );

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/f/${forecast.id}?p=${encodedPayload}`
      : `https://orangepaths.com/f/${forecast.id}?p=${encodedPayload}`;

  const horizonDays = forecast.evalDates?.length || 7;

  const tierLabel = locale === 'en' ? tierInfo.title : tierInfo.krTitle;
  const localizedComment = forecast.comment ? localizeDataText(forecast.comment, locale) : '';

  const shareSnippet = [
    t(
      `Orange Paths · ${forecast.ticker} ${horizonDays}일 예측`,
      `Orange Paths · ${forecast.ticker} ${horizonDays}D Forecast`
    ),
    t(
      `예측자: @${authorHandle} (${tierLabel} · ${authorElo} LP)`,
      `Forecaster: @${authorHandle} (${tierLabel} · ${authorElo} LP)`
    ),
    t(
      `${horizonDays}일 목표: $${forecast.basePrice.toLocaleString('en-US')} -> $${targetPrice.toLocaleString('en-US')} (${formatPct(changePct)})`,
      `${horizonDays}D Target: $${forecast.basePrice.toLocaleString('en-US')} -> $${targetPrice.toLocaleString('en-US')} (${formatPct(changePct)})`
    ),
    eloDeltaLp !== undefined && scoreTotal !== undefined
      ? t(
          `정산 점수: ${scoreTotal.toFixed(1)}점 (${scoreGrade}등급) · ${formatSignedLp(eloDeltaLp)}`,
          `Settlement Score: ${scoreTotal.toFixed(1)} pts (Grade ${scoreGrade}) · ${formatSignedLp(eloDeltaLp)}`
        )
      : divergencePct !== null
      ? t(
          `참여자 평균 대비: ${divergencePct >= 0 ? '+' : ''}${divergencePct.toFixed(1)}%p`,
          `vs Crowd Avg: ${divergencePct >= 0 ? '+' : ''}${divergencePct.toFixed(1)}%p`
        )
      : null,
    localizedComment ? t(`시나리오: "${localizedComment}"`, `Scenario: "${localizedComment}"`) : null,
    `${shareUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const drawCard = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

    const W = 1200;
    const H = 630;
    canvas.width = W;
    canvas.height = H;

    // 1. DeepBook Obsidian Canvas
    ctx.fillStyle = '#050505';
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

    // Outer Card Frame (#0b0b0c with #1f1f22 hairline)
    ctx.fillStyle = '#0b0b0c';
    ctx.fillRect(24, 24, W - 48, H - 48);
    ctx.strokeStyle = '#1f1f22';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(24, 24, W - 48, H - 48);

    // Top Header Bar (#141415)
    ctx.fillStyle = '#141415';
    ctx.fillRect(25, 25, W - 50, 68);
    ctx.strokeStyle = '#1f1f22';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(25, 93);
    ctx.lineTo(W - 25, 93);
    ctx.stroke();

    // Brand Title
    ctx.fillStyle = '#f5f5f5';
    ctx.font = '700 24px "Geist", "Pretendard Variable", "Pretendard", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ORANGE PATHS', 56, 67);

    ctx.fillStyle = '#ff7a1a';
    ctx.font = '600 13px "Geist Mono", "Geist", sans-serif';
    ctx.fillText(`· BTC/USDT ${horizonDays}D FORECAST`, 252, 65);

    ctx.fillStyle = '#6b6b73';
    ctx.font = '500 12px "Geist Mono", "Geist", sans-serif';
    ctx.textAlign = 'right';
    const verCount = forecast.versions?.length ?? 1;
    ctx.fillText(
      t(`기준일 ${forecast.baseDate} · v${verCount}`, `Base ${forecast.baseDate} · v${verCount}`),
      W - 56,
      65
    );

    // Left Column: Ticker, Tier Badge, Target Return
    const leftX = 56;
    ctx.textAlign = 'left';

    ctx.fillStyle = '#f5f5f5';
    ctx.font = '600 44px "Geist", "Pretendard Variable", "Pretendard", sans-serif';
    ctx.fillText(forecast.ticker, leftX, 168);

    ctx.fillStyle = tierInfo.accentHex;
    ctx.font = '600 16px "Geist", "Pretendard Variable", "Pretendard", sans-serif';
    ctx.fillText(
      `@${authorHandle}  ·  ${tierLabel} (${tierInfo.tier} ${authorElo} LP)`,
      leftX,
      204
    );

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 13px "Geist", "Pretendard Variable", "Pretendard", sans-serif';
    ctx.fillText(t(`D+${horizonDays} 목표 수익률`, `D+${horizonDays} Target Return`), leftX, 256);

    const accentColor = isBull ? '#2fbf71' : '#f0506e';
    ctx.fillStyle = accentColor;
    ctx.font = '700 60px "Geist", "Pretendard Variable", sans-serif';
    ctx.fillText(formatPct(changePct), leftX, 322);

    ctx.fillStyle = '#f5f5f5';
    ctx.font = '500 18px "Geist", "Pretendard Variable", sans-serif';
    ctx.fillText(
      `$${forecast.basePrice.toLocaleString('en-US')}  →  $${targetPrice.toLocaleString('en-US')}`,
      leftX,
      358
    );

    // Score or Crowd Comparison Box
    ctx.fillStyle = '#141415';
    ctx.strokeStyle = '#1f1f22';
    ctx.fillRect(leftX, 390, 440, 86);
    ctx.strokeRect(leftX, 390, 440, 86);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 13px "Geist", "Pretendard Variable", sans-serif';
    if (scoreTotal !== undefined) {
      ctx.fillText(t(`${horizonDays}일 채점 결과`, `${horizonDays}D Settlement Score`), leftX + 20, 420);
      ctx.fillStyle = '#f5f5f5';
      ctx.font = '600 22px "Geist", "Pretendard Variable", sans-serif';
      ctx.fillText(
        t(
          `${scoreTotal.toFixed(1)} / 100점 (${scoreGrade}등급)  ·  ${
            eloDeltaLp !== undefined ? formatSignedLp(eloDeltaLp) : ''
          }`,
          `${scoreTotal.toFixed(1)} / 100 pts (Grade ${scoreGrade})  ·  ${
            eloDeltaLp !== undefined ? formatSignedLp(eloDeltaLp) : ''
          }`
        ),
        leftX + 20,
        454
      );
    } else {
      ctx.fillText(t('참여자 평균 대비', 'vs Crowd Average'), leftX + 20, 420);
      ctx.fillStyle = '#ff7a1a';
      ctx.font = '600 20px "Geist", "Pretendard Variable", sans-serif';
      const crowdText =
        crowdChangePct !== undefined
          ? t(
              `평균 ${formatPct(crowdChangePct)} 대비 ${formatPct(divergencePct!)}p`,
              `Avg ${formatPct(crowdChangePct)} vs ${formatPct(divergencePct!)}p`
            )
          : t(
              `예측 지점 ${forecast.anchors?.length ?? 3}개 · ${horizonDays}일 경로`,
              `${forecast.anchors?.length ?? 3} anchor points · ${horizonDays}D path`
            );
      ctx.fillText(crowdText, leftX + 20, 454);
    }

    // Thesis Comment Footer
    ctx.fillStyle = '#6b6b73';
    ctx.font = '400 14px "Geist", "Pretendard Variable", sans-serif';
    const shortComment =
      localizedComment.length > 52
        ? `${localizedComment.slice(0, 52)}...`
        : localizedComment ||
          t(
            `차트 위에 직접 그린 ${horizonDays}일 가격 시나리오`,
            `Custom ${horizonDays}D price scenario drawn on chart`
          );
    ctx.fillText(`"${shortComment}"`, leftX, 535);

    // Right Column: Past Close Line + Future Polyline Trajectory Chart
    const chartX = 540;
    const chartY = 135;
    const chartW = 590;
    const chartH = 410;

    ctx.fillStyle = '#050505';
    ctx.strokeStyle = '#1f1f22';
    ctx.fillRect(chartX, chartY, chartW, chartH);
    ctx.strokeRect(chartX, chartY, chartW, chartH);

    const rawPast = getStockHistory(forecast.ticker)
      .filter(b => b.date <= forecast.baseDate)
      .slice(-11);
    const lastBarClose = rawPast[rawPast.length - 1]?.close ?? forecast.basePrice;
    const pastScale = lastBarClose > 0 ? forecast.basePrice / lastBarClose : 1;
    const pastPrices =
      rawPast.length >= 2
        ? [...rawPast.slice(0, -1).map(b => b.close * pastScale), forecast.basePrice]
        : [forecast.basePrice];
    const pastIntervals = Math.max(0, pastPrices.length - 1);
    const totalSteps = Math.max(1, pastIntervals + path.length);

    const allPrices = [
      forecast.basePrice,
      ...pastPrices,
      ...path.map(p => p.price),
      ...(crowdPath ? crowdPath.map(p => p.price) : []),
    ];
    const minP = Math.min(...allPrices) * 0.985;
    const maxP = Math.max(...allPrices) * 1.015;

    const toX = (stepIdx: number) =>
      chartX + 36 + (stepIdx / totalSteps) * (chartW - 72);
    const toY = (price: number) => {
      const ratio = (price - minP) / Math.max(1, maxP - minP);
      return chartY + chartH - 45 - ratio * (chartH - 90);
    };

    const splitX = toX(pastIntervals);

    // Subtle Surface Distinction on Future Zone
    ctx.fillStyle = 'rgba(255, 255, 255, 0.018)';
    ctx.fillRect(splitX, chartY + 1, chartX + chartW - 1 - splitX, chartH - 2);

    // Base Price Horizontal Dashed Line
    const baseY = toY(forecast.basePrice);
    ctx.strokeStyle = '#2c2c30';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(chartX + 20, baseY);
    ctx.lineTo(chartX + chartW - 20, baseY);
    ctx.stroke();

    // D-0 Vertical Split Divider
    if (pastIntervals > 0) {
      ctx.beginPath();
      ctx.moveTo(splitX, chartY + 20);
      ctx.lineTo(splitX, chartY + chartH - 36);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Past Realized Close Line (Silver-White)
    if (pastPrices.length > 1) {
      const grad = ctx.createLinearGradient(0, chartY + 24, 0, chartY + chartH - 36);
      grad.addColorStop(0, 'rgba(237, 237, 237, 0.12)');
      grad.addColorStop(1, 'rgba(237, 237, 237, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(toX(0), chartY + chartH - 36);
      pastPrices.forEach((p, idx) => {
        ctx.lineTo(toX(idx), toY(p));
      });
      ctx.lineTo(splitX, chartY + chartH - 36);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#a1a1aa';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      pastPrices.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(toX(idx), toY(p));
        else ctx.lineTo(toX(idx), toY(p));
      });
      ctx.stroke();

      ctx.fillStyle = '#ededed';
      ctx.beginPath();
      ctx.arc(splitX, baseY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crowd Median Path if available
    if (crowdPath && crowdPath.length > 0) {
      ctx.strokeStyle = 'rgba(139, 147, 167, 0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(splitX, baseY);
      crowdPath.forEach((pt, idx) => {
        ctx.lineTo(toX(pastIntervals + idx + 1), toY(pt.price));
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // User Interpolated Polyline (Orange)
    if (path.length > 0) {
      ctx.strokeStyle = '#ff7a1a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(splitX, baseY);
      path.forEach((pt, idx) => {
        ctx.lineTo(toX(pastIntervals + idx + 1), toY(pt.price));
      });
      ctx.stroke();

      // Anchor Dots
      const anchors = forecast.anchors || [{ day: path.length, price: targetPrice }];
      anchors.forEach(a => {
        const ax = toX(pastIntervals + a.day);
        const ay = toY(a.price);
        ctx.fillStyle = '#0b0b0c';
        ctx.strokeStyle = '#ff7a1a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ax, ay, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    ctx.fillStyle = '#6b6b73';
    ctx.font = '500 12px "Geist Mono", "Geist", sans-serif';
    if (pastIntervals > 0) {
      ctx.textAlign = 'left';
      ctx.fillText(`D-${pastIntervals}`, chartX + 36, chartY + chartH - 16);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#a1a1aa';
      ctx.fillText('D-0', splitX, chartY + chartH - 16);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText('D-0 ANCHOR', chartX + 36, chartY + chartH - 16);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff7a1a';
    ctx.fillText(`D+${horizonDays} ORANGE PATH`, chartX + chartW - 36, chartY + chartH - 16);
    };

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(drawCard).catch(drawCard);
    } else {
      drawCard();
    }

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    forecast,
    horizonDays,
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
    path,
    locale,
    tierLabel,
    localizedComment,
    t,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      dialog.showModal();
    }
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const handleClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (!isDialogContent) {
          dialog.close();
        }
      };
      dialog.addEventListener('click', handleClick);
      return () => dialog.removeEventListener('click', handleClick);
    }
  }, [isOpen]);

  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleDismiss = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    } else {
      onClose();
    }
  };

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `orange-paths-btc-${horizonDays}d-${forecast.id}.png`;
    link.href = url;
    link.click();
    track('share_clicked', { method: 'download_png', forecastId: forecast.id });
  };

  const handleCopyText = async (type: 'text' | 'link') => {
    const text = type === 'link' ? shareUrl : shareSnippet;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        // ignore if copy is blocked
      }
    }
    setCopiedType(type);
    track('share_clicked', { method: type, forecastId: forecast.id });
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <dialog
      ref={dialogRef}
      className="w-[calc(100vw-2rem)] max-w-3xl"
      aria-labelledby="share-ticket-modal-title"
      {...({ closedby: 'any' } as any)}
      onClose={onClose}
    >
      <div
        className="w-full p-5 space-y-4"
        style={{
          backgroundColor: 'var(--op-panel)',
          border: '1px solid var(--op-line-strong)',
          color: 'var(--op-ink)',
        }}
      >
        <div
          className="flex items-center justify-between pb-3"
          style={{ borderBottom: '1px solid var(--op-line)' }}
        >
          <div>
            <h2 id="share-ticket-modal-title" className="text-[15px] font-semibold">
              {t('예측 공유 카드', 'Share Forecast Card')}
            </h2>
            <p className="text-[12px]" style={{ color: 'var(--op-ink-3)' }}>
              {t(
                `${horizonDays}일 예측 경로와 티어 정보가 담긴 검증 이미지입니다.`,
                `Verified share image featuring your ${horizonDays}D path and tier badge.`
              )}
            </p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={handleDismiss}
            className="op-btn-ghost h-7 w-7 p-0"
            aria-label={t('예측 공유 카드 닫기', 'Close share card dialog')}
          >
            <X size={14} />
          </button>
        </div>

        {/* Canvas Preview */}
        <div
          className="w-full overflow-hidden"
          style={{ border: '1px solid var(--op-line)' }}
        >
          <canvas ref={canvasRef} className="w-full h-auto block" />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              className="op-btn-primary h-8 px-3.5 text-xs font-semibold"
            >
              <Download size={13} />
              {t('PNG 다운로드', 'Download PNG')}
            </button>
            <button
              type="button"
              onClick={() => handleCopyText('text')}
              className="op-btn-ghost h-8 px-3 text-xs"
            >
              {copiedType === 'text' ? <Check size={12} /> : <Copy size={12} />}
              {copiedType === 'text' ? t('텍스트 복사됨', 'Text Copied') : t('텍스트 복사', 'Copy Text')}
            </button>
            <button
              type="button"
              onClick={() => handleCopyText('link')}
              className="op-btn-ghost h-8 px-3 text-xs"
            >
              {copiedType === 'link' ? <Check size={12} /> : <Copy size={12} />}
              {copiedType === 'link' ? t('링크 복사됨', 'Link Copied') : t('링크 복사', 'Copy Link')}
            </button>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="op-btn-ghost h-8 px-3 text-xs"
          >
            {t('닫기', 'Close')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
