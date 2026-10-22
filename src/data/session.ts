import type { User } from '../domain/types';

const ANON_KEY = 'stoxdraw_anon_id';
const USER_KEY = 'stoxdraw_current_user';

export function getOrCreateAnonId(): string {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = 'anon_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

export function getCurrentUser(): User | null {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

const listeners = new Set<(user: User | null) => void>();

export function subscribeSession(callback: (user: User | null) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifySession(user: User | null) {
  listeners.forEach(cb => cb(user));
}

export function loginWithProvider(provider: 'google' | 'kakao'): User {
  const defaultUser: User = {
    id: 'user_my_account',
    handle: provider === 'google' ? 'google_user' : 'kakao_user',
    name: provider === 'google' ? '구글 애널리스트' : '카카오 애널리스트',
    avatarUrl: provider === 'google'
      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    bio: '5거래일 주가 경로 예측 및 Elo 정산 기록입니다.',
    elo: 1200,
    forecastsCount: 1,
    completedCount: 0,
  };

  localStorage.setItem(USER_KEY, JSON.stringify(defaultUser));
  notifySession(defaultUser);
  return defaultUser;
}

export function logout(): void {
  localStorage.removeItem(USER_KEY);
  notifySession(null);
}
