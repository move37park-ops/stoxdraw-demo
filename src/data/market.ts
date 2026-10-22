import type { MarketBar, MarketLandmark } from '../domain/types';
import { isTradingDay, formatDateStr } from '../domain/tradingCalendar';

export interface StockMeta {
  ticker: string;
  name: string;
  startPrice: number;
  volatility: number;
  logoColor: string;
}

export const CORE_STOCKS: StockMeta[] = [
  { ticker: 'NVDA', name: 'NVIDIA', startPrice: 128.8, volatility: 0.038, logoColor: '#76b900' },
  { ticker: 'TSLA', name: 'Tesla', startPrice: 245.5, volatility: 0.035, logoColor: '#e82127' },
  { ticker: 'AAPL', name: 'Apple', startPrice: 227.4, volatility: 0.018, logoColor: '#a2aaad' },
];

export const STOCKS: StockMeta[] = [
  ...CORE_STOCKS,
  { ticker: 'MSFT', name: 'Microsoft', startPrice: 422.3, volatility: 0.019, logoColor: '#00a4ef' },
  { ticker: 'AMZN', name: 'Amazon', startPrice: 186.2, volatility: 0.024, logoColor: '#ff9900' },
  { ticker: 'META', name: 'Meta', startPrice: 585.1, volatility: 0.028, logoColor: '#0668e1' },
  { ticker: 'GOOGL', name: 'Alphabet', startPrice: 164.7, volatility: 0.021, logoColor: '#4285f4' },
  { ticker: 'AMD', name: 'AMD', startPrice: 156.4, volatility: 0.036, logoColor: '#ed1c24' },
  { ticker: 'NFLX', name: 'Netflix', startPrice: 698.0, volatility: 0.026, logoColor: '#e50914' },
  { ticker: 'PLTR', name: 'Palantir', startPrice: 38.6, volatility: 0.042, logoColor: '#ffffff' },
];

function createSeededRandom(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2026-10-05 기준 과거 120거래일 + 미래 30거래일 시세 생성
export function generateStockHistory(stock: StockMeta): MarketBar[] {
  let seed = 0;
  for (let i = 0; i < stock.ticker.length; i++) {
    seed = (seed * 31 + stock.ticker.charCodeAt(i)) | 0;
  }
  const rand = createSeededRandom(seed);

  const bars: MarketBar[] = [];
  // 기준 시점: 2026-10-05
  const baseDate = new Date(2026, 9, 5); // 2026-10-05
  baseDate.setHours(0, 0, 0, 0);

  // 과거 100거래일 역산
  const pastDates: string[] = [];
  const temp = new Date(baseDate);
  while (pastDates.length < 100) {
    temp.setDate(temp.getDate() - 1);
    if (isTradingDay(temp)) {
      pastDates.unshift(formatDateStr(temp));
    }
  }

  // 미래 30거래일
  const futureDates: string[] = [];
  const tempFuture = new Date(baseDate);
  if (isTradingDay(tempFuture)) {
    futureDates.push(formatDateStr(tempFuture));
  }
  while (futureDates.length < 35) {
    tempFuture.setDate(tempFuture.getDate() + 1);
    if (isTradingDay(tempFuture)) {
      futureDates.push(formatDateStr(tempFuture));
    }
  }

  const allDates = [...pastDates, ...futureDates];

  let currentPrice = stock.startPrice;
  for (const date of allDates) {
    const change = (rand() - 0.485) * stock.volatility * currentPrice;
    const open = currentPrice;
    const close = Math.max(1, currentPrice + change);
    const high = Math.max(open, close) + rand() * stock.volatility * currentPrice * 0.5;
    const low = Math.min(open, close) - rand() * stock.volatility * currentPrice * 0.5;

    bars.push({
      date,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
    });

    currentPrice = close;
  }

  return bars;
}

// Memory Cache
const marketCache = new Map<string, MarketBar[]>();

export function getStockHistory(ticker: string): MarketBar[] {
  const meta = STOCKS.find(s => s.ticker === ticker) || STOCKS[0];
  if (!marketCache.has(meta.ticker)) {
    marketCache.set(meta.ticker, generateStockHistory(meta));
  }
  return marketCache.get(meta.ticker)!;
}

export function getCurrentStockPrice(ticker: string, asOfDate: string = '2026-10-05'): number {
  const bars = getStockHistory(ticker);
  const match = bars.find(b => b.date === asOfDate);
  if (match) return match.close;
  // Fallback to closest earlier bar
  const earlier = bars.filter(b => b.date <= asOfDate);
  if (earlier.length > 0) return earlier[earlier.length - 1].close;
  return bars[0].close;
}

/**
 * 종목별 5D 변동성(σ)에 맞춘 객관적 시장 내비게이션 기준선(Waypoints) 반환
 */
export function getStockLandmarks(ticker: string, basePrice: number): MarketLandmark[] {
  const meta = STOCKS.find(s => s.ticker === ticker.toUpperCase()) || CORE_STOCKS[0];
  const fiveDaySigma = meta.volatility * Math.sqrt(5);

  const upperPct = parseFloat((fiveDaySigma * 0.62 * 100).toFixed(1));
  const lowerPct = parseFloat((-fiveDaySigma * 0.52 * 100).toFixed(1));

  const upperPrice = parseFloat((basePrice * (1 + upperPct / 100)).toFixed(2));
  const lowerPrice = parseFloat((basePrice * (1 + lowerPct / 100)).toFixed(2));

  return [
    {
      id: `${meta.ticker}_wallst_target`,
      label: '월가 단기 저항 · 목표선 (Wall St. Target)',
      shortLabel: 'WALL ST TARGET',
      category: 'resistance',
      price: upperPrice,
      changePct: upperPct,
      benchmarkElo: 1650,
    },
    {
      id: `${meta.ticker}_options_support`,
      label: '옵션 맥스페인 · 지지선 (Options Support)',
      shortLabel: 'OPTIONS SUPPORT',
      category: 'support',
      price: lowerPrice,
      changePct: lowerPct,
      benchmarkElo: 1520,
    },
  ];
}
