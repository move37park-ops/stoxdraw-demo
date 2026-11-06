import type {
  User,
  Forecast,
  Comment,
  Notification,
  AnchorPoint,
  ForecastVersion,
} from '../domain/types';
import { BTC_TICKER, DEFAULT_BASE_DATE, getCurrentBtcPrice, getBtcHistoryBars } from './btcMarket';
import {
  buildInterpolatedTrajectory,
  getNextCalendarDays,
} from '../domain/interpolation';

export const SEED_USERS: User[] = [
  {
    id: 'u_quant',
    handle: 'quant_craft',
    name: 'Quant Craft',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    bio: 'BTC/USDT 20일 변동성 정규화 경로 모델링 및 파생상품 감마 변곡점 추적 (Diamond Tier).',
    elo: 1890,
    forecastsCount: 28,
    completedCount: 24,
  },
  {
    id: 'u_alpha',
    handle: 'alpha_seeker',
    name: 'Alpha Seeker',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    bio: '현물 ETF 순유입 사이클과 온체인 장기 보유자 물량 소화 기반 20일 추세 작도.',
    elo: 1820,
    forecastsCount: 22,
    completedCount: 19,
  },
  {
    id: 'u_satoshi',
    handle: 'satoshi_flow',
    name: 'Satoshi Flow',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    bio: '무기한 선물 펀딩비 과열 해소 구간 포착 및 스윙 변곡점 전문 포캐스터.',
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
    bio: '주요 매물대 지지·저항 리테스트 변곡점 중심의 보수적 리스크 관리.',
    elo: 1240,
    forecastsCount: 11,
    completedCount: 9,
  },
  {
    id: 'u_rookie',
    handle: 'onchain_rookie',
    name: 'Onchain Rookie',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    bio: '리플레이 랩으로 차트 추세 작도를 훈련 중인 크립토 트레이더.',
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

  const v1: ForecastVersion = {
    version: 1,
    createdAt: params.lockedAt,
    anchors,
    prices: initialInterp.prices,
    comment: params.comment,
    digestHash: `0x${params.id.replace(/[^a-z0-9]/gi, '').padEnd(16, 'a').slice(0, 16)}v1`,
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
    horizon: '20D',
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
  // 1. 진행 중인 현재 라운드 (기준일: 2026-10-02, 기준가: $75,897.47, 향후 20일: 10-03 ~ 10-22)
  // =========================================================================
  const liveBaseDate = DEFAULT_BASE_DATE;
  const liveBasePrice = getCurrentBtcPrice(liveBaseDate);
  const liveEvalDates = getNextCalendarDays(liveBaseDate, 20);
  const liveRoundId = 'R2026-W40-BTCUSDT-20D';

  forecasts.push(
    makeSeedForecast({
      id: 'fc_btc_live_quant',
      authorId: 'u_quant',
      baseDate: liveBaseDate,
      basePrice: liveBasePrice,
      evalDates: liveEvalDates,
      lockedAt: '2026-10-02T08:15:00Z',
      comment:
        'D+5 단기 반등 고점(+4.7%) 이후 D+7 눌림목 지지(+1.4%)를 확인한 뒤, 기관 현물 매수세로 D+14 돌파 및 D+20 +10.2% 도달 시나리오.',
      anchorsPct: [
        { day: 5, pct: 0.047 },
        { day: 7, pct: 0.014 },
        { day: 14, pct: 0.098 },
        { day: 20, pct: 0.102 },
      ],
      revisionAnchorsPct: {
        day: 20,
        pct: 0.108,
        updatedAt: '2026-10-02T14:20:00Z',
        comment:
          '[v2 수정] 현물 ETF 오더북 매수 벽 강화 확인. D+7 눌림목 지지 이후 D+20 최종 목표가를 +10.8%($84.1K)로 상향 조정.',
      },
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
        '온체인 거래소 보유량 감소세 지속. D+5 반등 후 D+8 짧은 숨고르기를 거쳐 D+14 전고점 돌파, 20일차 +11.2% 안착 전망.',
      anchorsPct: [
        { day: 5, pct: 0.044 },
        { day: 8, pct: 0.021 },
        { day: 14, pct: 0.095 },
        { day: 20, pct: 0.112 },
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
        '선물 미결제약정 과열 해소 후 완만한 계단식 우상향. D+7 눌림목 통과 후 D+20 +8.8% 도달 예측.',
      anchorsPct: [
        { day: 5, pct: 0.036 },
        { day: 7, pct: 0.012 },
        { day: 14, pct: 0.076 },
        { day: 20, pct: 0.088 },
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
        '초반 1주일 박스권 등락 이후 중반 유동성 회복 랠리. 20일 목표 수익률 +7.2%.',
      anchorsPct: [
        { day: 6, pct: 0.008 },
        { day: 13, pct: 0.054 },
        { day: 20, pct: 0.072 },
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
        '단기 기술적 반등(+3.2%) 이후 상단 매물대 저항으로 박스권 하단 재차 테스트(-3.6%) 시나리오.',
      anchorsPct: [
        { day: 5, pct: 0.032 },
        { day: 12, pct: -0.018 },
        { day: 20, pct: -0.036 },
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
        '단기 지지선 이탈 후 반등 실패를 예상하는 역발상 숏 관점 (-5.8%).',
      anchorsPct: [
        { day: 7, pct: -0.042 },
        { day: 14, pct: -0.022 },
        { day: 20, pct: -0.058 },
      ],
      roundId: liveRoundId,
    })
  );

  // =========================================================================
  // 2. 과거 정산 완료(RESOLVED)된 20일 라운드 (2026-09-05 ~ 2026-09-25, 실제 캔들과 정밀 동기화)
  // =========================================================================
  const pastBaseDate = '2026-09-05';
  const pastBaseBar = bars.find(b => b.date === pastBaseDate) || bars[157];
  const pastBasePrice = pastBaseBar ? pastBaseBar.close : 82988.36;
  const pastEvalDates = getNextCalendarDays(pastBaseDate, 20);
  const pastRoundId = 'R2026-W36-BTCUSDT-20D';

  forecasts.push(
    makeSeedForecast({
      id: 'fc_btc_resolved_quant',
      authorId: 'u_quant',
      baseDate: pastBaseDate,
      basePrice: pastBasePrice,
      evalDates: pastEvalDates,
      lockedAt: '2026-09-05T09:00:00Z',
      comment: 'D+6 소폭 조정(-1.6%) 후 D+11 반등 고점(+1.3%), 이후 하방 채널 이탈(-6.6%) 궤적 정밀 적중.',
      anchorsPct: [
        { day: 6, pct: -0.016 },
        { day: 11, pct: 0.013 },
        { day: 15, pct: -0.034 },
        { day: 20, pct: -0.066 },
      ],
      roundId: pastRoundId,
    }),
    makeSeedForecast({
      id: 'fc_btc_resolved_alpha',
      authorId: 'u_alpha',
      baseDate: pastBaseDate,
      basePrice: pastBasePrice,
      evalDates: pastEvalDates,
      lockedAt: '2026-09-05T10:30:00Z',
      comment: '중반부 $84K 저항 확인 후 하방 조정 파동 적중.',
      anchorsPct: [
        { day: 6, pct: -0.014 },
        { day: 11, pct: 0.015 },
        { day: 16, pct: -0.038 },
        { day: 20, pct: -0.063 },
      ],
      roundId: pastRoundId,
    }),
    makeSeedForecast({
      id: 'fc_btc_resolved_satoshi',
      authorId: 'u_satoshi',
      baseDate: pastBaseDate,
      basePrice: pastBasePrice,
      evalDates: pastEvalDates,
      lockedAt: '2026-09-05T11:45:00Z',
      comment: 'D+11 반등 이후 매물대 저항에 따른 하락 전환 적중.',
      anchorsPct: [
        { day: 6, pct: -0.018 },
        { day: 11, pct: 0.009 },
        { day: 20, pct: -0.058 },
      ],
      roundId: pastRoundId,
    }),
    makeSeedForecast({
      id: 'fc_btc_resolved_bull',
      authorId: 'u_bull',
      baseDate: pastBaseDate,
      basePrice: pastBasePrice,
      evalDates: pastEvalDates,
      lockedAt: '2026-09-05T13:15:00Z',
      comment: '하락 방향성은 적중했으나 낙폭을 다소 보수적으로 산정.',
      anchorsPct: [
        { day: 10, pct: 0.006 },
        { day: 20, pct: -0.046 },
      ],
      roundId: pastRoundId,
    }),
    makeSeedForecast({
      id: 'fc_btc_resolved_macro',
      authorId: 'u_macro',
      baseDate: pastBaseDate,
      basePrice: pastBasePrice,
      evalDates: pastEvalDates,
      lockedAt: '2026-09-05T14:50:00Z',
      comment: '박스권 상단 저항 후 완만한 약세 마감 예측.',
      anchorsPct: [
        { day: 8, pct: -0.012 },
        { day: 20, pct: -0.035 },
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
    content: 'D+7 레버리지 청산 눌림목 변곡점 위치에 동의합니다. 그 구간이 핵심 지지 테스트가 될 듯합니다.',
    createdAt: '2026-10-02T11:20:00Z',
  },
];

export const SEED_NOTIFICATIONS: Notification[] = [
  {
    id: 'n_1',
    userId: 'u_quant',
    type: 'comment',
    actorHandle: 'alpha_seeker',
    authorName: 'Alpha Seeker',
    forecastId: 'fc_btc_live_quant',
    ticker: BTC_TICKER,
    message: '님이 회원님의 BTC/USDT 20일 예측 경로에 의견을 남겼습니다.',
    createdAt: '2026-10-02T11:20:00Z',
    read: false,
  } as unknown as Notification,
];
