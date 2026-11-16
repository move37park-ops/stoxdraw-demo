import type {
  Forecast,
  User,
  Comment,
  Notification,
  Horizon,
  Mode,
  AnchorPoint,
  PracticeAttempt,
  CommunityPost,
  CommunityComment,
  CommunityTopic,
} from '../domain/types';

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
  }): Forecast;
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
  ): Forecast | undefined;
  claimAnonymous(anonId: string, userId: string): void;

  // Practice Replay Lab
  listPracticeAttempts(): PracticeAttempt[];
  savePracticeAttempt(attempt: Omit<PracticeAttempt, 'id' | 'createdAt'>): PracticeAttempt;

  // Users
  getUser(id: string): User | undefined;
  getUserByHandle(handle: string): User | undefined;
  listAllUsers(): User[];
  upsertUser(user: User): void;

  // Social
  isLiked(forecastId: string): boolean;
  toggleLike(forecastId: string): boolean;
  getLikesCount(forecastId: string): number;
  isFollowing(userId: string): boolean;
  toggleFollow(userId: string): boolean;

  // Comments
  listComments(forecastId: string): Comment[];
  addComment(forecastId: string, author: User, content: string): Comment;

  // Community Feed & Discussions
  listCommunityPosts(): CommunityPost[];
  createCommunityPost(input: {
    authorId: string | null;
    authorHandle: string;
    authorName: string;
    topic: CommunityTopic;
    title: string;
    body: string;
    forecastId?: string;
  }): CommunityPost;
  isCommunityPostLiked(postId: string): boolean;
  toggleCommunityPostLike(postId: string): boolean;
  getCommunityPostLikesCount(postId: string): number;
  listCommunityPostComments(postId: string): CommunityComment[];
  addCommunityPostComment(
    postId: string,
    author: { id: string | null; handle: string; name: string },
    content: string
  ): CommunityComment;

  // Notifications
  listNotifications(userId: string): Notification[];
  markNotificationRead(id: string): void;
  getUnreadNotificationsCount(userId: string): number;

  // Subscription
  subscribe(callback: () => void): () => void;
}
