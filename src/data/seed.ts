import type { User, Forecast, Comment, Notification } from '../domain/types';
import { getStockHistory, getCurrentStockPrice } from './market';
import { getNextTradingDays } from '../domain/tradingCalendar';

export const SEED_USERS: User[] = [
  {
    id: 'u_alpha',
    handle: 'alpha_seeker',
    name: 'Alpha Seeker',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    bio: 'Semiconductor & hyperscaler inflection curves, gamma positioning, and 5D flow analysis.',
    elo: 1760,
    forecastsCount: 16,
    completedCount: 12,
  },
  {
    id: 'u_quant',
    handle: 'quant_craft',
    name: 'Quant Craft',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    bio: 'Volatility-normalized trajectory modeling and consensus divergence mean-reversion.',
    elo: 1920,
    forecastsCount: 24,
    completedCount: 19,
  },
  {
    id: 'u_bull',
    handle: 'tech_bull',
    name: 'Silicon Bull',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    bio: 'AI compute infrastructure momentum and earnings revision breakout trajectories.',
    elo: 1490,
    forecastsCount: 11,
    completedCount: 8,
  },
  {
    id: 'u_macro',
    handle: 'macro_desk',
    name: 'Macro Desk',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    bio: 'Rates-driven equity swing trajectories and liquidity regime risk management.',
    elo: 1320,
    forecastsCount: 19,
    completedCount: 15,
  },
];

function buildPath(basePrice: number, evalDates: string[], pctSteps: number[]) {
  return evalDates.map((date, idx) => ({
    date,
    price: parseFloat((basePrice * (1 + (pctSteps[idx] ?? 0))).toFixed(2)),
  }));
}

export function generateSeedForecasts(): Forecast[] {
  const forecasts: Forecast[] = [];

  // =========================================================================
  // 1. [NVDA — Core Semiconductor Arena] 6 Forecasts (5 LIVE + 1 RESOLVED)
  // =========================================================================
  const nvdaBars = getStockHistory('NVDA');
  const pastNvdaBase = nvdaBars.find(b => b.date === '2026-09-21')?.close || 120.0;
  const pastNvdaEvals = getNextTradingDays('2026-09-21', 5);
  forecasts.push({
    id: 'fc_nvda_resolved_1',
    authorId: 'u_quant',
    anonId: 'anon_seed_nvda_res',
    ticker: 'NVDA',
    horizon: '5D',
    mode: 'path',
    comment: '[Breakout] Blackwell rack shipment acceleration driving 5-day consecutive channel expansion.',
    lockedAt: '2026-09-21T10:00:00Z',
    basePrice: pastNvdaBase,
    baseDate: '2026-09-21',
    evalDates: pastNvdaEvals,
    path: buildPath(pastNvdaBase, pastNvdaEvals, [0.012, 0.025, 0.018, 0.038, 0.054]),
    roundId: 'W2026-39-NVDA',
    rulesVersion: 'v1',
  });

  const liveNvdaBase = getCurrentStockPrice('NVDA', '2026-10-02');
  const liveNvdaEvals = getNextTradingDays('2026-10-02', 5);

  const nvdaProfiles = [
    {
      id: 'fc_nvda_live_root',
      authorId: 'u_bull',
      comment: '[Earnings] Hyperscaler data center capex guide raise; brief D+2 consolidation before +6.8% breakout.',
      lockedAt: '2026-10-02T09:20:00Z',
      steps: [0.018, 0.008, 0.032, 0.051, 0.068],
    },
    {
      id: 'fc_nvda_live_duel_1',
      authorId: 'u_macro',
      comment: '[Macro] 10Y yield backup triggers early-week -3.2% dip before recovering into Friday options close.',
      lockedAt: '2026-10-02T10:45:00Z',
      steps: [-0.016, -0.032, -0.021, -0.008, 0.006],
    },
    {
      id: 'fc_nvda_live_3',
      authorId: 'u_alpha',
      comment: '[Gamma] Call wall dealer hedging steepens upward slope into D+4 and D+5 settlement.',
      lockedAt: '2026-10-02T11:30:00Z',
      steps: [0.009, 0.019, 0.028, 0.042, 0.055],
    },
    {
      id: 'fc_nvda_live_4',
      authorId: 'u_quant',
      comment: '[Mean reversion] Short-term RSI exhaustion; fade overhead resistance toward -2.8% Friday close.',
      lockedAt: '2026-10-02T13:15:00Z',
      steps: [0.005, -0.011, -0.019, -0.024, -0.028],
    },
    {
      id: 'fc_nvda_live_5',
      authorId: 'u_alpha',
      comment: '[Breakout] Cloud GPU cluster utilization check confirms steady +3.6% institutional accumulation.',
      lockedAt: '2026-10-02T15:10:00Z',
      steps: [0.007, 0.014, 0.021, 0.029, 0.036],
    },
  ];

  nvdaProfiles.forEach((p, idx) => {
    forecasts.push({
      id: p.id,
      authorId: p.authorId,
      anonId: `anon_nvda_${idx}`,
      ticker: 'NVDA',
      horizon: '5D',
      mode: 'path',
      comment: p.comment,
      lockedAt: p.lockedAt,
      basePrice: liveNvdaBase,
      baseDate: '2026-10-02',
      evalDates: liveNvdaEvals,
      path: buildPath(liveNvdaBase, liveNvdaEvals, p.steps),
      pathPct: p.steps,
      roundId: 'W2026-41-NVDA',
      rulesVersion: 'v1',
    });
  });

  // =========================================================================
  // 2. [TSLA — High-Beta Momentum Arena] 6 Forecasts (5 LIVE + 1 RESOLVED)
  // =========================================================================
  const tslaBars = getStockHistory('TSLA');
  const pastTslaBase = tslaBars.find(b => b.date === '2026-09-21')?.close || 232.0;
  const pastTslaEvals = getNextTradingDays('2026-09-21', 5);
  forecasts.push({
    id: 'fc_tsla_resolved_1',
    authorId: 'u_alpha',
    anonId: 'anon_seed_1',
    ticker: 'TSLA',
    horizon: '5D',
    mode: 'path',
    comment: '[Breakout] FSD v13 fleet rollout momentum driving 5-day upside continuation.',
    lockedAt: '2026-09-21T09:30:00Z',
    basePrice: pastTslaBase,
    baseDate: '2026-09-21',
    evalDates: pastTslaEvals,
    path: buildPath(pastTslaBase, pastTslaEvals, [0.015, 0.030, 0.045, 0.060, 0.075]),
    roundId: 'W2026-39-TSLA',
    rulesVersion: 'v1',
  });

  const currentTslaBase = tslaBars.find(b => b.date === '2026-10-02')?.close || 240.0;
  const liveTslaEvals = getNextTradingDays('2026-10-02', 5);

  const tslaProfiles = [
    {
      id: 'fc_tsla_live_root',
      authorId: 'u_alpha',
      comment: '[Breakout] Autonomous fleet catalyst positioning; momentum squeeze targeting +7.0% by D+5.',
      lockedAt: '2026-10-02T09:15:00Z',
      steps: [0.012, 0.026, 0.041, 0.056, 0.070],
    },
    {
      id: 'fc_tsla_live_derived_1',
      authorId: 'u_quant',
      comment: '[Mean reversion] Pre-event de-risking pulls price to -3.5% on D+2 before V-shaped recovery.',
      lockedAt: '2026-10-02T11:45:00Z',
      steps: [-0.020, -0.035, -0.018, 0.002, 0.015],
    },
    {
      id: 'fc_tsla_live_3',
      authorId: 'u_bull',
      comment: '[Earnings] China delivery beat absorbed mid-week, setting up +4.8% Friday close.',
      lockedAt: '2026-10-02T12:30:00Z',
      steps: [0.015, 0.009, 0.024, 0.036, 0.048],
    },
    {
      id: 'fc_tsla_live_4',
      authorId: 'u_macro',
      comment: '[Macro] Implied volatility crush and valuation headwind driving -4.2% stair-step pullback.',
      lockedAt: '2026-10-02T14:00:00Z',
      steps: [-0.008, -0.017, -0.026, -0.035, -0.042],
    },
    {
      id: 'fc_tsla_live_5',
      authorId: 'u_quant',
      comment: '[Gamma] 20D moving average defense holds; D+4 inflection breakout to +3.2%.',
      lockedAt: '2026-10-02T15:20:00Z',
      steps: [-0.004, 0.002, 0.011, 0.024, 0.032],
    },
  ];

  tslaProfiles.forEach((p, idx) => {
    forecasts.push({
      id: p.id,
      authorId: p.authorId,
      anonId: `anon_tsla_${idx}`,
      ticker: 'TSLA',
      horizon: '5D',
      mode: 'path',
      comment: p.comment,
      lockedAt: p.lockedAt,
      basePrice: currentTslaBase,
      baseDate: '2026-10-02',
      evalDates: liveTslaEvals,
      path: buildPath(currentTslaBase, liveTslaEvals, p.steps),
      pathPct: p.steps,
      roundId: 'W2026-41-TSLA',
      rulesVersion: 'v1',
    });
  });

  // =========================================================================
  // 3. [AAPL — Low-Vol Consensus Arena] 6 Forecasts (5 LIVE + 1 RESOLVED)
  // =========================================================================
  const aaplBars = getStockHistory('AAPL');
  const pastAaplBase = aaplBars.find(b => b.date === '2026-09-21')?.close || 222.0;
  const pastAaplEvals = getNextTradingDays('2026-09-21', 5);
  forecasts.push({
    id: 'fc_aapl_resolved_1',
    authorId: 'u_bull',
    anonId: 'anon_aapl_res',
    ticker: 'AAPL',
    horizon: '5D',
    mode: 'path',
    comment: '[Earnings] Pro lineup lead-time expansion supporting steady +2.8% weekly grind.',
    lockedAt: '2026-09-21T11:00:00Z',
    basePrice: pastAaplBase,
    baseDate: '2026-09-21',
    evalDates: pastAaplEvals,
    path: buildPath(pastAaplBase, pastAaplEvals, [0.006, 0.011, 0.015, 0.021, 0.028]),
    roundId: 'W2026-39-AAPL',
    rulesVersion: 'v1',
  });

  const aaplPrice = getCurrentStockPrice('AAPL', '2026-10-02');
  const aaplEvals = getNextTradingDays('2026-10-02', 5);
  const aaplComments = [
    '[Earnings] Early cycle upgrade demand supporting low-volatility +1.4% upward drift.',
    '[Gamma] Institutional rebalancing absorbed by D+2; late-week bid to +1.8%.',
    '[Breakout] Services gross margin expansion driving defensive +2.2% outperformance.',
    '[Macro] FX headwind and hardware multiple compression triggering -1.5% dip.',
    '[Breakout] Top risk-adjusted Sharpe among mega-caps; targeting +3.0% Friday close.',
  ];
  for (let i = 0; i < 5; i++) {
    const delta = (i === 3 ? -0.015 : 0.014 + i * 0.004);
    const steps = [1, 2, 3, 4, 5].map(step => parseFloat((delta * (step / 5)).toFixed(4)));
    forecasts.push({
      id: `fc_aapl_live_${i}`,
      authorId: SEED_USERS[i % SEED_USERS.length].id,
      anonId: `anon_aapl_${i}`,
      ticker: 'AAPL',
      horizon: '5D',
      mode: 'path',
      comment: aaplComments[i],
      lockedAt: `2026-10-02T1${i}:00:00Z`,
      basePrice: aaplPrice,
      baseDate: '2026-10-02',
      evalDates: aaplEvals,
      path: buildPath(aaplPrice, aaplEvals, steps),
      pathPct: steps,
      roundId: 'W2026-41-AAPL',
      rulesVersion: 'v1',
    });
  }

  return forecasts;
}

export const SEED_COMMENTS: Comment[] = [];

export const SEED_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif_1',
    userId: 'u_alpha',
    type: 'resolved',
    actorHandle: 'STOXDRAW',
    actorName: 'Elo Settlement',
    forecastId: 'fc_tsla_resolved_1',
    ticker: 'TSLA',
    message: 'TSLA 5D trajectory settled: 88.4 hybrid score achieved (+21 LP credited).',
    createdAt: '2026-09-28T16:00:00Z',
    read: false,
  },
  {
    id: 'notif_2',
    userId: 'u_alpha',
    type: 'resolved',
    actorHandle: 'STOXDRAW',
    actorName: 'Crowd Consensus',
    forecastId: 'fc_nvda_live_3',
    ticker: 'NVDA',
    message: 'NVDA W2026-41 crowd median updated to +4.50% across 6 locked trajectories.',
    createdAt: '2026-10-02T15:30:00Z',
    read: true,
  },
];
