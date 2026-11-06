import type { MarketBar, MarketLandmark } from '../domain/types';
import { isTradingDay, formatDateStr } from '../domain/tradingCalendar';
import {
  BTC_TICKER,
  BTC_DAILY_VOLATILITY,
  getBtcHistoryBars,
  getCurrentBtcPrice,
  getBtcLandmarks,
} from './btcMarket';

export interface StockMeta {
  ticker: string;
  name: string;
  startPrice: number;
  volatility: number;
  logoColor: string;
}

export const CORE_STOCKS: StockMeta[] = [
  {
    ticker: BTC_TICKER,
    name: 'Bitcoin / Tether US',
    startPrice: 68420,
    volatility: BTC_DAILY_VOLATILITY,
    logoColor: '#f7931a',
  },
];

export const STOCKS: StockMeta[] = [
  ...CORE_STOCKS,
  { ticker: 'NVDA', name: 'NVIDIA', startPrice: 128.8, volatility: 0.038, logoColor: '#76b900' },
  { ticker: 'TSLA', name: 'Tesla', startPrice: 245.5, volatility: 0.035, logoColor: '#e82127' },
  { ticker: 'AAPL', name: 'Apple', startPrice: 227.4, volatility: 0.018, logoColor: '#a2aaad' },
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

export function generateStockHistory(stock: StockMeta): MarketBar[] {
  if (stock.ticker.toUpperCase().includes('BTC')) {
    return getBtcHistoryBars();
  }

  let seed = 0;
  for (let i = 0; i < stock.ticker.length; i++) {
    seed = (seed * 31 + stock.ticker.charCodeAt(i)) | 0;
  }
  const rand = createSeededRandom(seed);

  const bars: MarketBar[] = [];
  const baseDate = new Date(2026, 9, 5);
  baseDate.setHours(0, 0, 0, 0);

  const pastDates: string[] = [];
  const temp = new Date(baseDate);
  while (pastDates.length < 100) {
    temp.setDate(temp.getDate() - 1);
    if (isTradingDay(temp)) {
      pastDates.unshift(formatDateStr(temp));
    }
  }

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

const marketCache = new Map<string, MarketBar[]>();

export function getStockHistory(ticker: string): MarketBar[] {
  if (ticker.toUpperCase().includes('BTC')) {
    return getBtcHistoryBars();
  }
  const meta = STOCKS.find(s => s.ticker === ticker) || STOCKS[0];
  if (!marketCache.has(meta.ticker)) {
    marketCache.set(meta.ticker, generateStockHistory(meta));
  }
  return marketCache.get(meta.ticker)!;
}

export function getCurrentStockPrice(ticker: string, asOfDate: string = '2026-10-02'): number {
  if (ticker.toUpperCase().includes('BTC')) {
    return getCurrentBtcPrice(asOfDate);
  }
  const bars = getStockHistory(ticker);
  const match = bars.find(b => b.date === asOfDate);
  if (match) return match.close;
  const earlier = bars.filter(b => b.date <= asOfDate);
  if (earlier.length > 0) return earlier[earlier.length - 1].close;
  return bars[0].close;
}

export function getStockLandmarks(ticker: string, basePrice: number): MarketLandmark[] {
  if (ticker.toUpperCase().includes('BTC')) {
    return getBtcLandmarks(basePrice);
  }
  const meta = STOCKS.find(s => s.ticker === ticker) || STOCKS[0];
  const roundPrice = (p: number) => parseFloat(p.toFixed(2));
  const fiveDayVol = meta.volatility * Math.sqrt(5);

  return [
    {
      id: 'lm_resistance',
      label: '옵션 콜벽 저항 (Call Wall)',
      shortLabel: '콜벽 저항',
      category: 'resistance',
      price: roundPrice(basePrice * (1 + fiveDayVol * 0.95)),
      changePct: parseFloat((fiveDayVol * 95).toFixed(1)),
      benchmarkElo: 1750,
    },
    {
      id: 'lm_consensus',
      label: '월가 평균 목표선 (Wall St.)',
      shortLabel: '월가 목표선',
      category: 'consensus',
      price: roundPrice(basePrice * (1 + fiveDayVol * 0.42)),
      changePct: parseFloat((fiveDayVol * 42).toFixed(1)),
      benchmarkElo: 1600,
    },
    {
      id: 'lm_support',
      label: '풋 지지선 (Put Support)',
      shortLabel: '풋 지지선',
      category: 'support',
      price: roundPrice(basePrice * (1 - fiveDayVol * 0.65)),
      changePct: parseFloat((-fiveDayVol * 65).toFixed(1)),
      benchmarkElo: 1450,
    },
  ];
}
