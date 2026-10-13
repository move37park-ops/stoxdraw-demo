import type { User, Forecast, Comment, Notification } from '../domain/types';
import { getStockHistory, getCurrentStockPrice } from './market';
import { getNextTradingDays } from '../domain/tradingCalendar';

export const SEED_USERS: User[] = [
  {
    id: 'u_alpha',
    handle: 'alpha_seeker',
    name: '알파헌터',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    bio: '빅테크와 반도체 섹터의 변곡점을 손으로 그립니다.',
    forecastsCount: 14,
    completedCount: 11,
  },
  {
    id: 'u_quant',
    handle: 'quant_craft',
    name: '퀀트크래프트',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    bio: '변동성과 모멘텀 궤적을 추적하는 소셜 포캐스터.',
    forecastsCount: 22,
    completedCount: 19,
  },
  {
    id: 'u_bull',
    handle: 'tech_bull',
    name: '실리콘불',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    bio: 'AI 인프라 슈퍼사이클 장기 궤적 분석.',
    forecastsCount: 9,
    completedCount: 7,
  },
  {
    id: 'u_macro',
    handle: 'macro_wave',
    name: '매크로웨이브',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    bio: '금리와 유동성에 따른 주가 방향성 예측.',
    forecastsCount: 18,
    completedCount: 15,
  },
];

export function generateSeedForecasts(): Forecast[] {
  const forecasts: Forecast[] = [];

  // 1. [RESOLVED] TSLA 5D Path (과거 9월 22일 시작 ~ 9월 28일 종료)
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
    comment: 'FSD V13 기대감으로 전고점 돌파 궤적을 그립니다.',
    lockedAt: '2026-09-21T09:30:00Z',
    basePrice: pastTslaBase,
    baseDate: '2026-09-21',
    evalDates: pastTslaEvals,
    path: pastTslaEvals.map((date, idx) => ({
      date,
      price: parseFloat((pastTslaBase * (1 + (idx + 1) * 0.015)).toFixed(2)),
    })),
    rulesVersion: 'v1',
  });

  // 2. [RESOLVED] NVDA 5D Breakout (9월 21일 시작)
  const nvdaBars = getStockHistory('NVDA');
  const pastNvdaBase = nvdaBars.find(b => b.date === '2026-09-21')?.close || 120.0;
  const pastNvdaEvals = getNextTradingDays('2026-09-21', 5);
  forecasts.push({
    id: 'fc_nvda_resolved_2',
    authorId: 'u_quant',
    anonId: 'anon_seed_2',
    ticker: 'NVDA',
    horizon: '5D',
    mode: 'breakout',
    comment: '블랙웰 칩셋 출하 소식으로 $130 상향 돌파 예상합니다.',
    lockedAt: '2026-09-21T10:00:00Z',
    basePrice: pastNvdaBase,
    baseDate: '2026-09-21',
    evalDates: pastNvdaEvals,
    breakout: {
      direction: 'up',
      price: 130.0,
    },
    rulesVersion: 'v1',
  });

  // 3. [LIVE] TSLA 5D Path (10월 2일 시작 ~ 10월 8일 완료 예정, 현재 10월 5일 중간)
  const currentTslaBase = tslaBars.find(b => b.date === '2026-10-02')?.close || 240.0;
  const liveTslaEvals = getNextTradingDays('2026-10-02', 5);
  const originalTsla: Forecast = {
    id: 'fc_tsla_live_root',
    authorId: 'u_alpha',
    anonId: 'anon_seed_3',
    ticker: 'TSLA',
    horizon: '5D',
    mode: 'path',
    comment: '로보택시 발표 전 완만한 우상향 궤적을 예상합니다.',
    lockedAt: '2026-10-02T09:15:00Z',
    basePrice: currentTslaBase,
    baseDate: '2026-10-02',
    evalDates: liveTslaEvals,
    path: [
      { date: liveTslaEvals[0], price: currentTslaBase * 1.01 },
      { date: liveTslaEvals[1], price: currentTslaBase * 1.025 },
      { date: liveTslaEvals[2], price: currentTslaBase * 1.04 },
      { date: liveTslaEvals[3], price: currentTslaBase * 1.055 },
      { date: liveTslaEvals[4], price: currentTslaBase * 1.07 },
    ].map(p => ({ date: p.date, price: parseFloat(p.price.toFixed(2)) })),
    rulesVersion: 'v1',
  };
  forecasts.push(originalTsla);

  // 4. [LIVE] TSLA 파생 Forecast (파생 관계: §9 Forecast Response)
  forecasts.push({
    id: 'fc_tsla_live_derived_1',
    authorId: 'u_quant',
    anonId: 'anon_seed_4',
    ticker: 'TSLA',
    horizon: '5D',
    mode: 'path',
    parentId: 'fc_tsla_live_root', // @alpha_seeker의 원본 참조!
    comment: '@alpha_seeker 님의 상승 궤적에 반박합니다. 단기 차익실현으로 눌림목 후 반등할 것입니다.',
    lockedAt: '2026-10-02T11:45:00Z',
    basePrice: currentTslaBase,
    baseDate: '2026-10-02',
    evalDates: liveTslaEvals,
    path: [
      { date: liveTslaEvals[0], price: currentTslaBase * 0.98 },
      { date: liveTslaEvals[1], price: currentTslaBase * 0.965 },
      { date: liveTslaEvals[2], price: currentTslaBase * 0.97 },
      { date: liveTslaEvals[3], price: currentTslaBase * 0.99 },
      { date: liveTslaEvals[4], price: currentTslaBase * 1.01 },
    ].map(p => ({ date: p.date, price: parseFloat(p.price.toFixed(2)) })),
    rulesVersion: 'v1',
  });

  // 5. [LIVE] AAPL 5D Path (Crowd 형성용)
  const aaplPrice = getCurrentStockPrice('AAPL', '2026-10-02');
  const aaplEvals = getNextTradingDays('2026-10-02', 5);
  for (let i = 0; i < 6; i++) {
    const delta = (i % 2 === 0 ? 1 : -0.7) * (0.01 + i * 0.005);
    forecasts.push({
      id: `fc_aapl_live_${i}`,
      authorId: SEED_USERS[i % SEED_USERS.length].id,
      anonId: `anon_aapl_${i}`,
      ticker: 'AAPL',
      horizon: '5D',
      mode: 'path',
      comment: i === 0 ? '아이폰 17 초기 수요 호조세 반영 예상.' : '견조한 실적 기반 점진적 상승.',
      lockedAt: '2026-10-02T13:00:00Z',
      basePrice: aaplPrice,
      baseDate: '2026-10-02',
      evalDates: aaplEvals,
      path: aaplEvals.map((date, idx) => ({
        date,
        price: parseFloat((aaplPrice * (1 + delta * ((idx + 1) / 5))).toFixed(2)),
      })),
      rulesVersion: 'v1',
    });
  }

  // 6. [LOCKED] NVDA 30D Path (10월 5일 방금 생성됨, 내일 10월 6일부터 첫 평가일)
  const nvdaCurr = getCurrentStockPrice('NVDA', '2026-10-05');
  const nvda30Evals = getNextTradingDays('2026-10-05', 21);
  forecasts.push({
    id: 'fc_nvda_locked_recent',
    authorId: 'u_bull',
    anonId: 'anon_seed_nvda',
    ticker: 'NVDA',
    horizon: '30D',
    mode: 'path',
    comment: '30일 동안 공급망 증설 소식과 함께 계단식 우상향 궤적을 전망합니다.',
    lockedAt: '2026-10-05T14:20:00Z',
    basePrice: nvdaCurr,
    baseDate: '2026-10-05',
    evalDates: nvda30Evals,
    path: nvda30Evals.map((date, idx) => ({
      date,
      price: parseFloat((nvdaCurr * (1 + Math.sin(idx / 3) * 0.04 + (idx / 21) * 0.12)).toFixed(2)),
    })),
    rulesVersion: 'v1',
  });

  // 7. [COLD START 종목] PLTR (오직 2개만 존재 -> 스펙 §24 Cold Start 시연용!)
  const pltrCurr = getCurrentStockPrice('PLTR', '2026-10-05');
  const pltrEvals = getNextTradingDays('2026-10-05', 5);
  forecasts.push({
    id: 'fc_pltr_cold_1',
    authorId: 'u_macro',
    anonId: 'anon_seed_pltr',
    ticker: 'PLTR',
    horizon: '5D',
    mode: 'path',
    comment: 'S&P500 편입 모멘텀 2차 랠리 전망.',
    lockedAt: '2026-10-05T15:00:00Z',
    basePrice: pltrCurr,
    baseDate: '2026-10-05',
    evalDates: pltrEvals,
    path: pltrEvals.map((date, idx) => ({
      date,
      price: parseFloat((pltrCurr * (1 + (idx + 1) * 0.02)).toFixed(2)),
    })),
    rulesVersion: 'v1',
  });

  return forecasts;
}

export const SEED_COMMENTS: Comment[] = [
  {
    id: 'cmt_1',
    forecastId: 'fc_tsla_live_root',
    userId: 'u_quant',
    authorHandle: 'quant_craft',
    authorName: '퀀트크래프트',
    authorAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    content: '궤적의 기울기가 매우 가파르네요! 저도 [YOUR DRAW]로 눌림목 관점 제출했습니다.',
    createdAt: '2026-10-02T11:40:00Z',
  },
  {
    id: 'cmt_2',
    forecastId: 'fc_tsla_live_root',
    userId: 'u_bull',
    authorHandle: 'tech_bull',
    authorName: '실리콘불',
    authorAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    content: '공감합니다. 250달러 저항선만 뚫으면 이 궤적대로 갈 것 같아요.',
    createdAt: '2026-10-02T12:10:00Z',
  },
];

export const SEED_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif_1',
    userId: 'u_alpha',
    type: 'response',
    actorHandle: 'quant_craft',
    actorName: '퀀트크래프트',
    forecastId: 'fc_tsla_live_derived_1',
    ticker: 'TSLA',
    message: '@quant_craft 님이 회원님의 Forecast에 [YOUR DRAW]로 새로운 궤적을 제시했습니다.',
    createdAt: '2026-10-02T11:45:00Z',
    read: false,
  },
  {
    id: 'notif_2',
    userId: 'u_alpha',
    type: 'resolved',
    actorHandle: 'STOXDRAW',
    actorName: '시스템',
    forecastId: 'fc_tsla_resolved_1',
    ticker: 'TSLA',
    message: 'TSLA 5D Forecast가 성공적으로 검증 완료되어 Record에 등록되었습니다.',
    createdAt: '2026-09-28T16:00:00Z',
    read: true,
  },
];
