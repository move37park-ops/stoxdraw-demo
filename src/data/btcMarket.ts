import type { MarketBar, MarketLandmark } from '../domain/types';
import { formatDateStr, parseDateStr } from '../domain/tradingCalendar';
import { getNextCalendarDays } from '../domain/interpolation';

export const BTC_TICKER = 'BTC/USDT';
export const BTC_DAILY_VOLATILITY = 0.032;
export const DEFAULT_BASE_DATE = '2026-10-02';

export interface ReplayScenario {
  id: string;
  code: string;
  title: string;
  revealTitle: string;
  subtitle: string;
  difficulty: 'NORMAL' | 'HARD' | 'EXPERT';
  marketHint: string;
  contextCues: { label: string; value: string }[];
  revealTakeaway: string;
  baseDate: string;
  basePrice: number;
  evalDates: string[];
  historyBars: MarketBar[]; // 과거 6개월(180일) 일봉 (블라인드 퀴즈에서 노출)
  futureBars: MarketBar[];  // 향후 20일 실제 일봉 (제출 즉시 1초 만에 공개)
}

function createSeededRandom(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAST_HISTORY_DAYS = 185; // 약 6개월 일봉 (baseDate 포함 185봉)

/**
 * 결정론적 BTC/USDT 일봉 시계열 생성 (오프라인 폴백 및 타임워프 D-0 ~ D+20 추적 정산용)
 * 기준일(2026-10-02) 종가 = $68,420.00, 과거 6개월(185일) + 미래 25일 생성
 */
function buildDeterministicBtcBars(anchorClose: number = 68420): MarketBar[] {
  const rand = createSeededRandom(20261002);
  const baseDate = parseDateStr(DEFAULT_BASE_DATE);
  const baseIdx = PAST_HISTORY_DAYS - 1; // 184 ('2026-10-02')

  // 과거 184일 + 기준일 + 미래 25일 (총 210일 연속 달력일)
  const dates: string[] = [];
  for (let offset = -baseIdx; offset <= 25; offset++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + offset);
    dates.push(formatDateStr(d));
  }

  // 기준일(index 184)에서 역방향/순방향으로 자연스러운 6개월 비트코인 추세 파동 생성
  // 미래 20일(D+1 ~ D+20)은 초반 소폭 상승 -> D+7 눌림목 -> D+14 돌파 -> D+20 +10.4% 마감 시나리오
  const futureDailyReturns = [
    0.012, 0.018, -0.006, 0.015, 0.009,   // D+1 ~ D+5 (+4.8%)
    -0.019, -0.014, 0.004, 0.021, 0.016,  // D+6 ~ D+10 (+5.6%)
    0.008, -0.009, 0.019, 0.024, -0.007,  // D+11 ~ D+15 (+9.3%)
    0.005, -0.011, 0.013, 0.008, -0.004,  // D+16 ~ D+20 (+10.4%)
    0.006, -0.005, 0.009, 0.004, 0.003,
  ];

  const closes: number[] = new Array(dates.length).fill(anchorClose);
  closes[baseIdx] = anchorClose;

  // 과거 184일 역산 (중장기 지지/저항 및 추세 파동이 보이도록 다중 사인파 드리프트 결합)
  for (let i = baseIdx - 1; i >= 0; i--) {
    const daysAgo = baseIdx - i;
    const macroWave =
      Math.sin(daysAgo / 16) * 0.0045 +
      Math.cos(daysAgo / 34) * 0.0032 +
      0.0011;
    const noise = (rand() - 0.5) * 0.024;
    const stepPct = Math.max(-0.045, Math.min(0.048, macroWave + noise));
    closes[i] = parseFloat((closes[i + 1] / (1 + stepPct)).toFixed(2));
  }

  // 미래 25일 순방향 계산
  for (let i = baseIdx + 1; i < dates.length; i++) {
    const stepPct = futureDailyReturns[i - baseIdx - 1] ?? (rand() - 0.48) * 0.022;
    closes[i] = parseFloat((closes[i - 1] * (1 + stepPct)).toFixed(2));
  }

  return dates.map((date, idx) => {
    const close = closes[idx];
    const open = idx > 0 ? closes[idx - 1] : close * 0.992;
    const bodyMax = Math.max(open, close);
    const bodyMin = Math.min(open, close);
    const wickUp = close * (0.004 + rand() * 0.012);
    const wickDown = close * (0.004 + rand() * 0.012);

    return {
      date,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat((bodyMax + wickUp).toFixed(2)),
      low: parseFloat(Math.max(1000, bodyMin - wickDown).toFixed(2)),
      close: parseFloat(close.toFixed(2)),
    };
  });
}

let cachedBtcBars: MarketBar[] = buildDeterministicBtcBars(68420);
let liveSyncStatus: 'synced' | 'fallback' | 'loading' = 'fallback';
const marketListeners = new Set<() => void>();

export function getBtcSyncStatus(): 'synced' | 'fallback' | 'loading' {
  return liveSyncStatus;
}

export function subscribeBtcMarket(cb: () => void): () => void {
  marketListeners.add(cb);
  return () => marketListeners.delete(cb);
}

function notifyMarketListeners() {
  marketListeners.forEach(cb => cb());
}

/**
 * Binance 공개 API(무인증)를 통해 실제 BTC/USDT 일봉 데이터를 동기화합니다.
 * 타임워프 데모 일자(2026-10-02 기준)와의 호환성을 위해 최근 46일 실제 OHLC 패턴을
 * 데모 캘린더에 매핑하고 향후 20일 시뮬레이션 트랙을 실시간 현재가 기준으로 스케일링합니다.
 */
let fetchInitiated = false;
export async function syncBinanceBtcDailyBars(): Promise<MarketBar[]> {
  if (fetchInitiated) return cachedBtcBars;
  fetchInitiated = true;
  liveSyncStatus = 'loading';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=${PAST_HISTORY_DAYS}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw: unknown[] = await res.json();
    if (!Array.isArray(raw) || raw.length < 30) {
      throw new Error('Insufficient klines');
    }

    const parsed = raw.map(item => {
      const row = item as [number, string, string, string, string];
      return {
        open: parseFloat(parseFloat(row[1]).toFixed(2)),
        high: parseFloat(parseFloat(row[2]).toFixed(2)),
        low: parseFloat(parseFloat(row[3]).toFixed(2)),
        close: parseFloat(parseFloat(row[4]).toFixed(2)),
      };
    });

    const latestClose = parsed[parsed.length - 1].close;
    const seeded = buildDeterministicBtcBars(latestClose);
    const baseIdx = PAST_HISTORY_DAYS - 1; // '2026-10-02'

    // 과거 구간에 실제 Binance 6개월 일봉 OHLC 반영
    for (let k = 0; k < parsed.length; k++) {
      const targetIdx = baseIdx - (parsed.length - 1 - k);
      if (targetIdx >= 0 && targetIdx <= baseIdx) {
        seeded[targetIdx] = {
          date: seeded[targetIdx].date,
          ...parsed[k],
        };
      }
    }

    cachedBtcBars = seeded;
    liveSyncStatus = 'synced';
    notifyMarketListeners();
    return cachedBtcBars;
  } catch {
    liveSyncStatus = 'fallback';
    notifyMarketListeners();
    return cachedBtcBars;
  }
}

export function getBtcHistoryBars(): MarketBar[] {
  return cachedBtcBars;
}

export function getCurrentBtcPrice(asOfDate: string = DEFAULT_BASE_DATE): number {
  const bars = getBtcHistoryBars();
  const match = bars.find(b => b.date === asOfDate);
  if (match) return match.close;
  const earlier = bars.filter(b => b.date <= asOfDate);
  if (earlier.length > 0) return earlier[earlier.length - 1].close;
  return bars[0].close;
}

export function getBtcLandmarks(basePrice: number): MarketLandmark[] {
  const roundPrice = (p: number) => parseFloat(p.toFixed(2));
  return [
    {
      id: 'lm_resistance',
      label: '상단 매물대 저항 (Orderbook Wall)',
      shortLabel: '상단 저항선',
      category: 'resistance',
      price: roundPrice(basePrice * 1.085),
      changePct: 8.5,
      benchmarkElo: 1750,
    },
    {
      id: 'lm_consensus',
      label: '상위 1% 고수 평균 목표선 (Top Tier)',
      shortLabel: '고수 평균선',
      category: 'consensus',
      price: roundPrice(basePrice * 1.052),
      changePct: 5.2,
      benchmarkElo: 1650,
    },
    {
      id: 'lm_support',
      label: '단기 지지 구간 (20D EMA Support)',
      shortLabel: '단기 지지선',
      category: 'support',
      price: roundPrice(basePrice * 0.945),
      changePct: -5.5,
      benchmarkElo: 1450,
    },
  ];
}

/**
 * Practice 모드 (리플레이 랩)용 5개 기출 블라인드 시나리오 생성
 */
function buildScenarioBars(
  seed: number,
  baseDateStr: string,
  basePrice: number,
  pastDailyReturns: number[],
  futureDailyReturns: number[]
): { historyBars: MarketBar[]; futureBars: MarketBar[]; evalDates: string[] } {
  const rand = createSeededRandom(seed);
  const baseDate = parseDateStr(baseDateStr);
  const scenarioHistoryCount = 180; // 과거 6개월(180일) 일봉

  // 과거 180일 날짜 (baseDate 포함 총 180봉)
  const pastDates: string[] = [];
  for (let offset = -(scenarioHistoryCount - 1); offset <= 0; offset++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + offset);
    pastDates.push(formatDateStr(d));
  }

  const evalDates = getNextCalendarDays(baseDateStr, 20);

  // 과거 180일 종가 역산 (최근 구간은 시나리오 고유 패턴, 이전 구간은 6개월 추세 파동)
  const pastCloses: number[] = new Array(scenarioHistoryCount).fill(basePrice);
  pastCloses[scenarioHistoryCount - 1] = basePrice;
  for (let i = scenarioHistoryCount - 2; i >= 0; i--) {
    const recentIdx = i - (scenarioHistoryCount - 1 - pastDailyReturns.length);
    const daysAgo = scenarioHistoryCount - 1 - i;
    const macroWave =
      Math.sin((daysAgo + seed) / 17) * 0.0042 +
      Math.cos((daysAgo + seed) / 35) * 0.003 +
      (rand() - 0.49) * 0.022;
    const r = recentIdx >= 0 ? (pastDailyReturns[recentIdx] ?? macroWave) : macroWave;
    pastCloses[i] = parseFloat((pastCloses[i + 1] / (1 + r)).toFixed(2));
  }

  const historyBars: MarketBar[] = pastDates.map((date, idx) => {
    const close = pastCloses[idx];
    const open = idx > 0 ? pastCloses[idx - 1] : close * 0.99;
    const high = Math.max(open, close) + close * (0.005 + rand() * 0.01);
    const low = Math.min(open, close) - close * (0.005 + rand() * 0.01);
    return {
      date,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
    };
  });

  // 미래 20일 실제 종가 계산
  const futureBars: MarketBar[] = [];
  let prevClose = basePrice;
  for (let i = 0; i < 20; i++) {
    const r = futureDailyReturns[i] ?? 0;
    const close = parseFloat((prevClose * (1 + r)).toFixed(2));
    const open = prevClose;
    const high = Math.max(open, close) + close * (0.005 + rand() * 0.01);
    const low = Math.min(open, close) - close * (0.005 + rand() * 0.01);
    futureBars.push({
      date: evalDates[i],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close,
    });
    prevClose = close;
  }

  return { historyBars, futureBars, evalDates };
}

export const REPLAY_SCENARIOS: ReplayScenario[] = [
  (() => {
    const baseDate = '2024-02-05';
    const basePrice = 42658;
    // 2023년 8월 ~ 2024년 2월: $26k~$30k 횡보 후 10월~1월 현물 ETF 기대감 상승($46k) 및 1월 말 $39.5k 조정 후 $42.6k 수렴
    const recent29Returns = [
      0.032, -0.014, 0.008, -0.006, -0.068, -0.004, 0.021, -0.019, -0.002, -0.028,
      0.004, -0.038, 0.007, 0.003, 0.045, 0.005, -0.012, 0.014, 0.002, -0.011,
      0.015, 0.002, 0.001, -0.009, -0.011,
    ];
    // 2024-02-06 ~ 2024-02-25 실제 20일 돌파 궤적 ($42,658 -> $51,730, +21.3%)
    const future20Returns = [
      0.010, 0.029, 0.022, 0.041, 0.013,
      0.011, 0.034, -0.004, 0.042, 0.003,
      0.005, -0.009, 0.011, -0.007, 0.009,
      -0.008, -0.011, -0.012, 0.016, 0.004,
    ];
    const { historyBars, futureBars, evalDates } = buildScenarioBars(
      20240205,
      baseDate,
      basePrice,
      recent29Returns,
      future20Returns
    );
    return {
      id: 'replay_2024_etf_breakout',
      code: '2024.02',
      title: '현물 ETF 승인 직후 매물 소화 및 수렴 구간',
      revealTitle: '기관 ETF 순유입 전환 & $51.7K 돌파 (+21.3%)',
      subtitle: '2024년 2월 5일 기준 · 과거 6개월 실제 일봉',
      difficulty: 'NORMAL',
      marketHint: '2024년 1월 현물 ETF 승인 직후 차익실현 매물로 $39K까지 눌렸다가 $42.6K 부근에서 2주간 변동성이 수축된 시점입니다.',
      contextCues: [
        { label: '주요 가격대', value: '직전 고점 저항 $46.0K · 조정 저점 지지 $39.5K' },
        { label: '차트 구조', value: '20일 이동평균선($42.1K) 안착 후 일봉 변동폭 축소' },
        { label: '당시 시장 배경', value: '현물 ETF 상장 3주 차, 초기 환매 물량과 신규 유입세 경합' },
      ],
      revealTakeaway: '2024년 2월 6일부터 기관 현물 ETF 순유입이 본격화되며 D+10에 $52K를 돌파했고, 후반 10일간 $51K~52K 고가권 지지 테스트를 거쳐 +21.3% 상승 마감했습니다.',
      baseDate,
      basePrice,
      evalDates,
      historyBars,
      futureBars,
    };
  })(),
  (() => {
    const baseDate = '2024-04-19';
    const basePrice = 63818;
    // 2024년 3월 $73K 신고가 경신 후 4월 중순 반감기 직전 $61K~$71K 박스권 조정
    const recent29Returns = [
      -0.025, 0.042, 0.048, -0.005, 0.012, -0.014, 0.021, -0.003, -0.052, 0.008,
      0.015, 0.024, 0.032, -0.036, 0.022, -0.011, -0.048, -0.029, -0.028, 0.005,
      -0.039, 0.036, 0.004,
    ];
    // 2024-04-20 ~ 2024-05-09 실제 반감기 직후 20일 궤적 (초반 $66.8k 반등 -> D+11 $56.8k 투매 -> $63.0k 회복)
    const future20Returns = [
      0.018, -0.001, 0.029, -0.006, -0.032,
      0.003, -0.011, -0.005, -0.004, 0.011,
      -0.050, -0.038, 0.015, 0.064, 0.016,
      0.002, -0.013, -0.014, -0.018, 0.029,
    ];
    const { historyBars, futureBars, evalDates } = buildScenarioBars(
      20240419,
      baseDate,
      basePrice,
      recent29Returns,
      future20Returns
    );
    return {
      id: 'replay_2024_halving_whipsaw',
      code: '2024.04',
      title: '제4차 반감기 당일 고점 박스권 변곡점',
      revealTitle: '초반 $66.8K 반등 후 $58K 조정 및 회복 (-1.2%)',
      subtitle: '2024년 4월 19일 기준 · 과거 6개월 실제 일봉',
      difficulty: 'HARD',
      marketHint: '2024년 3월 $73K 신고가 달성 이후 고점이 낮아지는 박스권($61K~$71K) 안에서 네 번째 반감기 당일을 맞이한 시점입니다.',
      contextCues: [
        { label: '주요 가격대', value: '박스권 상단 저항 $71.0K · 하단 지지 $61.0K' },
        { label: '차트 구조', value: '20일 이동평균선 하향 돌파 후 $63.8K 단기 반등 시도' },
        { label: '당시 시장 배경', value: '4월 19일 제4차 반감기 도래 및 중동 지정학적 변동성 확대' },
      ],
      revealTakeaway: '반감기 직후 D+3까지 $66.8K로 소폭 반등했으나 차익 매물이 출회되며 D+12에 $58K 초반까지 밀렸고, 이후 저가 매수세 유입으로 D+20에 기준가 부근($63.0K)을 회복했습니다.',
      baseDate,
      basePrice,
      evalDates,
      historyBars,
      futureBars,
    };
  })(),
  (() => {
    const baseDate = '2024-08-05';
    const basePrice = 54018;
    // 2024년 7월 말 $68K에서 8월 초 엔 캐리 청산 쇼크로 5일 연속 급락해 $54K에 도달한 시점
    const recent29Returns = [
      0.012, 0.038, 0.021, 0.004, -0.011, 0.042, -0.006, 0.009, -0.021, -0.005,
      0.031, 0.006, -0.024, -0.008, -0.022, 0.011, -0.058, -0.016, -0.042, -0.072,
    ];
    // 2024-08-06 ~ 2024-08-25 실제 20일 V자 반등 및 횡보 후 $64.2K 마감 (+18.9%)
    const future20Returns = [
      0.037, -0.016, 0.119, -0.014, 0.001,
      -0.035, 0.010, 0.021, -0.031, -0.020,
      0.023, 0.009, -0.017, 0.018, -0.007,
      0.036, -0.013, 0.061, 0.002, 0.001,
    ];
    const { historyBars, futureBars, evalDates } = buildScenarioBars(
      20240805,
      baseDate,
      basePrice,
      recent29Returns,
      future20Returns
    );
    return {
      id: 'replay_2024_yen_carry_crash',
      code: '2024.08',
      title: '8월 글로벌 증시 쇼크 & 단기 급락 직후 구간',
      revealTitle: 'D+3 기술적 급반등 및 쌍바닥 확인 후 회복 (+18.9%)',
      subtitle: '2024년 8월 5일 기준 · 과거 6개월 실제 일봉',
      difficulty: 'HARD',
      marketHint: '7월 말 $68K 부근에서 엔 캐리 청산 쇼크로 닷새 만에 $54K까지 급락한 2024년 8월 5일 종가 시점입니다.',
      contextCues: [
        { label: '주요 가격대', value: '급락 전 매물대 $62.0K~$65.0K · 당일 종가 $54.0K' },
        { label: '차트 구조', value: '20일 이동평균선 대비 -15% 이상 단기 과매도 이격 발생' },
        { label: '당시 시장 배경', value: '일본 금리 인상발 엔 캐리 청산 및 레버리지 대규모 강제청산 직후' },
      ],
      revealTakeaway: '패닉셀 직후 D+3 만에 $61.7K로 강하게 기술적 반등한 뒤, 중반부 $57.5K 재차 지지 확인(쌍바닥)을 거치며 D+20에 $64.2K(+18.9%)까지 회복했습니다.',
      baseDate,
      basePrice,
      evalDates,
      historyBars,
      futureBars,
    };
  })(),
  (() => {
    const baseDate = '2024-11-05';
    const basePrice = 69359;
    // 2024년 10월 $60K -> $72K 상승 후 미 대선 직전 $67K~$69K 눌림목
    const recent29Returns = [
      0.024, 0.018, -0.006, 0.015, 0.009, -0.019, 0.011, 0.038, 0.026, -0.005,
      -0.018, -0.021, -0.011, 0.022,
    ];
    // 2024-11-06 ~ 2024-11-25 실제 신고가 랠리 ($69,359 -> $93,100+, +34.2%)
    const future20Returns = [
      0.090, 0.004, 0.008, 0.003, 0.048,
      0.102, -0.009, 0.029, -0.035, 0.042,
      -0.006, -0.008, 0.007, 0.019, 0.022,
      0.044, 0.006, -0.012, 0.003, -0.048,
    ];
    const { historyBars, futureBars, evalDates } = buildScenarioBars(
      20241105,
      baseDate,
      basePrice,
      recent29Returns,
      future20Returns
    );
    return {
      id: 'replay_2024_nov_ath_breakout',
      code: '2024.11',
      title: '7개월 장기 채널 상단 저항 및 눌림목 구간',
      revealTitle: '7개월 박스권 상단 돌파 & $90K+ 신고가 랠리 (+34.2%)',
      subtitle: '2024년 11월 5일 기준 · 과거 6개월 실제 일봉',
      difficulty: 'EXPERT',
      marketHint: '2024년 3월 고점 이후 7개월간 이어진 장기 조정 채널 상단($72K)을 테스트한 뒤 $69.3K로 눌린 시점입니다.',
      contextCues: [
        { label: '주요 가격대', value: '장기 전고점 저항 $72.0K~$73.7K · 단기 지지 $67.0K' },
        { label: '차트 구조', value: '10월 상승 추세선 및 20일 이동평균선($68.5K) 위 지지 유지' },
        { label: '당시 시장 배경', value: '미국 대선 이벤트 당일, 7개월간의 장기 매물대 소화 막바지' },
      ],
      revealTakeaway: '기준일 직후 D+1에 +9% 장대양봉으로 7개월 박스권을 돌파한 뒤, D+6에 $88K, D+16에 $98K 부근까지 가속 상승하며 20일 만에 +34% 이상의 강세장을 기록했습니다.',
      baseDate,
      basePrice,
      evalDates,
      historyBars,
      futureBars,
    };
  })(),
];

let replayFetchInitiated = false;

/**
 * 연습 모드(REPLAY_SCENARIOS)의 4개 실제 과거 시점(2024.02 / 2024.04 / 2024.08 / 2024.11)에 대해
 * Binance 공개 API에서 실제 과거 180일 + 향후 20일(총 200봉) 1D OHLC 데이터를 로드합니다.
 */
export async function syncReplayScenariosFromBinance(): Promise<void> {
  if (replayFetchInitiated) return;
  replayFetchInitiated = true;

  try {
    await Promise.all(
      REPLAY_SCENARIOS.map(async scenario => {
        const base = parseDateStr(scenario.baseDate);
        const startDate = new Date(
          Date.UTC(base.getFullYear(), base.getMonth(), base.getDate() - 179, 0, 0, 0)
        );
        const startTimeMs = startDate.getTime();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&startTime=${startTimeMs}&limit=200`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!res.ok) return;
        const raw: unknown[] = await res.json();
        if (!Array.isArray(raw) || raw.length < 200) return;

        const bars: MarketBar[] = raw.slice(0, 200).map(item => {
          const row = item as [number, string, string, string, string];
          const d = new Date(row[0]);
          const yyyy = d.getUTCFullYear();
          const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
          const dd = String(d.getUTCDate()).padStart(2, '0');
          return {
            date: `${yyyy}-${mm}-${dd}`,
            open: parseFloat(parseFloat(row[1]).toFixed(2)),
            high: parseFloat(parseFloat(row[2]).toFixed(2)),
            low: parseFloat(parseFloat(row[3]).toFixed(2)),
            close: parseFloat(parseFloat(row[4]).toFixed(2)),
          };
        });

        const historyBars = bars.slice(0, 180);
        const futureBars = bars.slice(180, 200);
        const baseBar = historyBars[historyBars.length - 1];

        scenario.baseDate = baseBar.date;
        scenario.basePrice = baseBar.close;
        scenario.historyBars = historyBars;
        scenario.futureBars = futureBars;
        scenario.evalDates = futureBars.map(b => b.date);
      })
    );
    notifyMarketListeners();
  } catch {
    // 오프라인이거나 요청 제한 시 시드 폴백 유지
  }
}
