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
  breakout?: BreakoutTarget;     // Mode === 'breakout'
  parentId?: string;             // 원본 Forecast ID ([YOUR DRAW] 파생 대결 관계)
  rulesVersion: 'v1';
}

export interface ForecastResult {
  mode: Mode;
  forecastChangePct: number;
  actualChangePct: number;
  directionHit: boolean;         // Path: 방향 일치 여부
  endErrorPct?: number;          // Path: 종가 오차율 (%)
  breakoutHit?: boolean;         // Breakout: 목표 달성 여부
  hitDate?: string;              // Breakout: 달성일
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
