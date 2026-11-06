import type { Repository, FeedTab } from './repository';
import type {
  Forecast,
  User,
  Comment,
  Notification,
  Horizon,
  Mode,
  AnchorPoint,
  ForecastVersion,
  PracticeAttempt,
} from '../domain/types';
import { SEED_USERS, generateSeedForecasts, SEED_COMMENTS, SEED_NOTIFICATIONS } from './seed';
import { deriveForecastStatus } from '../domain/lifecycle';
import { computeForecastDigest } from '../domain/audit';

const KEYS = {
  FORECASTS: 'stoxdraw_v9_btc20d_forecasts',
  USERS: 'stoxdraw_v9_btc20d_users',
  LIKES: 'stoxdraw_v9_btc20d_likes',
  FOLLOWS: 'stoxdraw_v9_btc20d_follows',
  COMMENTS: 'stoxdraw_v9_btc20d_comments',
  NOTIFICATIONS: 'stoxdraw_v9_btc20d_notifications',
  PRACTICE: 'stoxdraw_v9_btc20d_practice',
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
      localStorage.setItem(
        KEYS.LIKES,
        JSON.stringify({ fc_btc_live_quant: 31, fc_btc_live_alpha: 24, fc_btc_live_satoshi: 17 })
      );
    }
    if (!localStorage.getItem(KEYS.FOLLOWS)) {
      localStorage.setItem(KEYS.FOLLOWS, JSON.stringify(['u_quant', 'u_alpha']));
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

  listFeed(tab: FeedTab, currentDateStr: string = '2026-10-02'): Forecast[] {
    const list = this.getForecasts();
    const sorted = [...list].sort(
      (a, b) => new Date(b.lockedAt).getTime() - new Date(a.lockedAt).getTime()
    );

    if (tab === 'results') {
      return sorted.filter(f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED');
    }

    if (tab === 'following') {
      const follows: string[] = JSON.parse(localStorage.getItem(KEYS.FOLLOWS) || '[]');
      return sorted.filter(f => f.authorId && follows.includes(f.authorId));
    }

    return sorted;
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
    horizon: Horizon;
    mode: Mode;
    comment: string;
    basePrice: number;
    baseDate: string;
    evalDates: string[];
    anchors?: AnchorPoint[];
    path?: { date: string; price: number }[];
    pathPct?: number[];
    roundId?: string;
    breakout?: { direction: 'up' | 'down'; price: number };
    parentId?: string;
  }): Forecast {
    const forecasts = this.getForecasts();
    const nowIso = new Date().toISOString();
    const id = 'fc_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);

    const tempForecast: Forecast = {
      ...input,
      id,
      lockedAt: nowIso,
      rulesVersion: 'v1',
    };

    const digestHash = computeForecastDigest(tempForecast);
    const prices = (input.path || []).map(p => p.price);
    const initialVersion: ForecastVersion = {
      version: 1,
      createdAt: nowIso,
      anchors: input.anchors || [],
      prices,
      comment: input.comment,
      digestHash,
    };

    const newForecast: Forecast = {
      ...tempForecast,
      versions: [initialVersion],
    };

    forecasts.unshift(newForecast);
    this.setForecasts(forecasts);

    if (input.parentId) {
      const parent = forecasts.find(f => f.id === input.parentId);
      if (parent && parent.authorId && parent.authorId !== input.authorId) {
        const actor = input.authorId ? this.getUser(input.authorId) : null;
        this.createNotification({
          userId: parent.authorId,
          type: 'response',
          actorHandle: actor ? actor.handle : 'anon_trader',
          actorName: actor ? actor.name : 'Anonymous Trader',
          forecastId: newForecast.id,
          ticker: newForecast.ticker,
          message: `님이 회원님의 ${newForecast.ticker} 20일 시나리오에 맞불 작도를 제출했습니다.`,
        });
      }
    }

    if (input.authorId) {
      const users = this.listAllUsers();
      const idx = users.findIndex(u => u.id === input.authorId);
      if (idx !== -1) {
        users[idx].forecastsCount += 1;
        localStorage.setItem(KEYS.USERS, JSON.stringify(users));
      }
    }

    return newForecast;
  }

  /**
   * 피치덱 02.3 & 05.2: 예측 기록 박제 및 버전 관리 (최초 제출본 보존 + 수정 이력 추가)
   */
  appendForecastVersion(
    forecastId: string,
    input: {
      anchors: AnchorPoint[];
      prices: number[];
      path: { date: string; price: number }[];
      pathPct: number[];
      comment: string;
      digestHash: string;
    }
  ): Forecast | undefined {
    const forecasts = this.getForecasts();
    const idx = forecasts.findIndex(f => f.id === forecastId);
    if (idx === -1) return undefined;

    const target = forecasts[idx];
    const existingVersions = target.versions && target.versions.length > 0
      ? [...target.versions]
      : [
          {
            version: 1,
            createdAt: target.lockedAt,
            anchors: target.anchors || [],
            prices: (target.path || []).map(p => p.price),
            comment: target.comment,
            digestHash: computeForecastDigest(target),
          },
        ];

    const nextVerNum = existingVersions.length + 1;
    const nowIso = new Date().toISOString();

    const nextVersion: ForecastVersion = {
      version: nextVerNum,
      createdAt: nowIso,
      anchors: input.anchors,
      prices: input.prices,
      comment: input.comment,
      digestHash: input.digestHash,
    };

    const updated: Forecast = {
      ...target,
      updatedAt: nowIso,
      anchors: input.anchors,
      path: input.path,
      pathPct: input.pathPct,
      comment: input.comment,
      versions: [...existingVersions, nextVersion],
    };

    forecasts[idx] = updated;
    this.setForecasts(forecasts);
    return updated;
  }

  claimAnonymous(anonId: string, userId: string) {
    const forecasts = this.getForecasts();
    let changed = false;
    forecasts.forEach(f => {
      if (f.anonId === anonId && !f.authorId) {
        f.authorId = userId;
        changed = true;
      }
    });
    if (changed) {
      this.setForecasts(forecasts);
    }
  }

  listPracticeAttempts(): PracticeAttempt[] {
    const raw = localStorage.getItem(KEYS.PRACTICE);
    return raw ? JSON.parse(raw) : [];
  }

  savePracticeAttempt(attempt: Omit<PracticeAttempt, 'id' | 'createdAt'>): PracticeAttempt {
    const list = this.listPracticeAttempts();
    const newAttempt: PracticeAttempt = {
      ...attempt,
      id: 'prac_' + Math.random().toString(36).substring(2, 8) + '_' + Date.now().toString(36),
      createdAt: new Date().toISOString(),
    };
    list.unshift(newAttempt);
    localStorage.setItem(KEYS.PRACTICE, JSON.stringify(list.slice(0, 50)));
    this.notify();
    return newAttempt;
  }

  getUser(id: string): User | undefined {
    return this.listAllUsers().find(u => u.id === id);
  }

  getUserByHandle(handle: string): User | undefined {
    return this.listAllUsers().find(u => u.handle.toLowerCase() === handle.toLowerCase());
  }

  listAllUsers(): User[] {
    const raw = localStorage.getItem(KEYS.USERS);
    return raw ? JSON.parse(raw) : SEED_USERS;
  }

  private getLikesMap(): Record<string, number> {
    return JSON.parse(localStorage.getItem(KEYS.LIKES) || '{}');
  }

  private getMyLikedSet(): Set<string> {
    const raw = localStorage.getItem(KEYS.LIKES + '_my') || '[]';
    return new Set(JSON.parse(raw));
  }

  isLiked(forecastId: string): boolean {
    return this.getMyLikedSet().has(forecastId);
  }

  toggleLike(forecastId: string): boolean {
    const map = this.getLikesMap();
    const mySet = this.getMyLikedSet();
    let liked = false;

    if (mySet.has(forecastId)) {
      mySet.delete(forecastId);
      map[forecastId] = Math.max(0, (map[forecastId] || 1) - 1);
      liked = false;
    } else {
      mySet.add(forecastId);
      map[forecastId] = (map[forecastId] || 0) + 1;
      liked = true;
    }

    localStorage.setItem(KEYS.LIKES, JSON.stringify(map));
    localStorage.setItem(KEYS.LIKES + '_my', JSON.stringify(Array.from(mySet)));
    this.notify();
    return liked;
  }

  getLikesCount(forecastId: string): number {
    const map = this.getLikesMap();
    return map[forecastId] || 0;
  }

  isFollowing(userId: string): boolean {
    const follows: string[] = JSON.parse(localStorage.getItem(KEYS.FOLLOWS) || '[]');
    return follows.includes(userId);
  }

  toggleFollow(userId: string): boolean {
    const follows: string[] = JSON.parse(localStorage.getItem(KEYS.FOLLOWS) || '[]');
    const idx = follows.indexOf(userId);
    let nowFollowing = false;
    if (idx !== -1) {
      follows.splice(idx, 1);
      nowFollowing = false;
    } else {
      follows.push(userId);
      nowFollowing = true;
    }
    localStorage.setItem(KEYS.FOLLOWS, JSON.stringify(follows));
    this.notify();
    return nowFollowing;
  }

  listComments(forecastId: string): Comment[] {
    const all: Comment[] = JSON.parse(localStorage.getItem(KEYS.COMMENTS) || '[]');
    return all.filter(c => c.forecastId === forecastId);
  }

  addComment(forecastId: string, author: User, content: string): Comment {
    const all: Comment[] = JSON.parse(localStorage.getItem(KEYS.COMMENTS) || '[]');
    const newComment: Comment = {
      id: 'c_' + Date.now().toString(36),
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

    const forecast = this.getForecast(forecastId);
    if (forecast && forecast.authorId && forecast.authorId !== author.id) {
      this.createNotification({
        userId: forecast.authorId,
        type: 'comment',
        actorHandle: author.handle,
        actorName: author.name,
        forecastId,
        ticker: forecast.ticker,
        message: `님이 회원님의 ${forecast.ticker} 예측에 코멘트를 남겼습니다.`,
      });
    }

    this.notify();
    return newComment;
  }

  private getNotifications(): Notification[] {
    return JSON.parse(localStorage.getItem(KEYS.NOTIFICATIONS) || '[]');
  }

  private createNotification(input: Omit<Notification, 'id' | 'createdAt' | 'read'>) {
    const all = this.getNotifications();
    all.unshift({
      ...input,
      id: 'n_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      createdAt: new Date().toISOString(),
      read: false,
    });
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(all));
  }

  listNotifications(userId: string): Notification[] {
    return this.getNotifications().filter(n => n.userId === userId);
  }

  markNotificationRead(id: string) {
    const all = this.getNotifications();
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

export const repository = new LocalRepository();
