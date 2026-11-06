import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  ArrowRight,
  TrendingUp,
  Trophy,
  Zap,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { repository } from '../../data/localRepository';
import {
  BTC_TICKER,
  DEFAULT_BASE_DATE,
  getCurrentBtcPrice,
  getBtcHistoryBars,
} from '../../data/btcMarket';
import { getBtc20DRound } from '../../domain/round';
import { formatPct } from '../../domain/format';

interface LandingPageProps {
  currentDateStr: string;
}

// 데모 시연용 20일 실제 캔들 등락 시퀀스
const DEMO_FUTURE_RETURNS = [
  0.015, 0.021, -0.006, 0.018, 0.012,
  -0.019, -0.016, 0.004, 0.023, 0.019,
  0.011, -0.008, 0.021, 0.022, -0.005,
  0.009, -0.007, 0.015, 0.012, 0.008,
];

export function LandingPage({ currentDateStr }: LandingPageProps) {
  const navigate = useNavigate();

  const round = useMemo(
    () => getBtc20DRound(DEFAULT_BASE_DATE, currentDateStr),
    [currentDateStr]
  );
  const basePrice = getCurrentBtcPrice(round.baseDate);
  const liveCount = useMemo(() => {
    return repository
      .listFeed('all', currentDateStr)
      .filter(f => f.ticker === BTC_TICKER && f.baseDate === round.baseDate).length;
  }, [currentDateStr, round.baseDate]);

  // 좌측 과거 일봉 데이터 (41개: PAD_L(24px)부터 splitX(584px)까지 14px 등간격으로 빈틈없이 채움)
  const demoPastBars = useMemo(() => {
    const all = getBtcHistoryBars();
    return all.filter(b => b.date <= round.baseDate).slice(-41);
  }, [round.baseDate]);

  // 우측 미래 20일 실제 캔들 데이터
  const demoFutureBars = useMemo(() => {
    const list: { day: number; open: number; high: number; low: number; close: number }[] = [];
    let prev = basePrice;
    for (let i = 0; i < 20; i++) {
      const r = DEMO_FUTURE_RETURNS[i] ?? 0.005;
      const open = prev;
      const close = parseFloat((open * (1 + r)).toFixed(2));
      const high = Math.max(open, close) * 1.007;
      const low = Math.min(open, close) * 0.993;
      list.push({ day: i + 1, open, high, low, close });
      prev = close;
    }
    return list;
  }, [basePrice]);

  // =========================================================================
  // 60FPS requestAnimationFrame 무정지 루프 애니메이션 (총 5.4초 주기)
  // 0ms ~ 1800ms: 띡·띡·띡 3개 변곡점 작도 (D+5, D+11, D+20) & 파동 효과
  // 1800ms ~ 3100ms: 시장 집단 중앙값 밴드 부드러운 페이드인
  // 3100ms ~ 4500ms: 실제 20일 캔들 순차 생성 및 실시간 채점 카운트업
  // 4500ms ~ 5400ms: 완성된 94점 결과 안정적 유지 (Hold) 후 자연스러운 다음 순환
  // =========================================================================
  const [animElapsed, setAnimElapsed] = useState<number>(0);

  useEffect(() => {
    let animId: number;
    let startTime: number | null = null;
    const CYCLE_MS = 5400;

    const frame = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = (now - startTime) % CYCLE_MS;
      setAnimElapsed(elapsed);
      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, []);

  const phase: 0 | 1 | 2 = animElapsed < 1800 ? 0 : animElapsed < 3100 ? 1 : 2;

  // 데모 차트 뷰포트 좌표 (과거 40일 + 미래 20일 = 총 60일, 하루당 14px 정밀 1:1 일치)
  const W = 940;
  const H = 320;
  const PAD_L = 24;
  const PAD_R = 76;
  const PAD_T = 24;
  const PAD_B = 34;
  const stepX = 14;
  const splitX = PAD_L + 40 * stepX; // 584px (D-0 기준선)
  const plotRight = W - PAD_R; // 864px (splitX + 20 * stepX)
  const plotH = H - PAD_T - PAD_B; // 262px
  const futureW = plotRight - splitX; // 280px
  const CANDLE_WIDTH = 10.5; // 실제 트레이딩뷰 캔들 비율 (stepX 14px 중 10.5px 몸통, 3.5px 갭)

  const { minP, maxP } = useMemo(() => {
    const vals = [
      basePrice * 0.92,
      basePrice * 1.16,
      ...demoPastBars.map(b => b.high),
      ...demoPastBars.map(b => b.low),
    ];
    return {
      minP: Math.min(...vals) * 0.988,
      maxP: Math.max(...vals) * 1.012,
    };
  }, [basePrice, demoPastBars]);

  const priceToY = (p: number) => {
    const r = (p - minP) / Math.max(1, maxP - minP);
    return H - PAD_B - Math.max(0, Math.min(1, r)) * plotH;
  };

  // 과거 캔들: D-0 기준선(584px)에서 역산하여 과거 40개 캔들이 오차 없이 정확히 14px 등간격
  const pastIdxToX = (idx: number) =>
    splitX - (Math.max(1, demoPastBars.length) - 1 - idx) * stepX;

  // 미래 캔들: D-0 기준선(584px)에서 시작하여 정확히 14px 등간격 (D+1 = 598px, D+20 = 864px)
  const dayToX = (day: number) => splitX + day * stepX;

  // 사용자가 "띡·띡·띡" 찍는 3개 목표 변곡점 (시간: 500ms, 1100ms, 1700ms)
  const targetNodes = useMemo(
    () => [
      { day: 5, price: basePrice * 1.058, clickMs: 500 },
      { day: 11, price: basePrice * 1.022, clickMs: 1100 },
      { day: 20, price: basePrice * 1.124, clickMs: 1700 },
    ],
    [basePrice]
  );

  // 현재 경과 시간 기준으로 찍힌 변곡점 목록
  const placedNodes = useMemo(() => {
    if (phase > 0) return targetNodes;
    return targetNodes.filter(n => animElapsed >= n.clickMs);
  }, [phase, animElapsed, targetNodes]);

  // 가상 마우스 커서 위치 (Phase 0에서 D-0 -> 점1 -> 점2 -> 점3 부드러운 cubic bezier 이동)
  const cursorPos = useMemo(() => {
    const startPt = { x: splitX + 4, y: priceToY(basePrice) };
    const pt1 = { x: dayToX(targetNodes[0].day), y: priceToY(targetNodes[0].price) };
    const pt2 = { x: dayToX(targetNodes[1].day), y: priceToY(targetNodes[1].price) };
    const pt3 = { x: dayToX(targetNodes[2].day), y: priceToY(targetNodes[2].price) };

    const easeCubic = (t: number) => {
      const c = Math.max(0, Math.min(1, t));
      return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
    };

    if (animElapsed < 500) {
      const r = easeCubic(animElapsed / 500);
      return { x: startPt.x + (pt1.x - startPt.x) * r, y: startPt.y + (pt1.y - startPt.y) * r };
    }
    if (animElapsed < 1100) {
      const r = easeCubic((animElapsed - 500) / 600);
      return { x: pt1.x + (pt2.x - pt1.x) * r, y: pt1.y + (pt2.y - pt1.y) * r };
    }
    if (animElapsed < 1700) {
      const r = easeCubic((animElapsed - 1100) / 600);
      return { x: pt2.x + (pt3.x - pt2.x) * r, y: pt2.y + (pt3.y - pt2.y) * r };
    }
    return pt3;
  }, [animElapsed, splitX, basePrice, targetNodes, minP, maxP, stepX]);

  // 현재 그려진 내 예측 폴리라인
  const activeUserPolyline = useMemo(() => {
    const pts = [`${splitX},${priceToY(basePrice).toFixed(1)}`];
    placedNodes.forEach(n => {
      pts.push(`${dayToX(n.day).toFixed(1)},${priceToY(n.price).toFixed(1)}`);
    });
    // Phase 0에서 다음 점을 향해 이동 중일 때 커서까지 실시간 연결
    if (phase === 0 && placedNodes.length < 3) {
      pts.push(`${cursorPos.x.toFixed(1)},${cursorPos.y.toFixed(1)}`);
    }
    return pts.join(' ');
  }, [splitX, basePrice, placedNodes, phase, cursorPos, minP, maxP, stepX]);

  // 집단 데이터 페이드인 불투명도 (1800ms ~ 2300ms 동안 0 -> 1)
  const crowdOpacity = useMemo(() => {
    if (phase === 0) return 0;
    if (phase >= 2) return 1;
    return Math.min(1, Math.max(0, (animElapsed - 1800) / 500));
  }, [phase, animElapsed]);

  // 다른 참여자들의 개별 관점(얇은 궤적들) & 집단 중앙값 밴드
  const crowdOverlay = useMemo(() => {
    const upper: string[] = [`${splitX},${priceToY(basePrice).toFixed(1)}`];
    const lower: string[] = [];
    const median: string[] = [`${splitX},${priceToY(basePrice).toFixed(1)}`];
    const peerA: string[] = [`${splitX},${priceToY(basePrice).toFixed(1)}`];
    const peerB: string[] = [`${splitX},${priceToY(basePrice).toFixed(1)}`];
    const peerC: string[] = [`${splitX},${priceToY(basePrice).toFixed(1)}`];

    for (let d = 1; d <= 20; d++) {
      const x = dayToX(d).toFixed(1);
      const medP = basePrice * (1 + (d / 20) * 0.068 + Math.sin(d / 3) * 0.006);
      const spread = basePrice * (0.012 + (d / 20) * 0.044);

      const pA = basePrice * (1 + (d / 20) * 0.135 - Math.sin(d / 2.5) * 0.014);
      const pB = basePrice * (1 + (d / 20) * 0.032 + Math.cos(d / 3) * 0.012);
      const pC = basePrice * (1 - (d / 20) * 0.028 + Math.sin(d / 3.5) * 0.011);

      upper.push(`${x},${priceToY(medP + spread).toFixed(1)}`);
      lower.unshift(`${x},${priceToY(medP - spread).toFixed(1)}`);
      median.push(`${x},${priceToY(medP).toFixed(1)}`);
      peerA.push(`${x},${priceToY(pA).toFixed(1)}`);
      peerB.push(`${x},${priceToY(pB).toFixed(1)}`);
      peerC.push(`${x},${priceToY(pC).toFixed(1)}`);
    }

    return {
      polygon: [...upper, ...lower, `${splitX},${priceToY(basePrice).toFixed(1)}`].join(' '),
      median: median.join(' '),
      peers: [peerA.join(' '), peerB.join(' '), peerC.join(' ')],
    };
  }, [basePrice, minP, maxP, splitX, stepX]);

  // Phase 2에서 찍히는 실제 일봉 캔들 수 (3100ms ~ 4400ms 동안 1 ~ 20개 순차 등장, 4400ms 이후 20개 고정)
  const revealedCandles = useMemo(() => {
    if (phase < 2) return 0;
    if (animElapsed >= 4400) return 20;
    const progress = Math.max(0, Math.min(1, (animElapsed - 3100) / 1300));
    return Math.min(20, Math.max(1, Math.floor(progress * 20) + 1));
  }, [phase, animElapsed]);

  // 실시간 카운트업되는 정확도 점수 (62 -> 94점)
  const animatedScore = useMemo(() => {
    if (phase < 2) return 0;
    const progress = Math.min(1, revealedCandles / 20);
    return Math.round(62 + progress * 32);
  }, [phase, revealedCandles]);

  return (
    <div className="w-full relative">
      <span className="v-crosshair -top-[5px] -left-[6px]" aria-hidden="true" />
      <span className="v-crosshair -top-[5px] -right-[6px]" aria-hidden="true" />

      {/* =====================================================================
          1. HERO SECTION + Vercel Geist Continuous Canvas
          ===================================================================== */}
      <section
        className="w-full px-6 sm:px-12 pt-14 pb-14 sm:pt-20 sm:pb-16 flex flex-col items-center relative"
        style={{ borderBottom: '1px solid var(--v-hairline)' }}
      >
        <span className="v-crosshair -bottom-[6px] -left-[6px]" aria-hidden="true" />
        <span className="v-crosshair -bottom-[6px] -right-[6px]" aria-hidden="true" />

        {/* Main Headline */}
        <h1
          className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.16] text-center break-keep"
          style={{ color: 'var(--v-ink)' }}
        >
          20일 뒤 비트코인, 시장은 어디를 보고 있을까요?
        </h1>

        <p
          className="text-base sm:text-lg mt-4 max-w-3xl text-center leading-relaxed break-keep"
          style={{ color: 'var(--v-body)' }}
        >
          시장 참여자들의 20일 전망 궤적을 확인하고, 내 시나리오를 그려 정량 채점받으세요.
        </p>

        {/* Primary Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5 w-full max-w-md">
          <button
            type="button"
            onClick={() => navigate('/practice')}
            className="flex-1 v-btn-secondary h-11 sm:h-12 text-sm sm:text-base font-semibold"
          >
            <Play size={15} />
            연습 모드
          </button>

          <button
            type="button"
            onClick={() => navigate('/studio')}
            className="flex-1 v-btn-primary h-11 sm:h-12 text-sm sm:text-base font-semibold"
          >
            <TrendingUp size={15} />
            실전 모드
            <ArrowRight size={15} />
          </button>
        </div>

        {/* =================================================================
            PRODUCT SHOWCASE (Vercel Standard 1px Hairline Container)
            ================================================================= */}
        <div
          className="mt-10 w-full max-w-5xl rounded-[6px] overflow-hidden"
          style={{
            backgroundColor: 'var(--v-canvas)',
            border: '1px solid var(--v-hairline)',
            boxShadow: 'var(--v-shadow-border)',
          }}
        >
          {/* Minimal 3-Phase HUD Indicator Bar */}
          <div
            className="px-4 py-2.5 flex items-center justify-between gap-2"
            style={{
              backgroundColor: 'var(--v-canvas-soft)',
              borderBottom: '1px solid var(--v-hairline)',
            }}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              {[
                { id: 0, label: '1. 내 시나리오 작도' },
                { id: 1, label: '2. 집단 밴드 공개' },
                { id: 2, label: '3. 실제 캔들 채점' },
              ].map(item => {
                const active = phase === item.id;
                return (
                  <span
                    key={item.id}
                    className="px-2.5 py-1 rounded-[4px] v-caption-mono text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: active
                        ? 'var(--v-primary)'
                        : 'transparent',
                      color: active ? 'var(--v-on-primary)' : 'var(--v-mute)',
                    }}
                  >
                    {item.label}
                  </span>
                );
              })}
            </div>

            <span className="v-caption-mono text-xs hidden sm:inline" style={{ color: 'var(--v-mute)' }}>
              참여자 1,280명
            </span>
          </div>

          {/* Animated SVG Stage */}
          <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[250px] sm:h-[310px] block">
              {/* Future 20D Zone Shade */}
              <rect
                x={splitX}
                y={PAD_T}
                width={futureW}
                height={plotH}
                fill="var(--v-canvas-soft)"
                fillOpacity="0.55"
              />

              {/* Subtle Horizontal Grid */}
              {[0.2, 0.5, 0.8].map((r, i) => {
                const p = minP + r * (maxP - minP);
                const y = priceToY(p);
                const pct = ((p - basePrice) / basePrice) * 100;
                return (
                  <g key={i}>
                    <line
                      x1={PAD_L}
                      y1={y}
                      x2={plotRight}
                      y2={y}
                      stroke="var(--v-chart-grid)"
                      strokeWidth="1"
                    />
                    <text
                      x={plotRight + 8}
                      y={y + 3}
                      fill="var(--v-mute)"
                      fontSize="10"
                      fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
                    >
                      {formatPct(pct)}
                    </text>
                  </g>
                );
              })}

              {/* Base Price Reference Line */}
              <line
                x1={PAD_L}
                y1={priceToY(basePrice)}
                x2={plotRight}
                y2={priceToY(basePrice)}
                stroke="var(--v-hairline-strong)"
                strokeWidth="1"
                strokeDasharray="2 4"
              />

              {/* Synchronized 10D / 20D Vertical Time Grid Across Past & Future */}
              {[-30, -20, -10, 10, 20].map(offset => {
                const gx = splitX + offset * stepX;
                const isMajor = Math.abs(offset) % 20 === 0;
                return (
                  <line
                    key={offset}
                    x1={gx}
                    y1={PAD_T}
                    x2={gx}
                    y2={H - PAD_B}
                    stroke="var(--v-chart-grid)"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                    opacity={isMajor ? '0.8' : '0.4'}
                  />
                );
              })}

              {/* Past Daily Candlesticks (정확히 14px 등간격 일치) */}
              {demoPastBars.map((bar, idx) => {
                const x = pastIdxToX(idx);
                const isUp = bar.close >= bar.open;
                const color = isUp ? 'var(--v-bull)' : 'var(--v-bear)';
                const topY = priceToY(Math.max(bar.open, bar.close));
                const botY = priceToY(Math.min(bar.open, bar.close));
                const bodyH = Math.max(1.8, botY - topY);
                return (
                  <g key={bar.date}>
                    <line
                      x1={x}
                      y1={priceToY(bar.high)}
                      x2={x}
                      y2={priceToY(bar.low)}
                      stroke={color}
                      strokeWidth="1.1"
                      opacity="0.9"
                    />
                    <rect
                      x={x - CANDLE_WIDTH / 2}
                      y={topY}
                      width={CANDLE_WIDTH}
                      height={bodyH}
                      fill={color}
                      rx="0.5"
                    />
                  </g>
                );
              })}

              {/* PHASE 1 & 2: 다른 사람들의 예측선 + 집단 중앙값 밴드 (부드러운 페이드인) */}
              {phase >= 1 && (
                <g opacity={crowdOpacity} className="transition-opacity">
                  {/* Crowd Distribution Band */}
                  <polygon
                    points={crowdOverlay.polygon}
                    fill="var(--v-ink)"
                    fillOpacity="0.06"
                  />
                  {/* Individual Peer Perspectives */}
                  {crowdOverlay.peers.map((pts, i) => (
                    <polyline
                      key={i}
                      fill="none"
                      stroke="var(--v-mute)"
                      strokeWidth="1"
                      strokeDasharray="2 3"
                      opacity="0.45"
                      points={pts}
                    />
                  ))}
                  {/* Crowd Median Line */}
                  <polyline
                    fill="none"
                    stroke="var(--v-mute)"
                    strokeWidth="1.6"
                    strokeDasharray="5 3"
                    points={crowdOverlay.median}
                  />
                  {/* Crowd Tag on Chart */}
                  {phase === 1 && (
                    <g transform={`translate(${dayToX(11) - 64}, ${priceToY(basePrice * 1.045) + 12})`}>
                      <rect
                        x="0"
                        y="0"
                        width="136"
                        height="22"
                        rx="4"
                        fill="var(--v-canvas-soft-2)"
                        stroke="var(--v-hairline-strong)"
                      />
                      <text
                        x="68"
                        y="14.5"
                        textAnchor="middle"
                        fill="var(--v-ink)"
                        fontSize="10"
                        fontWeight="600"
                        fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
                      >
                        중앙값 +6.8%
                      </text>
                    </g>
                  )}
                </g>
              )}

              {/* PHASE 2: 실제 20일 일봉 캔들 순차 재생 (과거 캔들과 100% 동일한 14px 간격 & 폭) */}
              {phase === 2 &&
                demoFutureBars.slice(0, revealedCandles).map(bar => {
                  const x = dayToX(bar.day);
                  const isUp = bar.close >= bar.open;
                  const color = isUp ? 'var(--v-bull)' : 'var(--v-bear)';
                  const topY = priceToY(Math.max(bar.open, bar.close));
                  const botY = priceToY(Math.min(bar.open, bar.close));
                  const bodyH = Math.max(2.0, botY - topY);
                  return (
                    <g key={bar.day}>
                      <line
                        x1={x}
                        y1={priceToY(bar.high)}
                        x2={x}
                        y2={priceToY(bar.low)}
                        stroke={color}
                        strokeWidth="1.1"
                      />
                      <rect
                        x={x - CANDLE_WIDTH / 2}
                        y={topY}
                        width={CANDLE_WIDTH}
                        height={bodyH}
                        fill={color}
                        rx="0.5"
                      />
                    </g>
                  );
                })}

              {/* 내 예측 폴리라인 */}
              <polyline
                fill="none"
                stroke="var(--v-primary)"
                strokeWidth={phase === 2 ? '1.8' : '2.6'}
                strokeDasharray={phase === 2 ? '4 2' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={activeUserPolyline}
              />

              {/* D-0 기준선 & 시작점 */}
              <line
                x1={splitX}
                y1={PAD_T}
                x2={splitX}
                y2={H - PAD_B}
                stroke="var(--v-chart-divider)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={splitX}
                cy={priceToY(basePrice)}
                r="4"
                fill="var(--v-ink)"
                stroke="var(--v-canvas)"
                strokeWidth="1.5"
              />

              {/* "띡·띡·띡" 찍힌 변곡점 노드 & 클릭 파동(Ripple) 효과 */}
              {placedNodes.map((n, idx) => {
                const cx = dayToX(n.day);
                const cy = priceToY(n.price);
                const ageMs = animElapsed - n.clickMs;
                const showRipple = phase === 0 && ageMs >= 0 && ageMs <= 400;
                const pct = ((n.price - basePrice) / basePrice) * 100;

                return (
                  <g key={n.day}>
                    {showRipple && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={6 + (ageMs / 400) * 18}
                        fill="none"
                        stroke="var(--v-primary)"
                        strokeWidth="1.8"
                        opacity={Math.max(0, 1 - ageMs / 400)}
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r="5.5"
                      fill={idx === 2 ? 'var(--v-primary)' : 'var(--v-canvas)'}
                      stroke="var(--v-primary)"
                      strokeWidth="2.2"
                    />
                    <text
                      x={cx}
                      y={cy - 10}
                      textAnchor="middle"
                      fill="var(--v-ink)"
                      fontSize="10"
                      fontWeight="700"
                      fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
                    >
                      {formatPct(pct)}
                    </text>
                  </g>
                );
              })}

              {/* Phase 0: 가상 커서 포인터 */}
              {phase === 0 && (
                <g transform={`translate(${cursorPos.x}, ${cursorPos.y})`}>
                  <circle
                    cx="0"
                    cy="0"
                    r="9"
                    fill="var(--v-primary)"
                    fillOpacity="0.18"
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r="3.5"
                    fill="var(--v-primary)"
                  />
                </g>
              )}

              {/* Phase 2: 게이미피케이션 정확도 채점 & LP 보상 팝업 배지 */}
              {phase === 2 && (
                <g transform={`translate(${splitX + 24}, ${PAD_T + 10})`}>
                  <rect
                    x="0"
                    y="0"
                    width="226"
                    height="54"
                    rx="6"
                    fill="var(--v-canvas)"
                    stroke="var(--v-bull)"
                    strokeWidth="1.5"
                  />
                  <text
                    x="14"
                    y="21"
                    fill="var(--v-mute)"
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
                  >
                    정확도 (D+{revealedCandles}/20)
                  </text>
                  <text
                    x="14"
                    y="42"
                    fill="var(--v-ink)"
                    fontSize="18"
                    fontWeight="800"
                    fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
                  >
                    {animatedScore}점
                  </text>
                  <rect
                    x="72"
                    y="27"
                    width="140"
                    height="19"
                    rx="4"
                    fill="var(--v-bull-soft)"
                  />
                  <text
                    x="142"
                    y="40"
                    textAnchor="middle"
                    fill="var(--v-bull)"
                    fontSize="10.5"
                    fontWeight="700"
                    fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
                  >
                    S등급 · +32 LP
                  </text>
                </g>
              )}

              {/* 하단 시간축 라벨 (20일 단위 1:1 등간격 동기화) */}
              <text
                x={PAD_L + 12}
                y={H - 10}
                textAnchor="middle"
                fill="var(--v-mute)"
                fontSize="10"
                fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
              >
                D-40
              </text>
              <text
                x={splitX - 20 * stepX}
                y={H - 10}
                textAnchor="middle"
                fill="var(--v-mute)"
                fontSize="10"
                fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
              >
                D-20
              </text>
              <text
                x={splitX}
                y={H - 10}
                textAnchor="middle"
                fill="var(--v-ink)"
                fontSize="10"
                fontWeight="600"
                fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
              >
                오늘 (D-0)
              </text>
              <text
                x={dayToX(10)}
                y={H - 10}
                textAnchor="middle"
                fill="var(--v-mute)"
                fontSize="10"
                fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
              >
                D+10
              </text>
              <text
                x={dayToX(20)}
                y={H - 10}
                textAnchor="middle"
                fill="var(--v-mute)"
                fontSize="10"
                fontFamily="'Pretendard Variable', 'Pretendard', sans-serif"
              >
                D+20
              </text>
            </svg>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. 2-MODE GAME SELECTOR: 연습 모드 vs 실전 모드 (LARGE & SPACIOUS)
          ===================================================================== */}
      <section className="relative" style={{ borderBottom: '1px solid var(--v-hairline)' }}>
        <span className="v-crosshair -bottom-[6px] -left-[6px]" aria-hidden="true" />
        <span className="v-crosshair -bottom-[6px] -right-[6px]" aria-hidden="true" />

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--v-hairline)]">
          {/* LEFT: Practice Mode */}
          <div
            onClick={() => navigate('/practice')}
            className="p-8 sm:p-12 lg:p-14 flex flex-col justify-between group cursor-pointer transition-colors min-h-[340px]"
            style={{ backgroundColor: 'var(--v-canvas)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--v-canvas-soft)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--v-canvas)')}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: 'var(--v-mute)' }}>
                  과거 차트 리플레이
                </span>
                <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--v-bull)' }}>
                  <Zap size={15} />
                  1초 즉시 채점
                </span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight mt-4" style={{ color: 'var(--v-ink)' }}>
                연습 모드
              </h2>
              <p className="text-base sm:text-lg mt-3 leading-relaxed max-w-md" style={{ color: 'var(--v-body)' }}>
                2024년 주요 변곡점 차트에서 점수와 티어 부담 없이 시나리오를 그리고 즉시 결과를 확인합니다.
              </p>
            </div>

            <div className="mt-10 pt-6 border-t border-[var(--v-hairline)] flex items-center justify-between">
              <span className="v-mono text-sm font-medium" style={{ color: 'var(--v-mute)' }}>
                4개 핵심 구간 · 무제한 연습
              </span>
              <button
                type="button"
                className="v-btn-secondary h-11 px-5 text-sm font-semibold"
              >
                연습 모드 시작
                <ArrowRight size={15} />
              </button>
            </div>
          </div>

          {/* RIGHT: Live Mode */}
          <div
            onClick={() => navigate('/studio')}
            className="p-8 sm:p-12 lg:p-14 flex flex-col justify-between group cursor-pointer transition-colors min-h-[340px]"
            style={{ backgroundColor: 'var(--v-canvas)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--v-canvas-soft)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--v-canvas)')}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: 'var(--v-mute)' }}>
                  실시간 20일 라운드
                </span>
                <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--v-ink)' }}>
                  <Users size={15} />
                  {liveCount}명 참여 중
                </span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight mt-4" style={{ color: 'var(--v-ink)' }}>
                실전 모드
              </h2>
              <p className="text-base sm:text-lg mt-3 leading-relaxed max-w-md" style={{ color: 'var(--v-body)' }}>
                현재 진행 중인 비트코인 20일 흐름을 예측하고, 시장 참여자들과 적중률 및 랭크 점수를 겨룹니다.
              </p>
            </div>

            <div className="mt-10 pt-6 border-t border-[var(--v-hairline)] flex items-center justify-between">
              <span className="v-mono text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--v-mute)' }}>
                <ShieldCheck size={15} />
                기준가 ${basePrice.toLocaleString('en-US')} · 최대 +45 LP
              </span>
              <button
                type="button"
                className="v-btn-primary h-11 px-5 text-sm font-semibold"
              >
                실전 모드 참여
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. HOW IT WORKS: 3-STEP CORE PROCESS (LARGE EDITORIAL SCALE)
          ===================================================================== */}
      <section className="relative" style={{ borderBottom: '1px solid var(--v-hairline)' }}>
        <span className="v-crosshair -bottom-[6px] -left-[6px]" aria-hidden="true" />
        <span className="v-crosshair -bottom-[6px] -right-[6px]" aria-hidden="true" />

        <div className="px-6 sm:px-12 pt-16 sm:pt-24 pb-12 sm:pb-16">
          <div className="max-w-3xl">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight" style={{ color: 'var(--v-ink)' }}>
              3단계로 검증되는 시나리오
            </h2>
            <p className="text-base sm:text-lg mt-3 leading-relaxed" style={{ color: 'var(--v-body)' }}>
              변곡점 작도부터 집단지성 비교, 20일 뒤 자동 채점까지 투명하게 이어집니다.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--v-hairline)] border-t border-[var(--v-hairline)]">
          <div className="p-8 sm:p-12 lg:p-14 flex flex-col justify-between min-h-[260px]">
            <span className="v-serif-brand text-4xl sm:text-5xl leading-none" style={{ color: 'var(--v-ink)' }}>
              01
            </span>
            <div className="mt-8">
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: 'var(--v-ink)' }}>
                변곡점 클릭
              </h3>
              <p className="text-base sm:text-[17px] mt-3 leading-relaxed" style={{ color: 'var(--v-body)' }}>
                차트 위 주요 지점을 찍으면 20일 예상 경로가 자동으로 완성됩니다.
              </p>
            </div>
          </div>

          <div className="p-8 sm:p-12 lg:p-14 flex flex-col justify-between min-h-[260px]">
            <span className="v-serif-brand text-4xl sm:text-5xl leading-none" style={{ color: 'var(--v-ink)' }}>
              02
            </span>
            <div className="mt-8">
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: 'var(--v-ink)' }}>
                집단지성 공개
              </h3>
              <p className="text-base sm:text-[17px] mt-3 leading-relaxed" style={{ color: 'var(--v-body)' }}>
                제출 즉시 시장 참여자들의 중앙값과 상위 예측가들의 궤적이 열립니다.
              </p>
            </div>
          </div>

          <div className="p-8 sm:p-12 lg:p-14 flex flex-col justify-between min-h-[260px]">
            <span className="v-serif-brand text-4xl sm:text-5xl leading-none" style={{ color: 'var(--v-ink)' }}>
              03
            </span>
            <div className="mt-8">
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: 'var(--v-ink)' }}>
                20일 실전 채점
              </h3>
              <p className="text-base sm:text-[17px] mt-3 leading-relaxed" style={{ color: 'var(--v-body)' }}>
                실제 종가와 대조해 오차율과 방향성을 100점 만점으로 자동 평가합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. TIER SYSTEM: 5-STAGE REPUTATION LADDER (SPACIOUS FULL-BLEED GRID)
          ===================================================================== */}
      <section className="relative" style={{ borderBottom: '1px solid var(--v-hairline)' }}>
        <span className="v-crosshair -bottom-[6px] -left-[6px]" aria-hidden="true" />
        <span className="v-crosshair -bottom-[6px] -right-[6px]" aria-hidden="true" />

        <div className="px-6 sm:px-12 pt-16 sm:pt-24 pb-12 sm:pb-16 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight" style={{ color: 'var(--v-ink)' }}>
              적중률 기반 티어 시스템
            </h2>
            <p className="text-base sm:text-lg mt-3 leading-relaxed" style={{ color: 'var(--v-body)' }}>
              실전 채점 점수(LP)로만 평판이 결정되며, 상위 등급은 컨센서스에 더 큰 가중치를 가집니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/leaderboard')}
            className="v-btn-secondary h-11 px-5 text-sm font-semibold shrink-0 self-start sm:self-auto inline-flex items-center gap-2"
          >
            <Trophy size={15} />
            리더보드 보기
            <ArrowRight size={15} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[var(--v-hairline)] border-t border-[var(--v-hairline)]">
          {[
            { label: '브론즈', lp: '1,000+', summary: '실전 기록 입문 단계', dotColor: 'var(--v-mute)' },
            { label: '실버', lp: '1,200+', summary: '모든 참여자 기본 시작 등급', dotColor: 'var(--v-body)' },
            { label: '골드', lp: '1,400+', summary: '일별 오차율 안정 관리 구간', dotColor: 'var(--v-warning)' },
            { label: '플래티넘', lp: '1,600+', summary: '상위 10% 변곡점 예측가', dotColor: 'var(--v-bull)' },
            { label: '다이아몬드', lp: '1,800+', summary: '최상위 적중률 마스터', dotColor: 'var(--v-ink)' },
          ].map(t => (
            <div key={t.label} className="p-8 sm:p-10 flex flex-col justify-between min-h-[210px] sm:min-h-[240px]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-[1.5px]" style={{ backgroundColor: t.dotColor }} />
                  <span className="text-lg sm:text-xl font-bold" style={{ color: 'var(--v-ink)' }}>
                    {t.label}
                  </span>
                </div>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span
                    className="v-mono text-3xl sm:text-4xl font-bold tracking-tight"
                    style={{ color: 'var(--v-ink)' }}
                  >
                    {t.lp}
                  </span>
                  <span className="v-mono text-sm font-semibold" style={{ color: 'var(--v-mute)' }}>
                    LP
                  </span>
                </div>
              </div>

              <p className="text-base mt-6 leading-snug" style={{ color: 'var(--v-body)' }}>
                {t.summary}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================================
          5. CLOSING CTA: SPACIOUS BOTTOM SECTION
          ===================================================================== */}
      <section className="px-6 sm:px-12 py-20 sm:py-28 flex flex-col items-center text-center">
        <h2 className="text-2xl sm:text-4xl font-bold tracking-tight break-keep" style={{ color: 'var(--v-ink)' }}>
          지금 바로 20일 시나리오를 그려보세요
        </h2>
        <p className="text-base sm:text-lg mt-3 max-w-3xl leading-relaxed break-keep" style={{ color: 'var(--v-body)' }}>
          연습 모드에서 감을 잡거나, 실전 라운드에 참여해 시장의 집단지성을 확인할 수 있습니다.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5 w-full max-w-md">
          <button
            type="button"
            onClick={() => navigate('/practice')}
            className="flex-1 v-btn-secondary h-12 text-base font-semibold"
          >
            <Play size={16} />
            연습 모드
          </button>
          <button
            type="button"
            onClick={() => navigate('/studio')}
            className="flex-1 v-btn-primary h-12 text-base font-semibold"
          >
            <TrendingUp size={16} />
            실전 모드
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
