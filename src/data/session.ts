import type { User } from '../domain/types';
import { repository } from './localRepository';

const ANON_KEY = 'op_anon_id';
const USER_KEY = 'op_current_user';

export function getOrCreateAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = 'anon_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return 'anon_guest';
  }
}

export function getCurrentUser(): User | null {
  try {
    const data = localStorage.getItem(USER_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data) as User;
    if (parsed && parsed.id && !repository.getUser(parsed.id)) {
      repository.upsertUser(parsed);
    }
    return parsed;
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
  const existing = repository.getUser('user_my_account');
  const defaultUser: User = {
    id: 'user_my_account',
    handle: provider === 'google' ? 'google_user' : 'kakao_user',
    name: provider === 'google' ? '구글 애널리스트' : '카카오 애널리스트',
    avatarUrl: provider === 'google'
      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    bio: 'BTC/USDT 7일 가격 경로 예측 및 Elo 정산 기록입니다.',
    elo: existing?.elo ?? 1200,
    forecastsCount: existing?.forecastsCount ?? 0,
    completedCount: existing?.completedCount ?? 0,
  };

  try {
    localStorage.setItem(USER_KEY, JSON.stringify(defaultUser));
  } catch {
    // ignore storage errors
  }
  repository.upsertUser(defaultUser);
  notifySession(defaultUser);
  return defaultUser;
}

export function logout(): void {
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore storage errors
  }
  notifySession(null);
}
