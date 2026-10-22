import type { Repository, FeedTab } from './repository';
import type { Forecast, User, Comment, Notification } from '../domain/types';
import { SEED_USERS, generateSeedForecasts, SEED_COMMENTS, SEED_NOTIFICATIONS } from './seed';
import { deriveForecastStatus } from '../domain/lifecycle';

const KEYS = {
  FORECASTS: 'stoxdraw_v6_forecasts',
  USERS: 'stoxdraw_v6_users',
  LIKES: 'stoxdraw_v6_likes',
  FOLLOWS: 'stoxdraw_v6_follows',
  COMMENTS: 'stoxdraw_v6_comments',
  NOTIFICATIONS: 'stoxdraw_v6_notifications',
};

class LocalRepository implements Repository {
  private listeners = new Set<() => void>();

  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized() {
    if (!localStorage.getItem(KEYS.USERS)) {
      localStorage.setItem(KEYS.USERS, JSON.stringify(SEED_USERS));
    }
    if (!localStorage.getItem(KEYS.FORECASTS)) {
      localStorage.setItem(KEYS.FORECASTS, JSON.stringify(generateSeedForecasts()));
    }
    if (!localStorage.getItem(KEYS.COMMENTS)) {
      localStorage.setItem(KEYS.COMMENTS, JSON.stringify(SEED_COMMENTS));
    }
    if (!localStorage.getItem(KEYS.NOTIFICATIONS)) {
      localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(SEED_NOTIFICATIONS));
    }
    if (!localStorage.getItem(KEYS.LIKES)) {
      localStorage.setItem(KEYS.LIKES, JSON.stringify({ fc_tsla_live_root: 24, fc_tsla_resolved_1: 18 }));
    }
    if (!localStorage.getItem(KEYS.FOLLOWS)) {
      localStorage.setItem(KEYS.FOLLOWS, JSON.stringify(['u_alpha']));
    }
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private getForecasts(): Forecast[] {
    const raw = localStorage.getItem(KEYS.FORECASTS);
    return raw ? JSON.parse(raw) : [];
  }

  private setForecasts(list: Forecast[]) {
    localStorage.setItem(KEYS.FORECASTS, JSON.stringify(list));
    this.notify();
  }

  listFeed(tab: FeedTab, currentDateStr: string = '2026-10-05'): Forecast[] {
    const list = this.getForecasts();
    // Sort descending by lockedAt
    const sorted = [...list].sort((a, b) => new Date(b.lockedAt).getTime() - new Date(a.lockedAt).getTime());

    if (tab === 'results') {
      return sorted.filter(f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED');
    }

    if (tab === 'following') {
      const follows: string[] = JSON.parse(localStorage.getItem(KEYS.FOLLOWS) || '[]');
      return sorted.filter(f => f.authorId && follows.includes(f.authorId));
    }

    return sorted; // 'all'
  }

  getForecast(id: string): Forecast | undefined {
    return this.getForecasts().find(f => f.id === id);
  }

  listChildren(parentId: string): Forecast[] {
    return this.getForecasts().filter(f => f.parentId === parentId);
  }

  listByUser(userId: string): Forecast[] {
    return this.getForecasts().filter(f => f.authorId === userId);
  }

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
  }): Forecast {
    const forecasts = this.getForecasts();
    const newForecast: Forecast = {
      ...input,
      id: 'fc_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36),
      lockedAt: new Date().toISOString(),
      rulesVersion: 'v1',
    };

    forecasts.unshift(newForecast);
    this.setForecasts(forecasts);

    // If derived from parent, generate notification for original author (§9.3, §32)
    if (input.parentId) {
      const parent = forecasts.find(f => f.id === input.parentId);
      if (parent && parent.authorId) {
        const author = input.authorId ? this.getUser(input.authorId) : null;
        const actorHandle = author ? author.handle : '익명 사용자';
        const actorName = author ? author.name : '익명 예측가';

        const notifs = this.getAllNotifications();
        notifs.unshift({
          id: 'notif_' + Date.now(),
          userId: parent.authorId,
          type: 'response',
          actorHandle,
          actorName,
          forecastId: newForecast.id,
          ticker: newForecast.ticker,
          message: `@${actorHandle} 님이 회원님의 Forecast에 [YOUR DRAW]로 새로운 궤적을 제시했습니다.`,
          createdAt: new Date().toISOString(),
          read: false,
        });
        localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifs));
      }
    }

    return newForecast;
  }

  claimAnonymous(anonId: string, userId: string): void {
    const list = this.getForecasts();
    let updated = false;
    const modified = list.map(f => {
      if (f.anonId === anonId && !f.authorId) {
        updated = true;
        return { ...f, authorId: userId };
      }
      return f;
    });

    if (updated) {
      this.setForecasts(modified);
    }
  }

  getUser(id: string): User | undefined {
    return this.listAllUsers().find(u => u.id === id);
  }

  getUserByHandle(handle: string): User | undefined {
    return this.listAllUsers().find(u => u.handle.toLowerCase() === handle.toLowerCase());
  }

  listAllUsers(): User[] {
    const raw = localStorage.getItem(KEYS.USERS);
    const parsed: User[] = raw ? JSON.parse(raw) : SEED_USERS;
    return parsed.map(u => {
      const seedMatch = SEED_USERS.find(s => s.id === u.id);
      return {
        ...u,
        elo: u.elo ?? seedMatch?.elo ?? 1200,
      };
    });
  }

  isLiked(forecastId: string): boolean {
    const likes = JSON.parse(localStorage.getItem(KEYS.LIKES + '_user') || '[]');
    return likes.includes(forecastId);
  }

  toggleLike(forecastId: string): boolean {
    const userLikes: string[] = JSON.parse(localStorage.getItem(KEYS.LIKES + '_user') || '[]');
    const allCounts: Record<string, number> = JSON.parse(localStorage.getItem(KEYS.LIKES) || '{}');
    const idx = userLikes.indexOf(forecastId);
    let nowLiked = false;

    if (idx >= 0) {
      userLikes.splice(idx, 1);
      allCounts[forecastId] = Math.max(0, (allCounts[forecastId] || 1) - 1);
    } else {
      userLikes.push(forecastId);
      allCounts[forecastId] = (allCounts[forecastId] || 0) + 1;
      nowLiked = true;
    }

    localStorage.setItem(KEYS.LIKES + '_user', JSON.stringify(userLikes));
    localStorage.setItem(KEYS.LIKES, JSON.stringify(allCounts));
    this.notify();
    return nowLiked;
  }

  getLikesCount(forecastId: string): number {
    const allCounts: Record<string, number> = JSON.parse(localStorage.getItem(KEYS.LIKES) || '{}');
    return allCounts[forecastId] || 0;
  }

  isFollowing(userId: string): boolean {
    const follows: string[] = JSON.parse(localStorage.getItem(KEYS.FOLLOWS) || '[]');
    return follows.includes(userId);
  }

  toggleFollow(userId: string): boolean {
    const follows: string[] = JSON.parse(localStorage.getItem(KEYS.FOLLOWS) || '[]');
    const idx = follows.indexOf(userId);
    let nowFollow = false;
    if (idx >= 0) {
      follows.splice(idx, 1);
    } else {
      follows.push(userId);
      nowFollow = true;
    }
    localStorage.setItem(KEYS.FOLLOWS, JSON.stringify(follows));
    this.notify();
    return nowFollow;
  }

  listComments(forecastId: string): Comment[] {
    const all: Comment[] = JSON.parse(localStorage.getItem(KEYS.COMMENTS) || '[]');
    return all.filter(c => c.forecastId === forecastId);
  }

  addComment(forecastId: string, author: User, content: string): Comment {
    const all: Comment[] = JSON.parse(localStorage.getItem(KEYS.COMMENTS) || '[]');
    const newComment: Comment = {
      id: 'cmt_' + Date.now(),
      forecastId,
      userId: author.id,
      authorHandle: author.handle,
      authorName: author.name,
      authorAvatar: author.avatarUrl,
      content,
      createdAt: new Date().toISOString(),
    };
    all.push(newComment);
    localStorage.setItem(KEYS.COMMENTS, JSON.stringify(all));
    this.notify();
    return newComment;
  }

  private getAllNotifications(): Notification[] {
    const raw = localStorage.getItem(KEYS.NOTIFICATIONS);
    return raw ? JSON.parse(raw) : [];
  }

  listNotifications(userId: string): Notification[] {
    return this.getAllNotifications().filter(n => n.userId === userId);
  }

  markNotificationRead(id: string): void {
    const all = this.getAllNotifications();
    const target = all.find(n => n.id === id);
    if (target) {
      target.read = true;
      localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(all));
      this.notify();
    }
  }

  getUnreadNotificationsCount(userId: string): number {
    return this.listNotifications(userId).filter(n => !n.read).length;
  }
}

export const repository: Repository = new LocalRepository();
