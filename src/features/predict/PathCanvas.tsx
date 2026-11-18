import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import type { AnchorPoint, Forecast, ForecastVersion, MarketBar } from '../../domain/types';
import type { DailyConsensusBandPoint } from '../../domain/crowd';
import {
  interpolateHorizonPath,
  normalizeAnchors,
  isPathComplete,
  buildDrawnSegment,
  MAX_ANCHORS,
} from '../../domain/interpolation';
import { formatPct } from '../../domain/format';
import { useI18n } from '../../lib/i18nCore';
import { CanvasToolbar } from './CanvasToolbar';

export interface OverlayRival {
  forecast: Forecast;
  authorHandle: string;
  authorElo: number;
  colorVar: string;
}

interface PathCanvasProps {
  mode?: 'live' | 'practice';
  ticker?: string;
  baseDate: string;
  basePrice: number;
  evalDates: string[];
  historyBars: MarketBar[];
  actualFutureBars?: (MarketBar | null)[];
  scaleFutureBars?: MarketBar[];
  anchors: AnchorPoint[];
  onChangeAnchors: (next: AnchorPoint[]) => void;
  readOnly?: boolean;
  isConsensusUnlocked?: boolean;
  allForecasts?: Forecast[];
  overlaidRivals?: OverlayRival[];
  onRemoveOverlay?: (forecastId: string) => void;
  consensusBand?: DailyConsensusBandPoint[];
  initialVersion?: ForecastVersion | null;
  headerSubtitle?: string;
  hideAssetBadge?: boolean;
  blindMode?: boolean;
  showMA20?: boolean;
  showVolume?: boolean;
  countdown?: string;
  participantsCount?: number;
}

const W = 980;
const H = 440;
const PAD_LEFT = 16;
const PAD_RIGHT = 104;
const PAD_TOP = 26;
const PAD_BOTTOM = 36;
const plotRight = W - PAD_RIGHT;
const plotStart = PAD_LEFT + 6;
const plotEnd = plotRight - 6;
const plotTotalW = plotEnd - plotStart;
const plotTop = PAD_TOP;
const plotBottom = H - PAD_BOTTOM;
const plotHeight = plotBottom - plotTop;

const priceToYAt = (price: number, minP: number, maxP: number): number => {
  const ratio = (price - minP) / Math.max(1e-6, maxP - minP);
  return plotBottom - Math.max(0, Math.min(1, ratio)) * plotHeight;
};

const dayToXAt = (dayOffset: number, splitX: number, futureStepPx: number): number =>
  splitX + dayOffset * futureStepPx;

const historyIdxToXAt = (
  idx: number,
  pastCount: number,
  splitX: number,
  pastStepPx: number
): number => {
  const offsetFromEnd = Math.max(0, pastCount - 1 - idx);
  return splitX - offsetFromEnd * pastStepPx;
};

export function PathCanvas({
  mode = 'live',
  ticker = 'BTC/USDT',
  baseDate: _baseDate,
  basePrice,
  evalDates,
  historyBars,
  actualFutureBars = [],
  scaleFutureBars,
  anchors,
  onChangeAnchors,
  readOnly = false,
  isConsensusUnlocked = false,
  allForecasts: _allForecasts = [],
  overlaidRivals = [],
  onRemoveOverlay: _onRemoveOverlay,
  consensusBand = [],
  initialVersion = null,
  headerSubtitle,
  hideAssetBadge = false,
  blindMode = false,
  showMA20 = mode === 'practice',
  showVolume = mode === 'practice',
  countdown: _countdown,
  participantsCount: _participantsCount,
}: PathCanvasProps) {
  const { t } = useI18n();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [isDraggingYAxis, setIsDraggingYAxis] = useState<boolean>(false);
  const [hoveringYAxis, setHoveringYAxis] = useState<boolean>(false);
  const yAxisDragRef = useRef<{ startY: number; startZoom: number } | null>(null);
  const pendingMoveRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const moveRafRef = useRef<number | null>(null);
  const [hoveredAnchorIdx, setHoveredAnchorIdx] = useState<number | null>(null);
  const [selectedAnchorDay, setSelectedAnchorDay] = useState<number | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const [hoveredPastIdx, setHoveredPastIdx] = useState<number | null>(null);
  const [snapState, setSnapState] = useState<{ label: string; price: number } | null>(null);
  const [lookbackDays, setLookbackDays] = useState<number>(21);
  const lookbackDaysRef = useRef<number>(21);
  const lookbackExactRef = useRef<number>(21);
  const [animLookback, setAnimLookback] = useState<number>(21);
  const animLookbackRef = useRef<number>(21);
  const minLookbackDays = 7;
  const maxLookbackDays = Math.min(240, Math.max(21, historyBars.length - 1));
  const [chartStyle, setChartStyle] = useState<'line' | 'candles'>('line');
  const [yZoom, setYZoom] = useState<number>(1);
  const yZoomRef = useRef<number>(1);
  const [showInitialVersion, setShowInitialVersion] = useState<boolean>(true);
  const [showConsensus, setShowConsensus] = useState<boolean>(true);

  const horizonDays = evalDates.length || 7;
  const sortedAnchors = useMemo(
    () => normalizeAnchors(anchors, horizonDays, MAX_ANCHORS),
    [anchors, horizonDays]
  );

  const activeSelectedAnchor = useMemo(
    () =>
      selectedAnchorDay !== null
        ? sortedAnchors.find(a => a.day === selectedAnchorDay) ?? null
        : null,
    [selectedAnchorDay, sortedAnchors]
  );

  const pathCompleted = useMemo(
    () => isPathComplete(sortedAnchors, horizonDays),
    [sortedAnchors, horizonDays]
  );

  const drawnSegment = useMemo(
    () => buildDrawnSegment(basePrice, sortedAnchors, horizonDays),
    [basePrice, sortedAnchors, horizonDays]
  );

  const interpolatedPrices = useMemo(
    () =>
      pathCompleted
        ? interpolateHorizonPath(basePrice, sortedAnchors, horizonDays)
        : [],
    [pathCompleted, basePrice, sortedAnchors, horizonDays]
  );

  const effectiveLookback = Math.max(
    1,
    Math.min(Math.max(1, historyBars.length - 1), animLookback)
  );

  const targetPastBars = useMemo(
    () => historyBars.slice(-(lookbackDays + 1)),
    [historyBars, lookbackDays]
  );

  const pastBars = useMemo(
    () => historyBars.slice(-Math.min(historyBars.length, Math.ceil(effectiveLookback) + 2)),
    [historyBars, effectiveLookback]
  );

  const historyExtremes = useMemo(() => {
    if (targetPastBars.length === 0) return null;
    let maxBar = targetPastBars[0];
    let minBar = targetPastBars[0];
    let maxIdx = 0;
    let minIdx = 0;
    targetPastBars.forEach((b, i) => {
      if (b.high >= maxBar.high) {
        maxBar = b;
        maxIdx = i;
      }
      if (b.low <= minBar.low) {
        minBar = b;
        minIdx = i;
      }
    });
    return { maxBar, maxIdx, minBar, minIdx };
  }, [targetPastBars]);

  // Y-axis bounds include anchors, consensus overlay, rivals, and zoom multiplier
  const { targetMinPrice, targetMaxPrice } = useMemo(() => {
    const prices: number[] = [
      basePrice,
      basePrice * 1.045,
      basePrice * 0.955,
      ...sortedAnchors.map(a => a.price),
      ...interpolatedPrices,
    ];
    targetPastBars.forEach(b => prices.push(b.high, b.low));
    actualFutureBars.forEach(b => {
      if (b) prices.push(b.high, b.low, b.close);
    });
    scaleFutureBars?.forEach(b => prices.push(b.high, b.low, b.close));
    if (initialVersion && showInitialVersion) {
      initialVersion.prices.forEach(p => prices.push(p));
    }
    if (isConsensusUnlocked && showConsensus) {
      consensusBand.forEach(pt => {
        prices.push(pt.p25, pt.p75, pt.median, pt.topForecasterMedian);
      });
    }
    overlaidRivals.forEach(r => {
      r.forecast.path?.forEach(pt => {
        if (r.forecast.basePrice > 0) {
          const projected =
            basePrice * (1 + (pt.price - r.forecast.basePrice) / r.forecast.basePrice);
          if (Number.isFinite(projected)) prices.push(projected);
        } else {
          prices.push(pt.price);
        }
      });
    });

    const rawMin = Math.min(...prices);
    const rawMax = Math.max(...prices);
    const mid = (rawMin + rawMax) / 2;
    const baseSpan = Math.max(rawMax - rawMin, basePrice * 0.05) * 1.24;
    const zoomedHalf = baseSpan / (2 * Math.max(0.5, Math.min(2.4, yZoom)));
    return {
      targetMinPrice: mid - zoomedHalf,
      targetMaxPrice: mid + zoomedHalf,
    };
  }, [
    basePrice,
    sortedAnchors,
    interpolatedPrices,
    targetPastBars,
    actualFutureBars,
    scaleFutureBars,
    initialVersion,
    showInitialVersion,
    isConsensusUnlocked,
    showConsensus,
    consensusBand,
    overlaidRivals,
    yZoom,
  ]);

  const [animPrice, setAnimPrice] = useState(() => ({
    min: targetMinPrice,
    max: targetMaxPrice,
  }));
  const animPriceRef = useRef(animPrice);

  // Smooth TradingView-style rAF lerp interpolation (paused while dragging to prevent pointer drift)
  useEffect(() => {
    if (draggingIdx !== null) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const targetMid = (targetMinPrice + targetMaxPrice) / 2;
    const currMid = (animPriceRef.current.min + animPriceRef.current.max) / 2;
    const snapImmediately =
      prefersReduced ||
      currMid <= 0 ||
      Math.abs(targetMid - currMid) / Math.max(1, targetMid) > 0.35;

    let rafId = 0;
    const priceEps = Math.max(1e-4, (targetMaxPrice - targetMinPrice) * 0.0008);
    const tick = () => {
      if (snapImmediately) {
        animLookbackRef.current = lookbackDays;
        animPriceRef.current = { min: targetMinPrice, max: targetMaxPrice };
        setAnimLookback(lookbackDays);
        setAnimPrice(animPriceRef.current);
        return;
      }

      const lbDiff = lookbackDays - animLookbackRef.current;
      const minDiff = targetMinPrice - animPriceRef.current.min;
      const maxDiff = targetMaxPrice - animPriceRef.current.max;

      const lbDone = Math.abs(lbDiff) < 0.08;
      const minDone = Math.abs(minDiff) < priceEps;
      const maxDone = Math.abs(maxDiff) < priceEps;

      if (lbDone && minDone && maxDone) {
        if (
          animLookbackRef.current !== lookbackDays ||
          animPriceRef.current.min !== targetMinPrice ||
          animPriceRef.current.max !== targetMaxPrice
        ) {
          animLookbackRef.current = lookbackDays;
          animPriceRef.current = { min: targetMinPrice, max: targetMaxPrice };
          setAnimLookback(lookbackDays);
          setAnimPrice(animPriceRef.current);
        }
        return;
      }

      const lerp = 0.38;
      const nextLb = lbDone ? lookbackDays : animLookbackRef.current + lbDiff * lerp;
      const nextMin = minDone ? targetMinPrice : animPriceRef.current.min + minDiff * lerp;
      const nextMax = maxDone ? targetMaxPrice : animPriceRef.current.max + maxDiff * lerp;

      animLookbackRef.current = nextLb;
      animPriceRef.current = { min: nextMin, max: nextMax };
      setAnimLookback(nextLb);
      setAnimPrice(animPriceRef.current);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [lookbackDays, targetMinPrice, targetMaxPrice, draggingIdx]);

  const minPrice = animPrice.min;
  const maxPrice = animPrice.max;

  const totalIntervals = effectiveLookback + horizonDays;
  const stepPx = plotTotalW / totalIntervals;
  const splitX = plotStart + effectiveLookback * stepPx;
  const futureWidth = plotRight - splitX;
  const pastStepPx = stepPx;
  const futureStepPx = stepPx;

  // TradingView-style direct mouse wheel & trackpad zoom on canvas
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      const scaleUnit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? 400 : 1;
      const deltaY = e.deltaY * scaleUnit;
      const deltaX = e.deltaX * scaleUnit;
      const dominantDelta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
      if (dominantDelta === 0) return;

      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;
      const svgX = ((e.clientX - rect.left) / rect.width) * W;

      if (svgX >= plotRight + 8) {
        const nextZoom = parseFloat(
          Math.max(0.5, Math.min(2.4, yZoomRef.current * Math.exp(-dominantDelta * 0.0014))).toFixed(3)
        );
        yZoomRef.current = nextZoom;
        setYZoom(nextZoom);
      } else {
        const nextExact = Math.max(
          minLookbackDays,
          Math.min(maxLookbackDays, lookbackExactRef.current * Math.exp(dominantDelta * 0.0016))
        );
        lookbackExactRef.current = nextExact;
        const nextRounded = Math.max(
          minLookbackDays,
          Math.min(maxLookbackDays, Math.round(nextExact))
        );
        if (nextRounded !== lookbackDaysRef.current) {
          lookbackDaysRef.current = nextRounded;
          setLookbackDays(nextRounded);
        }
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [maxLookbackDays, minLookbackDays]);

  const priceToY = (price: number): number => priceToYAt(price, minPrice, maxPrice);
  const yToPrice = (y: number): number => {
    const clampedY = Math.max(plotTop + 4, Math.min(plotBottom - 4, y));
    const ratio = (plotBottom - clampedY) / plotHeight;
    return parseFloat((minPrice + ratio * (maxPrice - minPrice)).toFixed(2));
  };
  const dayToX = (dayOffset: number): number => dayToXAt(dayOffset, splitX, futureStepPx);
  const xToDay = (x: number): number => {
    const offset = Math.round((x - splitX) / futureStepPx);
    return Math.max(1, Math.min(horizonDays, offset));
  };
  const historyIdxToX = (idx: number): number =>
    historyIdxToXAt(idx, pastBars.length, splitX, pastStepPx);

  const getSvgCoords = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const transformed = pt.matrixTransform(ctm.inverse());
      return { svgX: transformed.x, svgY: transformed.y };
    }
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      svgX: ((clientX - rect.left) / rect.width) * W,
      svgY: ((clientY - rect.top) / rect.height) * H,
    };
  };

  const getValidDayBounds = (idx: number, list: AnchorPoint[]) => {
    const minDay = idx > 0 ? list[idx - 1].day + 1 : 1;
    const maxDay = idx < list.length - 1 ? list[idx + 1].day - 1 : horizonDays;
    return { minDay, maxDay };
  };

  const getSnapPrice = (svgY: number): { price: number; snap: { label: string; price: number } | null } => {
    const candidates: { price: number; label: string }[] = [
      { price: basePrice, label: t('기준 가격', 'Base Price') },
    ];
    if (historyExtremes) {
      candidates.push(
        {
          price: historyExtremes.maxBar.high,
          label: t(`${lookbackDays}일 고점`, `${lookbackDays}D High`),
        },
        {
          price: historyExtremes.minBar.low,
          label: t(`${lookbackDays}일 저점`, `${lookbackDays}D Low`),
        }
      );
    }
    let best: { price: number; label: string } | null = null;
    let bestDist = 7;
    candidates.forEach(c => {
      const dist = Math.abs(priceToY(c.price) - svgY);
      if (dist <= bestDist) {
        bestDist = dist;
        best = c;
      }
    });
    if (best !== null) {
      const matched = best as { price: number; label: string };
      const p = parseFloat(matched.price.toFixed(2));
      return { price: p, snap: { label: matched.label, price: p } };
    }
    return { price: yToPrice(svgY), snap: null };
  };

  const handlePointerDownAnchor = (idx: number, e: React.PointerEvent) => {
    if (readOnly || e.button !== 0) return;
    e.stopPropagation();
    svgRef.current?.setPointerCapture?.(e.pointerId);
    setDraggingIdx(idx);
    setHoveredPastIdx(null);
    const anchor = sortedAnchors[idx];
    setSelectedAnchorDay(anchor?.day ?? null);
    setHoveredDay(anchor?.day ?? null);
    setHoverPrice(anchor?.price ?? null);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const coords = getSvgCoords(e.clientX, e.clientY);
    if (!coords) return;

    // TradingView-style right price axis vertical drag zoom (desktop / stylus)
    if (e.pointerType !== 'touch' && coords.svgX > plotRight + 12 && coords.svgX <= W) {
      yAxisDragRef.current = { startY: coords.svgY, startZoom: yZoomRef.current };
      setIsDraggingYAxis(true);
      svgRef.current?.setPointerCapture?.(e.pointerId);
      return;
    }

    if (readOnly) return;

    if (coords.svgX < splitX - 8 || coords.svgX > plotRight + 16) {
      setSelectedAnchorDay(null);
      return;
    }

    let targetDay = xToDay(coords.svgX);
    const { price: targetPrice, snap } = getSnapPrice(coords.svgY);
    setSnapState(snap);

    // 1. Hit-test existing anchors (18px radius or same day)
    let hitIdx = -1;
    let minDist = 18;
    sortedAnchors.forEach((a, idx) => {
      const dx = dayToX(a.day) - coords.svgX;
      const dy = priceToY(a.price) - coords.svgY;
      const dist = Math.hypot(dx, dy);
      if (dist < minDist) {
        minDist = dist;
        hitIdx = idx;
      }
    });

    if (hitIdx === -1) {
      hitIdx = sortedAnchors.findIndex(a => a.day === targetDay);
    }

    if (hitIdx !== -1) {
      const updated = [...sortedAnchors];
      updated[hitIdx] = { day: updated[hitIdx].day, price: targetPrice };
      onChangeAnchors(updated);
      svgRef.current?.setPointerCapture?.(e.pointerId);
      setDraggingIdx(hitIdx);
      setSelectedAnchorDay(updated[hitIdx].day);
      setHoveredDay(updated[hitIdx].day);
      setHoverPrice(targetPrice);
      return;
    }

    // Snap near expiry line directly to D+horizonDays if no expiry anchor exists yet
    const hasExpiry = sortedAnchors.some(a => a.day === horizonDays);
    if (!hasExpiry && targetDay >= horizonDays - 1) {
      targetDay = horizonDays;
    }

    // 2. Add new anchor if below MAX_ANCHORS (5)
    if (sortedAnchors.length < MAX_ANCHORS) {
      const next = [...sortedAnchors, { day: targetDay, price: targetPrice }].sort(
        (a, b) => a.day - b.day
      );
      const newIdx = next.findIndex(a => a.day === targetDay);
      onChangeAnchors(next);
      svgRef.current?.setPointerCapture?.(e.pointerId);
      setDraggingIdx(newIdx !== -1 ? newIdx : next.length - 1);
      setSelectedAnchorDay(targetDay);
      setHoveredDay(targetDay);
      setHoverPrice(targetPrice);
      return;
    }

    // 3. At MAX_ANCHORS: grab nearest anchor (preserve expiry endpoint)
    let nearestIdx = 0;
    let bestDayDiff = Infinity;
    sortedAnchors.forEach((a, idx) => {
      const diff = Math.abs(a.day - targetDay);
      if (diff < bestDayDiff) {
        bestDayDiff = diff;
        nearestIdx = idx;
      }
    });

    const anchor = sortedAnchors[nearestIdx];
    const { minDay, maxDay } = getValidDayBounds(nearestIdx, sortedAnchors);
    const clampedDay =
      anchor.day === horizonDays
        ? horizonDays
        : Math.max(minDay, Math.min(maxDay, targetDay));
    const updated = [...sortedAnchors];
    updated[nearestIdx] = { day: clampedDay, price: targetPrice };
    onChangeAnchors(updated);
    svgRef.current?.setPointerCapture?.(e.pointerId);
    setDraggingIdx(nearestIdx);
    setSelectedAnchorDay(clampedDay);
    setHoveredDay(clampedDay);
    setHoverPrice(targetPrice);
  };

  const processPointerMove = (clientX: number, clientY: number) => {
    const coords = getSvgCoords(clientX, clientY);
    if (!coords) return;

    if (yAxisDragRef.current) {
      const dy = coords.svgY - yAxisDragRef.current.startY;
      const nextZoom = parseFloat(
        Math.max(0.5, Math.min(2.4, yAxisDragRef.current.startZoom * Math.exp(-dy * 0.006))).toFixed(3)
      );
      yZoomRef.current = nextZoom;
      setYZoom(nextZoom);
      return;
    }

    if (draggingIdx !== null && !readOnly) {
      const current = sortedAnchors[draggingIdx];
      if (!current) return;
      const { minDay, maxDay } = getValidDayBounds(draggingIdx, sortedAnchors);
      const rawDay = xToDay(coords.svgX);
      const nextDay =
        current.day === horizonDays
          ? horizonDays
          : Math.max(minDay, Math.min(maxDay, rawDay));
      const { price: nextPrice, snap } = getSnapPrice(coords.svgY);
      setSnapState(snap);
      if (hoveredPastIdx !== null) setHoveredPastIdx(null);

      const next = [...sortedAnchors];
      next[draggingIdx] = { day: nextDay, price: nextPrice };
      onChangeAnchors(next);
      setSelectedAnchorDay(nextDay);
      setHoveredDay(nextDay);
      setHoverPrice(nextPrice);
      return;
    }

    const overYAxis = coords.svgX > plotRight + 12 && coords.svgX <= W;
    if (overYAxis !== hoveringYAxis) {
      setHoveringYAxis(overYAxis);
    }

    if (coords.svgX >= splitX - 8 && coords.svgX <= plotRight + 14) {
      if (hoveredPastIdx !== null) setHoveredPastIdx(null);
      let day = xToDay(coords.svgX);
      const hasExpiry = sortedAnchors.some(a => a.day === horizonDays);
      if (!hasExpiry && day >= horizonDays - 1) {
        day = horizonDays;
      }
      const { price: nextPrice, snap } = getSnapPrice(coords.svgY);
      if (hoveredDay !== day) setHoveredDay(day);
      if (hoverPrice !== nextPrice) setHoverPrice(nextPrice);
      if (snapState?.label !== snap?.label || snapState?.price !== snap?.price) {
        setSnapState(snap);
      }
    } else if (coords.svgX >= plotStart - 6 && coords.svgX < splitX - 8 && pastBars.length > 0) {
      const rawIdx = Math.round(pastBars.length - 1 - (splitX - coords.svgX) / pastStepPx);
      const clampedIdx = Math.max(0, Math.min(pastBars.length - 1, rawIdx));
      if (hoveredPastIdx !== clampedIdx) setHoveredPastIdx(clampedIdx);
      if (hoveredDay !== null) setHoveredDay(null);
      if (hoverPrice !== null) setHoverPrice(null);
      if (snapState !== null) setSnapState(null);
    } else {
      if (hoveredPastIdx !== null) setHoveredPastIdx(null);
      if (hoveredDay !== null) setHoveredDay(null);
      if (hoverPrice !== null) setHoverPrice(null);
      if (snapState !== null) setSnapState(null);
    }
  };

  const processMoveRef = useRef(processPointerMove);
  processMoveRef.current = processPointerMove;

  useEffect(() => {
    return () => {
      if (moveRafRef.current !== null) {
        cancelAnimationFrame(moveRafRef.current);
      }
    };
  }, []);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    pendingMoveRef.current = { clientX: e.clientX, clientY: e.clientY };
    if (moveRafRef.current !== null) return;
    moveRafRef.current = requestAnimationFrame(() => {
      moveRafRef.current = null;
      const pending = pendingMoveRef.current;
      pendingMoveRef.current = null;
      if (pending) {
        processMoveRef.current(pending.clientX, pending.clientY);
      }
    });
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (moveRafRef.current !== null) {
      cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
    }
    const pending = pendingMoveRef.current;
    pendingMoveRef.current = null;
    if (pending && (draggingIdx !== null || yAxisDragRef.current)) {
      processMoveRef.current(pending.clientX, pending.clientY);
    }
    if (yAxisDragRef.current) {
      svgRef.current?.releasePointerCapture?.(e.pointerId);
      yAxisDragRef.current = null;
      setIsDraggingYAxis(false);
    }
    if (draggingIdx !== null) {
      svgRef.current?.releasePointerCapture?.(e.pointerId);
      setDraggingIdx(null);
      setSnapState(null);
    }
  };

  const handleRemoveAnchor = (day: number, e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (readOnly) return;
    onChangeAnchors(sortedAnchors.filter(a => a.day !== day));
    setHoveredAnchorIdx(null);
    if (selectedAnchorDay === day) {
      setSelectedAnchorDay(null);
    }
  };

  const handleAnchorKeyDown = (idx: number, e: React.KeyboardEvent<SVGGElement>) => {
    if (readOnly) return;
    const anchor = sortedAnchors[idx];
    if (!anchor) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      handleRemoveAnchor(anchor.day, e);
      return;
    }

    const priceStepPct = e.shiftKey ? 0.02 : 0.005;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      const delta = (e.key === 'ArrowUp' ? 1 : -1) * basePrice * priceStepPct;
      const nextPrice = Math.max(1, parseFloat((anchor.price + delta).toFixed(2)));
      const next = [...sortedAnchors];
      next[idx] = { day: anchor.day, price: nextPrice };
      onChangeAnchors(next);
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (anchor.day === horizonDays) return;
      e.preventDefault();
      e.stopPropagation();
      const { minDay, maxDay } = getValidDayBounds(idx, sortedAnchors);
      const nextDay = Math.max(
        minDay,
        Math.min(maxDay, anchor.day + (e.key === 'ArrowRight' ? 1 : -1))
      );
      if (nextDay !== anchor.day) {
        const next = [...sortedAnchors];
        next[idx] = { day: nextDay, price: anchor.price };
        onChangeAnchors(next);
        setSelectedAnchorDay(nextDay);
      }
    }
  };

  const handleSvgKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (sortedAnchors.length === 0) {
        onChangeAnchors([{ day: horizonDays, price: parseFloat((basePrice * 1.03).toFixed(2)) }]);
        setSelectedAnchorDay(horizonDays);
      } else if (!pathCompleted && sortedAnchors.length < MAX_ANCHORS) {
        const lastPrice = sortedAnchors[sortedAnchors.length - 1].price;
        onChangeAnchors([...sortedAnchors, { day: horizonDays, price: lastPrice }]);
        setSelectedAnchorDay(horizonDays);
      }
    }
  };

  const historyPolylinePoints = useMemo(() => {
    return pastBars
      .map((bar, idx) =>
        `${historyIdxToXAt(idx, pastBars.length, splitX, pastStepPx).toFixed(1)},${priceToYAt(bar.close, minPrice, maxPrice).toFixed(1)}`
      )
      .join(' ');
  }, [pastBars, minPrice, maxPrice, splitX, pastStepPx]);

  const historyAreaPoints = useMemo(() => {
    if (pastBars.length === 0) return '';
    const firstX = historyIdxToXAt(0, pastBars.length, splitX, pastStepPx).toFixed(1);
    const lastX = historyIdxToXAt(pastBars.length - 1, pastBars.length, splitX, pastStepPx).toFixed(1);
    return `${firstX},${plotBottom} ${historyPolylinePoints} ${lastX},${plotBottom}`;
  }, [pastBars.length, historyPolylinePoints, splitX, pastStepPx]);

  const ma20Series = useMemo(() => {
    const out: number[] = new Array(historyBars.length);
    let rollingSum = 0;
    for (let i = 0; i < historyBars.length; i++) {
      rollingSum += historyBars[i].close;
      if (i >= 20) rollingSum -= historyBars[i - 20].close;
      const winLen = Math.min(20, i + 1);
      out[i] = rollingSum / winLen;
    }
    return out;
  }, [historyBars]);

  const ma20PolylinePoints = useMemo(() => {
    if (!showMA20 || pastBars.length < 2) return '';
    const startOffset = historyBars.length - pastBars.length;
    return pastBars
      .map((bar, idx) => {
        const histIdx = startOffset + idx;
        const ma = ma20Series[histIdx] ?? bar.close;
        const x = historyIdxToXAt(idx, pastBars.length, splitX, pastStepPx).toFixed(1);
        const y = priceToYAt(ma, minPrice, maxPrice).toFixed(1);
        return `${x},${y}`;
      })
      .join(' ');
  }, [showMA20, pastBars, historyBars.length, ma20Series, splitX, pastStepPx, minPrice, maxPrice]);

  const maxPastVolume = useMemo(() => {
    if (!showVolume) return 0;
    let maxV = 0;
    for (const b of pastBars) {
      if ((b.volume ?? 0) > maxV) maxV = b.volume ?? 0;
    }
    return maxV;
  }, [showVolume, pastBars]);

  const historyDayTicks = useMemo(() => {
    const ticks: {
      x: number;
      offset: number;
      label: string;
      isMajor: boolean;
      showLabel: boolean;
    }[] = [];
    if (pastBars.length < 2) return ticks;
    const lastIdx = pastBars.length - 1;
    const step =
      lookbackDays <= 10
        ? 2
        : lookbackDays <= 16
        ? 4
        : lookbackDays <= 28
        ? 7
        : lookbackDays <= 50
        ? 10
        : lookbackDays <= 80
        ? 15
        : lookbackDays <= 140
        ? 20
        : 30;
    for (let offset = step; offset <= lastIdx; offset += step) {
      const idx = lastIdx - offset;
      const bar = pastBars[idx];
      if (!bar) continue;
      const x = historyIdxToXAt(idx, pastBars.length, splitX, pastStepPx);
      if (x < PAD_LEFT - 2) continue;
      const isMajor = offset % (step * 2) === 0 || offset === lastIdx;
      const showLabel = x >= PAD_LEFT + 28 && x <= splitX - 38;
      const mmdd = bar.date.slice(5).replace('-', '.');
      ticks.push({
        x,
        offset,
        label: blindMode ? `D-${offset}` : `D-${offset} (${mmdd})`,
        isMajor,
        showLabel,
      });
    }
    return ticks;
  }, [pastBars, splitX, pastStepPx, lookbackDays, blindMode]);

  const drawnCoords = useMemo(() => {
    if (drawnSegment.length <= 1) return [];
    return drawnSegment.map(pt => ({
      x: pt.day === 0 ? splitX : dayToXAt(pt.day, splitX, futureStepPx),
      y: priceToYAt(pt.price, minPrice, maxPrice),
      day: pt.day,
      price: pt.price,
    }));
  }, [drawnSegment, minPrice, maxPrice, splitX, futureStepPx]);

  const userPolylineStr = useMemo(() => {
    if (drawnCoords.length <= 1) return '';
    return drawnCoords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }, [drawnCoords]);

  const userAreaPolygonStr = useMemo(() => {
    if (!pathCompleted || drawnCoords.length <= 1) return '';
    const lastX = drawnCoords[drawnCoords.length - 1].x.toFixed(1);
    return `${splitX.toFixed(1)},${plotBottom} ${userPolylineStr} ${lastX},${plotBottom}`;
  }, [pathCompleted, drawnCoords, userPolylineStr, splitX]);

  const ghostPolylineStr = useMemo(() => {
    if (
      readOnly ||
      draggingIdx !== null ||
      hoveredAnchorIdx !== null ||
      hoveredDay === null ||
      hoverPrice === null
    ) {
      return null;
    }
    if (sortedAnchors.length >= MAX_ANCHORS) return null;
    if (sortedAnchors.some(a => a.day === hoveredDay)) return null;

    const previewSegment = buildDrawnSegment(
      basePrice,
      [...sortedAnchors, { day: hoveredDay, price: hoverPrice }],
      horizonDays
    );
    if (previewSegment.length <= 1) return null;
    return previewSegment
      .map(pt => {
        const x = pt.day === 0 ? splitX : dayToXAt(pt.day, splitX, futureStepPx);
        return `${x.toFixed(1)},${priceToYAt(pt.price, minPrice, maxPrice).toFixed(1)}`;
      })
      .join(' ');
  }, [
    readOnly,
    draggingIdx,
    hoveredAnchorIdx,
    hoveredDay,
    hoverPrice,
    sortedAnchors,
    horizonDays,
    basePrice,
    minPrice,
    maxPrice,
    splitX,
    futureStepPx,
  ]);

  const settledFutureItems = useMemo(() => {
    const items: { x: number; y: number; day: number; bar: MarketBar }[] = [];
    actualFutureBars.forEach((bar, idx) => {
      if (bar) {
        items.push({
          x: dayToXAt(idx + 1, splitX, futureStepPx),
          y: priceToYAt(bar.close, minPrice, maxPrice),
          day: idx + 1,
          bar,
        });
      }
    });
    return items;
  }, [actualFutureBars, minPrice, maxPrice, splitX, futureStepPx]);

  const actualFuturePolyline = useMemo(() => {
    if (settledFutureItems.length === 0) return '';
    return [
      `${splitX},${priceToYAt(basePrice, minPrice, maxPrice).toFixed(1)}`,
      ...settledFutureItems.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    ].join(' ');
  }, [settledFutureItems, basePrice, minPrice, maxPrice, splitX]);

  const actualFutureAreaPoints = useMemo(() => {
    if (settledFutureItems.length === 0) return '';
    const lastX = settledFutureItems[settledFutureItems.length - 1].x.toFixed(1);
    return `${splitX},${plotBottom} ${actualFuturePolyline} ${lastX},${plotBottom}`;
  }, [settledFutureItems, actualFuturePolyline, splitX]);

  const yTicks = useMemo(() => {
    return [0.15, 0.32, 0.5, 0.68, 0.85].map(r => {
      const p = minPrice + r * (maxPrice - minPrice);
      const pct = basePrice > 0 ? ((p - basePrice) / basePrice) * 100 : 0;
      return { price: p, y: priceToYAt(p, minPrice, maxPrice), pct };
    });
  }, [minPrice, maxPrice, basePrice]);

  const finalUserPrice = pathCompleted
    ? interpolatedPrices[interpolatedPrices.length - 1] ?? basePrice
    : null;
  const finalUserPct =
    finalUserPrice !== null && basePrice > 0
      ? ((finalUserPrice - basePrice) / basePrice) * 100
      : null;

  const syncedCandleWidth = Math.max(4, Math.min(12, stepPx * 0.68));
  const futureGuideDays = horizonDays <= 7 ? [2, 4, 7] : [5, 10, 15, 20];
  const expiryDateShort =
    evalDates[evalDates.length - 1]?.slice(5).replace('-', '.') || `D+${horizonDays}`;

  const hoveredPastBar = hoveredPastIdx !== null ? pastBars[hoveredPastIdx] : null;
  const hoveredPastOffset =
    hoveredPastIdx !== null && pastBars[hoveredPastIdx]
      ? pastBars.length - 1 - hoveredPastIdx
      : null;
  const hoverPctDelta =
    hoverPrice !== null && basePrice > 0
      ? ((hoverPrice - basePrice) / basePrice) * 100
      : null;

  const formatAxisLevel = (price: number): string => {
    if (blindMode) {
      const pct = basePrice > 0 ? ((price - basePrice) / basePrice) * 100 : 0;
      return formatPct(pct);
    }
    return `$${Math.round(price).toLocaleString('en-US')}`;
  };

  const consensusGeom = useMemo(() => {
    if (!isConsensusUnlocked || !showConsensus || consensusBand.length === 0) return null;
    const baseY = priceToYAt(basePrice, minPrice, maxPrice).toFixed(1);
    const basePt = `${splitX.toFixed(1)},${baseY}`;
    const top10Pts = [
      basePt,
      ...consensusBand.map(
        b => `${dayToXAt(b.day, splitX, futureStepPx).toFixed(1)},${priceToYAt(b.topForecasterMedian, minPrice, maxPrice).toFixed(1)}`
      ),
    ].join(' ');
    const medianPts = [
      basePt,
      ...consensusBand.map(
        b => `${dayToXAt(b.day, splitX, futureStepPx).toFixed(1)},${priceToYAt(b.median, minPrice, maxPrice).toFixed(1)}`
      ),
    ].join(' ');
    const p75Fwd = [
      basePt,
      ...consensusBand.map(
        b => `${dayToXAt(b.day, splitX, futureStepPx).toFixed(1)},${priceToYAt(b.p75, minPrice, maxPrice).toFixed(1)}`
      ),
    ];
    const p25Rev = [
      ...consensusBand
        .slice()
        .reverse()
        .map(
          b => `${dayToXAt(b.day, splitX, futureStepPx).toFixed(1)},${priceToYAt(b.p25, minPrice, maxPrice).toFixed(1)}`
        ),
      basePt,
    ];
    const bandPolygon = [...p75Fwd, ...p25Rev].join(' ');
    const lastTop10 = consensusBand[consensusBand.length - 1];
    return {
      top10Pts,
      medianPts,
      bandPolygon,
      lastTop10X: dayToXAt(lastTop10.day, splitX, futureStepPx),
      lastTop10Y: priceToYAt(lastTop10.topForecasterMedian, minPrice, maxPrice),
    };
  }, [
    isConsensusUnlocked,
    showConsensus,
    consensusBand,
    minPrice,
    maxPrice,
    splitX,
    futureStepPx,
    basePrice,
  ]);

  const handleToggleConsensus = useCallback(() => setShowConsensus(p => !p), []);
  const handleToggleInitialVersion = useCallback(() => setShowInitialVersion(p => !p), []);
  const handleZoomOutBtn = useCallback(() => {
    setLookbackDays(d => {
      const next = Math.min(maxLookbackDays, Math.max(d + 4, Math.round(d * 1.25)));
      lookbackExactRef.current = next;
      lookbackDaysRef.current = next;
      return next;
    });
  }, [maxLookbackDays]);
  const handleZoomInBtn = useCallback(() => {
    setLookbackDays(d => {
      const next = Math.max(minLookbackDays, Math.min(d - 4, Math.round(d * 0.8)));
      lookbackExactRef.current = next;
      lookbackDaysRef.current = next;
      return next;
    });
  }, [minLookbackDays]);
  const handleResetZoomBtn = useCallback(() => {
    lookbackExactRef.current = 21;
    lookbackDaysRef.current = 21;
    yZoomRef.current = 1;
    setLookbackDays(21);
    setYZoom(1);
  }, []);
  const handleDeleteSelectedBtn = useCallback(() => {
    if (activeSelectedAnchor) handleRemoveAnchor(activeSelectedAnchor.day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSelectedAnchor]);
  const handleClearAnchorsBtn = useCallback(() => {
    onChangeAnchors([]);
    setSelectedAnchorDay(null);
  }, [onChangeAnchors]);

  return (
    <div
      className="w-full h-full flex flex-col relative select-none"
      style={{ backgroundColor: 'var(--op-canvas)' }}
    >
      <CanvasToolbar
        ticker={ticker}
        basePrice={basePrice}
        horizonDays={horizonDays}
        lookbackDays={lookbackDays}
        minLookbackDays={minLookbackDays}
        maxLookbackDays={maxLookbackDays}
        pathCompleted={pathCompleted}
        readOnly={readOnly}
        anchorsCount={sortedAnchors.length}
        selectedAnchor={activeSelectedAnchor}
        chartStyle={chartStyle}
        showConsensus={showConsensus}
        hasConsensusBand={consensusBand.length > 0}
        isConsensusUnlocked={isConsensusUnlocked}
        initialVersion={initialVersion}
        showInitialVersion={showInitialVersion}
        headerSubtitle={headerSubtitle}
        hideAssetBadge={hideAssetBadge}
        blindMode={blindMode}
        hoveredDay={hoveredDay}
        hoverPrice={hoverPrice}
        hoverPctDelta={hoverPctDelta}
        snapState={snapState}
        hoveredPastBar={hoveredPastBar}
        hoveredPastOffset={hoveredPastOffset}
        onToggleConsensus={handleToggleConsensus}
        onToggleInitialVersion={handleToggleInitialVersion}
        onChangeChartStyle={setChartStyle}
        onZoomOut={handleZoomOutBtn}
        onZoomIn={handleZoomInBtn}
        onResetZoom={handleResetZoomBtn}
        onDeleteSelectedAnchor={handleDeleteSelectedBtn}
        onClearAnchors={handleClearAnchorsBtn}
      />

      {/* Main Interactive SVG Canvas */}
      <div className="relative w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden chart-container-reserved">
        <svg
          ref={svgRef}
          role="region"
          tabIndex={readOnly ? undefined : 0}
          aria-label={t(
            `BTC/USDT ${horizonDays}일 인터랙티브 예측 차트. 엔터 또는 스페이스로 예측 경로 그리기를 시작할 수 있습니다.`,
            `BTC/USDT ${horizonDays}D Interactive Forecast Chart. Press Enter or Space to start drawing.`
          )}
          viewBox={`0 0 ${W} ${H}`}
          className={`w-full h-auto max-h-[480px] block ${
            draggingIdx !== null || isDraggingYAxis ? 'touch-none' : 'touch-pan-y'
          } ${
            isDraggingYAxis || hoveringYAxis
              ? 'cursor-ns-resize'
              : readOnly
              ? 'cursor-default'
              : draggingIdx !== null
              ? 'cursor-grabbing'
              : 'cursor-crosshair'
          }`}
          onKeyDown={handleSvgKeyDown}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={e => {
            const coords = getSvgCoords(e.clientX, e.clientY);
            if (coords && coords.svgX > plotRight + 12) {
              yZoomRef.current = 1;
              setYZoom(1);
            }
          }}
          onPointerLeave={e => {
            setHoveringYAxis(false);
            if (draggingIdx === null && !yAxisDragRef.current) {
              if (moveRafRef.current !== null) {
                cancelAnimationFrame(moveRafRef.current);
                moveRafRef.current = null;
              }
              pendingMoveRef.current = null;
              setHoveredPastIdx(null);
              setHoveredDay(null);
              setHoverPrice(null);
              setSnapState(null);
            } else {
              handlePointerUp(e);
            }
          }}
        >
          <defs>
            <linearGradient id="op-hist-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--op-ink)" stopOpacity="0.10" />
              <stop offset="100%" stopColor="var(--op-ink)" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="op-orange-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--op-orange)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--op-orange)" stopOpacity="0.0" />
            </linearGradient>
            <clipPath id="op-plot-clip">
              <rect x={PAD_LEFT} y={plotTop} width={plotRight - PAD_LEFT} height={plotHeight} />
            </clipPath>
          </defs>

          {/* Future Drawing Surface */}
          <rect
            x={splitX}
            y={plotTop}
            width={futureWidth}
            height={plotHeight}
            fill="var(--op-panel)"
            fillOpacity="0.65"
          />

          {/* Horizontal Y-Axis Grid Lines & Price Labels */}
          {yTicks.map((tick, idx) => {
            const baseTagY = priceToY(basePrice);
            const targetTagY = finalUserPrice !== null ? priceToY(finalUserPrice) : -999;
            const collidesAxisTag =
              Math.abs(tick.y - baseTagY) < 16 || Math.abs(tick.y - targetTagY) < 16;
            return (
              <g key={idx}>
                <line
                  x1={PAD_LEFT}
                  y1={tick.y}
                  x2={plotRight}
                  y2={tick.y}
                  stroke="var(--op-chart-grid)"
                  strokeWidth="1"
                />
                {!collidesAxisTag && (
                  <text
                    x={plotRight + 8}
                    y={tick.y + 3}
                    fill="var(--op-ink-3)"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                  >
                    {formatAxisLevel(tick.price)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Base Price Reference Line */}
          <line
            x1={PAD_LEFT}
            y1={priceToY(basePrice)}
            x2={plotRight}
            y2={priceToY(basePrice)}
            stroke="var(--op-line-strong)"
            strokeWidth="1"
            strokeDasharray="2 4"
            opacity="0.7"
          />

          {/* Historical Vertical Day Guides */}
          {historyDayTicks.map(tick => (
            <g key={tick.offset}>
              <line
                x1={tick.x}
                y1={plotTop}
                x2={tick.x}
                y2={plotBottom}
                stroke="var(--op-chart-grid)"
                strokeWidth="1"
                strokeDasharray="2 3"
                opacity={tick.isMajor ? '0.8' : '0.35'}
              />
              {tick.showLabel && (
                <text
                  x={Math.max(PAD_LEFT + 34, tick.x)}
                  y={H - 12}
                  textAnchor="middle"
                  fill="var(--op-ink-3)"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                >
                  {tick.label}
                </text>
              )}
            </g>
          ))}

          {/* Future Vertical Day Guides + Highlighted Expiry Line */}
          {futureGuideDays.map(d => {
            if (d > horizonDays) return null;
            const x = dayToX(d);
            const isExpiry = d === horizonDays;
            return (
              <g key={d}>
                <line
                  x1={x}
                  y1={plotTop}
                  x2={x}
                  y2={plotBottom}
                  stroke={
                    isExpiry && !pathCompleted && !readOnly
                      ? 'var(--op-orange)'
                      : 'var(--op-chart-grid)'
                  }
                  strokeWidth={isExpiry ? '1.2' : '1'}
                  strokeDasharray={isExpiry ? '4 3' : '2 3'}
                  opacity={isExpiry && !pathCompleted && !readOnly ? '0.7' : '0.6'}
                />
                <text
                  x={x}
                  y={H - 12}
                  textAnchor="middle"
                  fill={
                    isExpiry && !pathCompleted && !readOnly
                      ? 'var(--op-orange)'
                      : 'var(--op-ink-3)'
                  }
                  fontSize="10"
                  fontWeight={isExpiry ? '600' : '400'}
                  fontFamily="var(--font-mono)"
                >
                  {isExpiry
                    ? blindMode
                      ? `D+${horizonDays}`
                      : `D+${horizonDays} (${expiryDateShort})`
                    : `D+${d}`}
                </text>
              </g>
            );
          })}

          {/* D0 Split Label */}
          {pastBars.length > 0 && (
            <text
              x={splitX}
              y={H - 12}
              textAnchor="middle"
              fill="var(--op-ink)"
              fontSize="10"
              fontWeight="600"
              fontFamily="var(--font-mono)"
            >
              D0
            </text>
          )}

          {/* Subtle Past Volume Histogram + 20D Moving Average (Practice Intuition Cues) */}
          {maxPastVolume > 0 && (
            <g clipPath="url(#op-plot-clip)" pointerEvents="none">
              {pastBars.map((bar, idx) => {
                const vol = bar.volume ?? 0;
                if (vol <= 0) return null;
                const barH = Math.max(1, (vol / maxPastVolume) * (plotHeight * 0.16));
                const x = historyIdxToX(idx);
                const w = Math.max(1.5, Math.min(8, pastStepPx * 0.65));
                return (
                  <rect
                    key={`vol_${bar.date}_${idx}`}
                    x={x - w / 2}
                    y={plotBottom - barH}
                    width={w}
                    height={barH}
                    fill={bar.close >= bar.open ? 'var(--op-bull)' : 'var(--op-bear)'}
                    fillOpacity="0.16"
                  />
                );
              })}
            </g>
          )}

          {ma20PolylinePoints && (
            <g clipPath="url(#op-plot-clip)" pointerEvents="none">
              <polyline
                fill="none"
                stroke="var(--op-smart)"
                strokeWidth="1.1"
                strokeDasharray="3 3"
                opacity="0.52"
                points={ma20PolylinePoints}
              />
            </g>
          )}

          {/* 1. Past Price Series */}
          {chartStyle === 'line' ? (
            <g clipPath="url(#op-plot-clip)">
              {historyAreaPoints && (
                <polygon points={historyAreaPoints} fill="url(#op-hist-grad)" />
              )}
              <polyline
                fill="none"
                stroke="var(--op-ink)"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={historyPolylinePoints}
              />
            </g>
          ) : (
            <g clipPath="url(#op-plot-clip)">
              {pastBars.map((bar, idx) => {
                const x = historyIdxToX(idx);
                const isUp = bar.close >= bar.open;
                const color = isUp ? 'var(--op-bull)' : 'var(--op-bear)';
                const topY = priceToY(Math.max(bar.open, bar.close));
                const botY = priceToY(Math.min(bar.open, bar.close));
                return (
                  <g key={bar.date}>
                    <line
                      x1={x}
                      y1={priceToY(bar.high)}
                      x2={x}
                      y2={priceToY(bar.low)}
                      stroke={color}
                      strokeWidth="0.9"
                    />
                    <rect
                      x={x - syncedCandleWidth / 2}
                      y={topY}
                      width={syncedCandleWidth}
                      height={Math.max(1.5, botY - topY)}
                      fill={color}
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Conditional Magnetic Snap Level Line */}
          {snapState && (
            <g pointerEvents="none">
              <line
                x1={PAD_LEFT}
                y1={priceToY(snapState.price)}
                x2={plotRight}
                y2={priceToY(snapState.price)}
                stroke="var(--op-orange)"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.7"
              />
              <text
                x={plotRight - 6}
                y={Math.max(plotTop + 12, priceToY(snapState.price) - 5)}
                textAnchor="end"
                fill="var(--op-orange)"
                fontSize="9.5"
                fontFamily="var(--font-mono)"
              >
                {snapState.label} {formatAxisLevel(snapState.price)}
              </text>
            </g>
          )}

          {/* Past Hover Hairline */}
          {hoveredPastIdx !== null && pastBars[hoveredPastIdx] && (
            <g pointerEvents="none">
              <line
                x1={historyIdxToX(hoveredPastIdx)}
                y1={plotTop}
                x2={historyIdxToX(hoveredPastIdx)}
                y2={plotBottom}
                stroke="var(--op-ink-3)"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.45"
              />
              <circle
                cx={historyIdxToX(hoveredPastIdx)}
                cy={priceToY(pastBars[hoveredPastIdx].close)}
                r="3.2"
                fill="var(--op-ink)"
              />
            </g>
          )}

          {/* In-Chart Unlocked Crowd & Top-Tier Consensus Overlay */}
          {consensusGeom && (
            <g pointerEvents="none">
              <polygon
                points={consensusGeom.bandPolygon}
                fill="var(--op-smart)"
                fillOpacity="0.10"
              />
              <polyline
                fill="none"
                stroke="var(--op-crowd)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                points={consensusGeom.medianPts}
              />
              <polyline
                fill="none"
                stroke="var(--op-smart)"
                strokeWidth="2"
                strokeLinejoin="round"
                points={consensusGeom.top10Pts}
              />
              <circle
                cx={consensusGeom.lastTop10X}
                cy={consensusGeom.lastTop10Y}
                r="3.2"
                fill="var(--op-smart)"
              />
            </g>
          )}

          {/* Overlaid Rival Paths */}
          {overlaidRivals.map(rival => {
            const pathPts = rival.forecast.path || [];
            if (pathPts.length === 0) return null;
            const pts = [
              `${splitX.toFixed(1)},${priceToY(basePrice).toFixed(1)}`,
              ...pathPts.map((p, idx) => {
                const projected =
                  rival.forecast.basePrice > 0
                    ? basePrice * (1 + (p.price - rival.forecast.basePrice) / rival.forecast.basePrice)
                    : p.price;
                return `${dayToX(idx + 1).toFixed(1)},${priceToY(projected).toFixed(1)}`;
              }),
            ].join(' ');
            return (
              <polyline
                key={rival.forecast.id}
                pointerEvents="none"
                fill="none"
                stroke={rival.colorVar}
                strokeWidth="1.4"
                strokeDasharray="3 2"
                opacity="0.85"
                points={pts}
              />
            );
          })}

          {/* Initial Version (v1) Comparison Line */}
          {initialVersion && showInitialVersion && initialVersion.prices.length > 0 && (
            <polyline
              pointerEvents="none"
              fill="none"
              stroke="var(--op-ink-3)"
              strokeWidth="1.3"
              strokeDasharray="3 3"
              points={[
                `${splitX},${priceToY(basePrice).toFixed(1)}`,
                ...initialVersion.prices.map(
                  (p, idx) => `${dayToX(idx + 1).toFixed(1)},${priceToY(p).toFixed(1)}`
                ),
              ].join(' ')}
            />
          )}

          {/* Settled Future Actual Market Bars */}
          {settledFutureItems.length > 0 && (
            <g pointerEvents="none">
              {chartStyle === 'line' ? (
                <>
                  {actualFutureAreaPoints && (
                    <polygon
                      points={actualFutureAreaPoints}
                      fill="var(--op-bull)"
                      fillOpacity="0.06"
                    />
                  )}
                  <polyline
                    fill="none"
                    stroke="var(--op-bull)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={actualFuturePolyline}
                  />
                  {(() => {
                    const lastItem = settledFutureItems[settledFutureItems.length - 1];
                    return (
                      <circle
                        cx={lastItem.x}
                        cy={lastItem.y}
                        r="3.5"
                        fill="var(--op-bull)"
                        stroke="var(--op-canvas)"
                        strokeWidth="1.5"
                      />
                    );
                  })()}
                </>
              ) : (
                settledFutureItems.map(item => {
                  const { bar, x } = item;
                  const isUp = bar.close >= bar.open;
                  const color = isUp ? 'var(--op-bull)' : 'var(--op-bear)';
                  const topY = priceToY(Math.max(bar.open, bar.close));
                  const botY = priceToY(Math.min(bar.open, bar.close));
                  return (
                    <g key={`future_candle_${item.day}`}>
                      <line
                        x1={x}
                        y1={priceToY(bar.high)}
                        x2={x}
                        y2={priceToY(bar.low)}
                        stroke={color}
                        strokeWidth="1"
                      />
                      <rect
                        x={x - syncedCandleWidth / 2}
                        y={topY}
                        width={syncedCandleWidth}
                        height={Math.max(1.8, botY - topY)}
                        fill={color}
                      />
                    </g>
                  );
                })
              )}

              {settledFutureItems.length < horizonDays && (() => {
                const latest = settledFutureItems[settledFutureItems.length - 1];
                return (
                  <g>
                    <line
                      x1={latest.x}
                      y1={plotTop}
                      x2={latest.x}
                      y2={plotBottom}
                      stroke="var(--op-bull)"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                      opacity="0.7"
                    />
                    <text
                      x={latest.x}
                      y={plotTop + 12}
                      textAnchor="middle"
                      fill="var(--op-bull)"
                      fontSize="9.5"
                      fontWeight="600"
                      fontFamily="var(--font-mono)"
                    >
                      D+{latest.day}
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* Ghost Hover Preview Segment */}
          {ghostPolylineStr && (
            <polyline
              pointerEvents="none"
              fill="none"
              stroke="var(--op-orange)"
              strokeWidth="1.4"
              strokeDasharray="3 3"
              opacity="0.45"
              points={ghostPolylineStr}
            />
          )}

          {/* User Drawn Polyline & Gradient Fill */}
          {userAreaPolygonStr && (
            <polygon points={userAreaPolygonStr} fill="url(#op-orange-grad)" pointerEvents="none" />
          )}
          {userPolylineStr && (
            <polyline
              pointerEvents="none"
              fill="none"
              stroke="var(--op-orange)"
              strokeWidth={settledFutureItems.length > 0 && chartStyle === 'candles' ? '1.8' : '2.2'}
              strokeDasharray={
                settledFutureItems.length > 0 && chartStyle === 'candles' ? '4 2' : undefined
              }
              strokeLinecap="round"
              strokeLinejoin="round"
              points={userPolylineStr}
            />
          )}

          {/* Vertical Split Divider (D-0) */}
          <line
            x1={splitX}
            y1={plotTop}
            x2={splitX}
            y2={plotBottom}
            stroke="var(--op-chart-divider)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Base Anchor Point (D-0) */}
          <circle
            cx={splitX}
            cy={priceToY(basePrice)}
            r="4"
            fill="var(--op-ink)"
            stroke="var(--op-canvas)"
            strokeWidth="1.8"
          />

          {/* Right Axis Base Price Tag */}
          <g transform={`translate(${plotRight + 6}, ${priceToY(basePrice) - 9})`}>
            <rect
              x="0"
              y="0"
              width="92"
              height="18"
              rx="2"
              fill="var(--op-raised)"
              stroke="var(--op-line-strong)"
            />
            <text
              x="46"
              y="12.5"
              textAnchor="middle"
              fill="var(--op-ink)"
              fontSize="9.5"
              fontWeight="600"
              fontFamily="var(--font-mono)"
            >
              {blindMode ? '0.0%' : `$${Math.round(basePrice).toLocaleString('en-US')}`}
            </text>
          </g>

          {/* Hover Crosshair */}
          {!readOnly && hoveredDay !== null && hoverPrice !== null && (
            <g pointerEvents="none">
              <line
                x1={dayToX(hoveredDay)}
                y1={plotTop}
                x2={dayToX(hoveredDay)}
                y2={plotBottom}
                stroke="var(--op-ink-3)"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.45"
              />
              <line
                x1={splitX}
                y1={priceToY(hoverPrice)}
                x2={plotRight}
                y2={priceToY(hoverPrice)}
                stroke="var(--op-ink-3)"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.3"
              />
              {draggingIdx === null && hoveredAnchorIdx === null && (
                <circle
                  cx={dayToX(hoveredDay)}
                  cy={priceToY(hoverPrice)}
                  r="3.8"
                  fill="var(--op-canvas)"
                  stroke="var(--op-orange)"
                  strokeWidth="1.5"
                  opacity="0.8"
                />
              )}
            </g>
          )}

          {/* Interactive User Inflection Anchors (Max 5) */}
          {sortedAnchors.map((anchor, idx) => {
            const cx = dayToX(anchor.day);
            const cy = priceToY(anchor.price);
            const isEndpoint = anchor.day === horizonDays;
            const isSelected = selectedAnchorDay === anchor.day;
            const isActive = draggingIdx === idx || hoveredAnchorIdx === idx || isSelected;
            const pct = basePrice > 0 ? ((anchor.price - basePrice) / basePrice) * 100 : 0;

            return (
              <g
                key={anchor.day}
                tabIndex={readOnly ? undefined : 0}
                role={readOnly ? undefined : 'slider'}
                aria-label={t(
                  `D+${anchor.day} 예측 지점: ${formatAxisLevel(anchor.price)} (${formatPct(pct)})`,
                  `D+${anchor.day} anchor point: ${formatAxisLevel(anchor.price)} (${formatPct(pct)})`
                )}
                aria-valuenow={Math.round(anchor.price)}
                className={readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing focus:outline-none'}
                onFocus={() => setSelectedAnchorDay(anchor.day)}
                onKeyDown={e => handleAnchorKeyDown(idx, e)}
                onPointerDown={e => handlePointerDownAnchor(idx, e)}
                onPointerEnter={() => setHoveredAnchorIdx(idx)}
                onPointerLeave={() =>
                  setHoveredAnchorIdx(prev => (prev === idx ? null : prev))
                }
                onDoubleClick={e => handleRemoveAnchor(anchor.day, e)}
                onContextMenu={e => handleRemoveAnchor(anchor.day, e)}
              >
                <circle cx={cx} cy={cy} r="20" fill="transparent" />

                {isActive && !readOnly && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="11"
                    fill="var(--op-orange)"
                    fillOpacity="0.22"
                  />
                )}

                <circle
                  cx={cx}
                  cy={cy}
                  r={isActive || isEndpoint ? '5.5' : '4.8'}
                  fill={isEndpoint || isActive ? 'var(--op-orange)' : 'var(--op-canvas)'}
                  stroke="var(--op-orange)"
                  strokeWidth="2"
                />

                {(isActive || isEndpoint || lookbackDays <= 35) && draggingIdx !== idx && (
                  <text
                    x={Math.min(plotRight - 22, Math.max(splitX + 18, cx))}
                    y={cy - 10}
                    textAnchor="middle"
                    fill="var(--op-ink)"
                    fontSize="9.5"
                    fontWeight="600"
                    fontFamily="var(--font-mono)"
                  >
                    {formatPct(pct)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Right Axis Target Price Tag (only when completed) */}
          {finalUserPrice !== null && finalUserPct !== null && (
            <g transform={`translate(${plotRight + 6}, ${priceToY(finalUserPrice) - 10})`}>
              <rect
                x="0"
                y="0"
                width="92"
                height="20"
                rx="2"
                fill="var(--op-orange)"
              />
              <text
                x="46"
                y="13.5"
                textAnchor="middle"
                fill="var(--op-on-orange)"
                fontSize="9.5"
                fontWeight="700"
                fontFamily="var(--font-mono)"
              >
                {t('목표가', 'Target')} {formatPct(finalUserPct)}
              </text>
            </g>
          )}

          {/* Right Axis Settled Actual Tag */}
          {settledFutureItems.length > 0 && (() => {
            const lastSettled = settledFutureItems[settledFutureItems.length - 1];
            const settledPct =
              basePrice > 0 ? ((lastSettled.bar.close - basePrice) / basePrice) * 100 : 0;
            const targetY = finalUserPrice !== null ? priceToY(finalUserPrice) : -999;
            let actualTagY = lastSettled.y - 10;
            if (Math.abs(actualTagY - (targetY - 10)) < 22) {
              actualTagY = lastSettled.y > targetY ? targetY + 14 : targetY - 32;
            }
            return (
              <g transform={`translate(${plotRight + 6}, ${actualTagY})`}>
                <rect x="0" y="0" width="92" height="20" rx="2" fill="var(--op-bull)" />
                <text
                  x="46"
                  y="13.5"
                  textAnchor="middle"
                  fill="var(--op-on-orange)"
                  fontSize="9.5"
                  fontWeight="700"
                  fontFamily="var(--font-mono)"
                >
                  {t('실제 가격', 'Actual')} {formatPct(settledPct)}
                </text>
              </g>
            );
          })()}
        </svg>

        {/* Minimal 1-Line Empty Canvas Prompt */}
        {!readOnly && sortedAnchors.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-3">
            <span
              className="px-3 py-1.5 rounded-[2px] text-[11.5px]"
              style={{
                backgroundColor: 'var(--op-panel)',
                border: '1px solid var(--op-line-strong)',
                color: 'var(--op-ink-2)',
                boxShadow: 'var(--op-shadow-stack)',
              }}
            >
              {t(
                `D+1~D+${horizonDays} 클릭으로 예측 경로 그리기`,
                `Click D+1–D+${horizonDays} to draw forecast path`
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
