import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../domain/types';
import { SEED_USERS } from './seed';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) ?? null) : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe('localRepository & session persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists mock OAuth login into KEYS.USERS and syncs getCurrentUser / getUserByHandle', async () => {
    const { repository } = await import('./localRepository');
    const { getCurrentUser, loginWithProvider } = await import('./session');

    const googleUser = loginWithProvider('google');
    expect(googleUser.id).toBe('user_my_account');
    expect(googleUser.handle).toBe('google_user');

    expect(repository.getUser('user_my_account')?.handle).toBe('google_user');
    expect(repository.getUserByHandle('google_user')?.id).toBe('user_my_account');
    expect(getCurrentUser()?.handle).toBe('google_user');

    const kakaoUser = loginWithProvider('kakao');
    expect(kakaoUser.handle).toBe('kakao_user');
    expect(repository.getUser('user_my_account')?.handle).toBe('kakao_user');
    expect(repository.getUserByHandle('kakao_user')?.id).toBe('user_my_account');
    expect(
      repository.listAllUsers().filter(u => u.id === 'user_my_account')
    ).toHaveLength(1);
  });

  it('recovers via fallback without throwing when stored JSON is corrupt', async () => {
    localStorage.setItem('op_v2_btc7d_forecasts', '{invalid_json');
    localStorage.setItem('op_v2_btc7d_users', '{invalid_json');
    localStorage.setItem('op_v2_btc7d_practice', 'not-json');

    const { repository } = await import('./localRepository');

    expect(repository.listFeed('all', '2026-10-02')).toEqual([]);
    expect(repository.listAllUsers()).toEqual(SEED_USERS);
    expect(repository.listPracticeAttempts()).toEqual([]);
  });

  it('updates existing users via upsertUser without creating duplicate records', async () => {
    const { repository } = await import('./localRepository');

    const baseUser: User = {
      id: 'user_custom_1',
      handle: 'macro_tester',
      name: 'Macro Tester',
      avatarUrl: '',
      bio: 'Initial bio',
      elo: 1320,
      forecastsCount: 2,
      completedCount: 1,
    };

    repository.upsertUser(baseUser);
    repository.upsertUser({
      ...baseUser,
      bio: 'Updated bio',
      elo: 1410,
      forecastsCount: 4,
    });

    const matches = repository.listAllUsers().filter(u => u.id === 'user_custom_1');
    expect(matches).toHaveLength(1);
    expect(matches[0].elo).toBe(1410);
    expect(matches[0].bio).toBe('Updated bio');
    expect(matches[0].forecastsCount).toBe(4);
    expect(repository.getUserByHandle('MACRO_TESTER')?.id).toBe('user_custom_1');
  });

  it('persists community posts, likes, and replies while recovering safely from corrupt storage', async () => {
    localStorage.setItem('op_v2_btc7d_community_posts', '{corrupt');
    localStorage.setItem('op_v2_btc7d_community_comments', 'bad');

    const { repository } = await import('./localRepository');
    expect(repository.listCommunityPosts()).toEqual([]);

    const created = repository.createCommunityPost({
      authorId: 'user_my_account',
      authorHandle: 'google_user',
      authorName: '구글 애널리스트',
      topic: 'market',
      title: '변동성 수축 구간 체크',
      body: 'D+2~D+3 변동폭 확인 후 진입',
    });

    const posts = repository.listCommunityPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe(created.id);

    expect(repository.isCommunityPostLiked(created.id)).toBe(false);
    expect(repository.toggleCommunityPostLike(created.id)).toBe(true);
    expect(repository.getCommunityPostLikesCount(created.id)).toBe(1);

    repository.addCommunityPostComment(
      created.id,
      { id: 'u_quant', handle: 'quant_craft', name: 'Quant Craft' },
      '동의합니다.'
    );
    expect(repository.listCommunityPostComments(created.id)).toHaveLength(1);
  });
});
