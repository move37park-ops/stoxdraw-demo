import React, { useRef, useState, useMemo } from 'react';
import { RotateCcw, Eye, EyeOff, Layers } from 'lucide-react';
import type { AnchorPoint, Forecast, ForecastVersion, MarketBar } from '../../domain/types';
import {
  interpolate20DayPath,
  normalizeAnchors,
  MAX_ANCHORS,
} from '../../domain/interpolation';
import { compute20DConsensusBand } from '../../domain/crowd';
import { formatPct } from '../../domain/format';

export interface OverlayRival {
  forecast: Forecast;
  authorHandle: string;
  authorElo: number;
  colorVar: string;
}

interface Polyline20DCanvasProps {
  mode: 'live' | 'practice';
  ticker?: string;
  baseDate: string;
  basePrice: number;
  evalDates: string[];          // 20일 날짜 배열
  historyBars: MarketBar[];     // 과거 6개월(180일) 일봉 배열
  actualFutureBars?: (MarketBar | null)[]; // 진행된 실제 일봉 (Live 추적 또는 Practice 정답 공개)
  scaleFutureBars?: MarketBar[]; // 애니메이션 중 Y축 흔들림 방지용 전체 미래 일봉 참조
  anchors: AnchorPoint[];
  onChangeAnchors: (next: AnchorPoint[]) => void;
  readOnly?: boolean;
  isConsensusUnlocked: boolean; // 내 예측 제출 여부 (Contribution-to-Unlock)
  allForecasts?: Forecast[];
  overlaidRivals?: OverlayRival[];
  onRemoveOverlay?: (forecastId: string) => void;
  initialVersion?: ForecastVersion | null; // 수정본(v2+) 작도 시 최초 제출본(v1) 비교용
  headerSubtitle?: string;
}

const LOOKBACK_OPTIONS: { days: 40 | 60 | 90; label: string }[] = [
  { days: 40, label: '40일' },
  { days: 60, label: '60일' },
  { days: 90, label: '90일' },
];

export function Polyline20DCanvas({
  mode,
  baseDate,
  basePrice,
  evalDates,
  historyBars,
  actualFutureBars = [],
  scaleFutureBars,
  anchors,
  onChangeAnchors,
  readOnly = false,
  isConsensusUnlocked,
  allForecasts = [],
  overlaidRivals = [],
  onRemoveOverlay,
  initialVersion = null,
}: Polyline20DCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoveredAnchorIdx, setHoveredAnchorIdx] = useState<number | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const [lookbackDays, setLookbackDays] = useState<40 | 60 | 90>(60);
  const [chartStyle, setChartStyle] = useState<'line' | 'candles'>('candles');
  const [showCrowdOverlay, setShowCrowdOverlay] = useState<boolean>(true);
  const [showTopForecasters, setShowTopForecasters] = useState<boolean>(true);
  const [showInitialVersion, setShowInitialVersion] = useState<boolean>(true);

  const horizonDays = evalDates.length || 20;
  const sortedAnchors = useMemo(
    () => normalizeAnchors(anchors, horizonDays, MAX_ANCHORS),
    [anchors, horizonDays]
  );

  // 20일 자동 선형 보간된 일봉 가격 배열
  const interpolatedPrices = useMemo(
    () => interpolate20DayPath(basePrice, sortedAnchors, horizonDays),
    [basePrice, sortedAnchors, horizonDays]
  );

  // Crowd Median 및 Top Forecasters 20일 시계열 집계
  const consensusBand = useMemo(
    () => compute20DConsensusBand(allForecasts, evalDates, basePrice),
    [allForecasts, evalDates, basePrice]
  );

  // 과거 일봉: D-lookbackDays 부터 D-0(기준일)까지 정확히 lookbackDays개의 일간 스텝을 갖도록 (lookbackDays + 1)봉 슬라이스
  const pastBars = useMemo(
    () => historyBars.slice(-(lookbackDays + 1)),
    [historyBars, lookbackDays]
  );

  // 과거 기간 최고가 / 최저가 산출 (지지·저항 참조용)
  const historyExtremes = useMemo(() => {
    if (pastBars.length === 0) return null;
    let maxBar = pastBars[0];
    let minBar = pastBars[0];
    let maxIdx = 0;
    let minIdx = 0;
    pastBars.forEach((b, i) => {
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
  }, [pastBars]);

  // Y축 가격 범위 산출
  const { minPrice, maxPrice } = useMemo(() => {
    const prices: number[] = [
      basePrice,
      basePrice * 1.07,
      basePrice * 0.93,
      ...interpolatedPrices,
    ];
    pastBars.forEach(b => {
      prices.push(b.high, b.low);
    });
    actualFutureBars.forEach(b => {
      if (b) prices.push(b.high, b.low, b.close);
    });
    scaleFutureBars?.forEach(b => {
      prices.push(b.high, b.low, b.close);
    });
    if (isConsensusUnlocked && showCrowdOverlay && consensusBand.length > 0) {
      consensusBand.forEach(c => prices.push(c.p15, c.p85, c.topForecasterMedian));
    }
    if (initialVersion && showInitialVersion) {
      initialVersion.prices.forEach(p => prices.push(p));
    }
    overlaidRivals.forEach(r => {
      r.forecast.path?.forEach(p => {
        if (r.forecast.basePrice > 0) {
          prices.push(
            basePrice * (1 + (p.price - r.forecast.basePrice) / r.forecast.basePrice)
          );
        }
      });
    });

    const rawMin = Math.min(...prices);
    const rawMax = Math.max(...prices);
    const span = Math.max(rawMax - rawMin, basePrice * 0.08);
    return {
      minPrice: rawMin - span * 0.12,
      maxPrice: rawMax + span * 0.12,
    };
  }, [
    basePrice,
    interpolatedPrices,
    pastBars,
    actualFutureBars,
    scaleFutureBars,
    isConsensusUnlocked,
    showCrowdOverlay,
    consensusBand,
    initialVersion,
    showInitialVersion,
    overlaidRivals,
  ]);

  // SVG 뷰포트 좌표계: 조회 기간(40일 / 60일 / 90일)과 미래 20일 구간의 1일 간격(stepPx) 및 캔들 폭을 1:1로 완전 동기화
  const W = 1060;
  const H = 440;
  const PAD_LEFT = 18;
  const PAD_RIGHT = 108;
  const PAD_TOP = 28;
  const PAD_BOTTOM = 38;
  const plotRight = W - PAD_RIGHT; // 952

  const pastIntervals = Math.max(1, pastBars.length - 1);
  const totalIntervals = pastIntervals + horizonDays;
  const plotStart = PAD_LEFT + 6; // 좌측 첫 캔들 반폭 여유
  const plotEnd = plotRight - 6;  // 우측 D+20 캔들 반폭 여유
  const plotTotalW = plotEnd - plotStart;
  const stepPx = plotTotalW / totalIntervals;
  const splitX = plotStart + pastIntervals * stepPx;
  const futureWidth = plotRight - splitX;
  const pastStepPx = stepPx;
  const futureStepPx = stepPx;

  const plotTop = PAD_TOP;
  const plotBottom = H - PAD_BOTTOM;
  const plotHeight = plotBottom - plotTop;

  const priceToY = (price: number): number => {
    const ratio = (price - minPrice) / Math.max(1e-6, maxPrice - minPrice);
    return plotBottom - Math.max(0, Math.min(1, ratio)) * plotHeight;
  };

  const yToPrice = (y: number): number => {
    const clampedY = Math.max(plotTop + 4, Math.min(plotBottom - 4, y));
    const ratio = (plotBottom - clampedY) / plotHeight;
    return parseFloat((minPrice + ratio * (maxPrice - minPrice)).toFixed(2));
  };

  const dayToX = (dayOffset: number): number => {
    return splitX + dayOffset * futureStepPx;
  };

  const xToDay = (x: number): number => {
    const offset = Math.round((x - splitX) / futureStepPx);
    return Math.max(1, Math.min(horizonDays, offset));
  };

  const historyIdxToX = (idx: number): number => {
    const offsetFromEnd = Math.max(0, pastBars.length - 1 - idx);
    return splitX - offsetFromEnd * pastStepPx;
  };

  const getSvgCoords = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const svgX = ((clientX - rect.left) / rect.width) * W;
    const svgY = ((clientY - rect.top) / rect.height) * H;
    return { svgX, svgY };
  };

  // 변곡점(idx)이 드래그 중 이동 가능한 유효 일자 범위 (인접 변곡점 교차 방지)
  const getValidDayBounds = (idx: number, list: AnchorPoint[]) => {
    const minDay = idx > 0 ? list[idx - 1].day + 1 : 1;
    const maxDay = idx < list.length - 1 ? list[idx + 1].day - 1 : horizonDays;
    return { minDay, maxDay };
  };

  // 기존 변곡점 직접 포인터 다운
  const handlePointerDownAnchor = (idx: number, e: React.PointerEvent) => {
    if (readOnly || e.button !== 0) return;
    e.stopPropagation();
    svgRef.current?.setPointerCapture?.(e.pointerId);
    setDraggingIdx(idx);
    setHoveredDay(sortedAnchors[idx]?.day ?? null);
    setHoverPrice(sortedAnchors[idx]?.price ?? null);
  };

  // 미래 영역 배경 포인터 다운: 클릭 즉시 점 생성 + 곧바로 드래그 연결 (최대 4개)
  const handleCanvasPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly || e.button !== 0) return;
    const coords = getSvgCoords(e.clientX, e.clientY);
    if (!coords) return;

    // 미래 작도 영역 밖이면 무시
    if (coords.svgX < splitX - 10 || coords.svgX > plotRight + 18) return;

    const targetDay = xToDay(coords.svgX);
    const targetPrice = yToPrice(coords.svgY);

    // 1. 기존 변곡점과 매우 가까운 위치(18px 이내 또는 동일 일자)를 누른 경우 해당 변곡점 즉시 그랩
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
      setHoveredDay(updated[hitIdx].day);
      setHoverPrice(targetPrice);
      return;
    }

    // 2. 변곡점이 4개 미만인 경우: 누른 위치에 즉시 새 변곡점 생성 후 바로 드래그 상태로 진입
    if (sortedAnchors.length < MAX_ANCHORS) {
      const next = [...sortedAnchors, { day: targetDay, price: targetPrice }].sort(
        (a, b) => a.day - b.day
      );
      const newIdx = next.findIndex(a => a.day === targetDay);
      onChangeAnchors(next);
      svgRef.current?.setPointerCapture?.(e.pointerId);
      setDraggingIdx(newIdx !== -1 ? newIdx : next.length - 1);
      setHoveredDay(targetDay);
      setHoverPrice(targetPrice);
      return;
    }

    // 3. 이미 최대 4개인 경우: 가장 가까운 변곡점을 부드럽게 끌어오며 즉시 드래그 시작
    let nearestIdx = 0;
    let bestDayDiff = Infinity;
    sortedAnchors.forEach((a, idx) => {
      const diff = Math.abs(a.day - targetDay);
      if (diff < bestDayDiff) {
        bestDayDiff = diff;
        nearestIdx = idx;
      }
    });

    const { minDay, maxDay } = getValidDayBounds(nearestIdx, sortedAnchors);
    const clampedDay = Math.max(minDay, Math.min(maxDay, targetDay));
    const updated = [...sortedAnchors];
    updated[nearestIdx] = { day: clampedDay, price: targetPrice };
    onChangeAnchors(updated);
    svgRef.current?.setPointerCapture?.(e.pointerId);
    setDraggingIdx(nearestIdx);
    setHoveredDay(clampedDay);
    setHoverPrice(targetPrice);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const coords = getSvgCoords(e.clientX, e.clientY);
    if (!coords) return;

    if (draggingIdx !== null && !readOnly) {
      const current = sortedAnchors[draggingIdx];
      if (!current) return;
      const { minDay, maxDay } = getValidDayBounds(draggingIdx, sortedAnchors);
      const nextDay = Math.max(minDay, Math.min(maxDay, xToDay(coords.svgX)));
      const nextPrice = yToPrice(coords.svgY);

      const next = [...sortedAnchors];
      next[draggingIdx] = { day: nextDay, price: nextPrice };
      onChangeAnchors(next);
      setHoveredDay(nextDay);
      setHoverPrice(nextPrice);
      return;
    }

    if (coords.svgX >= splitX - 10 && coords.svgX <= plotRight + 16) {
      setHoveredDay(xToDay(coords.svgX));
      setHoverPrice(yToPrice(coords.svgY));
    } else {
      setHoveredDay(null);
      setHoverPrice(null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingIdx !== null) {
      svgRef.current?.releasePointerCapture?.(e.pointerId);
      setDraggingIdx(null);
    }
  };

  const handleRemoveAnchor = (day: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (readOnly) return;
    if (sortedAnchors.length <= 1) return; // 최소 1개 변곡점 유지
    onChangeAnchors(sortedAnchors.filter(a => a.day !== day));
    setHoveredAnchorIdx(null);
  };

  // 과거 일봉 폴리라인 및 영역 문자열
  const historyPolylinePoints = useMemo(() => {
    return pastBars
      .map((bar, idx) => `${historyIdxToX(idx).toFixed(1)},${priceToY(bar.close).toFixed(1)}`)
      .join(' ');
  }, [pastBars, minPrice, maxPrice, splitX]);

  const historyAreaPoints = useMemo(() => {
    if (pastBars.length === 0) return '';
    const firstX = historyIdxToX(0).toFixed(1);
    const lastX = historyIdxToX(pastBars.length - 1).toFixed(1);
    return `${firstX},${plotBottom} ${historyPolylinePoints} ${lastX},${plotBottom}`;
  }, [pastBars, historyPolylinePoints, plotBottom, splitX]);

  // 과거 20일 이동평균선 (MA20) 좌표
  const ma20Points = useMemo(() => {
    if (pastBars.length < 15) return '';
    const pts: string[] = [];
    for (let i = 0; i < pastBars.length; i++) {
      const start = Math.max(0, i - 19);
      const slice = pastBars.slice(start, i + 1);
      const avg = slice.reduce((acc, b) => acc + b.close, 0) / slice.length;
      pts.push(`${historyIdxToX(i).toFixed(1)},${priceToY(avg).toFixed(1)}`);
    }
    return pts.join(' ');
  }, [pastBars, minPrice, maxPrice, splitX]);

  // 과거 구간 10일/20일 등간격 수직 가이드 및 날짜 라벨 (미래 20일 구간과 1:1 시간축 리듬 동기화)
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
    for (let offset = 10; offset <= lastIdx; offset += 10) {
      const idx = lastIdx - offset;
      const bar = pastBars[idx];
      if (!bar) continue;
      const x = historyIdxToX(idx);
      const isMajor = offset % 20 === 0 || offset === lastIdx;
      const showLabel =
        lookbackDays === 40
          ? offset % 10 === 0
          : lookbackDays === 60
          ? offset % 20 === 0
          : offset === 90 || (offset % 20 === 0 && offset !== 80);
      const mmdd = bar.date.slice(5).replace('-', '.');
      ticks.push({
        x,
        offset,
        label: `D-${offset} (${mmdd})`,
        isMajor,
        showLabel,
      });
    }
    return ticks;
  }, [pastBars, splitX, pastStepPx, lookbackDays]);

  // 유저 작도 20일 보간 폴리라인 좌표
  const userTrajectoryCoords = useMemo(() => {
    const pts = [{ x: splitX, y: priceToY(basePrice), day: 0, price: basePrice }];
    interpolatedPrices.forEach((p, idx) => {
      pts.push({
        x: dayToX(idx + 1),
        y: priceToY(p),
        day: idx + 1,
        price: p,
      });
    });
    return pts;
  }, [basePrice, interpolatedPrices, minPrice, maxPrice, splitX]);

  const userPolylineStr = useMemo(
    () => userTrajectoryCoords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    [userTrajectoryCoords]
  );

  // 호버 시 고스트 프리뷰 폴리라인 (변곡점 여유 슬롯이 있을 때 클릭 전 궤적 미리보기)
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

    const previewAnchors = normalizeAnchors(
      [...sortedAnchors, { day: hoveredDay, price: hoverPrice }],
      horizonDays,
      MAX_ANCHORS
    );
    const previewPrices = interpolate20DayPath(basePrice, previewAnchors, horizonDays);
    const pts = [
      `${splitX},${priceToY(basePrice).toFixed(1)}`,
      ...previewPrices.map(
        (p, idx) => `${dayToX(idx + 1).toFixed(1)},${priceToY(p).toFixed(1)}`
      ),
    ];
    return pts.join(' ');
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
  ]);

  // Crowd Median & Band SVG Paths
  const crowdSvg = useMemo(() => {
    if (!isConsensusUnlocked || consensusBand.length === 0) return null;
    const anchorY = priceToY(basePrice);

    const outerUpper = [
      `${splitX},${anchorY.toFixed(1)}`,
      ...consensusBand.map(c => `${dayToX(c.day).toFixed(1)},${priceToY(c.p85).toFixed(1)}`),
    ];
    const outerLower = [
      ...consensusBand
        .slice()
        .reverse()
        .map(c => `${dayToX(c.day).toFixed(1)},${priceToY(c.p15).toFixed(1)}`),
      `${splitX},${anchorY.toFixed(1)}`,
    ];

    const innerUpper = [
      `${splitX},${anchorY.toFixed(1)}`,
      ...consensusBand.map(c => `${dayToX(c.day).toFixed(1)},${priceToY(c.p75).toFixed(1)}`),
    ];
    const innerLower = [
      ...consensusBand
        .slice()
        .reverse()
        .map(c => `${dayToX(c.day).toFixed(1)},${priceToY(c.p25).toFixed(1)}`),
      `${splitX},${anchorY.toFixed(1)}`,
    ];

    const medianLine = [
      `${splitX},${anchorY.toFixed(1)}`,
      ...consensusBand.map(c => `${dayToX(c.day).toFixed(1)},${priceToY(c.median).toFixed(1)}`),
    ].join(' ');

    const topForecasterLine = [
      `${splitX},${anchorY.toFixed(1)}`,
      ...consensusBand.map(
        c => `${dayToX(c.day).toFixed(1)},${priceToY(c.topForecasterMedian).toFixed(1)}`
      ),
    ].join(' ');

    const lastPoint = consensusBand[consensusBand.length - 1];

    return {
      outerPolygon: [...outerUpper, ...outerLower].join(' '),
      innerPolygon: [...innerUpper, ...innerLower].join(' '),
      medianLine,
      topForecasterLine,
      lastMedianPrice: lastPoint.median,
      lastTopPrice: lastPoint.topForecasterMedian,
    };
  }, [isConsensusUnlocked, consensusBand, basePrice, minPrice, maxPrice, splitX]);

  // 실제 진행된 미래 일봉 데이터 (Live 경과 시뮬레이션 또는 Practice 정답 공개)
  const settledFutureItems = useMemo(() => {
    const items: {
      x: number;
      y: number;
      day: number;
      bar: MarketBar;
    }[] = [];
    actualFutureBars.forEach((bar, idx) => {
      if (bar) {
        items.push({
          x: dayToX(idx + 1),
          y: priceToY(bar.close),
          day: idx + 1,
          bar,
        });
      }
    });
    return items;
  }, [actualFutureBars, minPrice, maxPrice, splitX]);

  const actualFuturePolyline = useMemo(() => {
    if (settledFutureItems.length === 0) return '';
    return [
      `${splitX},${priceToY(basePrice).toFixed(1)}`,
      ...settledFutureItems.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    ].join(' ');
  }, [settledFutureItems, basePrice, minPrice, maxPrice, splitX]);

  const actualFutureAreaPoints = useMemo(() => {
    if (settledFutureItems.length === 0) return '';
    const lastX = settledFutureItems[settledFutureItems.length - 1].x.toFixed(1);
    return `${splitX},${plotBottom} ${actualFuturePolyline} ${lastX},${plotBottom}`;
  }, [settledFutureItems, actualFuturePolyline, plotBottom, splitX]);

  // Y축 눈금 (5단계)
  const yTicks = useMemo(() => {
    return [0.15, 0.32, 0.5, 0.68, 0.85].map(r => {
      const p = minPrice + r * (maxPrice - minPrice);
      const pct = basePrice > 0 ? ((p - basePrice) / basePrice) * 100 : 0;
      return {
        price: p,
        y: priceToY(p),
        pct,
      };
    });
  }, [minPrice, maxPrice, basePrice]);

  const finalUserPrice = interpolatedPrices[interpolatedPrices.length - 1] ?? basePrice;
  const finalUserPct = basePrice > 0 ? ((finalUserPrice - basePrice) / basePrice) * 100 : 0;

  // 과거 및 미래 일봉(캔들) 폭: 단일 stepPx 기반으로 과거와 미래 캔들 두께를 100% 동일하게 동기화
  const syncedCandleWidth = Math.max(4, Math.min(10.5, stepPx * 0.72));
  const pastCandleWidth = syncedCandleWidth;
  const futureCandleWidth = syncedCandleWidth;

  // 미래 구간 수직 가이드 일자 (5일/10일 단위 눈금 표시)
  const futureGuideDays = [5, 10, 15, 20];

  return (
    <div
      className="w-full relative select-none"
      style={{
        backgroundColor: 'var(--v-canvas)',
        borderBottom: '1px solid var(--v-hairline)',
      }}
    >
      {/* Top Canvas Toolbar: Lookback Period, Presets & Layer Toggles */}
      <div
        className="px-4 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2.5"
        style={{
          backgroundColor: 'var(--v-canvas-soft)',
          borderBottom: '1px solid var(--v-hairline)',
        }}
      >
        {/* Left: Lookback Period Selector (6M / 3M / 1M) & Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-[4px] p-0.5"
            style={{
              backgroundColor: 'var(--v-canvas)',
              boxShadow: 'var(--v-shadow-border)',
            }}
          >
            {LOOKBACK_OPTIONS.map(opt => {
              const active = lookbackDays === opt.days;
              return (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setLookbackDays(opt.days)}
                  className="px-2 py-0.5 text-xs v-mono rounded-[3px] transition-colors"
                  style={{
                    backgroundColor: active ? 'var(--v-primary)' : 'transparent',
                    color: active ? 'var(--v-on-primary)' : 'var(--v-mute)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={() =>
                onChangeAnchors([{ day: horizonDays, price: basePrice }])
              }
              className="v-btn-secondary h-6 px-2.5 text-xs inline-flex items-center gap-1"
              title="작도 초기화 (수평선)"
            >
              <RotateCcw size={11} />
              초기화
            </button>
          )}
        </div>

        {/* Right: Consensus Overlays & Chart Style (라인 / 캔들) */}
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'live' && isConsensusUnlocked && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowCrowdOverlay(p => !p)}
                className="v-btn-secondary h-6 px-2 text-[11px]"
                style={{ opacity: showCrowdOverlay ? 1 : 0.45 }}
              >
                {showCrowdOverlay ? <Eye size={11} /> : <EyeOff size={11} />}
                군집 중앙값
              </button>
              <button
                type="button"
                onClick={() => setShowTopForecasters(p => !p)}
                className="v-btn-secondary h-6 px-2 text-[11px]"
                style={{ opacity: showTopForecasters ? 1 : 0.45 }}
              >
                {showTopForecasters ? <Eye size={11} /> : <EyeOff size={11} />}
                상위 예측자
              </button>
            </div>
          )}

          {initialVersion && (
            <button
              type="button"
              onClick={() => setShowInitialVersion(p => !p)}
              className="v-btn-secondary h-6 px-2 text-[11px]"
              style={{ opacity: showInitialVersion ? 1 : 0.45 }}
            >
              <Layers size={11} />
              최초본(v1)
            </button>
          )}

          {/* Line / Candle Toggle */}
          <div
            className="inline-flex rounded-[4px] p-0.5"
            style={{
              backgroundColor: 'var(--v-canvas)',
              boxShadow: 'var(--v-shadow-border)',
            }}
          >
            <button
              type="button"
              onClick={() => setChartStyle('line')}
              className="px-2 py-0.5 text-xs v-mono rounded-[3px]"
              style={{
                backgroundColor:
                  chartStyle === 'line' ? 'var(--v-primary)' : 'transparent',
                color:
                  chartStyle === 'line'
                    ? 'var(--v-on-primary)'
                    : 'var(--v-mute)',
              }}
            >
              라인
            </button>
            <button
              type="button"
              onClick={() => setChartStyle('candles')}
              className="px-2 py-0.5 text-xs v-mono rounded-[3px]"
              style={{
                backgroundColor:
                  chartStyle === 'candles' ? 'var(--v-primary)' : 'transparent',
                color:
                  chartStyle === 'candles'
                    ? 'var(--v-on-primary)'
                    : 'var(--v-mute)',
              }}
            >
              캔들
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive SVG Canvas */}
      <div className="relative w-full overflow-hidden chart-container-reserved">
        <svg
          ref={svgRef}
          role="region"
          aria-label="BTC/USDT 20일 시계열 인터랙티브 예측 차트"
          viewBox={`0 0 ${W} ${H}`}
          className={`w-full h-[370px] sm:h-[440px] block touch-none ${
            readOnly
              ? 'cursor-default'
              : draggingIdx !== null
              ? 'cursor-grabbing'
              : 'cursor-crosshair'
          }`}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={e => {
            if (draggingIdx === null) {
              setHoveredDay(null);
              setHoverPrice(null);
            } else {
              handlePointerUp(e);
            }
          }}
        >
          {/* Future 20D Subtle Tinted Zone */}
          <rect
            x={splitX}
            y={plotTop}
            width={futureWidth}
            height={plotHeight}
            fill="var(--v-canvas-soft)"
            fillOpacity="0.55"
          />

          {/* Horizontal Y-Axis Grid Lines */}
          {yTicks.map((t, idx) => (
            <g key={idx}>
              <line
                x1={PAD_LEFT}
                y1={t.y}
                x2={plotRight}
                y2={t.y}
                stroke="var(--v-chart-grid)"
                strokeWidth="1"
              />
              <text
                x={plotRight + 8}
                y={t.y + 3}
                fill="var(--v-mute)"
                fontSize="10"
                fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
              >
                ${t.price.toLocaleString('en-US', { maximumFractionDigits: 0 })} (
                {t.pct >= 0 ? `+${t.pct.toFixed(1)}%` : `${t.pct.toFixed(1)}%`})
              </text>
            </g>
          ))}

          {/* Base Price Horizontal Reference Line */}
          <line
            x1={PAD_LEFT}
            y1={priceToY(basePrice)}
            x2={plotRight}
            y2={priceToY(basePrice)}
            stroke="var(--v-hairline-strong)"
            strokeWidth="1"
            strokeDasharray="2 4"
            opacity="0.6"
          />

          {/* Historical 10D / 20D Synchronized Day Guides */}
          {historyDayTicks.map(t => (
            <g key={t.offset}>
              <line
                x1={t.x}
                y1={plotTop}
                x2={t.x}
                y2={plotBottom}
                stroke="var(--v-chart-grid)"
                strokeWidth="1"
                strokeDasharray="2 3"
                opacity={t.isMajor ? '0.8' : '0.4'}
              />
              {t.showLabel && (
                <text
                  x={Math.max(PAD_LEFT + 34, t.x)}
                  y={H - 12}
                  textAnchor="middle"
                  fill="var(--v-mute)"
                  fontSize="10"
                  fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
                >
                  {t.label}
                </text>
              )}
            </g>
          ))}

          {/* Vertical Day Guides in Future Zone */}
          {futureGuideDays.map(d => {
            if (d > horizonDays) return null;
            const x = dayToX(d);
            const isMajor = d % 10 === 0;
            const showLabel = lookbackDays === 90 ? isMajor : true;
            return (
              <g key={d}>
                <line
                  x1={x}
                  y1={plotTop}
                  x2={x}
                  y2={plotBottom}
                  stroke="var(--v-chart-grid)"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                  opacity={isMajor ? '0.8' : '0.4'}
                />
                {showLabel && (
                  <text
                    x={x}
                    y={H - 12}
                    textAnchor="middle"
                    fill="var(--v-mute)"
                    fontSize="10"
                    fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
                  >
                    D+{d}
                  </text>
                )}
              </g>
            );
          })}

          {/* Split D-0 Date Label */}
          {pastBars.length > 0 && (
            <text
              x={splitX}
              y={H - 12}
              textAnchor="middle"
              fill="var(--v-ink)"
              fontSize="10"
              fontWeight="600"
              fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
            >
              D-0 ({baseDate.slice(5).replace('-', '.')})
            </text>
          )}

          {/* 1. Past 6M/3M/1M Daily Chart (Line + MA20 or Candles) */}
          {ma20Points && (
            <polyline
              fill="none"
              stroke="var(--v-mute)"
              strokeWidth="1.1"
              strokeDasharray="3 3"
              opacity="0.45"
              points={ma20Points}
            />
          )}

          {chartStyle === 'line' ? (
            <g>
              {historyAreaPoints && (
                <polygon
                  points={historyAreaPoints}
                  fill="var(--v-ink)"
                  fillOpacity="0.035"
                />
              )}
              <polyline
                fill="none"
                stroke="var(--v-ink)"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={historyPolylinePoints}
              />
            </g>
          ) : (
            pastBars.map((bar, idx) => {
              const x = historyIdxToX(idx);
              const isUp = bar.close >= bar.open;
              const color = isUp ? 'var(--v-bull)' : 'var(--v-bear)';
              const topY = priceToY(Math.max(bar.open, bar.close));
              const botY = priceToY(Math.min(bar.open, bar.close));
              const bodyH = Math.max(1.5, botY - topY);
              return (
                <g key={bar.date}>
                  <line
                    x1={x}
                    y1={priceToY(bar.high)}
                    x2={x}
                    y2={priceToY(bar.low)}
                    stroke={color}
                    strokeWidth="0.9"
                    opacity="0.85"
                  />
                  <rect
                    x={x - pastCandleWidth / 2}
                    y={topY}
                    width={pastCandleWidth}
                    height={bodyH}
                    fill={color}
                    rx="0.5"
                  />
                </g>
              );
            })
          )}

          {/* 6M High / Low Subtle Reference Tags on Past Chart */}
          {historyExtremes && (
            <g pointerEvents="none">
              <circle
                cx={historyIdxToX(historyExtremes.maxIdx)}
                cy={priceToY(
                  chartStyle === 'candles'
                    ? historyExtremes.maxBar.high
                    : historyExtremes.maxBar.close
                )}
                r="2.5"
                fill="var(--v-mute)"
              />
              <text
                x={Math.min(
                  splitX - 45,
                  Math.max(PAD_LEFT + 35, historyIdxToX(historyExtremes.maxIdx))
                )}
                y={
                  priceToY(
                    chartStyle === 'candles'
                      ? historyExtremes.maxBar.high
                      : historyExtremes.maxBar.close
                  ) - 6
                }
                textAnchor="middle"
                fill="var(--v-mute)"
                fontSize="9.5"
                fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
              >
                최고 ${Math.round(historyExtremes.maxBar.high).toLocaleString('en-US')}
              </text>

              <circle
                cx={historyIdxToX(historyExtremes.minIdx)}
                cy={priceToY(
                  chartStyle === 'candles'
                    ? historyExtremes.minBar.low
                    : historyExtremes.minBar.close
                )}
                r="2.5"
                fill="var(--v-mute)"
              />
              <text
                x={Math.min(
                  splitX - 45,
                  Math.max(PAD_LEFT + 35, historyIdxToX(historyExtremes.minIdx))
                )}
                y={
                  priceToY(
                    chartStyle === 'candles'
                      ? historyExtremes.minBar.low
                      : historyExtremes.minBar.close
                  ) + 13
                }
                textAnchor="middle"
                fill="var(--v-mute)"
                fontSize="9.5"
                fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
              >
                최저 ${Math.round(historyExtremes.minBar.low).toLocaleString('en-US')}
              </text>
            </g>
          )}

          {/* 2. Unlocked Crowd Consensus Band & Top Forecasters */}
          {isConsensusUnlocked && crowdSvg && showCrowdOverlay && (
            <g pointerEvents="none">
              <polygon
                points={crowdSvg.outerPolygon}
                fill="var(--v-ink)"
                fillOpacity="0.04"
              />
              <polygon
                points={crowdSvg.innerPolygon}
                fill="var(--v-ink)"
                fillOpacity="0.08"
              />
              <polyline
                fill="none"
                stroke="var(--v-mute)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                points={crowdSvg.medianLine}
              />
            </g>
          )}

          {isConsensusUnlocked && crowdSvg && showTopForecasters && (
            <g pointerEvents="none">
              <polyline
                fill="none"
                stroke="var(--v-bull)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                points={crowdSvg.topForecasterLine}
              />
              <circle
                cx={dayToX(horizonDays)}
                cy={priceToY(crowdSvg.lastTopPrice)}
                r="2.8"
                fill="var(--v-bull)"
              />
            </g>
          )}

          {/* Unlocked End-of-Horizon Price Tags: 대중 중앙값 & 상위 10% 엘리트 핀 라벨 */}
          {isConsensusUnlocked && crowdSvg && (
            <g pointerEvents="none">
              {showCrowdOverlay && (() => {
                const my = priceToY(crowdSvg.lastMedianPrice);
                const mPct = ((crowdSvg.lastMedianPrice - basePrice) / basePrice) * 100;
                return (
                  <g transform={`translate(${plotRight - 132}, ${my - 10})`}>
                    <rect
                      x="0"
                      y="0"
                      width="126"
                      height="20"
                      rx="3.5"
                      fill="var(--v-canvas-soft)"
                      fillOpacity="0.92"
                      stroke="var(--v-hairline-strong)"
                    />
                    <text
                      x="63"
                      y="13.5"
                      textAnchor="middle"
                      fill="var(--v-mute)"
                      fontSize="9.5"
                      fontWeight="600"
                      fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
                    >
                      대중 ${Math.round(crowdSvg.lastMedianPrice).toLocaleString('en-US')} ({formatPct(mPct)})
                    </text>
                  </g>
                );
              })()}
              {showTopForecasters && (() => {
                const ty = priceToY(crowdSvg.lastTopPrice);
                const my = priceToY(crowdSvg.lastMedianPrice);
                const tPct = ((crowdSvg.lastTopPrice - basePrice) / basePrice) * 100;
                let topTagY = ty - 10;
                if (showCrowdOverlay && Math.abs(topTagY - (my - 10)) < 22) {
                  topTagY = ty > my ? my + 12 : my - 22;
                }
                return (
                  <g transform={`translate(${plotRight - 132}, ${topTagY})`}>
                    <rect
                      x="0"
                      y="0"
                      width="126"
                      height="20"
                      rx="3.5"
                      fill="var(--v-canvas-soft)"
                      fillOpacity="0.92"
                      stroke="var(--v-bull)"
                    />
                    <text
                      x="63"
                      y="13.5"
                      textAnchor="middle"
                      fill="var(--v-bull)"
                      fontSize="9.5"
                      fontWeight="600"
                      fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
                    >
                      상위 10% ${Math.round(crowdSvg.lastTopPrice).toLocaleString('en-US')} ({formatPct(tPct)})
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* 3. Initial Version (v1) Comparison Line */}
          {initialVersion && showInitialVersion && initialVersion.prices.length > 0 && (
            <polyline
              pointerEvents="none"
              fill="none"
              stroke="var(--v-mute)"
              strokeWidth="1.4"
              strokeDasharray="3 3"
              points={[
                `${splitX},${priceToY(basePrice).toFixed(1)}`,
                ...initialVersion.prices.map(
                  (p, idx) => `${dayToX(idx + 1).toFixed(1)},${priceToY(p).toFixed(1)}`
                ),
              ].join(' ')}
            />
          )}

          {/* 4. Overlaid Peer / Rival Trajectories */}
          {isConsensusUnlocked &&
            overlaidRivals.map(rival => {
              const pts = rival.forecast.path || [];
              if (pts.length === 0 || rival.forecast.basePrice <= 0) return null;
              const lineStr = [
                `${splitX},${priceToY(basePrice).toFixed(1)}`,
                ...pts.map((pt, idx) => {
                  const projected =
                    basePrice *
                    (1 + (pt.price - rival.forecast.basePrice) / rival.forecast.basePrice);
                  return `${dayToX(idx + 1).toFixed(1)},${priceToY(projected).toFixed(1)}`;
                }),
              ].join(' ');
              return (
                <polyline
                  key={rival.forecast.id}
                  pointerEvents="none"
                  fill="none"
                  stroke={rival.colorVar}
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  points={lineStr}
                />
              );
            })}

          {/* 5. Actual Future Market Bars: 라인 모드면 라인 차트로, 캔들 모드면 일봉 캔들로 렌더링 */}
          {settledFutureItems.length > 0 && (
            <g pointerEvents="none">
              {chartStyle === 'line' ? (
                <>
                  {actualFutureAreaPoints && (
                    <polygon
                      points={actualFutureAreaPoints}
                      fill="var(--v-bull)"
                      fillOpacity="0.06"
                    />
                  )}
                  <polyline
                    fill="none"
                    stroke="var(--v-bull)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={actualFuturePolyline}
                  />
                  {/* 마지막 정산 시점에만 깔끔한 현재가 포인트 표시 */}
                  {(() => {
                    const lastItem = settledFutureItems[settledFutureItems.length - 1];
                    return (
                      <circle
                        cx={lastItem.x}
                        cy={lastItem.y}
                        r="3.5"
                        fill="var(--v-bull)"
                        stroke="var(--v-canvas)"
                        strokeWidth="1.5"
                      />
                    );
                  })()}
                </>
              ) : (
                settledFutureItems.map(item => {
                  const { bar, x } = item;
                  const isUp = bar.close >= bar.open;
                  const color = isUp ? 'var(--v-bull)' : 'var(--v-bear)';
                  const topY = priceToY(Math.max(bar.open, bar.close));
                  const botY = priceToY(Math.min(bar.open, bar.close));
                  const bodyH = Math.max(1.8, botY - topY);
                  return (
                    <g key={`future_candle_${item.day}`}>
                      <line
                        x1={x}
                        y1={priceToY(bar.high)}
                        x2={x}
                        y2={priceToY(bar.low)}
                        stroke={color}
                        strokeWidth="1"
                        opacity="0.95"
                      />
                      <rect
                        x={x - futureCandleWidth / 2}
                        y={topY}
                        width={futureCandleWidth}
                        height={bodyH}
                        fill={color}
                        rx="0.5"
                      />
                    </g>
                  );
                })
              )}

              {/* 리플레이 진행 중(D+1 ~ D+19)일 때 현재 진행 일자 플레이헤드 스캔라인 표시 */}
              {settledFutureItems.length < horizonDays && (() => {
                const latest = settledFutureItems[settledFutureItems.length - 1];
                return (
                  <g>
                    <line
                      x1={latest.x}
                      y1={plotTop}
                      x2={latest.x}
                      y2={plotBottom}
                      stroke="var(--v-bull)"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                      opacity="0.7"
                    />
                    <text
                      x={latest.x}
                      y={plotTop + 12}
                      textAnchor="middle"
                      fill="var(--v-bull)"
                      fontSize="9.5"
                      fontWeight="600"
                      fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
                    >
                      D+{latest.day}
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* Ghost Preview Polyline when hovering with < 4 points */}
          {ghostPolylineStr && (
            <polyline
              pointerEvents="none"
              fill="none"
              stroke="var(--v-primary)"
              strokeWidth="1.4"
              strokeDasharray="3 3"
              opacity="0.35"
              points={ghostPolylineStr}
            />
          )}

          {/* 6. User Drawn 20D Interpolated Polyline */}
          <polyline
            pointerEvents="none"
            fill="none"
            stroke="var(--v-primary)"
            strokeWidth={settledFutureItems.length > 0 && chartStyle === 'candles' ? '1.8' : '2.2'}
            strokeDasharray={
              settledFutureItems.length > 0 && chartStyle === 'candles' ? '4 2' : undefined
            }
            strokeLinecap="round"
            strokeLinejoin="round"
            points={userPolylineStr}
          />

          {/* Split Horizon Divider Line (D-0) */}
          <line
            x1={splitX}
            y1={plotTop}
            x2={splitX}
            y2={plotBottom}
            stroke="var(--v-chart-divider)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Base Anchor Point (D-0) */}
          <circle
            cx={splitX}
            cy={priceToY(basePrice)}
            r="4"
            fill="var(--v-ink)"
            stroke="var(--v-canvas)"
            strokeWidth="1.8"
          />

          {/* Hover Crosshair & Floating Coordinate Pill in Future Zone */}
          {!readOnly && hoveredDay !== null && hoverPrice !== null && (
            <g pointerEvents="none">
              <line
                x1={dayToX(hoveredDay)}
                y1={plotTop}
                x2={dayToX(hoveredDay)}
                y2={plotBottom}
                stroke="var(--v-mute)"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.45"
              />
              <line
                x1={splitX}
                y1={priceToY(hoverPrice)}
                x2={plotRight}
                y2={priceToY(hoverPrice)}
                stroke="var(--v-mute)"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.3"
              />
              {draggingIdx === null && hoveredAnchorIdx === null && (
                <circle
                  cx={dayToX(hoveredDay)}
                  cy={priceToY(hoverPrice)}
                  r="3.8"
                  fill="var(--v-canvas)"
                  stroke="var(--v-primary)"
                  strokeWidth="1.5"
                  opacity="0.75"
                />
              )}
              {/* Floating Readout Pill */}
              {(() => {
                const hx = dayToX(hoveredDay);
                const hy = priceToY(hoverPrice);
                const hpct =
                  basePrice > 0 ? ((hoverPrice - basePrice) / basePrice) * 100 : 0;
                const pillW = 132;
                const pillX = Math.min(
                  plotRight - pillW - 2,
                  Math.max(splitX - 24, hx - pillW / 2)
                );
                const pillY = hy < plotTop + 34 ? hy + 14 : hy - 30;
                return (
                  <g transform={`translate(${pillX}, ${pillY})`}>
                    <rect
                      x="0"
                      y="0"
                      width={pillW}
                      height="20"
                      rx="4"
                      fill="var(--v-ink)"
                      opacity="0.92"
                    />
                    <text
                      x={pillW / 2}
                      y="13.5"
                      textAnchor="middle"
                      fill="var(--v-canvas)"
                      fontSize="10"
                      fontWeight="600"
                      fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
                    >
                      D+{hoveredDay} · ${Math.round(hoverPrice).toLocaleString('en-US')} (
                      {formatPct(hpct)})
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* Interactive User Inflection Anchors (Max 4) */}
          {sortedAnchors.map((anchor, idx) => {
            const cx = dayToX(anchor.day);
            const cy = priceToY(anchor.price);
            const isLast = idx === sortedAnchors.length - 1;
            const isActive = draggingIdx === idx || hoveredAnchorIdx === idx;
            const pct =
              basePrice > 0 ? ((anchor.price - basePrice) / basePrice) * 100 : 0;

            return (
              <g
                key={anchor.day}
                className={readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}
                onPointerDown={e => handlePointerDownAnchor(idx, e)}
                onPointerEnter={() => setHoveredAnchorIdx(idx)}
                onPointerLeave={() =>
                  setHoveredAnchorIdx(prev => (prev === idx ? null : prev))
                }
                onDoubleClick={e => handleRemoveAnchor(anchor.day, e)}
                onContextMenu={e => handleRemoveAnchor(anchor.day, e)}
              >
                {/* Generous 18px Hit Area for Snappy Grabbing */}
                <circle cx={cx} cy={cy} r="18" fill="transparent" />

                {/* Active Halo Ring */}
                {isActive && !readOnly && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="10"
                    fill="var(--v-primary)"
                    fillOpacity="0.15"
                  />
                )}

                <circle
                  cx={cx}
                  cy={cy}
                  r={isActive ? '6.5' : '5.5'}
                  fill={isLast || isActive ? 'var(--v-primary)' : 'var(--v-canvas)'}
                  stroke="var(--v-primary)"
                  strokeWidth="2"
                />

                {(isActive || isLast || lookbackDays === 40) && draggingIdx !== idx && (
                  <text
                    x={Math.min(plotRight - 22, Math.max(splitX + 18, cx))}
                    y={cy - 10}
                    textAnchor="middle"
                    fill="var(--v-ink)"
                    fontSize="9.5"
                    fontWeight="600"
                    fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
                  >
                    {formatPct(pct)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Right Lane Final Target Tag */}
          <g transform={`translate(${plotRight + 6}, ${priceToY(finalUserPrice) - 10})`}>
            <rect
              x="0"
              y="0"
              width="96"
              height="20"
              rx="4"
              fill="var(--v-primary)"
            />
            <text
              x="48"
              y="13.5"
              textAnchor="middle"
              fill="var(--v-on-primary)"
              fontSize="10"
              fontWeight="600"
              fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
            >
              목표 {formatPct(finalUserPct)}
            </text>
          </g>

          {/* Right Lane Settled Actual Tag (When Settlement Simulation is Active) */}
          {settledFutureItems.length > 0 && (() => {
            const lastSettled = settledFutureItems[settledFutureItems.length - 1];
            const settledPct =
              basePrice > 0
                ? ((lastSettled.bar.close - basePrice) / basePrice) * 100
                : 0;
            const targetY = priceToY(finalUserPrice);
            let actualTagY = lastSettled.y - 10;
            if (Math.abs(actualTagY - (targetY - 10)) < 22) {
              actualTagY = lastSettled.y > targetY ? targetY + 14 : targetY - 32;
            }
            return (
              <g transform={`translate(${plotRight + 6}, ${actualTagY})`}>
                <rect
                  x="0"
                  y="0"
                  width="96"
                  height="20"
                  rx="4"
                  fill="var(--v-bull)"
                />
                <text
                  x="48"
                  y="13.5"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
                >
                  실제 {formatPct(settledPct)}
                </text>
              </g>
            );
          })()}

          {/* Corner Section Label */}
          <text
            x={PAD_LEFT + 6}
            y={plotTop + 14}
            fill="var(--v-mute)"
            fontSize="10"
            fontWeight="500"
            fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
          >
            과거 {lookbackDays}일 일봉 · 향후 {horizonDays}일 (1:1 등간격 동기화) · MA20
          </text>

          {/* 미제출 상태일 때 미래 20일 영역 상단 안내 배지 */}
          {!isConsensusUnlocked && mode === 'live' && (() => {
            const badgeW = Math.min(204, Math.max(148, futureWidth - 14));
            return (
              <g pointerEvents="none" transform={`translate(${splitX + futureWidth / 2}, ${plotTop + 14})`}>
                <rect
                  x={-badgeW / 2}
                  y="-10"
                  width={badgeW}
                  height="20"
                  rx="3.5"
                  fill="var(--v-canvas-soft-2)"
                  stroke="var(--v-hairline-strong)"
                />
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fill="var(--v-mute)"
                  fontSize="9.5"
                  fontWeight="500"
                  fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
                >
                  {lookbackDays === 90 ? '제출 시 집단·상위 예측 공개' : '제출 시 시장 중앙값·고수 예측 공개'}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Bottom Inflection Points Strip & Legend Bar */}
      <div
        className="px-4 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3"
        style={{
          backgroundColor: 'var(--v-canvas-soft)',
          borderTop: '1px solid var(--v-hairline)',
        }}
      >
        {/* Active Inflection Point Chips (Max 4) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="v-caption-mono text-[11px] px-1.5 py-0.5 rounded-[4px]"
            style={{
              backgroundColor: 'var(--v-canvas-soft-2)',
              color: 'var(--v-ink)',
            }}
          >
            변곡점 {sortedAnchors.length}/{MAX_ANCHORS}
          </span>
          {sortedAnchors.map(a => {
            const pct = basePrice > 0 ? ((a.price - basePrice) / basePrice) * 100 : 0;
            return (
              <span
                key={a.day}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] v-caption-mono text-[11px]"
                style={{
                  backgroundColor: 'var(--v-canvas)',
                  boxShadow: 'var(--v-shadow-border)',
                  color: 'var(--v-ink)',
                }}
              >
                <strong>D+{a.day}</strong>
                <span
                  style={{
                    color: pct >= 0 ? 'var(--v-bull)' : 'var(--v-bear)',
                  }}
                >
                  {formatPct(pct)}
                </span>
                {!readOnly && sortedAnchors.length > 1 && (
                  <button
                    type="button"
                    onClick={e => handleRemoveAnchor(a.day, e)}
                    className="hover:opacity-75 ml-0.5"
                    style={{ color: 'var(--v-mute)' }}
                    title="변곡점 삭제"
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>

        {/* Visual Legend */}
        <div className="flex flex-wrap items-center gap-4 v-caption text-[11px]" style={{ color: 'var(--v-mute)' }}>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: 'var(--v-primary)' }} />
            내 예측
          </span>
          {isConsensusUnlocked && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-3 h-0.5 inline-block"
                  style={{ backgroundColor: 'var(--v-mute)' }}
                />
                군집 중앙값
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: 'var(--v-bull)' }} />
                상위 예측자
              </span>
            </>
          )}
          {settledFutureItems.length > 0 && (
            <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--v-bull)' }}>
              <span className="w-3 h-1 inline-block rounded-full" style={{ backgroundColor: 'var(--v-bull)' }} />
              {chartStyle === 'candles' ? '실제 일봉(캔들)' : '실제 종가 라인'}
            </span>
          )}
          {overlaidRivals.map(r => (
            <span key={r.forecast.id} className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--v-mute)' }} />
              @{r.authorHandle}
              {onRemoveOverlay && (
                <button
                  type="button"
                  onClick={() => onRemoveOverlay(r.forecast.id)}
                  className="hover:opacity-75"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
