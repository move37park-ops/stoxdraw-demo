import type { User, Forecast, Comment, Notification } from '../domain/types';
import { getStockHistory, getCurrentStockPrice } from './market';
import { getNextTradingDays } from '../domain/tradingCalendar';

export const SEED_USERS: User[] = [
  {
    id: 'u_alpha',
    handle: 'alpha_seeker',
    name: '알파헌터',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    bio: '빅테크 및 반도체 섹터의 단기 변곡점과 수급을 분석합니다.',
    elo: 1760,
    forecastsCount: 16,
    completedCount: 12,
  },
  {
    id: 'u_quant',
    handle: 'quant_craft',
    name: '퀀트크래프트',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    bio: '변동성 정규화 경로와 컨센서스 괴리율을 기반으로 5D 종가를 추정합니다.',
    elo: 1920,
    forecastsCount: 24,
    completedCount: 19,
  },
  {
    id: 'u_bull',
    handle: 'tech_bull',
    name: '실리콘불',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    bio: 'AI 인프라 및 빅테크 실적 모멘텀 중심의 5거래일 추세 분석.',
    elo: 1490,
    forecastsCount: 11,
    completedCount: 8,
  },
  {
    id: 'u_macro',
    handle: 'macro_desk',
    name: '매크로데스크',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    bio: '금리와 유동성 지표에 따른 단기 주가 스윙 및 리스크 관리.',
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
  // 1. [NVDA — 기본 메인 종목] 6건 (LIVE 5건 + RESOLVED 1건)
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
    comment: '블랙웰 출하 모멘텀 본격화로 5거래일 연속 우상향 돌파 궤적.',
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
      comment: '데이터센터 증설 가이던스 상향 기대. D+2 단기 숨고르기 후 전고점 돌파 궤적.',
      lockedAt: '2026-10-02T09:20:00Z',
      steps: [0.018, 0.008, 0.032, 0.051, 0.068],
    },
    {
      id: 'fc_nvda_live_duel_1',
      authorId: 'u_macro',
      comment: '국채금리 반등 구간 진입으로 주 초반 눌림목(-3.2%) 소화 후 제한적 반등 예상.',
      lockedAt: '2026-10-02T10:45:00Z',
      steps: [-0.016, -0.032, -0.021, -0.008, 0.006],
    },
    {
      id: 'fc_nvda_live_3',
      authorId: 'u_alpha',
      comment: '옵션 만기 수급 집중으로 주 후반으로 갈수록 상승 기울기가 가팔라지는 경로.',
      lockedAt: '2026-10-02T11:30:00Z',
      steps: [0.009, 0.019, 0.028, 0.042, 0.055],
    },
    {
      id: 'fc_nvda_live_4',
      authorId: 'u_quant',
      comment: '단기 과열 해소 구간 진입. 고점 저항 확인 후 -2.8% 조정을 거치는 역발상 경로.',
      lockedAt: '2026-10-02T13:15:00Z',
      steps: [0.005, -0.011, -0.019, -0.024, -0.028],
    },
    {
      id: 'fc_nvda_live_5',
      authorId: 'u_alpha',
      comment: '빅테크 AI CAPEX 재확인 구간, 완만한 +3.6% 우상향 추세.',
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
  // 2. [TSLA — 고변동 모멘텀 종목] 6건 (LIVE 5건 + RESOLVED 1건)
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
    comment: 'FSD V13 배포 기대감으로 5거래일 전고점 돌파 궤적.',
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
      comment: '로보택시 이벤트 기대감 유입으로 +7.0% 상방 돌파 궤적.',
      lockedAt: '2026-10-02T09:15:00Z',
      steps: [0.012, 0.026, 0.041, 0.056, 0.070],
    },
    {
      id: 'fc_tsla_live_derived_1',
      authorId: 'u_quant',
      comment: '이벤트 직전 차익실현 물량으로 D+2까지 -3.5% 눌림목 후 V자 반등 예상.',
      lockedAt: '2026-10-02T11:45:00Z',
      steps: [-0.020, -0.035, -0.018, 0.002, 0.015],
    },
    {
      id: 'fc_tsla_live_3',
      authorId: 'u_bull',
      comment: '중국 인도량 서프라이즈 반영, 주 중반 변동성 소화 후 +4.8% 안착.',
      lockedAt: '2026-10-02T12:30:00Z',
      steps: [0.015, 0.009, 0.024, 0.036, 0.048],
    },
    {
      id: 'fc_tsla_live_4',
      authorId: 'u_macro',
      comment: '단기 밸류에이션 부담 구간, 5거래일 계단식 조정(-4.2%) 경로.',
      lockedAt: '2026-10-02T14:00:00Z',
      steps: [-0.008, -0.017, -0.026, -0.035, -0.042],
    },
    {
      id: 'fc_tsla_live_5',
      authorId: 'u_quant',
      comment: '20일 지지선 확인 후 D+4 변곡점에서 상방 이탈하는 +3.2% 스윙.',
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
  // 3. [AAPL — 안정형 컨센서스 종목] 6건 (LIVE 5건 + RESOLVED 1건)
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
    comment: '신형 아이폰 프로 라인업 리드타임 확대로 완만한 우상향 달성.',
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
    '아이폰 초기 수요 호조세 반영, 저변동 우상향(+2.6%) 예상.',
    '기관 리밸런싱 물량 소화 후 주 후반 반등 궤적.',
    '서비스 매출 성장세 견조, 5일 내내 방어적 상승 흐름.',
    '환율 역풍 우려로 주 중반 -1.5% 약세 조정 예상.',
    '빅테크 중 변동성 대비 샤프 비율 최상위 구간, +3.1% 목표.',
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
    actorName: 'Elo 정산',
    forecastId: 'fc_tsla_resolved_1',
    ticker: 'TSLA',
    message: 'TSLA 5D 궤적 정산 완료: 정확도 88점 달성으로 +21 LP가 반영되었습니다.',
    createdAt: '2026-09-28T16:00:00Z',
    read: false,
  },
  {
    id: 'notif_2',
    userId: 'u_alpha',
    type: 'resolved',
    actorHandle: 'STOXDRAW',
    actorName: '시장 컨센서스',
    forecastId: 'fc_nvda_live_3',
    ticker: 'NVDA',
    message: 'NVDA W2026-41 라운드 시장 컨센서스가 업데이트되었습니다 (+3.6%).',
    createdAt: '2026-10-02T15:30:00Z',
    read: true,
  },
];
