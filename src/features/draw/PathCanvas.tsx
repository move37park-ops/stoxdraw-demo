import { useRef, useEffect, useState, useCallback } from 'react';
import type { MarketBar, MarketLandmark, PathPoint } from '../../domain/types';
import { formatPct } from '../../domain/format';
import { calculateEloProjection } from '../../domain/elo';
import { track } from '../../lib/analytics';
import { Undo2, RotateCcw } from 'lucide-react';

interface PathCanvasProps {
  basePrice: number;
  evalDates: string[];
  pastBars: MarketBar[];
  initialPath?: PathPoint[];
  volatility?: number;
  compact?: boolean;
  landmarks?: MarketLandmark[];
  opponentPath?: PathPoint[];
  opponentLabel?: string;
  crowdChangePct?: number;
  onPathChange: (path: PathPoint[]) => void;
  onComplete?: (path: PathPoint[]) => void;
}

const PRESET_PATTERNS: { id: string; label: string; factors: number[] }[] = [
  { id: 'bull_rally', label: '우상향 추세', factors: [0.25, 0.5, 0.75, 1.05, 1.35] },
  { id: 'dip_rebound', label: '눌림목 후 반등', factors: [-0.45, -0.75, -0.25, 0.35, 0.95] },
  { id: 'breakout_pullback', label: '돌파 후 안착', factors: [0.55, 1.15, 1.35, 0.95, 1.05] },
  { id: 'bear_slide', label: '계단식 조정', factors: [-0.25, -0.5, -0.7, -0.95, -1.2] },
];

export function PathCanvas({
  basePrice,
  evalDates,
  pastBars,
  initialPath = [],
  volatility = 0.035,
  compact = false,
  landmarks = [],
  opponentPath = [],
  opponentLabel = '상대 궤적',
  crowdChangePct,
  onPathChange,
  onComplete,
}: PathCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // points map: { [dateStr]: price }
  const [pointsMap, setPointsMap] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    initialPath.forEach(p => { init[p.date] = p.price; });
    return init;
  });

  const [history, setHistory] = useState<Record<string, number>[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [touchPreview, setTouchPreview] = useState<{ x: number; y: number; price: number } | null>(null);
  const hasTrackedFirstTouch = useRef(false);
  const lastSlotIdxRef = useRef<number | null>(null);
  const hasFiredCompleteRef = useRef(false);

  // Sync to parent
  useEffect(() => {
    const arr: PathPoint[] = evalDates
      .filter(d => pointsMap[d] !== undefined)
      .map(d => ({ date: d, price: parseFloat(pointsMap[d].toFixed(2)) }));
    onPathChange(arr);

    const isComplete = arr.length === evalDates.length && evalDates.length > 0;
    if (!isComplete) {
      hasFiredCompleteRef.current = false;
    } else if (!isDrawing && !hasFiredCompleteRef.current) {
      hasFiredCompleteRef.current = true;
      track('canvas_completed', { pointsCount: arr.length });
      if (onComplete) {
        onComplete(arr);
      }
    }
  }, [pointsMap, evalDates, isDrawing, onPathChange, onComplete]);

  // Price Scale Bounds (Fixed to past bars + landmarks + base price ±12%, stable while drawing)
  const pastPrices = pastBars.flatMap(b => [b.high, b.low, b.close]);
  const landmarkPrices = landmarks.map(l => l.price);
  const opponentPrices = opponentPath.map(p => p.price);
  const baselinePrices = [
    ...pastPrices,
    ...landmarkPrices,
    ...opponentPrices,
    basePrice,
  ];
  const rawMin = Math.min(...baselinePrices);
  const rawMax = Math.max(...baselinePrices);
  const span = rawMax - rawMin || basePrice * 0.12;
  const minPrice = Math.min(rawMin - span * 0.35, basePrice * 0.88);
  const maxPrice = Math.max(rawMax + span * 0.35, basePrice * 1.12);
  const priceRange = maxPrice - minPrice || 1;

  const pastCount = pastBars.length;
  const evalCount = evalDates.length;
  const totalSlots = pastCount + evalCount;

  // Render Canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const padTop = compact ? 22 : 32;
    const padBottom = compact ? 24 : 34;
    const chartHeight = height - padTop - padBottom;

    const getXForIndex = (index: number) => {
      return (index / (totalSlots - 1)) * (width - 44) + 22;
    };

    const getYForPrice = (p: number) => {
      const norm = (p - minPrice) / priceRange;
      return padTop + chartHeight * (1 - norm);
    };

    // 1. Grid Lines & Price Labels
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.lineWidth = 1;
    ctx.font = '9px "Pretendard Variable", Pretendard, sans-serif';
    ctx.fillStyle = '#526071';
    ctx.textAlign = 'right';

    for (let i = 1; i <= 4; i++) {
      const y = padTop + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();

      const gridPrice = maxPrice - (priceRange / 5) * i;
      ctx.fillText(`$${gridPrice.toFixed(0)}`, width - 24, y - 4);
    }

    const baseIndex = pastCount - 1;
    const baseX = getXForIndex(baseIndex);
    const baseY = getYForPrice(basePrice);

    // 2. Base Horizon & Market Landmarks (Waypoints)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(width - 20, baseY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (landmarks.length > 0) {
      landmarks.forEach(lm => {
        const ly = getYForPrice(lm.price);
        if (ly >= padTop - 4 && ly <= height - padBottom + 4) {
          const isRes = lm.category === 'resistance';
          const lineColor = isRes ? 'rgba(56, 189, 248, 0.42)' : 'rgba(197, 160, 89, 0.42)';
          const textColor = isRes ? '#7dd3fc' : '#DFC15D';

          ctx.strokeStyle = lineColor;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(baseX, ly);
          ctx.lineTo(width - 20, ly);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = textColor;
          ctx.font = '500 9px "Geist Mono", monospace';
          ctx.textAlign = 'right';
          ctx.fillText(
            `${lm.shortLabel} $${lm.price.toFixed(1)} (${lm.changePct >= 0 ? '+' : ''}${lm.changePct}%)`,
            width - 24,
            isRes ? ly - 5 : ly + 11
          );
        }
      });
    } else {
      const guideLines = [
        { pct: 0.05, label: '+5%', color: 'rgba(16, 185, 129, 0.25)' },
        { pct: -0.05, label: '-5%', color: 'rgba(244, 63, 94, 0.25)' },
      ];
      guideLines.forEach(g => {
        const gPrice = basePrice * (1 + g.pct);
        const gy = getYForPrice(gPrice);
        if (gy >= padTop && gy <= height - padBottom) {
          ctx.strokeStyle = g.color;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(baseX, gy);
          ctx.lineTo(width - 20, gy);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = g.color;
          ctx.font = '500 8px "Geist Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(g.label, baseX + 4, gy - 2);
        }
      });
    }

    // 3. Volatility Envelope Shading (과거 변동성 기준 ±1σ√t 변동성 밴드)
    if (evalDates.length > 0) {
      const waveGrad = ctx.createLinearGradient(baseX, 0, width - 20, 0);
      waveGrad.addColorStop(0, 'rgba(34, 211, 238, 0.08)');
      waveGrad.addColorStop(1, 'rgba(56, 189, 248, 0.02)');
      ctx.fillStyle = waveGrad;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);

      evalDates.forEach((_, i) => {
        const x = getXForIndex(pastCount + i);
        const upperPrice = basePrice * (1 + volatility * Math.sqrt(i + 1));
        ctx.lineTo(x, getYForPrice(upperPrice));
      });

      for (let i = evalDates.length - 1; i >= 0; i--) {
        const x = getXForIndex(pastCount + i);
        const lowerPrice = basePrice * (1 - volatility * Math.sqrt(i + 1));
        ctx.lineTo(x, getYForPrice(lowerPrice));
      }
      ctx.closePath();
      ctx.fill();
    }

    // 4. Base Date Dividing Line
    ctx.strokeStyle = '#253548';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(baseX, 10);
    ctx.lineTo(baseX, height - 12);
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Past Stock Candlesticks
    const slotWidth = getXForIndex(1) - getXForIndex(0);
    const candleWidth = Math.max(3.5, Math.min(8, slotWidth * 0.65));

    pastBars.forEach((bar, i) => {
      const x = getXForIndex(i);
      const isUp = bar.close >= bar.open;
      const candleColor = isUp ? '#10b981' : '#f43f5e';

      const yHigh = getYForPrice(bar.high);
      const yLow = getYForPrice(bar.low);
      const yOpen = getYForPrice(bar.open);
      const yClose = getYForPrice(bar.close);

      ctx.strokeStyle = candleColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));
      ctx.fillStyle = candleColor;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

    // 6. Opponent Path Overlay (when drawing a response trajectory)
    if (opponentPath.length > 0) {
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.65)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      opponentPath.forEach((op, idx) => {
        const dateIdx = evalDates.indexOf(op.date);
        const slotIdx = dateIdx !== -1 ? dateIdx : idx;
        const ox = getXForIndex(pastCount + slotIdx);
        const oy = getYForPrice(op.price);
        ctx.lineTo(ox, oy);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      const lastOp = opponentPath[opponentPath.length - 1];
      const lastOpX = getXForIndex(pastCount + Math.min(evalDates.length - 1, opponentPath.length - 1));
      const lastOpY = getYForPrice(lastOp.price);
      ctx.fillStyle = '#fb7185';
      ctx.font = '600 9px "Pretendard Variable", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${opponentLabel} $${lastOp.price.toFixed(1)}`, lastOpX - 6, lastOpY - 6);
    }

    // 7. Base Point
    ctx.fillStyle = '#F2F5EF';
    ctx.beginPath();
    ctx.arc(baseX, baseY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#060c14';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 8. Future Evaluation Slots & Vertical Guides
    evalDates.forEach((date, i) => {
      const x = getXForIndex(pastCount + i);
      const isSet = pointsMap[date] !== undefined;

      ctx.strokeStyle = isSet ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, height - padBottom);
      ctx.stroke();

      const shortDate = date.slice(5).replace('-', '/');
      ctx.font = '10px "Pretendard Variable", Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = isSet ? '#38bdf8' : '#526071';
      ctx.fillText(shortDate, x, height - 10);

      ctx.fillStyle = isSet ? '#38bdf8' : '#1e293b';
      ctx.beginPath();
      ctx.arc(x, height - 24, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 9. Connected Forecast Path (Champagne Gold #DFC15D)
    const validFuturePoints: { x: number; y: number; price: number; date: string }[] = [];
    evalDates.forEach((date, i) => {
      if (pointsMap[date] !== undefined) {
        const x = getXForIndex(pastCount + i);
        const y = getYForPrice(pointsMap[date]);
        validFuturePoints.push({ x, y, price: pointsMap[date], date });
      }
    });

    if (validFuturePoints.length > 0) {
      ctx.strokeStyle = '#DFC15D';
      ctx.lineWidth = compact ? 2.5 : 3.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      validFuturePoints.forEach(p => {
        ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      validFuturePoints.forEach(p => {
        ctx.fillStyle = '#DFC15D';
        ctx.beginPath();
        ctx.arc(p.x, p.y, compact ? 3.5 : 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#060c14';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (!compact) {
          ctx.font = '10px "Pretendard Variable", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#F2F5EF';
          ctx.fillText(`$${p.price.toFixed(1)}`, p.x, p.y - 9);
        }
      });
    }

    // 9. Floating Preview Pin (Mobile Touch Offset -24px)
    if (touchPreview) {
      ctx.save();
      ctx.fillStyle = '#C5A059';
      ctx.beginPath();
      ctx.arc(touchPreview.x, touchPreview.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeStyle = '#C5A059';
      ctx.lineWidth = 1;
      const badgeW = 54;
      const badgeH = 18;
      ctx.fillRect(touchPreview.x - badgeW / 2, touchPreview.y - 24, badgeW, badgeH);
      ctx.strokeRect(touchPreview.x - badgeW / 2, touchPreview.y - 24, badgeW, badgeH);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px "Pretendard Variable", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`$${touchPreview.price.toFixed(1)}`, touchPreview.x, touchPreview.y - 12);
      ctx.restore();
    }
  }, [pointsMap, pastBars, evalDates, basePrice, minPrice, maxPrice, priceRange, totalSlots, pastCount, touchPreview, compact, volatility, landmarks, opponentPath, opponentLabel]);

  // Canvas resize sync
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      canvasRef.current.width = rect.width;
      canvasRef.current.height = rect.height;
      draw();
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Pointer Interaction Logic with One-Stroke Linear Interpolation
  const applyPoint = (clientX: number, clientY: number, isTouch: boolean = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;

    const touchOffsetY = isTouch ? -24 : 0;
    const y = clientY - rect.top + touchOffsetY;

    const padTop = compact ? 22 : 32;
    const padBottom = compact ? 24 : 34;
    const chartHeight = canvas.height - padTop - padBottom;

    const clampedY = Math.max(padTop, Math.min(canvas.height - padBottom, y));
    const norm = 1 - (clampedY - padTop) / chartHeight;
    const calculatedPrice = minPrice + norm * priceRange;

    const getXForIndex = (index: number) => (index / (totalSlots - 1)) * (canvas.width - 44) + 22;

    let closestSlotIdx = -1;
    let minDistance = Infinity;

    evalDates.forEach((_, i) => {
      const slotX = getXForIndex(pastCount + i);
      const dist = Math.abs(slotX - x);
      if (dist < minDistance) {
        minDistance = dist;
        closestSlotIdx = i;
      }
    });

    if (closestSlotIdx !== -1 && minDistance < 75) {
      const targetDate = evalDates[closestSlotIdx];
      const slotX = getXForIndex(pastCount + closestSlotIdx);
      const prevIdx = lastSlotIdxRef.current;

      setPointsMap(prev => {
        const next = { ...prev, [targetDate]: calculatedPrice };

        // 빠른 스와이프 시 직전 슬롯과 현재 슬롯 사이의 빈 슬롯을 자동 선형 보간
        if (prevIdx !== null && Math.abs(closestSlotIdx - prevIdx) > 1) {
          const prevDate = evalDates[prevIdx];
          const prevPrice = prev[prevDate] ?? basePrice;
          const stepCount = Math.abs(closestSlotIdx - prevIdx);
          const dir = closestSlotIdx > prevIdx ? 1 : -1;
          for (let s = 1; s < stepCount; s++) {
            const midIdx = prevIdx + dir * s;
            const midDate = evalDates[midIdx];
            if (midDate) {
              next[midDate] = prevPrice + ((calculatedPrice - prevPrice) * s) / stepCount;
            }
          }
        } else if (prevIdx === null && closestSlotIdx > 0 && Object.keys(prev).length === 0) {
          // 첫 터치가 D+2 이후에서 시작해 우측으로 드래그될 때 기준가(Base)에서 자연스럽게 보간
          for (let s = 0; s < closestSlotIdx; s++) {
            const midDate = evalDates[s];
            if (midDate && next[midDate] === undefined) {
              next[midDate] = basePrice + ((calculatedPrice - basePrice) * (s + 1)) / (closestSlotIdx + 1);
            }
          }
        }
        return next;
      });

      lastSlotIdxRef.current = closestSlotIdx;

      if (isTouch) {
        setTouchPreview({ x: slotX, y: clampedY, price: calculatedPrice });
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const isTouch = e.pointerType === 'touch';
    setIsDrawing(true);
    lastSlotIdxRef.current = null;
    setHistory(prev => [...prev.slice(-10), { ...pointsMap }]);

    if (!hasTrackedFirstTouch.current) {
      hasTrackedFirstTouch.current = true;
      track('canvas_first_touch', { isTouch });
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }

    applyPoint(e.clientX, e.clientY, isTouch);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDrawing) {
      const isTouch = e.pointerType === 'touch';
      applyPoint(e.clientX, e.clientY, isTouch);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDrawing(false);
    lastSlotIdxRef.current = null;
    setTouchPreview(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }
  };

  const handleApplyPreset = (factors: number[]) => {
    setHistory(prev => [...prev.slice(-10), { ...pointsMap }]);
    const next: Record<string, number> = {};
    evalDates.forEach((d, idx) => {
      const f = factors[idx] ?? factors[factors.length - 1] ?? 0;
      const rawP = basePrice * (1 + f * volatility);
      const clampedP = Math.max(minPrice + priceRange * 0.06, Math.min(maxPrice - priceRange * 0.06, rawP));
      next[d] = parseFloat(clampedP.toFixed(2));
    });
    setPointsMap(next);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setPointsMap(prev);
  };

  const handleClear = () => {
    setHistory(prev => [...prev, { ...pointsMap }]);
    setPointsMap({});
  };

  const completedCount = Object.keys(pointsMap).length;
  const clickedDates = evalDates.filter(d => pointsMap[d] !== undefined);
  const latestClickedDate = clickedDates.length > 0 ? clickedDates[clickedDates.length - 1] : null;
  const latestPrice = latestClickedDate ? pointsMap[latestClickedDate] : null;
  const latestChangePct = latestPrice ? ((latestPrice - basePrice) / basePrice) * 100 : null;
  const isAllCompleted = completedCount === evalDates.length && evalDates.length > 0;

  const eloProjection = latestChangePct !== null
    ? calculateEloProjection(latestChangePct, crowdChangePct, volatility)
    : null;

  return (
    <div className="w-full select-none">
      {/* Top Status & Quick Pattern Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-0.5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span>
            <span className="text-zinc-100 font-mono font-medium">{completedCount}/{evalDates.length}일 완료</span>
          </span>
          {latestPrice !== null && latestChangePct !== null && (
            <span className="font-mono font-medium">
              <span className="text-zinc-100">${latestPrice.toFixed(2)}</span>{' '}
              <span className={latestChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                ({formatPct(latestChangePct)})
              </span>
            </span>
          )}
          {eloProjection && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black border border-zinc-800 text-[11px] font-mono">
              <span className="text-emerald-400 font-medium">+{eloProjection.expectedWinLp} LP</span>
              <span className="text-zinc-600">/</span>
              <span className="text-rose-400">{eloProjection.expectedLossLp} LP</span>
            </span>
          )}
        </div>

        {/* Quick Pattern Templates */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {PRESET_PATTERNS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleApplyPreset(p.factors)}
              className="px-2 py-1 rounded-md bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[11px] text-zinc-300 hover:text-zinc-100 transition whitespace-nowrap"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Drawing Canvas Area */}
      <div
        ref={containerRef}
        className={`relative w-full rounded-md bg-black border border-zinc-800 overflow-hidden touch-none cursor-crosshair ${
          compact ? 'aspect-[16/10] min-h-[240px]' : 'aspect-[16/10] sm:aspect-[16/9] min-h-[300px] max-h-[55vh]'
        }`}
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full block"
          style={{ touchAction: 'none' }}
        />

        {/* Start Guide Pill */}
        {completedCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
            <div className="px-3 py-1.5 rounded-md bg-zinc-900/90 border border-zinc-700 text-xs text-zinc-200 flex items-center gap-2 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-100 animate-pulse" />
              우측 5일 구간을 드래그하여 예상 경로를 그리세요
            </div>
          </div>
        )}
      </div>

      {/* Evaluation Date Status Strip (1px Hairline Grid) */}
      {!compact && (
        <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-950 grid grid-cols-5 divide-x divide-zinc-800 overflow-hidden">
          {evalDates.map((date, idx) => {
            const isSet = pointsMap[date] !== undefined;
            const shortDate = date.slice(5).replace('-', '/');
            const p = pointsMap[date];
            return (
              <div
                key={date}
                className={`px-2 py-1.5 text-xs font-mono tabular-nums flex flex-col items-center transition ${
                  isSet
                    ? 'bg-zinc-900 text-zinc-100 font-medium'
                    : 'bg-zinc-950 text-zinc-600'
                }`}
              >
                <span className="text-[10px] text-zinc-500">D+{idx + 1} ({shortDate})</span>
                <span className="text-[11px] mt-0.5">{isSet ? `$${p.toFixed(1)}` : '—'}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Canvas Controls */}
      <div className="flex items-center justify-between mt-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-900 text-xs text-zinc-300 hover:text-white hover:bg-zinc-850 disabled:opacity-30 border border-zinc-800 transition"
          >
            <Undo2 size={12} />
            되돌리기
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={completedCount === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-900 text-xs text-zinc-300 hover:text-rose-400 hover:bg-zinc-850 disabled:opacity-30 border border-zinc-800 transition"
          >
            <RotateCcw size={12} />
            초기화
          </button>
        </div>

        <div className="text-[11px] text-zinc-400 font-mono">
          기준가 <span className="text-zinc-200 font-medium">${basePrice.toFixed(2)}</span>
          {isAllCompleted && <span className="ml-2 text-emerald-400 font-medium">완료</span>}
        </div>
      </div>
    </div>
  );
}

export default PathCanvas;
