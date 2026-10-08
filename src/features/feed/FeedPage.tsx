import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { repository } from '../../data/localRepository';
import { ForecastCard } from '../../components/ForecastCard';
import type { FeedTab } from '../../data/repository';
import type { Forecast } from '../../domain/types';
import { Sparkles, X, Search } from 'lucide-react';

interface FeedPageProps {
  currentDateStr: string;
}

export function FeedPage({ currentDateStr }: FeedPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as FeedTab) || 'all';
  const filterStock = searchParams.get('stock') || '';

  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem('hide-intro-banner'));

  const loadFeed = () => {
    let list = repository.listFeed(currentTab, currentDateStr);
    if (filterStock) {
      list = list.filter(f => f.ticker.toLowerCase() === filterStock.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(f =>
        f.ticker.toLowerCase().includes(q) ||
        f.comment.toLowerCase().includes(q)
      );
    }
    setForecasts(list);
  };

  useEffect(() => {
    loadFeed();
    const unsub = repository.subscribe(loadFeed);
    return () => unsub();
  }, [currentTab, filterStock, searchQuery, currentDateStr]);

  const handleTabChange = (tab: FeedTab) => {
    const params = new URLSearchParams(searchParams);
    if (tab === 'all') params.delete('tab');
    else params.set('tab', tab);
    setSearchParams(params);
  };

  const handleClearStock = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('stock');
    setSearchParams(params);
  };

  return (
    <div className="w-full">
      {/* 1. Header Sticky Tabs (All · Following · Results) — §6 Feed */}
      <div className="sticky top-0 lg:top-0 z-20 bg-black/90 backdrop-blur-md border-b border-[#1b1e26]">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-1 sm:gap-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'following', label: 'Following' },
              { id: 'results', label: 'Results' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as FeedTab)}
                className={`relative px-3 sm:px-4 py-2 text-[14px] font-semibold transition ${
                  currentTab === tab.id
                    ? 'text-white'
                    : 'text-[#71767b] hover:text-[#e4e4e7]'
                }`}
              >
                {tab.label}
                {currentTab === tab.id && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-white rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Quick Search Toggle */}
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`p-2 rounded-full transition ${
              isSearchOpen ? 'bg-zinc-800 text-white' : 'text-[#71767b] hover:text-white'
            }`}
          >
            <Search size={18} />
          </button>
        </div>

        {/* Search Bar Collapsible */}
        {isSearchOpen && (
          <div className="px-4 pb-3 pt-1">
            <input
              type="text"
              placeholder="종목명 또는 예측 키워드 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#14161f] border border-[#272b38] text-white text-[13px] placeholder-[#71767b] focus:outline-none focus:border-[#38bdf8]"
              autoFocus
            />
          </div>
        )}

        {/* Selected Stock Filter Pill */}
        {filterStock && (
          <div className="flex items-center gap-2 px-4 pb-2.5">
            <span className="text-xs text-[#71767b]">필터:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#181a24] border border-[#2e3344] text-xs font-mono text-white">
              {filterStock.toUpperCase()}
              <button onClick={handleClearStock} className="text-[#71767b] hover:text-white">
                <X size={12} />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Platform Intro Banner */}
      {showIntro && (
        <div className="mx-4 mt-3 mb-1 p-3.5 rounded-2xl bg-gradient-to-r from-[#0d1527] via-[#101426] to-[#1a1329] border border-sky-500/20 shadow-md flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400 mb-1">
              <Sparkles size={13} />
              <span>STOXDRAW 소셜 포캐스팅</span>
            </div>
            <p className="text-[13px] text-zinc-100 font-medium leading-snug">
              미래 주가를 직접 그리고, Crowd 합의와 비교하세요.
            </p>
            <p className="text-[11px] text-[#9aa0a6] mt-0.5">
              실제 시장 결과로 검증되는 나만의 예측 Record가 투명하게 축적됩니다.
            </p>
          </div>
          <button
            onClick={() => {
              setShowIntro(false);
              localStorage.setItem('hide-intro-banner', 'true');
            }}
            className="text-zinc-500 hover:text-white p-1 rounded transition"
            title="닫기"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 2. Forecast Feed Cards List */}
      <div>
        {forecasts.length > 0 ? (
          forecasts.map(forecast => (
            <ForecastCard
              key={forecast.id}
              forecast={forecast}
              currentDateStr={currentDateStr}
            />
          ))
        ) : (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-900 text-[#71767b] flex items-center justify-center mx-auto mb-3">
              <Sparkles size={20} />
            </div>
            <h4 className="font-semibold text-white mb-1">
              {currentTab === 'following'
                ? '팔로우 중인 사용자의 Forecast가 없습니다.'
                : currentTab === 'results'
                ? '검증 완료된 Forecast가 없습니다.'
                : '등록된 Forecast가 없습니다.'}
            </h4>
            <p className="text-[13px] text-[#71767b] max-w-xs mx-auto mb-4">
              {currentTab === 'following'
                ? '다른 예측가를 팔로우하거나 All 탭에서 새로운 예측을 만나보세요.'
                : '가장 먼저 나만의 미래 주가 궤적을 그려보세요!'}
            </p>
            {currentTab !== 'all' && (
              <button
                onClick={() => handleTabChange('all')}
                className="px-4 py-1.5 rounded-full bg-zinc-800 text-white text-xs font-medium hover:bg-zinc-700"
              >
                전체 Feed 보기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
