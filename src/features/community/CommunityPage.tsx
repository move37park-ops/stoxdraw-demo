import { useState, useMemo, useEffect, useRef, useLayoutEffect, type KeyboardEvent } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  Lock,
  MessageSquare,
  Plus,
  Send,
  ThumbsUp,
  Trophy,
} from 'lucide-react';
import { LeaderboardPage } from '../leaderboard/LeaderboardPage';
import { repository } from '../../data/localRepository';
import { getCurrentUser, getOrCreateAnonId, subscribeSession } from '../../data/session';
import { DEFAULT_BASE_DATE, getBtcHistoryBars } from '../../data/btcMarket';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecastsWithCohort } from '../../domain/resolution';
import { getEloTierInfo, DEFAULT_ELO, MIN_ELO, formatSignedLp } from '../../domain/elo';
import { formatPct } from '../../domain/format';
import { localizeDataText, useI18n } from '../../lib/i18nCore';
import { track } from '../../lib/analytics';
import { ForecastSparkline } from '../../components/ForecastSparkline';
import type { CommunityPost, CommunityTopic, Forecast, ForecastResult, User } from '../../domain/types';

interface CommunityPageProps {
  currentDateStr: string;
}

type CommunityTab = 'feed' | 'rankings';
type FeedFilter = 'all' | 'discussion' | 'resolved' | 'live';

const TOPIC_META: Record<CommunityTopic, { ko: string; en: string }> = {
  market: { ko: '시황 분석', en: 'Market View' },
  review: { ko: '복기 메모', en: 'Post-Mortem' },
  discussion: { ko: '자유 토론', en: 'Discussion' },
};

function formatShortTime(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  return iso.slice(5, 16).replace('T', ' ');
}

export function CommunityPage({ currentDateStr }: CommunityPageProps) {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const activeTab: CommunityTab =
    location.pathname.startsWith('/leaderboard') || searchParams.get('tab') === 'rankings'
      ? 'rankings'
      : 'feed';

  const [tick, setTick] = useState(0);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [draftTopic, setDraftTopic] = useState<CommunityTopic>('market');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(() => new Set(['cp_seed_disc_shape']));
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubRepo = repository.subscribe(() => setTick(c => c + 1));
    const unsubSess = subscribeSession(() => setTick(c => c + 1));
    return () => {
      unsubRepo();
      unsubSess();
    };
  }, []);

  const currentUser = getCurrentUser();
  const anonId = getOrCreateAnonId();
  const cleanAnonSuffix = anonId.replace(/^anon[_-]?/i, '').slice(0, 4) || 'guest';
  const myHandle = currentUser ? currentUser.handle : `guest_${cleanAnonSuffix}`;
  const myName = currentUser ? currentUser.name : t('익명 참여자', 'Guest Trader');

  const {
    allUsers,
    userById,
    allForecasts,
    posts,
    cohortResults,
    myCurrentRoundForecast,
    topForecasters,
    myLiveElo,
  } = useMemo(() => {
    void tick;
    const users = repository.listAllUsers();
    const uMap = new Map<string, User>();
    const eloMap: Record<string, number> = {};
    users.forEach(u => {
      uMap.set(u.id, u);
      eloMap[u.id] = u.elo ?? DEFAULT_ELO;
    });

    const forecasts = repository.listFeed('all', currentDateStr);
    const btcBars = getBtcHistoryBars().filter(b => b.date <= currentDateStr);
    const resolved = forecasts.filter(
      f => deriveForecastStatus(f, currentDateStr) === 'RESOLVED'
    );
    const results: Map<string, ForecastResult> = resolveForecastsWithCohort(
      resolved,
      btcBars,
      eloMap
    );

    const mine =
      forecasts.find(
        f =>
          f.baseDate === DEFAULT_BASE_DATE &&
          ((currentUser && f.authorId === currentUser.id) || f.anonId === anonId)
      ) ?? null;

    const communityPosts = repository.listCommunityPosts();

    const rankedPreview = [...users]
      .map(u => ({
        user: u,
        liveElo: Math.max(MIN_ELO, u.elo ?? DEFAULT_ELO),
      }))
      .sort((a, b) => b.liveElo - a.liveElo)
      .slice(0, 3);

    const meEntry = currentUser ? uMap.get(currentUser.id) : undefined;
    const liveElo = Math.max(MIN_ELO, meEntry?.elo ?? currentUser?.elo ?? DEFAULT_ELO);

    return {
      allUsers: users,
      userById: uMap,
      allForecasts: forecasts,
      posts: communityPosts,
      cohortResults: results,
      myCurrentRoundForecast: mine,
      topForecasters: rankedPreview,
      myLiveElo: liveElo,
    };
  }, [tick, currentDateStr, currentUser, anonId]);

  const hasSubmittedCurrentRound = myCurrentRoundForecast !== null;

  const tabWrapRef = useRef<HTMLDivElement>(null);
  const feedTabRef = useRef<HTMLButtonElement>(null);
  const rankTabRef = useRef<HTMLButtonElement>(null);
  const [tabGlow, setTabGlow] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    ready: boolean;
  }>({ left: 0, top: 0, width: 0, height: 0, ready: false });

  useLayoutEffect(() => {
    const syncGlow = () => {
      const el = activeTab === 'feed' ? feedTabRef.current : rankTabRef.current;
      if (!el) return;
      setTabGlow({
        left: el.offsetLeft,
        top: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
        ready: el.offsetWidth > 0,
      });
    };
    syncGlow();
    const wrap = tabWrapRef.current;
    let observer: ResizeObserver | null = null;
    if (wrap && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(syncGlow);
      observer.observe(wrap);
    }
    window.addEventListener('resize', syncGlow);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncGlow);
    };
  }, [activeTab, posts.length, allUsers.length, locale]);

  const switchTab = (next: CommunityTab) => {
    track('community_tab_switched', { tab: next });
    navigate(next === 'rankings' ? '/community?tab=rankings' : '/community');
  };

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, current: CommunityTab) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next: CommunityTab = current === 'feed' ? 'rankings' : 'feed';
      switchTab(next);
      (next === 'feed' ? feedTabRef.current : rankTabRef.current)?.focus();
    }
  };

  type StreamEntry =
    | { kind: 'post'; sortTime: number; post: CommunityPost }
    | { kind: 'forecast'; sortTime: number; forecast: Forecast; isResolved: boolean };

  const streamEntries = useMemo(() => {
    const entries: StreamEntry[] = [];

    if (feedFilter === 'all' || feedFilter === 'discussion') {
      posts.forEach(post => {
        entries.push({
          kind: 'post',
          sortTime: new Date(post.createdAt).getTime(),
          post,
        });
      });
    }

    if (feedFilter === 'all' || feedFilter === 'resolved' || feedFilter === 'live') {
      allForecasts.forEach(fc => {
        const isResolved = deriveForecastStatus(fc, currentDateStr) === 'RESOLVED';
        if (feedFilter === 'resolved' && !isResolved) return;
        if (feedFilter === 'live' && isResolved) return;
        entries.push({
          kind: 'forecast',
          sortTime: new Date(fc.lockedAt).getTime(),
          forecast: fc,
          isResolved,
        });
      });
    }

    return entries.sort((a, b) => b.sortTime - a.sortTime);
  }, [posts, allForecasts, feedFilter, currentDateStr]);

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    const title = draftTitle.trim();
    const body = draftBody.trim();
    if (!title || !body) return;

    const created = repository.createCommunityPost({
      authorId: currentUser?.id ?? null,
      authorHandle: myHandle,
      authorName: myName,
      topic: draftTopic,
      title,
      body,
    });
    track('community_post_created', { postId: created.id, topic: draftTopic });
    setDraftTitle('');
    setDraftBody('');
    setIsComposerOpen(false);
    setFeedFilter('all');
  };

  const toggleExpandThread = (id: string) => {
    setExpandedPostIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmitReply = (targetKind: 'post' | 'forecast', id: string) => {
    const text = (replyDrafts[id] || '').trim();
    if (!text) return;
    if (targetKind === 'post') {
      repository.addCommunityPostComment(
        id,
        { id: currentUser?.id ?? null, handle: myHandle, name: myName },
        text
      );
    } else {
      const authorObj: User = currentUser ?? {
        id: anonId,
        handle: myHandle,
        name: myName,
        avatarUrl: '',
        elo: DEFAULT_ELO,
        forecastsCount: 0,
        completedCount: 0,
      };
      repository.addComment(id, authorObj, text);
    }
    setReplyDrafts(prev => ({ ...prev, [id]: '' }));
  };

  const boxStyle = {
    backgroundColor: 'var(--op-canvas)',
    border: '1px solid var(--op-line-strong)',
    borderRadius: '2px',
  } as const;

  const filterChips: { id: FeedFilter; label: string }[] = [
    { id: 'all', label: t('전체', 'All') },
    { id: 'discussion', label: t('시황·토론', 'Ideas') },
    { id: 'resolved', label: t('만기 복기', 'Settled') },
    { id: 'live', label: t('이번 라운드', 'Live Round') },
  ];

  return (
    <div
      className="px-4 sm:px-6 pt-4 pb-8 space-y-4 op-view-enter"
      style={{ backgroundColor: 'var(--op-canvas)' }}
    >
      {/* Box 1: Unified Community Header & Tab Navigation */}
      <section className="overflow-hidden" style={boxStyle}>
        <div className="px-5 py-4">
          <h1 className="v-display-md" style={{ color: 'var(--op-ink)' }}>
            {t('커뮤니티', 'Community')}
          </h1>
          <p className="v-caption mt-0.5" style={{ color: 'var(--op-ink-2)' }}>
            {t(
              'Elo 실력 기록이 연동된 관점 토론, 만기 복기 및 라운드 순위입니다.',
              'Cohort-verified commentary, post-mortem reviews, and live Elo rankings.'
            )}
          </p>
        </div>

        {/* Sub-Tabs Row */}
        <div
          className="px-5 py-2 flex flex-wrap items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--op-panel)',
            borderTop: '1px solid var(--op-line)',
          }}
        >
          <div
            ref={tabWrapRef}
            role="tablist"
            aria-label={t('커뮤니티 보기 전환', 'Community sections')}
            className="relative inline-flex items-center gap-1.5"
          >
            {tabGlow.ready && (
              <span
                aria-hidden="true"
                className="op-sliding-glow"
                style={{
                  transform: `translate3d(${tabGlow.left}px, ${tabGlow.top}px, 0)`,
                  width: `${tabGlow.width}px`,
                  height: `${tabGlow.height}px`,
                }}
              />
            )}

            <button
              ref={feedTabRef}
              type="button"
              role="tab"
              id="community-tab-feed"
              aria-selected={activeTab === 'feed'}
              aria-controls="community-panel-feed"
              tabIndex={activeTab === 'feed' ? 0 : -1}
              onClick={() => switchTab('feed')}
              onKeyDown={e => handleTabKeyDown(e, 'feed')}
              className="relative z-10 h-8 px-3 rounded-[4px] inline-flex items-center gap-1.5 text-[12.5px] font-semibold transition-colors"
              style={{
                color: activeTab === 'feed' ? 'var(--op-orange)' : 'var(--op-ink-2)',
              }}
            >
              <span>{t('피드 · 토론', 'Feed & Ideas')}</span>
              <span
                className="op-mono text-[10.5px] px-1.5 py-0.2 rounded-[2px]"
                style={{
                  backgroundColor:
                    activeTab === 'feed' ? 'var(--op-orange-soft)' : 'var(--op-raised)',
                  color: activeTab === 'feed' ? 'var(--op-orange)' : 'var(--op-ink-3)',
                }}
              >
                {posts.length + allForecasts.length}
              </span>
            </button>

            <button
              ref={rankTabRef}
              type="button"
              role="tab"
              id="community-tab-rankings"
              aria-selected={activeTab === 'rankings'}
              aria-controls="community-panel-rankings"
              tabIndex={activeTab === 'rankings' ? 0 : -1}
              onClick={() => switchTab('rankings')}
              onKeyDown={e => handleTabKeyDown(e, 'rankings')}
              className="relative z-10 h-8 px-3 rounded-[4px] inline-flex items-center gap-1.5 text-[12.5px] font-semibold transition-colors"
              style={{
                color: activeTab === 'rankings' ? 'var(--op-orange)' : 'var(--op-ink-2)',
              }}
            >
              <span>{t('Elo 랭킹', 'Elo Rankings')}</span>
              <span
                className="op-mono text-[10.5px] px-1.5 py-0.2 rounded-[2px]"
                style={{
                  backgroundColor:
                    activeTab === 'rankings' ? 'var(--op-orange-soft)' : 'var(--op-raised)',
                  color: activeTab === 'rankings' ? 'var(--op-orange)' : 'var(--op-ink-3)',
                }}
              >
                {allUsers.length}
              </span>
            </button>
          </div>

          <span className="text-[11.5px]" style={{ color: 'var(--op-ink-3)' }}>
            {hasSubmittedCurrentRound
              ? t(
                  '이번 라운드 제출 완료 · 모든 경로와 논거가 열려 있습니다.',
                  'Round locked in · All live peer paths and rationales are visible.'
                )
              : t(
                  '블라인드 보호 · 이번 라운드 목표가·경로는 내 예측 제출 후 공개됩니다.',
                  'Blind guard · Live targets unlock after you lock your 7D forecast.'
                )}
          </span>
        </div>
      </section>

      {/* Tab Body */}
      {activeTab === 'rankings' ? (
        <div
          role="tabpanel"
          id="community-panel-rankings"
          aria-labelledby="community-tab-rankings"
        >
          <LeaderboardPage currentDateStr={currentDateStr} embedded />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="community-panel-feed"
          aria-labelledby="community-tab-feed"
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start"
        >
          {/* Left 8 Cols: Filter + Composer + Feed Stream */}
          <div className="lg:col-span-8 space-y-3 min-w-0">
            {/* Filter Bar & Write Toggle */}
            <div
              className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2"
              style={boxStyle}
            >
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('피드 필터', 'Feed filter')}>
                {filterChips.map(chip => {
                  const active = feedFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFeedFilter(chip.id)}
                      className="h-7 px-2.5 rounded-[2px] text-[12px] font-medium transition-colors"
                      style={{
                        backgroundColor: active ? 'var(--op-orange-soft)' : 'transparent',
                        color: active ? 'var(--op-orange)' : 'var(--op-ink-2)',
                        border: active
                          ? '1px solid var(--op-orange)'
                          : '1px solid var(--op-line)',
                      }}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                aria-expanded={isComposerOpen}
                onClick={() => setIsComposerOpen(v => !v)}
                className="op-btn-ghost h-7 px-2.5 text-[12px] font-semibold"
                style={{
                  borderColor: isComposerOpen ? 'var(--op-orange)' : 'var(--op-line-strong)',
                  color: isComposerOpen ? 'var(--op-orange)' : 'var(--op-ink)',
                }}
              >
                <Plus size={12} aria-hidden="true" />
                {t('관점 글 작성', 'New Post')}
              </button>
            </div>

            {/* Collapsible New Discussion Post Composer */}
            {isComposerOpen && (
              <form
                onSubmit={handleCreatePost}
                className="p-4 sm:p-5 space-y-3"
                style={{
                  backgroundColor: 'var(--op-panel)',
                  border: '1px solid var(--op-line-strong)',
                  borderRadius: '2px',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5" role="group" aria-label={t('주제 분류', 'Topic category')}>
                    {(Object.keys(TOPIC_META) as CommunityTopic[]).map(topicKey => {
                      const active = draftTopic === topicKey;
                      return (
                        <button
                          key={topicKey}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setDraftTopic(topicKey)}
                          className="h-7 px-2.5 rounded-[2px] text-[11.5px] font-medium"
                          style={{
                            backgroundColor: active ? 'var(--op-raised)' : 'transparent',
                            color: active ? 'var(--op-ink)' : 'var(--op-ink-3)',
                            border: active
                              ? '1px solid var(--op-line-strong)'
                              : '1px solid var(--op-line)',
                          }}
                        >
                          {locale === 'en' ? TOPIC_META[topicKey].en : TOPIC_META[topicKey].ko}
                        </button>
                      );
                    })}
                  </div>
                  <span className="op-mono text-[11.5px]" style={{ color: 'var(--op-ink-3)' }}>
                    @{myHandle} · {myLiveElo} LP
                  </span>
                </div>

                <input
                  type="text"
                  value={draftTitle}
                  onChange={e => setDraftTitle(e.target.value)}
                  maxLength={80}
                  placeholder={t(
                    '제목을 입력하세요 (예: D+2 조정 폭 대비 펀딩비 변화 점검)',
                    'Post title (e.g., Funding compression vs D+2 pullback risk)'
                  )}
                  className="w-full h-9 px-3 rounded-[2px] text-[13px] outline-none"
                  style={{
                    backgroundColor: 'var(--op-canvas)',
                    border: '1px solid var(--op-line-strong)',
                    color: 'var(--op-ink)',
                  }}
                />

                <textarea
                  value={draftBody}
                  onChange={e => setDraftBody(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder={t(
                    '시장 레짐, 변동성, 과거 라운드 복기 관점을 자유롭게 공유하세요. (현재 라운드 구체적 목표가는 차트에서 제출)',
                    'Share regime notes, volatility insights, or post-mortems. Submit live D+7 paths on the chart.'
                  )}
                  className="w-full p-3 rounded-[2px] text-[13px] resize-none outline-none"
                  style={{
                    backgroundColor: 'var(--op-canvas)',
                    border: '1px solid var(--op-line-strong)',
                    color: 'var(--op-ink)',
                  }}
                />

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsComposerOpen(false)}
                    className="op-btn-ghost h-8 px-3 text-[12px]"
                  >
                    {t('취소', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={!draftTitle.trim() || !draftBody.trim()}
                    className="op-btn-primary h-8 px-3.5 text-[12px] disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    {t('게시하기', 'Publish')}
                  </button>
                </div>
              </form>
            )}

            {/* Feed Items */}
            {streamEntries.length === 0 ? (
              <div className="p-10 text-center text-[13px]" style={{ ...boxStyle, color: 'var(--op-ink-3)' }}>
                {t('해당 조건의 게시물이 없습니다.', 'No community posts match this filter.')}
              </div>
            ) : (
              <div className="space-y-3">
                {streamEntries.map(entry => {
                  if (entry.kind === 'post') {
                    const { post } = entry;
                    const authorUser = post.authorId ? userById.get(post.authorId) : undefined;
                    const authorElo = Math.max(MIN_ELO, authorUser?.elo ?? DEFAULT_ELO);
                    const tierInfo = getEloTierInfo(authorElo);
                    const liked = repository.isCommunityPostLiked(post.id);
                    const likesCount = repository.getCommunityPostLikesCount(post.id);
                    const comments = repository.listCommunityPostComments(post.id);
                    const isExpanded = expandedPostIds.has(post.id);
                    const topicLabel =
                      locale === 'en' ? TOPIC_META[post.topic].en : TOPIC_META[post.topic].ko;
                    const linkedForecast = post.forecastId
                      ? allForecasts.find(f => f.id === post.forecastId)
                      : undefined;
                    const linkedResult = linkedForecast
                      ? cohortResults.get(linkedForecast.id)
                      : undefined;

                    return (
                      <article key={post.id} className="p-4 sm:p-5 space-y-2.5" style={boxStyle}>
                        {/* Author Header Row (no nested interactive elements) */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={() => navigate(`/u/${post.authorHandle}`)}
                              className="op-mono text-[12.5px] font-semibold hover:underline cursor-pointer"
                              style={{ color: 'var(--op-ink)' }}
                            >
                              @{post.authorHandle}
                            </button>
                            <span
                              className="op-mono text-[11px] font-semibold inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px]"
                              style={{
                                backgroundColor: 'var(--op-panel)',
                                border: '1px solid var(--op-line)',
                                color: tierInfo.accentHex,
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-[1px]"
                                style={{ backgroundColor: tierInfo.accentHex }}
                                aria-hidden="true"
                              />
                              {locale === 'en' ? tierInfo.title : tierInfo.krTitle} · {authorElo}
                            </span>
                            <span
                              className="text-[11px] px-1.5 py-0.5 rounded-[2px]"
                              style={{
                                backgroundColor: 'var(--op-raised)',
                                color: 'var(--op-ink-2)',
                              }}
                            >
                              {topicLabel}
                            </span>
                          </div>

                          <span className="op-mono text-[11px]" style={{ color: 'var(--op-ink-3)' }}>
                            {formatShortTime(post.createdAt)}
                          </span>
                        </div>

                        {/* Title & Body */}
                        <div className="space-y-1">
                          <h2 className="text-[14.5px] font-semibold leading-snug" style={{ color: 'var(--op-ink)' }}>
                            {localizeDataText(post.title, locale)}
                          </h2>
                          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
                            {localizeDataText(post.body, locale)}
                          </p>
                        </div>

                        {linkedForecast && (
                          <button
                            type="button"
                            onClick={() => navigate(`/f/${linkedForecast.id}`)}
                            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[2px] text-[11.5px] hover:opacity-85 transition-opacity cursor-pointer"
                            style={{
                              backgroundColor: 'var(--op-panel)',
                              border: '1px solid var(--op-line-strong)',
                              color: 'var(--op-ink-2)',
                            }}
                          >
                            <span style={{ color: 'var(--op-ink)' }}>
                              {linkedForecast.baseDate} {t('라운드 정산', 'Settled Round')}
                            </span>
                            {linkedResult?.score && (
                              <span className="op-mono font-semibold" style={{ color: 'var(--op-bull)' }}>
                                {linkedResult.score.total.toFixed(1)}
                                {t('점', ' pts')}
                              </span>
                            )}
                            <ArrowUpRight size={12} aria-hidden="true" />
                          </button>
                        )}

                        {/* Actions Footer */}
                        <div
                          className="pt-2.5 flex items-center gap-3 text-[12px]"
                          style={{ borderTop: '1px solid var(--op-line)' }}
                        >
                          <button
                            type="button"
                            aria-pressed={liked}
                            onClick={() => repository.toggleCommunityPostLike(post.id)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[2px] transition-colors cursor-pointer"
                            style={{
                              backgroundColor: liked ? 'var(--op-orange-soft)' : 'transparent',
                              color: liked ? 'var(--op-orange)' : 'var(--op-ink-3)',
                            }}
                          >
                            <ThumbsUp size={12} aria-hidden="true" />
                            <span className="op-mono">{likesCount}</span>
                          </button>

                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            onClick={() => toggleExpandThread(post.id)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[2px] transition-colors hover:bg-[var(--op-panel)] cursor-pointer"
                            style={{ color: 'var(--op-ink-2)' }}
                          >
                            <MessageSquare size={12} aria-hidden="true" />
                            <span>{t(`댓글 ${comments.length}`, `Replies (${comments.length})`)}</span>
                          </button>
                        </div>

                        {/* Inline Discussion Replies */}
                        {isExpanded && (
                          <div
                            className="pt-2.5 space-y-2.5"
                            style={{ borderTop: '1px solid var(--op-line)' }}
                          >
                            {comments.map(c => {
                              const cAuthor = c.userId ? userById.get(c.userId) : undefined;
                              const cElo = Math.max(MIN_ELO, cAuthor?.elo ?? DEFAULT_ELO);
                              return (
                                <div
                                  key={c.id}
                                  className="px-3 py-2 rounded-[2px] text-[12.5px] space-y-1"
                                  style={{ backgroundColor: 'var(--op-panel)' }}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="op-mono text-[11.5px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                                      @{c.authorHandle}{' '}
                                      <span style={{ color: 'var(--op-ink-3)', fontWeight: 400 }}>
                                        · {cElo} LP
                                      </span>
                                    </span>
                                    <span className="op-mono text-[10.5px]" style={{ color: 'var(--op-ink-3)' }}>
                                      {formatShortTime(c.createdAt)}
                                    </span>
                                  </div>
                                  <p style={{ color: 'var(--op-ink-2)' }}>
                                    {localizeDataText(c.content, locale)}
                                  </p>
                                </div>
                              );
                            })}

                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={replyDrafts[post.id] || ''}
                                onChange={e =>
                                  setReplyDrafts(prev => ({ ...prev, [post.id]: e.target.value }))
                                }
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSubmitReply('post', post.id);
                                  }
                                }}
                                maxLength={240}
                                placeholder={t('의견 남기기...', 'Add a reply...')}
                                className="flex-1 h-8 px-2.5 rounded-[2px] text-[12px] outline-none"
                                style={{
                                  backgroundColor: 'var(--op-panel)',
                                  border: '1px solid var(--op-line-strong)',
                                  color: 'var(--op-ink)',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleSubmitReply('post', post.id)}
                                disabled={!(replyDrafts[post.id] || '').trim()}
                                className="op-btn-ghost h-8 px-2.5 text-[12px] disabled:opacity-40"
                                aria-label={t('댓글 등록', 'Submit reply')}
                              >
                                <Send size={12} aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  }

                  // Entry Kind: Forecast Card (Strict Blind Guard for active unsubmitted round)
                  const { forecast: fc, isResolved } = entry;
                  const authorUser = fc.authorId ? userById.get(fc.authorId) : undefined;
                  const handle = authorUser
                    ? authorUser.handle
                    : `guest_${fc.anonId.replace(/^anon[_-]?/i, '').slice(0, 4) || 'user'}`;
                  const authorElo = Math.max(MIN_ELO, authorUser?.elo ?? DEFAULT_ELO);
                  const tierInfo = getEloTierInfo(authorElo);
                  const isMine =
                    (currentUser && fc.authorId === currentUser.id) || fc.anonId === anonId;
                  const isBlindMasked =
                    !isResolved &&
                    fc.baseDate === DEFAULT_BASE_DATE &&
                    !hasSubmittedCurrentRound &&
                    !isMine;

                  if (isBlindMasked) {
                    return (
                      <article
                        key={fc.id}
                        className="px-4 py-3 flex flex-wrap items-center gap-2"
                        style={{
                          backgroundColor: 'var(--op-panel)',
                          border: '1px solid var(--op-line)',
                          borderRadius: '2px',
                        }}
                      >
                        <Lock size={13} style={{ color: 'var(--op-ink-3)' }} aria-hidden="true" />
                        <button
                          type="button"
                          onClick={() => navigate(`/u/${handle}`)}
                          className="op-mono text-[12px] font-semibold hover:underline cursor-pointer"
                          style={{ color: 'var(--op-ink)' }}
                        >
                          @{handle}
                        </button>
                        <span className="op-mono text-[11px]" style={{ color: tierInfo.accentHex }}>
                          {locale === 'en' ? tierInfo.title : tierInfo.krTitle} · {authorElo}
                        </span>
                        <span className="text-[12px]" style={{ color: 'var(--op-ink-3)' }}>
                          {t(
                            '이번 라운드 7D 예측 잠금 · 제출 후 공개',
                            'Locked 7D path · Hidden until you submit'
                          )}
                        </span>
                      </article>
                    );
                  }

                  const targetPrice =
                    fc.path && fc.path.length > 0
                      ? fc.path[fc.path.length - 1].price
                      : fc.basePrice;
                  const changePct =
                    fc.basePrice > 0
                      ? ((targetPrice - fc.basePrice) / fc.basePrice) * 100
                      : 0;
                  const resolvedResult = isResolved ? cohortResults.get(fc.id) : undefined;
                  const likesCount = repository.getLikesCount(fc.id);
                  const isLiked = repository.isLiked(fc.id);
                  const fcComments = repository.listComments(fc.id);
                  const isExpanded = expandedPostIds.has(fc.id);

                  return (
                    <article key={fc.id} className="p-4 sm:p-5 space-y-2.5" style={boxStyle}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => navigate(`/u/${handle}`)}
                            className="op-mono text-[12.5px] font-semibold hover:underline cursor-pointer"
                            style={{ color: 'var(--op-ink)' }}
                          >
                            @{handle}
                          </button>
                          <span
                            className="op-mono text-[11px] font-semibold inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px]"
                            style={{
                              backgroundColor: 'var(--op-panel)',
                              border: '1px solid var(--op-line)',
                              color: tierInfo.accentHex,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-[1px]"
                              style={{ backgroundColor: tierInfo.accentHex }}
                              aria-hidden="true"
                            />
                            {locale === 'en' ? tierInfo.title : tierInfo.krTitle} · {authorElo}
                          </span>
                          <span
                            className="op-mono text-[11px] px-1.5 py-0.5 rounded-[2px]"
                            style={{
                              backgroundColor: isResolved ? 'var(--op-raised)' : 'var(--op-orange-soft)',
                              color: isResolved ? 'var(--op-ink-2)' : 'var(--op-orange)',
                            }}
                          >
                            {isResolved ? t('만기 복기', 'Settled') : t('7D 진행 중', 'Live 7D')}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <ForecastSparkline forecast={fc} />
                          <div className="text-right op-mono">
                            <div
                              className="text-[12.5px] font-bold"
                              style={{ color: changePct >= 0 ? 'var(--op-bull)' : 'var(--op-bear)' }}
                            >
                              {formatPct(changePct)}
                            </div>
                            <div className="text-[11px]" style={{ color: 'var(--op-ink-3)' }}>
                              ${Math.round(targetPrice).toLocaleString('en-US')}
                            </div>
                          </div>
                        </div>
                      </div>

                      {fc.comment && (
                        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
                          {localizeDataText(fc.comment, locale)}
                        </p>
                      )}

                      <div
                        className="pt-2.5 flex flex-wrap items-center justify-between gap-2 text-[12px]"
                        style={{ borderTop: '1px solid var(--op-line)' }}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            aria-pressed={isLiked}
                            onClick={() => repository.toggleLike(fc.id)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[2px] cursor-pointer"
                            style={{
                              backgroundColor: isLiked ? 'var(--op-orange-soft)' : 'transparent',
                              color: isLiked ? 'var(--op-orange)' : 'var(--op-ink-3)',
                            }}
                          >
                            <ThumbsUp size={12} aria-hidden="true" />
                            <span className="op-mono">{likesCount}</span>
                          </button>

                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            onClick={() => toggleExpandThread(fc.id)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[2px] hover:bg-[var(--op-panel)] cursor-pointer"
                            style={{ color: 'var(--op-ink-2)' }}
                          >
                            <MessageSquare size={12} aria-hidden="true" />
                            <span>{t(`댓글 ${fcComments.length}`, `Replies (${fcComments.length})`)}</span>
                          </button>

                          {resolvedResult?.score && (
                            <span className="op-mono text-[11.5px]" style={{ color: 'var(--op-ink-2)' }}>
                              {resolvedResult.score.total.toFixed(1)}
                              {t('점', ' pts')}
                              {resolvedResult.eloSettlement && (
                                <span
                                  className="ml-1.5 font-semibold"
                                  style={{
                                    color:
                                      resolvedResult.eloSettlement.deltaLp >= 0
                                        ? 'var(--op-bull)'
                                        : 'var(--op-bear)',
                                  }}
                                >
                                  ({formatSignedLp(resolvedResult.eloSettlement.deltaLp)})
                                </span>
                              )}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => navigate(`/f/${fc.id}`)}
                          className="op-btn-ghost h-7 px-2.5 text-[11.5px]"
                        >
                          {t('상세 · 맞불 작도', 'Inspect / Counter')}
                          <ArrowUpRight size={12} aria-hidden="true" />
                        </button>
                      </div>

                      {isExpanded && (
                        <div
                          className="pt-2.5 space-y-2"
                          style={{ borderTop: '1px solid var(--op-line)' }}
                        >
                          {fcComments.map(c => (
                            <div
                              key={c.id}
                              className="px-3 py-2 rounded-[2px] text-[12.5px] space-y-1"
                              style={{ backgroundColor: 'var(--op-panel)' }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="op-mono text-[11.5px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                                  @{c.authorHandle}
                                </span>
                                <span className="op-mono text-[10.5px]" style={{ color: 'var(--op-ink-3)' }}>
                                  {formatShortTime(c.createdAt)}
                                </span>
                              </div>
                              <p style={{ color: 'var(--op-ink-2)' }}>
                                {localizeDataText(c.content, locale)}
                              </p>
                            </div>
                          ))}

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={replyDrafts[fc.id] || ''}
                              onChange={e =>
                                setReplyDrafts(prev => ({ ...prev, [fc.id]: e.target.value }))
                              }
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSubmitReply('forecast', fc.id);
                                }
                              }}
                              maxLength={240}
                              placeholder={t('이 예측에 의견 남기기...', 'Reply on this path...')}
                              className="flex-1 h-8 px-2.5 rounded-[2px] text-[12px] outline-none"
                              style={{
                                backgroundColor: 'var(--op-panel)',
                                border: '1px solid var(--op-line-strong)',
                                color: 'var(--op-ink)',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSubmitReply('forecast', fc.id)}
                              disabled={!(replyDrafts[fc.id] || '').trim()}
                              className="op-btn-ghost h-8 px-2.5 text-[12px] disabled:opacity-40"
                              aria-label={t('댓글 등록', 'Submit reply')}
                            >
                              <Send size={12} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right 4 Cols: Top Forecasters Preview */}
          <aside className="lg:col-span-4 space-y-3">
            <section className="p-4 sm:p-5 space-y-3" style={boxStyle}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[13.5px] font-semibold inline-flex items-center gap-1.5" style={{ color: 'var(--op-ink)' }}>
                  <Trophy size={13} style={{ color: 'var(--op-orange)' }} aria-hidden="true" />
                  {t('Elo 상위 포캐스터', 'Top Elo Forecasters')}
                </h2>
                <button
                  type="button"
                  onClick={() => switchTab('rankings')}
                  className="text-[11.5px] font-medium hover:underline cursor-pointer"
                  style={{ color: 'var(--op-orange)' }}
                >
                  {t('전체 순위', 'Full Rankings')}
                </button>
              </div>

              <div className="divide-y" style={{ borderColor: 'var(--op-line)' }}>
                {topForecasters.map((item, idx) => {
                  const tInfo = getEloTierInfo(item.liveElo);
                  return (
                    <div
                      key={item.user.id}
                      className="py-2.5 flex items-center justify-between gap-2"
                      style={{ borderColor: 'var(--op-line)' }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="op-mono text-[12px] font-bold w-4" style={{ color: 'var(--op-ink-3)' }}>
                          {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => navigate(`/u/${item.user.handle}`)}
                          className="op-mono text-[12.5px] font-semibold hover:underline truncate cursor-pointer"
                          style={{ color: 'var(--op-ink)' }}
                        >
                          @{item.user.handle}
                        </button>
                      </div>
                      <span className="op-mono text-[12px] font-semibold flex-shrink-0" style={{ color: tInfo.accentHex }}>
                        {item.liveElo.toLocaleString('en-US')} LP
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
