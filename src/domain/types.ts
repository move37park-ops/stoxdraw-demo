export type Horizon = '5D' | '30D';
export type Mode = 'path' | 'breakout';
export type ForecastStatus = 'DRAFT' | 'LOCKED' | 'LIVE' | 'RESOLVED';

export interface PathPoint {
  date: string;
  price: number;
}

export interface BreakoutTarget {
  direction: 'up' | 'down';
  price: number;
}

export interface Forecast {
  id: string;
  authorId: string | null;       // null = Anonymous
  anonId: string;                // 익명 디바이스 ID (계정 연결 시 귀속)
  ticker: string;
  horizon: Horizon;
  mode: Mode;
  comment: string;
  lockedAt: string;              // ISO String
  basePrice: number;             // Lock 시점 기준가
  baseDate: string;              // YYYY-MM-DD
  evalDates: string[];           // 평가 거래일 목록 (5일 또는 21일)
  path?: PathPoint[];            // Mode === 'path'
  pathPct?: number[];            // 기준가 대비 % 변동률 배열 [-0.02, 0.01, ...]
  roundId?: string;              // 주간 라운드 ID (e.g. W2026-40-NVDA)
  breakout?: BreakoutTarget;     // Mode === 'breakout'
  parentId?: string;             // 원본 Forecast ID ([YOUR DRAW] 파생 대결 관계)
  rulesVersion: 'v1';
}

export interface ScoreBreakdown {
  total: number;                 // 0 ~ 100점
  pathScore: number;             // /50
  directionScore: number;        // /30
  targetScore: number;           // /20
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  directionHit: boolean;
  endErrorPct: number;
}

export type EloTier = 'MASTER' | 'DIAMOND' | 'GOLD' | 'SILVER' | 'BRONZE';

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
  label: string;                 // 예: '월가 목표선 (Wall St.)'
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
