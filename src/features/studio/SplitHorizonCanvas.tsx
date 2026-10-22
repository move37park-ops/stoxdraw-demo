import React, { useRef, useState, useMemo } from 'react';
import { getStockHistory, getStockLandmarks, STOCKS } from '../../data/market';
import type { Forecast, MarketBar } from '../../domain/types';

export interface OverlayRival {
  forecast: Forecast;
  authorHandle: string;
  authorElo: number;
  colorVar: string;
}

interface RightLaneLabel {
  id: string;
  rawY: number;
  y: number;
  text: string;
  color: string;
  bold?: boolean;
}

function resolveRightLaneLabels(
  items: Omit<RightLaneLabel, 'y'>[],
  minGap: number,
  minY: number,
  maxY: number
): RightLaneLabel[] {
  const sorted = [...items]
    .sort((a, b) => a.rawY - b.rawY)
    .map(item => ({ ...item, y: Math.max(minY, Math.min(maxY, item.rawY)) }));

  // Forward pass: push down overlapping labels
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].y - sorted[i - 1].y < minGap) {
      sorted[i].y = sorted[i - 1].y + minGap;
    }
  }

  // Backward pass: keep within bottom boundary
  if (sorted.length > 0 && sorted[sorted.length - 1].y > maxY) {
    sorted[sorted.length - 1].y = maxY;
    for (let i = sorted.length - 2; i >= 0; i--) {
      if (sorted[i + 1].y - sorted[i].y < minGap) {
        sorted[i].y = Math.max(minY, sorted[i + 1].y - minGap);
      }
    }
  }

  return sorted;
}

interface SplitHorizonCanvasProps {
  ticker: string;
  baseDate: string;
  basePrice: number;
  evalDates: string[];
  currentDateStr: string;
  draftPrices: number[];
  onChangeDraftPrices: (prices: number[]) => void;
  lockedForecast: Forecast | null;
  onExitLockedView: () => void;
  allTickerForecasts: Forecast[];
  overlaidRivals: OverlayRival[];
  onRemoveOverlay: (forecastId: string) => void;
  onClearOverlays: () => void;
  duelTarget: { forecast: Forecast; handle: string } | null;
  onCancelDuel: () => void;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function SplitHorizonCanvas({
  ticker,
  baseDate,
  basePrice,
  evalDates,
  currentDateStr,
  draftPrices,
  onChangeDraftPrices,
  lockedForecast,
  onExitLockedView,
  allTickerForecasts,
  overlaidRivals,
  onRemoveOverlay,
  onClearOverlays,
  duelTarget,
  onCancelDuel,
}: SplitHorizonCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [showCrowdBand, setShowCrowdBand] = useState(true);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [chartStyle, setChartStyle] = useState<'line' | 'candles'>('line');

  const stockMeta = STOCKS.find(s => s.ticker === ticker) || STOCKS[0];
  const allBars = useMemo(() => getStockHistory(ticker), [ticker]);

  // Past 15 trading bars up to baseDate
  const historyBars: MarketBar[] = useMemo(() => {
    const upToBase = allBars.filter(b => b.date <= baseDate);
    return upToBase.slice(-15);
  }, [allBars, baseDate]);

  // Actual bars for evalDates that have settled (only when currentDateStr > baseDate)
  const actualEvalBars = useMemo(() => {
    const map = new Map(allBars.map(b => [b.date, b]));
    return evalDates.map(d => {
      if (currentDateStr > baseDate && d <= currentDateStr) {
        return map.get(d) || null;
      }
      return null;
    });
  }, [allBars, evalDates, currentDateStr, baseDate]);

  const activePrices: number[] = useMemo(() => {
    if (lockedForecast && lockedForecast.path && lockedForecast.path.length > 0) {
      return evalDates.map((d, i) => {
        const pt = lockedForecast.path!.find(p => p.date === d);
        return pt ? pt.price : lockedForecast.path![i]?.price ?? basePrice;
      });
    }
    return draftPrices;
  }, [lockedForecast, draftPrices, evalDates, basePrice]);

  const crowdBand = useMemo(() => {
    const valid = allTickerForecasts.filter(
      f => f.mode === 'path' && f.path && f.path.length >= 5 && f.basePrice > 0
    );
    if (valid.length < 2) return null;

    return evalDates.map((_, stepIdx) => {
      const pcts = valid
        .map(f => {
          const pt = f.path![stepIdx];
          return pt ? (pt.price - f.basePrice) / f.basePrice : 0;
        })
        .sort((a, b) => a - b);

      const p20 = basePrice * (1 + quantile(pcts, 0.2));
      const med = basePrice * (1 + quantile(pcts, 0.5));
      const p80 = basePrice * (1 + quantile(pcts, 0.8));
      return {
        p20: parseFloat(p20.toFixed(2)),
        med: parseFloat(med.toFixed(2)),
        p80: parseFloat(p80.toFixed(2)),
      };
    });
  }, [allTickerForecasts, evalDates, basePrice]);

  const landmarks = useMemo(
    () => getStockLandmarks(ticker, basePrice),
    [ticker, basePrice]
  );

  // Tighter Y-axis domain so price curves look dynamic without excessive vertical whitespace
  const { minPrice, maxPrice } = useMemo(() => {
    const prices: number[] = [basePrice, ...activePrices];
    historyBars.forEach(b => {
      prices.push(b.high, b.low);
    });
    if (showLandmarks) {
      landmarks.forEach(l => prices.push(l.price));
    }
    if (showCrowdBand && crowdBand) {
      crowdBand.forEach(c => prices.push(c.p20, c.p80));
    }
    overlaidRivals.forEach(r => {
      r.forecast.path?.forEach(pt => {
        if (r.forecast.basePrice > 0) {
          const projected =
            basePrice * (1 + (pt.price - r.forecast.basePrice) / r.forecast.basePrice);
          prices.push(projected);
        }
      });
    });
    actualEvalBars.forEach(b => {
      if (b) prices.push(b.close);
    });

    const fiveDayMove = basePrice * stockMeta.volatility * Math.sqrt(5) * 0.85;
    prices.push(basePrice + fiveDayMove, basePrice - fiveDayMove);

    const rawMin = Math.min(...prices);
    const rawMax = Math.max(...prices);
    const pad = Math.max((rawMax - rawMin) * 0.08, basePrice * 0.012);
    return {
      minPrice: rawMin - pad,
      maxPrice: rawMax + pad,
    };
  }, [
    basePrice,
    activePrices,
    historyBars,
    landmarks,
    showLandmarks,
    crowdBand,
    showCrowdBand,
    overlaidRivals,
    actualEvalBars,
    stockMeta.volatility,
  ]);

  // Compact, well-proportioned SVG Geometry
  const SVG_W = 920;
  const SVG_H = 368;
  const PAD_TOP = 28;
  const PAD_BOTTOM = 38;
  const PLOT_LEFT = 54;
  const ANCHOR_X = 412;
  const SANDBOX_RIGHT = 736;
  const PLOT_H = SVG_H - PAD_TOP - PAD_BOTTOM;

  const priceToY = (p: number) => {
    const ratio = (p - minPrice) / Math.max(1e-6, maxPrice - minPrice);
    return PAD_TOP + PLOT_H * (1 - Math.max(0, Math.min(1, ratio)));
  };

  const yToPrice = (y: number) => {
    const clampedY = Math.max(PAD_TOP, Math.min(PAD_TOP + PLOT_H, y));
    const ratio = 1 - (clampedY - PAD_TOP) / PLOT_H;
    return parseFloat((minPrice + ratio * (maxPrice - minPrice)).toFixed(2));
  };

  const historyStepX =
    historyBars.length > 1
      ? (ANCHOR_X - PLOT_LEFT) / (historyBars.length - 1)
      : ANCHOR_X - PLOT_LEFT;

  const getHistoryX = (idx: number) => PLOT_LEFT + idx * historyStepX;
  const sandboxStepX = (SANDBOX_RIGHT - ANCHOR_X) / 5;
  const getEvalX = (slotIdx: number) => ANCHOR_X + (slotIdx + 1) * sandboxStepX;

  const updateNodeFromPointer = (clientX: number, clientY: number) => {
    if (lockedForecast) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = SVG_W / rect.width;
    const scaleY = SVG_H / rect.height;
    const svgX = (clientX - rect.left) * scaleX;
    const svgY = (clientY - rect.top) * scaleY;

    if (svgX < ANCHOR_X - sandboxStepX * 0.4) return;

    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < 5; i++) {
      const dist = Math.abs(svgX - getEvalX(i));
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }

    const newPrice = yToPrice(svgY);
    const next = [...draftPrices];
    next[closestIdx] = newPrice;
    setHoveredSlot(closestIdx);
    onChangeDraftPrices(next);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (lockedForecast) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateNodeFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) * SVG_W) / rect.width;

    if (svgX >= ANCHOR_X - 16 && svgX <= SANDBOX_RIGHT + 24) {
      let closestIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < 5; i++) {
        const dist = Math.abs(svgX - getEvalX(i));
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }
      setHoveredSlot(closestIdx);
    } else {
      setHoveredSlot(null);
    }

    if (isDragging && !lockedForecast) {
      updateNodeFromPointer(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const applyArchetype = (
    type: 'breakout' | 'dip_rip' | 'reject' | 'flat' | 'pullback'
  ) => {
    if (lockedForecast) {
      onExitLockedView();
    }
    const unit = basePrice * stockMeta.volatility;
    const multipliers: Record<typeof type, number[]> = {
      breakout: [0.45, 0.85, 1.15, 1.55, 1.95],
      dip_rip: [-0.75, -1.15, -0.35, 0.55, 1.35],
      reject: [0.85, 1.35, 0.65, -0.25, -0.95],
      flat: [0.12, -0.15, 0.08, -0.06, 0.05],
      pullback: [-0.45, -0.8, -1.1, -1.45, -1.85],
    };
    const next = multipliers[type].map(m =>
      parseFloat((basePrice + unit * m).toFixed(2))
    );
    onChangeDraftPrices(next);
  };

  const anchorY = priceToY(basePrice);
  const activePoints = [
    { x: ANCHOR_X, y: anchorY, price: basePrice },
    ...activePrices.map((p, i) => ({ x: getEvalX(i), y: priceToY(p), price: p })),
  ];
  const activePolyline = activePoints.map(pt => `${pt.x},${pt.y}`).join(' ');

  const endPrice = activePrices[activePrices.length - 1] ?? basePrice;
  const endChangePct =
    basePrice > 0 ? ((endPrice - basePrice) / basePrice) * 100 : 0;
  const activeStrokeColor =
    endChangePct >= 0 ? 'var(--v-bull)' : 'var(--v-bear)';

  const settledPoints: { x: number; y: number; price: number; slotIdx: number }[] = [];
  actualEvalBars.forEach((bar, idx) => {
    if (bar) {
      settledPoints.push({
        x: getEvalX(idx),
        y: priceToY(bar.close),
        price: bar.close,
        slotIdx: idx,
      });
    }
  });

  const errorPolygonPoints = useMemo(() => {
    if (settledPoints.length === 0) return null;
    const lastIdx = settledPoints[settledPoints.length - 1].slotIdx;
    const predSegment = [
      `${ANCHOR_X},${anchorY}`,
      ...activePrices
        .slice(0, lastIdx + 1)
        .map((p, i) => `${getEvalX(i)},${priceToY(p)}`),
    ];
    const actSegmentReversed = [
      `${ANCHOR_X},${anchorY}`,
      ...settledPoints.map(pt => `${pt.x},${pt.y}`),
    ].reverse();
    return [...predSegment, ...actSegmentReversed].join(' ');
  }, [settledPoints, activePrices, anchorY]);

  const yTicks = useMemo(() => {
    const count = 5;
    const step = (maxPrice - minPrice) / (count - 1);
    return Array.from({ length: count }, (_, i) => minPrice + i * step);
  }, [minPrice, maxPrice]);

  // Build collision-free Right Lane Direct Labels
  const rightLaneLabels = useMemo(() => {
    const rawItems: Omit<RightLaneLabel, 'y'>[] = [];

    if (showLandmarks) {
      landmarks.forEach(lm => {
        rawItems.push({
          id: `lm-${lm.id}`,
          rawY: priceToY(lm.price),
          text: `${lm.shortLabel} $${lm.price.toFixed(1)}`,
          color: 'var(--v-mute)',
        });
      });
    }

    if (showCrowdBand && crowdBand) {
      rawItems.push({
        id: 'crowd-med',
        rawY: priceToY(crowdBand[4].med),
        text: `CROWD $${crowdBand[4].med.toFixed(1)}`,
        color: 'var(--v-link)',
      });
    }

    overlaidRivals.forEach(rival => {
      if (!rival.forecast.path || rival.forecast.basePrice <= 0) return;
      const lastPt = rival.forecast.path[rival.forecast.path.length - 1];
      if (!lastPt) return;
      const pct = (lastPt.price - rival.forecast.basePrice) / rival.forecast.basePrice;
      const projected = basePrice * (1 + pct);
      rawItems.push({
        id: `rival-${rival.forecast.id}`,
        rawY: priceToY(projected),
        text: `@${rival.authorHandle} ${pct >= 0 ? '+' : ''}${(pct * 100).toFixed(1)}%`,
        color: rival.colorVar,
      });
    });

    rawItems.push({
      id: 'active-user',
      rawY: priceToY(endPrice),
      text: `${lockedForecast ? 'LOCKED' : 'YOUR DRAW'} ${
        endChangePct >= 0 ? '+' : ''
      }${endChangePct.toFixed(2)}%`,
      color: activeStrokeColor,
      bold: true,
    });

    return resolveRightLaneLabels(
      rawItems,
      15,
      PAD_TOP + 8,
      PAD_TOP + PLOT_H - 6
    );
  }, [
    showLandmarks,
    landmarks,
    showCrowdBand,
    crowdBand,
    overlaidRivals,
    basePrice,
    endPrice,
    endChangePct,
    lockedForecast,
    activeStrokeColor,
    minPrice,
    maxPrice,
  ]);

  return (
    <div className="relative flex flex-col h-full justify-between min-w-0">
      {/* Top Canvas Toolbar */}
      <div
        className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-2"
        style={{ borderBottom: '1px solid var(--v-hairline)' }}
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className="v-caption-mono px-2 py-0.5 rounded-[4px]"
            style={{
              backgroundColor: 'var(--v-canvas-soft-2)',
              boxShadow: 'var(--v-shadow-border)',
              color: 'var(--v-ink)',
            }}
          >
            {lockedForecast ? 'AUDIT MODE' : 'INTERACTIVE SANDBOX'}
          </span>

          <span className="v-caption-mono" style={{ color: 'var(--v-mute)' }}>
            {baseDate} → {evalDates[4]} · σ={(stockMeta.volatility * 100).toFixed(1)}%/d
          </span>

          {lockedForecast && (
            <button
              type="button"
              onClick={onExitLockedView}
              className="v-caption-mono underline"
              style={{ color: 'var(--v-link)' }}
            >
              Exit audit (#{lockedForecast.id.slice(0, 6)})
            </button>
          )}

          {duelTarget && !lockedForecast && (
            <span
              className="v-caption-mono px-2 py-0.5 rounded-[4px] inline-flex items-center gap-1.5"
              style={{
                backgroundColor: 'var(--v-violet-soft)',
                color: 'var(--v-violet)',
              }}
            >
              Duel vs @{duelTarget.handle}
              <button
                type="button"
                onClick={onCancelDuel}
                className="underline ml-1"
              >
                ×
              </button>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() =>
              setChartStyle(prev => (prev === 'line' ? 'candles' : 'line'))
            }
            className="v-btn-secondary v-mono"
          >
            {chartStyle === 'line' ? 'Area line' : 'Monochrome OHLC'}
          </button>

          <button
            type="button"
            onClick={() => setShowCrowdBand(prev => !prev)}
            className="v-btn-secondary"
            style={{
              backgroundColor: showCrowdBand
                ? 'var(--v-canvas-soft-2)'
                : 'transparent',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: showCrowdBand
                  ? 'var(--v-link)'
                  : 'var(--v-dim)',
              }}
            />
            <span>Crowd P20-P80</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLandmarks(prev => !prev)}
            className="v-btn-secondary"
            style={{
              backgroundColor: showLandmarks
                ? 'var(--v-canvas-soft-2)'
                : 'transparent',
            }}
          >
            <span>Landmarks</span>
          </button>

          {overlaidRivals.length > 0 && (
            <button
              type="button"
              onClick={onClearOverlays}
              className="v-btn-secondary v-mono"
              style={{ color: 'var(--v-violet)' }}
            >
              Clear ({overlaidRivals.length})
            </button>
          )}
        </div>
      </div>

      {/* Main Split-Horizon SVG Viewport */}
      <div className="relative w-full select-none overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className={`w-full h-auto block ${
            lockedForecast ? 'cursor-default' : 'cursor-crosshair'
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            setIsDragging(false);
            setHoveredSlot(null);
          }}
          role="img"
          aria-label={`${ticker} 15-day history and 5-day trajectory studio`}
        >
          <defs>
            <pattern
              id="v-sandbox-dots"
              width="14"
              height="14"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="0.85" fill="var(--v-dot-color)" />
            </pattern>

            <pattern
              id="v-crowd-hatch"
              width="7"
              height="7"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="7"
                stroke="var(--v-link)"
                strokeWidth="1"
                strokeOpacity="0.22"
              />
            </pattern>

            <linearGradient id="v-history-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--v-ink)" stopOpacity="0.10" />
              <stop offset="100%" stopColor="var(--v-ink)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Future 5D Sandbox Dot-Matrix Fill */}
          <rect
            x={ANCHOR_X}
            y={PAD_TOP}
            width={SANDBOX_RIGHT - ANCHOR_X}
            height={PLOT_H}
            fill="url(#v-sandbox-dots)"
          />

          {/* Horizontal Price Gridlines & Left Y-Axis Labels */}
          {yTicks.map((tick, idx) => {
            const y = priceToY(tick);
            return (
              <g key={idx}>
                <line
                  x1={PLOT_LEFT}
                  y1={y}
                  x2={SANDBOX_RIGHT}
                  y2={y}
                  stroke="var(--v-chart-grid)"
                  strokeWidth="1"
                />
                <text
                  x={PLOT_LEFT - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="v-caption-mono"
                  fill="var(--v-mute)"
                  fontSize="10.5"
                >
                  ${tick.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Vertical D+1..D+5 Rails inside the Sandbox */}
          {evalDates.map((d, i) => {
            const x = getEvalX(i);
            const isHovered = hoveredSlot === i;
            return (
              <g key={d}>
                <line
                  x1={x}
                  y1={PAD_TOP}
                  x2={x}
                  y2={PAD_TOP + PLOT_H}
                  stroke={
                    isHovered ? 'var(--v-hairline-strong)' : 'var(--v-chart-grid)'
                  }
                  strokeDasharray={isHovered ? '2 2' : 'none'}
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={SVG_H - 18}
                  textAnchor="middle"
                  className="v-caption-mono"
                  fill={isHovered ? 'var(--v-ink)' : 'var(--v-mute)'}
                  fontSize="10.5"
                >
                  D+{i + 1}
                </text>
                <text
                  x={x}
                  y={SVG_H - 6}
                  textAnchor="middle"
                  className="v-caption-mono"
                  fill="var(--v-dim)"
                  fontSize="9.5"
                >
                  {d.slice(5)}
                </text>
              </g>
            );
          })}

          {/* Zone Captions */}
          <text
            x={PLOT_LEFT + 4}
            y={PAD_TOP - 9}
            className="v-caption-mono"
            fill="var(--v-mute)"
            fontSize="10"
          >
            OBSERVED TAPE (15D)
          </text>
          <text
            x={ANCHOR_X + 8}
            y={PAD_TOP - 9}
            className="v-caption-mono"
            fill="var(--v-ink)"
            fontSize="10"
          >
            FORECAST HORIZON (5D) · DRAG NODES TO SCULPT
          </text>

          {/* Horizontal Base Price Reference across Sandbox */}
          <line
            x1={ANCHOR_X}
            y1={anchorY}
            x2={SANDBOX_RIGHT}
            y2={anchorY}
            stroke="var(--v-chart-divider)"
            strokeDasharray="2 3"
            strokeWidth="1"
          />

          {/* LAYER 1: Market Landmarks Guide Lines */}
          {showLandmarks &&
            landmarks.map(lm => {
              const y = priceToY(lm.price);
              return (
                <line
                  key={lm.id}
                  x1={ANCHOR_X}
                  y1={y}
                  x2={SANDBOX_RIGHT}
                  y2={y}
                  stroke="var(--v-hairline-strong)"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              );
            })}

          {/* LAYER 2: Crowd Consensus Band */}
          {showCrowdBand && crowdBand && (
            <g>
              <polygon
                points={[
                  `${ANCHOR_X},${anchorY}`,
                  ...crowdBand.map((c, i) => `${getEvalX(i)},${priceToY(c.p80)}`),
                  ...[...crowdBand]
                    .reverse()
                    .map(
                      (c, revIdx) =>
                        `${getEvalX(4 - revIdx)},${priceToY(c.p20)}`
                    ),
                  `${ANCHOR_X},${anchorY}`,
                ].join(' ')}
                fill="url(#v-crowd-hatch)"
              />
              <polyline
                fill="none"
                stroke="var(--v-link)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                points={[
                  `${ANCHOR_X},${anchorY}`,
                  ...crowdBand.map((c, i) => `${getEvalX(i)},${priceToY(c.med)}`),
                ].join(' ')}
              />
            </g>
          )}

          {/* LEFT HALF: Restrained Monochrome Historical Tape */}
          {chartStyle === 'line' ? (
            <g>
              <polygon
                points={[
                  `${getHistoryX(0)},${PAD_TOP + PLOT_H}`,
                  ...historyBars.map(
                    (b, idx) => `${getHistoryX(idx)},${priceToY(b.close)}`
                  ),
                  `${ANCHOR_X},${PAD_TOP + PLOT_H}`,
                ].join(' ')}
                fill="url(#v-history-fade)"
              />
              <polyline
                fill="none"
                stroke="var(--v-body)"
                strokeWidth="1.75"
                points={historyBars
                  .map((b, idx) => `${getHistoryX(idx)},${priceToY(b.close)}`)
                  .join(' ')}
              />
              {historyBars.map((b, idx) =>
                idx % 4 === 0 ? (
                  <text
                    key={b.date}
                    x={getHistoryX(idx)}
                    y={SVG_H - 6}
                    textAnchor="middle"
                    className="v-caption-mono"
                    fill="var(--v-dim)"
                    fontSize="9.5"
                  >
                    {b.date.slice(5)}
                  </text>
                ) : null
              )}
            </g>
          ) : (
            historyBars.map((bar, idx) => {
              const x = getHistoryX(idx);
              const isUp = bar.close >= bar.open;
              const highY = priceToY(bar.high);
              const lowY = priceToY(bar.low);
              const openY = priceToY(bar.open);
              const closeY = priceToY(bar.close);
              const bodyTop = Math.min(openY, closeY);
              const bodyHeight = Math.max(2, Math.abs(closeY - openY));

              return (
                <g key={bar.date}>
                  <line
                    x1={x}
                    y1={highY}
                    x2={x}
                    y2={lowY}
                    stroke="var(--v-dim)"
                    strokeWidth="1"
                  />
                  <rect
                    x={x - 3}
                    y={bodyTop}
                    width="6"
                    height={bodyHeight}
                    fill={isUp ? 'var(--v-body)' : 'var(--v-canvas)'}
                    stroke={isUp ? 'var(--v-body)' : 'var(--v-mute)'}
                    strokeWidth="1"
                  />
                  {idx % 4 === 0 && (
                    <text
                      x={x}
                      y={SVG_H - 6}
                      textAnchor="middle"
                      className="v-caption-mono"
                      fill="var(--v-dim)"
                      fontSize="9.5"
                    >
                      {bar.date.slice(5)}
                    </text>
                  )}
                </g>
              );
            })
          )}

          {/* CENTER BOUNDARY: Immutable Lock Divider */}
          <line
            x1={ANCHOR_X}
            y1={PAD_TOP}
            x2={ANCHOR_X}
            y2={PAD_TOP + PLOT_H}
            stroke="var(--v-chart-divider)"
            strokeWidth="1"
          />
          <text
            x={ANCHOR_X}
            y={SVG_H - 18}
            textAnchor="middle"
            className="v-caption-mono"
            fill="var(--v-ink)"
            fontSize="10.5"
          >
            D-0
          </text>
          <text
            x={ANCHOR_X}
            y={SVG_H - 6}
            textAnchor="middle"
            className="v-caption-mono"
            fill="var(--v-mute)"
            fontSize="9.5"
          >
            {baseDate.slice(5)}
          </text>

          {/* LAYER 3: Overlaid Rival Trajectories */}
          {overlaidRivals.map(rival => {
            if (!rival.forecast.path || rival.forecast.basePrice <= 0) return null;
            const pts = rival.forecast.path.slice(0, 5).map((pt, idx) => {
              const pct =
                (pt.price - rival.forecast.basePrice) / rival.forecast.basePrice;
              const projected = basePrice * (1 + pct);
              return { x: getEvalX(idx), y: priceToY(projected) };
            });
            const poly = [
              `${ANCHOR_X},${anchorY}`,
              ...pts.map(p => `${p.x},${p.y}`),
            ].join(' ');

            return (
              <g key={rival.forecast.id}>
                <polyline
                  fill="none"
                  stroke={rival.colorVar}
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  points={poly}
                />
                {pts.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r="2.5"
                    fill={rival.colorVar}
                  />
                ))}
              </g>
            );
          })}

          {/* LAYER 4: Error Area & Actual Closes (Only when Time-Warp > D-0) */}
          {errorPolygonPoints && (
            <polygon
              points={errorPolygonPoints}
              fill={
                endChangePct >= 0 ? 'var(--v-bull-soft)' : 'var(--v-bear-soft)'
              }
            />
          )}

          {settledPoints.length > 0 && (
            <g>
              <polyline
                fill="none"
                stroke="var(--v-ink)"
                strokeWidth="2"
                points={[
                  `${ANCHOR_X},${anchorY}`,
                  ...settledPoints.map(pt => `${pt.x},${pt.y}`),
                ].join(' ')}
              />
              {settledPoints.map(pt => (
                <circle
                  key={pt.slotIdx}
                  cx={pt.x}
                  cy={pt.y}
                  r="3.5"
                  fill="var(--v-ink)"
                  stroke="var(--v-canvas)"
                  strokeWidth="1.5"
                />
              ))}
              <text
                x={settledPoints[settledPoints.length - 1].x + 8}
                y={settledPoints[settledPoints.length - 1].y + 14}
                className="v-caption-mono"
                fill="var(--v-ink)"
                fontSize="10"
              >
                ACTUAL ${settledPoints[settledPoints.length - 1].price.toFixed(2)}
              </text>
            </g>
          )}

          {/* LAYER 5: Active User Trajectory */}
          <polyline
            fill="none"
            stroke={activeStrokeColor}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={activePolyline}
          />

          {/* Anchor Node at D-0 */}
          <circle
            cx={ANCHOR_X}
            cy={anchorY}
            r="4.5"
            fill="var(--v-ink)"
            stroke="var(--v-canvas)"
            strokeWidth="2"
          />

          {/* 5 Hollow-Core Geist Control Nodes (D+1..D+5) */}
          {activePrices.map((price, idx) => {
            const x = getEvalX(idx);
            const y = priceToY(price);
            const pct =
              basePrice > 0 ? ((price - basePrice) / basePrice) * 100 : 0;
            const isHovered = hoveredSlot === idx;

            return (
              <g key={idx}>
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 6 : 4.5}
                  fill="var(--v-canvas)"
                  stroke={activeStrokeColor}
                  strokeWidth="2.25"
                />
                {(isHovered || idx === 4) && (
                  <g>
                    <rect
                      x={x - 38}
                      y={y - 25}
                      width="76"
                      height="17"
                      rx="3"
                      fill="var(--v-canvas)"
                      stroke="var(--v-hairline-strong)"
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y={y - 13.5}
                      textAnchor="middle"
                      className="v-caption-mono"
                      fill="var(--v-ink)"
                      fontSize="10"
                    >
                      ${price.toFixed(1)} ({pct >= 0 ? '+' : ''}
                      {pct.toFixed(1)}%)
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Collision-Free Right-Lane Direct Labels */}
          {rightLaneLabels.map(lbl => {
            const shifted = Math.abs(lbl.y - lbl.rawY) > 2;
            return (
              <g key={lbl.id}>
                {shifted && (
                  <polyline
                    fill="none"
                    stroke="var(--v-hairline-strong)"
                    strokeWidth="0.75"
                    points={`${SANDBOX_RIGHT + 2},${lbl.rawY} ${SANDBOX_RIGHT + 7},${lbl.y}`}
                  />
                )}
                <text
                  x={SANDBOX_RIGHT + 10}
                  y={lbl.y + 3.5}
                  className="v-caption-mono"
                  fill={lbl.color}
                  fontSize="10"
                  fontWeight={lbl.bold ? '600' : '400'}
                >
                  {lbl.text}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Overlaid Rivals Strip */}
        {overlaidRivals.length > 0 && (
          <div className="px-5 pb-2 flex items-center gap-2 flex-wrap">
            <span className="v-caption-mono" style={{ color: 'var(--v-mute)' }}>
              pinned series:
            </span>
            {overlaidRivals.map(r => (
              <span
                key={r.forecast.id}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] v-caption-mono"
                style={{
                  backgroundColor: 'var(--v-canvas-soft)',
                  boxShadow: 'var(--v-shadow-border)',
                  color: 'var(--v-ink)',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: r.colorVar }}
                />
                @{r.authorHandle}
                <button
                  type="button"
                  onClick={() => onRemoveOverlay(r.forecast.id)}
                  className="ml-1 opacity-70 hover:opacity-100"
                  aria-label={`Remove ${r.authorHandle}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Trajectory Archetype Presets Bar */}
      <div
        className="px-5 py-2.5 flex items-center justify-between gap-2 flex-wrap"
        style={{
          backgroundColor: 'var(--v-canvas-soft)',
          borderTop: '1px solid var(--v-hairline)',
        }}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="v-caption-mono mr-1"
            style={{ color: 'var(--v-mute)' }}
          >
            Presets:
          </span>
          <button
            type="button"
            onClick={() => applyArchetype('breakout')}
            className="v-btn-secondary"
          >
            Breakout (+1.9σ)
          </button>
          <button
            type="button"
            onClick={() => applyArchetype('dip_rip')}
            className="v-btn-secondary"
          >
            Dip & recovery
          </button>
          <button
            type="button"
            onClick={() => applyArchetype('reject')}
            className="v-btn-secondary"
          >
            Resistance fade
          </button>
          <button
            type="button"
            onClick={() => applyArchetype('pullback')}
            className="v-btn-secondary"
          >
            Pullback (-1.8σ)
          </button>
          <button
            type="button"
            onClick={() => applyArchetype('flat')}
            className="v-btn-secondary"
          >
            Rangebound
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            onChangeDraftPrices([
              basePrice,
              basePrice,
              basePrice,
              basePrice,
              basePrice,
            ])
          }
          className="v-caption-mono underline"
          style={{ color: 'var(--v-mute)' }}
        >
          Reset vector
        </button>
      </div>
    </div>
  );
}
