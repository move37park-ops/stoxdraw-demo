export type Horizon = '20D' | '5D' | '30D';
export type Mode = 'path' | 'breakout';
export type ForecastStatus = 'DRAFT' | 'LOCKED' | 'LIVE' | 'RESOLVED';

export interface PathPoint {
  date: string;
  price: number;
}

export interface AnchorPoint {
  day: number; // 1 ~ 20 (D+1 ~ D+20)
  price: number;
}

export interface ForecastVersion {
  version: number;          // 1 (최초 제출본), 2, 3...
  createdAt: string;        // 박제 시각 (ISO String)
  anchors: AnchorPoint[];   // 클릭하여 작도한 변곡점 목록
  prices: number[];         // 자동 보간된 20일 시계열 가격 (길이 20)
  comment: string;          // 해당 버전 코멘트
  digestHash: string;       // 불변 검증 해시
}

export interface BreakoutTarget {
  direction: 'up' | 'down';
  price: number;
}

export interface Forecast {
  id: string;
  authorId: string | null;       // null = Anonymous
  anonId: string;                // 익명 디바이스 ID (계정 연결 시 귀속)
  ticker: string;                // 'BTC/USDT'
  horizon: Horizon;              // 기본 '20D'
  mode: Mode;
  comment: string;
  lockedAt: string;              // 최초 제출 시각 (ISO String)
  updatedAt?: string;            // 최근 수정 시각 (ISO String)
  basePrice: number;             // Lock 시점 기준가
  baseDate: string;              // YYYY-MM-DD
  evalDates: string[];           // 평가 일봉 목록 (20일)
  anchors?: AnchorPoint[];       // 현재 활성 변곡점 배열
  versions?: ForecastVersion[];  // 최초 제출본(v1) 및 수정 이력(v2+) 보존 원장
  path?: PathPoint[];            // 보간된 20일 시계열 가격 배열
  pathPct?: number[];            // 기준가 대비 % 변동률 배열 [-0.02, 0.01, ...]
  roundId?: string;              // 라운드 ID (e.g. R2026-BTC-20D)
  breakout?: BreakoutTarget;     // Mode === 'breakout'
  parentId?: string;             // 원본 Forecast ID (맞불 대결 관계)
  rulesVersion: 'v1';
}

export interface ScoreBreakdown {
  total: number;                 // 0 ~ 100점
  pathScore: number;             // /50 (오차 정밀도)
  directionScore: number;        // /30 (방향성 적중)
  targetScore: number;           // /20 (변동성·목표가 정밀도)
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  directionHit: boolean;
  endErrorPct: number;
}

export type EloTier = 'DIAMOND' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'MASTER';

export interface EloProjection {
  expectedWinLp: number;         // 적중 시 예상 획득 LP (예: +28)
  expectedLossLp: number;        // 미달 시 예상 차감 LP (예: -14)
  expectedProbability: number;   // 기대 성취 확률 E (0.22 ~ 0.65)
  difficultyLabel: string;       // 예측 난이도 라벨 (예: '역발상 예측')
}

export interface EloSettlement {
  deltaLp: number;               // 정산 반영 LP (예: +24 또는 -12)
  performanceRatio: number;      // S = Score / 100
  expectedProbability: number;   // E
  expectedWinLp: number;
  expectedLossLp: number;
}

export interface MarketLandmark {
  id: string;
  label: string;                 // 예: '전고점 저항선'
  shortLabel: string;            // 캔버스 배지용 짧은 라벨
  category: 'consensus' | 'resistance' | 'support';
  price: number;
  changePct: number;
  benchmarkElo: number;          // 기준선 벤치마크 레이팅 (예: 1650)
}

export interface ForecastResult {
  mode: Mode;
  forecastChangePct: number;
  actualChangePct: number;
  directionHit: boolean;         // Path: 방향 일치 여부
  endErrorPct?: number;          // Path: 종가 오차율 (%)
  breakoutHit?: boolean;         // Breakout: 목표 달성 여부
  hitDate?: string;              // Breakout: 달성일
  score?: ScoreBreakdown;        // 100점 만점 하이브리드 점수
  eloSettlement?: EloSettlement; // 정량 채점 기반 Elo 레이팅 증감
}

export interface CrowdAggregate {
  ticker: string;
  horizon: Horizon;
  mode: Mode;
  participantsCount: number;
  isColdStart: boolean;          // 5명 미만일 경우 true
  // Path
  consensusPath?: PathPoint[];
  consensusChangePct?: number;
  // Breakout
  upPct?: number;
  downPct?: number;
  medianPrice?: number;
}

export interface User {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string;
  bio?: string;
  elo?: number;                  // 기본 Elo 레이팅 (기본 1200 LP)
  forecastsCount: number;
  completedCount: number;
}

export interface Comment {
  id: string;
  forecastId: string;
  userId: string;
  authorHandle: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'response' | 'comment' | 'resolved';
  actorHandle: string;
  actorName: string;
  forecastId: string;
  ticker: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface MarketBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PracticeAttempt {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  createdAt: string;
  basePrice: number;
  anchors: AnchorPoint[];
  forecastPrices: number[];
  actualPrices: number[];
  score: ScoreBreakdown;
}
