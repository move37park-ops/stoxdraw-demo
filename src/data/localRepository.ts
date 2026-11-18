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
  CommunityPost,
  CommunityComment,
  CommunityTopic,
} from '../domain/types';
import {
  SEED_USERS,
  generateSeedForecasts,
  SEED_COMMENTS,
  SEED_NOTIFICATIONS,
  SEED_COMMUNITY_POSTS,
  SEED_COMMUNITY_COMMENTS,
} from './seed';
import { deriveForecastStatus } from '../domain/lifecycle';
import { computeForecastDigest } from '../domain/audit';

const KEYS = {
  FORECASTS: 'op_v2_btc7d_forecasts',
  USERS: 'op_v2_btc7d_users',
  LIKES: 'op_v2_btc7d_likes',
  FOLLOWS: 'op_v2_btc7d_follows',
  COMMENTS: 'op_v2_btc7d_comments',
  NOTIFICATIONS: 'op_v2_btc7d_notifications',
  PRACTICE: 'op_v2_btc7d_practice',
  COMMUNITY_POSTS: 'op_v2_btc7d_community_posts',
  COMMUNITY_LIKES: 'op_v2_btc7d_community_likes',
  COMMUNITY_COMMENTS: 'op_v2_btc7d_community_comments',
};

function safeReadJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / restricted storage errors
  }
}

function safeHasKey(key: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

class LocalRepository implements Repository {
  private listeners = new Set<() => void>();
  private readCache = new Map<string, unknown>();

  constructor() {
    this.ensureInitialized();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', () => {
        this.readCache.clear();
        this.notify();
      });
    }
  }

  private readCached<T>(key: string, fallback: T): T {
    if (this.readCache.has(key)) {
      return this.readCache.get(key) as T;
    }
    const parsed = safeReadJson<T>(key, fallback);
    if (parsed !== fallback) {
      this.readCache.set(key, parsed);
    }
    return parsed;
  }

  private writeCached(key: string, value: unknown): void {
    this.readCache.set(key, value);
    safeWriteJson(key, value);
  }

  private ensureInitialized() {
    if (!safeHasKey(KEYS.USERS)) {
      this.writeCached(KEYS.USERS, SEED_USERS);
    }
    if (!safeHasKey(KEYS.FORECASTS)) {
      this.writeCached(KEYS.FORECASTS, generateSeedForecasts());
    }
    if (!safeHasKey(KEYS.COMMENTS)) {
      this.writeCached(KEYS.COMMENTS, SEED_COMMENTS);
    }
    if (!safeHasKey(KEYS.NOTIFICATIONS)) {
      this.writeCached(KEYS.NOTIFICATIONS, SEED_NOTIFICATIONS);
    }
    if (!safeHasKey(KEYS.LIKES)) {
      this.writeCached(KEYS.LIKES, {
        fc_btc_live_quant: 31,
        fc_btc_live_alpha: 24,
        fc_btc_live_satoshi: 17,
      });
    }
    if (!safeHasKey(KEYS.FOLLOWS)) {
      this.writeCached(KEYS.FOLLOWS, ['u_quant', 'u_alpha']);
    }
    if (!safeHasKey(KEYS.COMMUNITY_POSTS)) {
      this.writeCached(KEYS.COMMUNITY_POSTS, SEED_COMMUNITY_POSTS);
    }
    if (!safeHasKey(KEYS.COMMUNITY_LIKES)) {
      this.writeCached(KEYS.COMMUNITY_LIKES, {
        cp_seed_review_sep: 19,
        cp_seed_market_vol: 14,
        cp_seed_disc_shape: 11,
      });
    }
    if (!safeHasKey(KEYS.COMMUNITY_COMMENTS)) {
      this.writeCached(KEYS.COMMUNITY_COMMENTS, SEED_COMMUNITY_COMMENTS);
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
    const raw = this.readCached<Forecast[]>(KEYS.FORECASTS, []);
    return Array.isArray(raw) ? raw : [];
  }

  private setForecasts(list: Forecast[]) {
    this.writeCached(KEYS.FORECASTS, list);
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
      const follows = safeReadJson<string[]>(KEYS.FOLLOWS, []);
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
    const forecasts = [...this.getForecasts()];
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
          message: `님이 회원님의 ${newForecast.ticker} 7일 시나리오에 반박 예측을 제출했습니다.`,
        });
      }
    }

    if (input.authorId) {
      const users = [...this.listAllUsers()];
      const idx = users.findIndex(u => u.id === input.authorId);
      if (idx !== -1) {
        users[idx] = { ...users[idx], forecastsCount: users[idx].forecastsCount + 1 };
        this.writeCached(KEYS.USERS, users);
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
    const forecasts = [...this.getForecasts()];
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
    let changed = false;
    const next = this.getForecasts().map(f => {
      if (f.anonId === anonId && !f.authorId) {
        changed = true;
        return { ...f, authorId: userId };
      }
      return f;
    });
    if (changed) {
      this.setForecasts(next);
    }
  }

  listPracticeAttempts(): PracticeAttempt[] {
    const raw = this.readCached<PracticeAttempt[]>(KEYS.PRACTICE, []);
    return Array.isArray(raw) ? raw : [];
  }

  savePracticeAttempt(attempt: Omit<PracticeAttempt, 'id' | 'createdAt'>): PracticeAttempt {
    const list = [...this.listPracticeAttempts()];
    const newAttempt: PracticeAttempt = {
      ...attempt,
      id: 'prac_' + Math.random().toString(36).substring(2, 8) + '_' + Date.now().toString(36),
      createdAt: new Date().toISOString(),
    };
    list.unshift(newAttempt);
    this.writeCached(KEYS.PRACTICE, list.slice(0, 50));
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
    const raw = this.readCached<User[]>(KEYS.USERS, SEED_USERS);
    return Array.isArray(raw) ? raw : SEED_USERS;
  }

  upsertUser(user: User): void {
    const users = [...this.listAllUsers()];
    const idx = users.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...user };
    } else {
      users.push(user);
    }
    this.writeCached(KEYS.USERS, users);
    this.notify();
  }

  private getLikesMap(): Record<string, number> {
    return this.readCached<Record<string, number>>(KEYS.LIKES, {});
  }

  private getMyLikedSet(): Set<string> {
    const raw = this.readCached<string[]>(KEYS.LIKES + '_my', []);
    return new Set(Array.isArray(raw) ? raw : []);
  }

  isLiked(forecastId: string): boolean {
    return this.getMyLikedSet().has(forecastId);
  }

  toggleLike(forecastId: string): boolean {
    const map = { ...this.getLikesMap() };
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

    this.writeCached(KEYS.LIKES, map);
    this.writeCached(KEYS.LIKES + '_my', Array.from(mySet));
    this.notify();
    return liked;
  }

  getLikesCount(forecastId: string): number {
    const map = this.getLikesMap();
    return map[forecastId] || 0;
  }

  isFollowing(userId: string): boolean {
    const follows = this.readCached<string[]>(KEYS.FOLLOWS, []);
    return Array.isArray(follows) && follows.includes(userId);
  }

  toggleFollow(userId: string): boolean {
    const raw = this.readCached<string[]>(KEYS.FOLLOWS, []);
    const follows = Array.isArray(raw) ? [...raw] : [];
    const idx = follows.indexOf(userId);
    let nowFollowing = false;
    if (idx !== -1) {
      follows.splice(idx, 1);
      nowFollowing = false;
    } else {
      follows.push(userId);
      nowFollowing = true;
    }
    this.writeCached(KEYS.FOLLOWS, follows);
    this.notify();
    return nowFollowing;
  }

  listComments(forecastId: string): Comment[] {
    const all = this.readCached<Comment[]>(KEYS.COMMENTS, []);
    return Array.isArray(all) ? all.filter(c => c.forecastId === forecastId) : [];
  }

  addComment(forecastId: string, author: User, content: string): Comment {
    const raw = this.readCached<Comment[]>(KEYS.COMMENTS, []);
    const all = Array.isArray(raw) ? [...raw] : [];
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
    this.writeCached(KEYS.COMMENTS, all);

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

  listCommunityPosts(): CommunityPost[] {
    const all = this.readCached<CommunityPost[]>(KEYS.COMMUNITY_POSTS, []);
    if (!Array.isArray(all)) return [];
    return [...all].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  createCommunityPost(input: {
    authorId: string | null;
    authorHandle: string;
    authorName: string;
    topic: CommunityTopic;
    title: string;
    body: string;
    forecastId?: string;
  }): CommunityPost {
    const all = this.listCommunityPosts();
    const post: CommunityPost = {
      id: 'cp_' + Math.random().toString(36).substring(2, 8) + '_' + Date.now().toString(36),
      authorId: input.authorId,
      authorHandle: input.authorHandle,
      authorName: input.authorName,
      topic: input.topic,
      title: input.title.trim(),
      body: input.body.trim(),
      createdAt: new Date().toISOString(),
      forecastId: input.forecastId,
    };
    all.unshift(post);
    this.writeCached(KEYS.COMMUNITY_POSTS, all);
    this.notify();
    return post;
  }

  private getCommunityLikesMap(): Record<string, number> {
    return this.readCached<Record<string, number>>(KEYS.COMMUNITY_LIKES, {});
  }

  private getMyCommunityLikedSet(): Set<string> {
    const arr = this.readCached<string[]>(KEYS.COMMUNITY_LIKES + '_my', []);
    return new Set(Array.isArray(arr) ? arr : []);
  }

  isCommunityPostLiked(postId: string): boolean {
    return this.getMyCommunityLikedSet().has(postId);
  }

  toggleCommunityPostLike(postId: string): boolean {
    const map = { ...this.getCommunityLikesMap() };
    const mySet = this.getMyCommunityLikedSet();
    let liked = false;
    if (mySet.has(postId)) {
      mySet.delete(postId);
      map[postId] = Math.max(0, (map[postId] || 1) - 1);
      liked = false;
    } else {
      mySet.add(postId);
      map[postId] = (map[postId] || 0) + 1;
      liked = true;
    }
    this.writeCached(KEYS.COMMUNITY_LIKES, map);
    this.writeCached(KEYS.COMMUNITY_LIKES + '_my', Array.from(mySet));
    this.notify();
    return liked;
  }

  getCommunityPostLikesCount(postId: string): number {
    return this.getCommunityLikesMap()[postId] || 0;
  }

  listCommunityPostComments(postId: string): CommunityComment[] {
    const all = this.readCached<CommunityComment[]>(KEYS.COMMUNITY_COMMENTS, []);
    if (!Array.isArray(all)) return [];
    return all.filter(c => c.postId === postId);
  }

  addCommunityPostComment(
    postId: string,
    author: { id: string | null; handle: string; name: string },
    content: string
  ): CommunityComment {
    const all = this.readCached<CommunityComment[]>(KEYS.COMMUNITY_COMMENTS, []);
    const list = Array.isArray(all) ? [...all] : [];
    const entry: CommunityComment = {
      id: 'cc_' + Math.random().toString(36).substring(2, 7) + '_' + Date.now().toString(36),
      postId,
      userId: author.id,
      authorHandle: author.handle,
      authorName: author.name,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    list.push(entry);
    this.writeCached(KEYS.COMMUNITY_COMMENTS, list);
    this.notify();
    return entry;
  }

  private getNotifications(): Notification[] {
    const raw = this.readCached<Notification[]>(KEYS.NOTIFICATIONS, []);
    return Array.isArray(raw) ? raw : [];
  }

  private createNotification(input: Omit<Notification, 'id' | 'createdAt' | 'read'>) {
    const all = [...this.getNotifications()];
    all.unshift({
      ...input,
      id: 'n_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      createdAt: new Date().toISOString(),
      read: false,
    });
    this.writeCached(KEYS.NOTIFICATIONS, all);
  }

  listNotifications(userId: string): Notification[] {
    return this.getNotifications().filter(n => n.userId === userId);
  }

  markNotificationRead(id: string) {
    const all = [...this.getNotifications()];
    const idx = all.findIndex(n => n.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], read: true };
      this.writeCached(KEYS.NOTIFICATIONS, all);
      this.notify();
    }
  }

  getUnreadNotificationsCount(userId: string): number {
    return this.listNotifications(userId).filter(n => !n.read).length;
  }
}

export const repository = new LocalRepository();
