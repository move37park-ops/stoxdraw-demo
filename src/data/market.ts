import type { MarketBar } from '../domain/types';
import { isTradingDay, formatDateStr } from '../domain/tradingCalendar';

export interface StockMeta {
  ticker: string;
  name: string;
  startPrice: number;
  volatility: number;
  logoColor: string;
}

export const STOCKS: StockMeta[] = [
  { ticker: 'TSLA', name: '테슬라', startPrice: 245.5, volatility: 0.035, logoColor: '#e82127' },
  { ticker: 'NVDA', name: '엔비디아', startPrice: 128.8, volatility: 0.038, logoColor: '#76b900' },
  { ticker: 'AAPL', name: '애플', startPrice: 227.4, volatility: 0.018, logoColor: '#a2aaad' },
  { ticker: 'MSFT', name: '마이크로소프트', startPrice: 422.3, volatility: 0.019, logoColor: '#00a4ef' },
  { ticker: 'AMZN', name: '아마존', startPrice: 186.2, volatility: 0.024, logoColor: '#ff9900' },
  { ticker: 'META', name: '메타', startPrice: 585.1, volatility: 0.028, logoColor: '#0668e1' },
  { ticker: 'GOOGL', name: '알파벳 (구글)', startPrice: 164.7, volatility: 0.021, logoColor: '#4285f4' },
  { ticker: 'AMD', name: 'AMD', startPrice: 156.4, volatility: 0.036, logoColor: '#ed1c24' },
  { ticker: 'NFLX', name: '넷플릭스', startPrice: 698.0, volatility: 0.026, logoColor: '#e50914' },
  { ticker: 'PLTR', name: '팔란티어', startPrice: 38.6, volatility: 0.042, logoColor: '#ffffff' },
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
