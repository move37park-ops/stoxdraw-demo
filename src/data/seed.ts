import type {
  User,
  Forecast,
  Comment,
  Notification,
  AnchorPoint,
  ForecastVersion,
  CommunityPost,
  CommunityComment,
} from '../domain/types';
import { BTC_TICKER, DEFAULT_BASE_DATE, getCurrentBtcPrice, getBtcHistoryBars } from './btcMarket';
import {
  buildInterpolatedTrajectory,
  getNextCalendarDays,
} from '../domain/interpolation';
import { computeForecastDigest } from '../domain/audit';

export const SEED_USERS: User[] = [
  {
    id: 'u_quant',
    handle: 'quant_craft',
    name: 'Quant Craft',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    bio: 'BTC/USDT 7일 변동성 정규화 경로 모델링 및 파생상품 감마 전환점 추적 (Diamond Tier).',
    elo: 1890,
    forecastsCount: 28,
    completedCount: 24,
  },
  {
    id: 'u_alpha',
    handle: 'alpha_seeker',
    name: 'Alpha Seeker',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    bio: '현물 ETF 순유입 사이클과 온체인 장기 보유자 물량 소화 기반 7일 예측 경로 분석.',
    elo: 1820,
    forecastsCount: 22,
    completedCount: 19,
  },
  {
    id: 'u_satoshi',
    handle: 'satoshi_flow',
    name: 'Satoshi Flow',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    bio: '무기한 선물 펀딩비 과열 해소 구간 포착 및 스윙 전환 구간 전문 트레이더.',
    elo: 1640,
    forecastsCount: 18,
    completedCount: 15,
  },
  {
    id: 'u_bull',
    handle: 'macro_whale',
    name: 'Macro Whale',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    bio: '글로벌 유동성 지표(M2) 및 달러 인덱스 역상관 기반 비트코인 중기 시나리오.',
    elo: 1460,
    forecastsCount: 15,
    completedCount: 12,
  },
  {
    id: 'u_macro',
    handle: 'chart_sculptor',
    name: 'Chart Sculptor',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    bio: '주요 매물대 지지·저항 리테스트 구간 중심의 보수적 리스크 관리.',
    elo: 1240,
    forecastsCount: 11,
    completedCount: 9,
  },
  {
    id: 'u_rookie',
    handle: 'onchain_rookie',
    name: 'Onchain Rookie',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    bio: '블라인드 연습으로 차트 예측 경로 그리기를 연습 중인 크립토 트레이더.',
    elo: 980,
    forecastsCount: 6,
    completedCount: 4,
  },
];

function makeSeedForecast(params: {
  id: string;
  authorId: string;
  baseDate: string;
  basePrice: number;
  evalDates: string[];
  lockedAt: string;
  comment: string;
  anchorsPct: { day: number; pct: number }[];
  revisionAnchorsPct?: { day: number; pct: number; updatedAt: string; comment: string };
  roundId: string;
}): Forecast {
  const anchors: AnchorPoint[] = params.anchorsPct.map(a => ({
    day: a.day,
    price: parseFloat((params.basePrice * (1 + a.pct)).toFixed(2)),
  }));

  const initialInterp = buildInterpolatedTrajectory(
    params.basePrice,
    params.evalDates,
    anchors
  );

  const seedDraft: Forecast = {
    id: params.id,
    authorId: params.authorId,
    anonId: `anon_${params.authorId}`,
    ticker: BTC_TICKER,
    horizon: '7D',
    mode: 'path',
    comment: params.comment,
    lockedAt: params.lockedAt,
    basePrice: params.basePrice,
    baseDate: params.baseDate,
    evalDates: params.evalDates,
    anchors,
    path: initialInterp.path,
    pathPct: initialInterp.pathPct,
    roundId: params.roundId,
    rulesVersion: 'v1',
  };

  const v1: ForecastVersion = {
    version: 1,
    createdAt: params.lockedAt,
    anchors,
    prices: initialInterp.prices,
    comment: params.comment,
    digestHash: computeForecastDigest(seedDraft),
  };

  const versions: ForecastVersion[] = [v1];
  let activeAnchors = anchors;
  let activePath = initialInterp.path;
  let activePathPct = initialInterp.pathPct;
  let activeComment = params.comment;
  let updatedAt: string | undefined = undefined;

  if (params.revisionAnchorsPct) {
    const revAnchors: AnchorPoint[] = [
      ...anchors.slice(0, -1),
      {
        day: params.revisionAnchorsPct.day,
        price: parseFloat(
          (params.basePrice * (1 + params.revisionAnchorsPct.pct)).toFixed(2)
        ),
      },
    ];
    const revInterp = buildInterpolatedTrajectory(
      params.basePrice,
      params.evalDates,
      revAnchors
    );
    const v2: ForecastVersion = {
      version: 2,
      createdAt: params.revisionAnchorsPct.updatedAt,
      anchors: revAnchors,
      prices: revInterp.prices,
      comment: params.revisionAnchorsPct.comment,
      digestHash: `0x${params.id.replace(/[^a-z0-9]/gi, '').padEnd(16, 'b').slice(0, 16)}v2`,
    };
    versions.push(v2);
    activeAnchors = revAnchors;
    activePath = revInterp.path;
    activePathPct = revInterp.pathPct;
    activeComment = params.revisionAnchorsPct.comment;
    updatedAt = params.revisionAnchorsPct.updatedAt;
  }

  return {
    id: params.id,
    authorId: params.authorId,
    anonId: `anon_${params.authorId}`,
    ticker: BTC_TICKER,
    horizon: '7D',
    mode: 'path',
    comment: activeComment,
    lockedAt: params.lockedAt,
    updatedAt,
    basePrice: params.basePrice,
    baseDate: params.baseDate,
    evalDates: params.evalDates,
    anchors: activeAnchors,
    versions,
    path: activePath,
    pathPct: activePathPct,
    roundId: params.roundId,
    rulesVersion: 'v1',
  };
}

export function generateSeedForecasts(): Forecast[] {
  const forecasts: Forecast[] = [];
  const bars = getBtcHistoryBars();

  // =========================================================================
  // 1. 진행 중인 현재 라운드 (기준일: 2026-10-02, 기준가: $75,897.47, 향후 7일: 10-03 ~ 10-09)
  // =========================================================================
  const liveBaseDate = DEFAULT_BASE_DATE;
  const liveBasePrice = getCurrentBtcPrice(liveBaseDate);
  const liveEvalDates = getNextCalendarDays(liveBaseDate, 7);
  const liveRoundId = 'R2026-W40-BTCUSDT-7D';

  forecasts.push(
    makeSeedForecast({
      id: 'fc_btc_live_quant',
      authorId: 'u_quant',
      baseDate: liveBaseDate,
      basePrice: liveBasePrice,
      evalDates: liveEvalDates,
      lockedAt: '2026-10-02T08:15:00Z',
      comment:
        'D+2 단기 반등(+2.4%) 이후 D+3 레버리지 청산 눌림목(-1.2%)을 거친 뒤, D+5 돌파 및 7일 만기 +6.8% 도달 시나리오.',
      anchorsPct: [
        { day: 2, pct: 0.024 },
        { day: 3, pct: -0.012 },
        { day: 5, pct: 0.045 },
        { day: 7, pct: 0.068 },
      ],
      roundId: liveRoundId,
    }),
    makeSeedForecast({
      id: 'fc_btc_live_alpha',
      authorId: 'u_alpha',
      baseDate: liveBaseDate,
      basePrice: liveBasePrice,
      evalDates: liveEvalDates,
      lockedAt: '2026-10-02T09:40:00Z',
      comment:
        '거래소 보유량 감소세 지속. D+2 반등 후 D+4 짧은 숨고르기(-0.8%)를 거쳐 D+7 +6.5% 안착 전망.',
      anchorsPct: [
        { day: 2, pct: 0.021 },
        { day: 4, pct: -0.008 },
        { day: 6, pct: 0.048 },
        { day: 7, pct: 0.065 },
      ],
      roundId: liveRoundId,
    }),
    makeSeedForecast({
      id: 'fc_btc_live_satoshi',
      authorId: 'u_satoshi',
      baseDate: liveBaseDate,
      basePrice: liveBasePrice,
      evalDates: liveEvalDates,
      lockedAt: '2026-10-02T11:05:00Z',
      comment:
        '초반 이틀 눌림목(-1.5%) 소화 후 주 후반 완만한 회복 랠리. 7일 목표 +4.6%.',
      anchorsPct: [
        { day: 2, pct: -0.015 },
        { day: 4, pct: 0.018 },
        { day: 7, pct: 0.046 },
      ],
      roundId: liveRoundId,
    }),
    makeSeedForecast({
      id: 'fc_btc_live_bull',
      authorId: 'u_bull',
      baseDate: liveBaseDate,
      basePrice: liveBasePrice,
      evalDates: liveEvalDates,
      lockedAt: '2026-10-02T12:30:00Z',
      comment:
        '초반 횡보 이후 주중 매수세 유입으로 7일 만기 +4.2% 계단식 상승 전망.',
      anchorsPct: [
        { day: 3, pct: 0.008 },
        { day: 5, pct: 0.031 },
        { day: 7, pct: 0.042 },
      ],
      roundId: liveRoundId,
    }),
    makeSeedForecast({
      id: 'fc_btc_live_macro',
      authorId: 'u_macro',
      baseDate: liveBaseDate,
      basePrice: liveBasePrice,
      evalDates: liveEvalDates,
      lockedAt: '2026-10-02T15:10:00Z',
      comment:
        'D+2 기술적 반등(+1.9%) 이후 상단 매물대 저항으로 주 후반 박스권 하단 재차 테스트(-2.8%) 시나리오.',
      anchorsPct: [
        { day: 2, pct: 0.019 },
        { day: 5, pct: -0.014 },
        { day: 7, pct: -0.028 },
      ],
      roundId: liveRoundId,
    }),
    makeSeedForecast({
      id: 'fc_btc_live_rookie',
      authorId: 'u_rookie',
      baseDate: liveBaseDate,
      basePrice: liveBasePrice,
      evalDates: liveEvalDates,
      lockedAt: '2026-10-02T16:45:00Z',
      comment:
        '단기 지지선 이탈 후 반등 실패를 예상하는 역발상 숏 관점 (-4.1%).',
      anchorsPct: [
        { day: 3, pct: -0.026 },
        { day: 5, pct: -0.015 },
        { day: 7, pct: -0.041 },
      ],
      roundId: liveRoundId,
    })
  );

  // =========================================================================
  // 2. 과거 정산 완료(RESOLVED)된 7일 라운드 (2026-09-18 ~ 2026-09-25, 실제 캔들과 정밀 동기화)
  // =========================================================================
  const pastBaseDate = '2026-09-18';
  const pastBaseBar = bars.find(b => b.date === pastBaseDate) || bars[170];
  const pastBasePrice = pastBaseBar ? pastBaseBar.close : 81189.43;
  const pastEvalDates = getNextCalendarDays(pastBaseDate, 7);
  const pastRoundId = 'R2026-W38-BTCUSDT-7D';

  forecasts.push(
    makeSeedForecast({
      id: 'fc_btc_resolved_quant',
      authorId: 'u_quant',
      baseDate: pastBaseDate,
      basePrice: pastBasePrice,
      evalDates: pastEvalDates,
      lockedAt: '2026-09-18T09:00:00Z',
      comment: 'D+2 소폭 조정(-1.3%) 후 D+5 약보합 반등(+0.4%), 이후 하방 채널 이탈(-4.6%) 궤적 정밀 적중.',
      anchorsPct: [
        { day: 2, pct: -0.013 },
        { day: 5, pct: 0.004 },
        { day: 7, pct: -0.046 },
      ],
      roundId: pastRoundId,
    }),
    makeSeedForecast({
      id: 'fc_btc_resolved_alpha',
      authorId: 'u_alpha',
      baseDate: pastBaseDate,
      basePrice: pastBasePrice,
      evalDates: pastEvalDates,
      lockedAt: '2026-09-18T10:30:00Z',
      comment: '주중 저항 확인 후 후반 하방 조정 파동(-4.3%) 적중.',
      anchorsPct: [
        { day: 2, pct: -0.011 },
        { day: 5, pct: 0.006 },
        { day: 7, pct: -0.043 },
      ],
      roundId: pastRoundId,
    }),
    makeSeedForecast({
      id: 'fc_btc_resolved_satoshi',
      authorId: 'u_satoshi',
      baseDate: pastBaseDate,
      basePrice: pastBasePrice,
      evalDates: pastEvalDates,
      lockedAt: '2026-09-18T11:45:00Z',
      comment: 'D+5 반등 이후 매물대 저항에 따른 하락 전환 적중.',
      anchorsPct: [
        { day: 3, pct: -0.014 },
        { day: 5, pct: 0.002 },
        { day: 7, pct: -0.039 },
      ],
      roundId: pastRoundId,
    }),
    makeSeedForecast({
      id: 'fc_btc_resolved_bull',
      authorId: 'u_bull',
      baseDate: pastBaseDate,
      basePrice: pastBasePrice,
      evalDates: pastEvalDates,
      lockedAt: '2026-09-18T13:15:00Z',
      comment: '하락 방향성은 적중했으나 낙폭을 다소 보수적으로 산정.',
      anchorsPct: [
        { day: 4, pct: 0.004 },
        { day: 7, pct: -0.028 },
      ],
      roundId: pastRoundId,
    }),
    makeSeedForecast({
      id: 'fc_btc_resolved_macro',
      authorId: 'u_macro',
      baseDate: pastBaseDate,
      basePrice: pastBasePrice,
      evalDates: pastEvalDates,
      lockedAt: '2026-09-18T14:50:00Z',
      comment: '박스권 상단 저항 후 완만한 약세 마감 예측.',
      anchorsPct: [
        { day: 3, pct: -0.010 },
        { day: 7, pct: -0.024 },
      ],
      roundId: pastRoundId,
    })
  );

  return forecasts;
}

export const SEED_COMMENTS: Comment[] = [
  {
    id: 'c_1',
    forecastId: 'fc_btc_live_quant',
    userId: 'u_alpha',
    authorHandle: 'alpha_seeker',
    authorName: 'Alpha Seeker',
    authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    content: 'D+3 레버리지 청산 눌림목 위치에 동의합니다. 그 구간이 핵심 지지 테스트가 될 듯합니다.',
    createdAt: '2026-10-02T11:20:00Z',
  },
];

export const SEED_NOTIFICATIONS: Notification[] = [
  {
    id: 'n_1',
    userId: 'u_quant',
    type: 'comment',
    actorHandle: 'alpha_seeker',
    actorName: 'Alpha Seeker',
    forecastId: 'fc_btc_live_quant',
    ticker: BTC_TICKER,
    message: '님이 회원님의 BTC/USDT 7일 예측 경로에 의견을 남겼습니다.',
    createdAt: '2026-10-02T11:20:00Z',
    read: false,
  },
];

export const SEED_COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: 'cp_seed_review_sep',
    authorId: 'u_quant',
    authorHandle: 'quant_craft',
    authorName: 'Quant Craft',
    topic: 'review',
    title: '9월 18일 라운드 복기: D+2 소폭 조정 뒤 채널 이탈 적중',
    body: '초반 이틀 변동성 수축 구간에서 과도하게 반등을 그리지 않고 D+5 저항 확인 후 하방 이탈 궤적으로 잡았던 점이 유효했습니다. 형태 유사도 점수(25점)가 전체 총점 차이를 크게 벌렸습니다.',
    createdAt: '2026-09-26T10:15:00Z',
    forecastId: 'fc_btc_resolved_quant',
  },
  {
    id: 'cp_seed_market_vol',
    authorId: 'u_alpha',
    authorHandle: 'alpha_seeker',
    authorName: 'Alpha Seeker',
    topic: 'market',
    title: '실현 변동성 σ 3%대 수축 구간의 7D 변곡점 배치 기준',
    body: '최근 현물 ETF 유출입과 무기한 선물 펀딩비가 모두 중립권으로 내려오면 D+7 단일 종가보다 D+2~D+4 사이 중간 눌림 폭이 경로 점수(50점)를 좌우합니다.',
    createdAt: '2026-10-02T07:45:00Z',
  },
  {
    id: 'cp_seed_disc_shape',
    authorId: 'u_macro',
    authorHandle: 'chart_sculptor',
    authorName: 'Chart Sculptor',
    topic: 'discussion',
    title: '상승 관점일 때 중간 눌림목을 몇 개 앵커로 나누시나요?',
    body: '만기 D+7 앵커만 찍어 직선으로 이어도 방향은 맞출 수 있지만, 실전 정산에서는 D+2~D+3 흔들림을 한 번 꺾어주는 편이 경로 점수 방어에 유리할지 의견 궁금합니다.',
    createdAt: '2026-10-02T05:30:00Z',
  },
];

export const SEED_COMMUNITY_COMMENTS: CommunityComment[] = [
  {
    id: 'cc_seed_1',
    postId: 'cp_seed_disc_shape',
    userId: 'u_alpha',
    authorHandle: 'alpha_seeker',
    authorName: 'Alpha Seeker',
    content: '강한 추세장이 아니면 보통 D+2 또는 D+3에 눌림목 앵커 1개만 추가해 3~4점 체제로 맞추는 편이 안정적이었습니다.',
    createdAt: '2026-10-02T06:20:00Z',
  },
  {
    id: 'cc_seed_2',
    postId: 'cp_seed_review_sep',
    userId: 'u_satoshi',
    authorHandle: 'satoshi_flow',
    authorName: 'Satoshi Flow',
    content: 'D+5 반등 고점 위치를 거의 일봉 종가 수준으로 맞추신 점이 인상적이었습니다.',
    createdAt: '2026-09-26T12:10:00Z',
  },
];
