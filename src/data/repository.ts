import type { Forecast, User, Comment, Notification } from '../domain/types';

export type FeedTab = 'all' | 'following' | 'results';

export interface Repository {
  // Forecasts
  listFeed(tab: FeedTab, currentDateStr?: string): Forecast[];
  getForecast(id: string): Forecast | undefined;
  listChildren(parentId: string): Forecast[];
  listByUser(userId: string): Forecast[];
  createForecast(input: {
    authorId: string | null;
    anonId: string;
    ticker: string;
    horizon: '5D' | '30D';
    mode: 'path' | 'breakout';
    comment: string;
    basePrice: number;
    baseDate: string;
    evalDates: string[];
    path?: { date: string; price: number }[];
    pathPct?: number[];
    roundId?: string;
    breakout?: { direction: 'up' | 'down'; price: number };
    parentId?: string;
  }): Forecast;
  claimAnonymous(anonId: string, userId: string): void;

  // Users
  getUser(id: string): User | undefined;
  getUserByHandle(handle: string): User | undefined;
  listAllUsers(): User[];

  // Social
  isLiked(forecastId: string): boolean;
  toggleLike(forecastId: string): boolean;
  getLikesCount(forecastId: string): number;
  isFollowing(userId: string): boolean;
  toggleFollow(userId: string): boolean;

  // Comments
  listComments(forecastId: string): Comment[];
  addComment(forecastId: string, author: User, content: string): Comment;

  // Notifications
  listNotifications(userId: string): Notification[];
  markNotificationRead(id: string): void;
  getUnreadNotificationsCount(userId: string): number;

  // Subscription
  subscribe(callback: () => void): () => void;
}
