import { useRef, useEffect, useState, useCallback } from 'react';
import type { MarketBar, PathPoint } from '../../domain/types';
import { formatPct } from '../../domain/format';
import { Undo2, RotateCcw } from 'lucide-react';

interface PathCanvasProps {
  basePrice: number;
  evalDates: string[];
  pastBars: MarketBar[];
  initialPath?: PathPoint[];
  onPathChange: (path: PathPoint[]) => void;
}

export function PathCanvas({
  basePrice,
  evalDates,
  pastBars,
  initialPath = [],
  onPathChange,
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

  // Sync to parent
  useEffect(() => {
    const arr: PathPoint[] = evalDates
      .filter(d => pointsMap[d] !== undefined)
      .map(d => ({ date: d, price: parseFloat(pointsMap[d].toFixed(2)) }));
    onPathChange(arr);
  }, [pointsMap, evalDates, onPathChange]);

  // Price Scale Bounds (Fixed to past bars + base price ±15%, stable while drawing!)
  const pastPrices = pastBars.flatMap(b => [b.high, b.low, b.close]);
  const baselinePrices = pastPrices.length > 0 ? [...pastPrices, basePrice] : [basePrice];
  const rawMin = Math.min(...baselinePrices);
  const rawMax = Math.max(...baselinePrices);
  const span = rawMax - rawMin || basePrice * 0.1;
  const minPrice = Math.min(rawMin - span * 0.4, basePrice * 0.88);
  const maxPrice = Math.max(rawMax + span * 0.4, basePrice * 1.12);
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

    const isLight = document.documentElement.classList.contains('light');

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const padTop = 32;
    const padBottom = 34;
    const chartHeight = height - padTop - padBottom;

    const getXForIndex = (index: number) => {
      return (index / (totalSlots - 1)) * (width - 44) + 22;
    };

    const getYForPrice = (p: number) => {
      const norm = (p - minPrice) / priceRange;
      return padTop + chartHeight * (1 - norm);
    };

    // 1. Grid Lines & Price Labels
    ctx.strokeStyle = isLight ? '#e5e7eb' : '#181a24';
    ctx.lineWidth = 1;
    ctx.font = '9px "Pretendard Variable", Pretendard, sans-serif';
    ctx.fillStyle = isLight ? '#94a3b8' : '#4b5563';
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

    // 2. Base Date Dividing Line
    const baseIndex = pastCount - 1;
    const baseX = getXForIndex(baseIndex);
    const baseY = getYForPrice(basePrice);

    ctx.strokeStyle = isLight ? '#94a3b8' : '#272a38';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(baseX, 10);
    ctx.lineTo(baseX, height - 12);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Past Stock Candlesticks (캔들스틱 형식)
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

      // Wick (심지)
      ctx.strokeStyle = candleColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // Body (몸통)
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));
      ctx.fillStyle = candleColor;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

    // 4. Base Point
    ctx.fillStyle = isLight ? '#0F1A15' : '#F2F5EF';
    ctx.beginPath();
    ctx.arc(baseX, baseY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isLight ? '#FFFFFF' : '#0A120E';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 5. Future Evaluation Slots & Vertical Guides (30% Supporting Secondary)
    evalDates.forEach((date, i) => {
      const x = getXForIndex(pastCount + i);
      const isSet = pointsMap[date] !== undefined;

      // Subtle vertical slot guide line
      ctx.strokeStyle = isLight ? '#E5ECE2' : '#1D2A23';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, height - padBottom);
      ctx.stroke();

      // Date Label below each slot
      const shortDate = date.slice(5).replace('-', '/');
      ctx.font = '10px "Pretendard Variable", Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = isSet
        ? (isLight ? '#1F7DFF' : '#78ABFF')
        : (isLight ? '#586B60' : '#38463E');
      ctx.fillText(shortDate, x, height - 10);

      // Bottom Slot Dot
      ctx.fillStyle = isSet ? (isLight ? '#1F7DFF' : '#78ABFF') : (isLight ? '#C2CFC0' : '#26362E');
      ctx.beginPath();
      ctx.arc(x, height - 24, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 6. Connected Forecast Path & Placed Points (Champagne Gold #DFC15D)
    const validFuturePoints: { x: number; y: number; price: number; date: string }[] = [];
    evalDates.forEach((date, i) => {
      if (pointsMap[date] !== undefined) {
        const x = getXForIndex(pastCount + i);
        const y = getYForPrice(pointsMap[date]);
        validFuturePoints.push({ x, y, price: pointsMap[date], date });
      }
    });

    if (validFuturePoints.length > 0) {
      // Connect line from Base to all points (Wall Street Champagne Gold Path)
      ctx.strokeStyle = '#DFC15D';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      validFuturePoints.forEach(p => {
        ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      // Draw point circles and price text
      validFuturePoints.forEach(p => {
        // Point Circle
        ctx.fillStyle = '#DFC15D';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isLight ? '#FFFFFF' : '#0A120E';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Price Label above point
        ctx.font = '10px "Pretendard Variable", Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = isLight ? '#0F1A15' : '#F2F5EF';
        ctx.fillText(`$${p.price.toFixed(1)}`, p.x, p.y - 9);
      });
    }
  }, [pointsMap, pastBars, evalDates, basePrice, minPrice, maxPrice, priceRange, totalSlots, pastCount]);

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

  // Pointer Interaction Logic (Direct Point Tap)
  const applyPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const padTop = 32;
    const padBottom = 34;
    const chartHeight = canvas.height - padTop - padBottom;

    // Y to Price
    const clampedY = Math.max(padTop, Math.min(canvas.height - padBottom, y));
    const norm = 1 - (clampedY - padTop) / chartHeight;
    const calculatedPrice = minPrice + norm * priceRange;

    // X to Eval Date Slot
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

    if (closestSlotIdx !== -1 && minDistance < 60) {
      const targetDate = evalDates[closestSlotIdx];
      setPointsMap(prev => {
        return { ...prev, [targetDate]: calculatedPrice };
      });
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDrawing(true);
    setHistory(prev => [...prev.slice(-10), { ...pointsMap }]);
    applyPoint(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDrawing) {
      applyPoint(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
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

  const isAllCompleted = completedCount === evalDates.length;

  return (
    <div className="w-full select-none">
      {/* Top Status & Price Callout */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-xs text-zinc-400">
          진행도: <span className="text-white font-semibold">{completedCount} / {evalDates.length}일</span>
          {isAllCompleted && <span className="ml-1 text-[#DFC15D] font-bold font-mono">(완료)</span>}
        </div>
        {latestPrice !== null && latestChangePct !== null ? (
          <div className="text-xs font-mono font-bold">
            {isAllCompleted ? '최종 예측: ' : '최근 예측: '}
            <span className="text-white">${latestPrice.toFixed(2)}</span>{' '}
            <span className={latestChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              ({formatPct(latestChangePct)})
            </span>
          </div>
        ) : (
          <div className="text-xs text-[#586B60]">
            차트의 각 날짜를 탭하여 점을 찍어주세요
          </div>
        )}
      </div>

      {/* Drawing Canvas Area (60% Dominant Base) */}
      <div
        ref={containerRef}
        className="relative w-full aspect-[4/3] sm:aspect-video rounded-2xl bg-[#0A120E] border border-[#C2CFC0]/15 overflow-hidden touch-none cursor-crosshair max-h-[50vh] min-h-[260px]"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full block"
        />

        {/* Start Guide Pill */}
        {completedCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="px-4 py-2 rounded-full bg-black/80 border border-[#2e3344] text-xs text-[#38bdf8] flex items-center gap-2 shadow-xl animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[#38bdf8]" />
              차트의 미래 날짜를 탭하여 예측 점을 찍어주세요
            </div>
          </div>
        )}
      </div>

      {/* Evaluation Date Status Chips */}
      <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1">
        {evalDates.map((date, idx) => {
          const isSet = pointsMap[date] !== undefined;
          const shortDate = date.slice(5).replace('-', '/');
          const p = pointsMap[date];
          return (
            <div
              key={date}
              className={`px-2 py-1 rounded-lg text-xs font-mono border flex flex-col items-center flex-1 min-w-[55px] transition ${
                isSet
                  ? 'bg-sky-500/10 border-sky-500/40 text-[#38bdf8] font-semibold'
                  : 'bg-[#14161f] border-[#222530] text-[#71767b]'
              }`}
            >
              <span className="text-[10px] text-[#9aa0a6]">D+{idx + 1} ({shortDate})</span>
              <span className="text-[11px] mt-0.5">{isSet ? `$${p.toFixed(1)}` : '—'}</span>
            </div>
          );
        })}
      </div>

      {/* Bottom Canvas Controls */}
      <div className="flex items-center justify-between mt-2.5 px-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#14161f] text-xs text-[#9aa0a6] hover:text-white disabled:opacity-30 border border-[#222530]"
          >
            <Undo2 size={13} />
            되돌리기
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={completedCount === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#14161f] text-xs text-[#9aa0a6] hover:text-rose-400 disabled:opacity-30 border border-[#222530]"
          >
            <RotateCcw size={13} />
            지우기
          </button>
        </div>

        <div className="text-[11px] text-[#71767b]">
          기준가: <span className="font-mono text-zinc-300">${basePrice.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
