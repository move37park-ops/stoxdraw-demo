import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { repository } from '../../data/localRepository';
import { CompactForecastCard } from '../../components/CompactForecastCard';
import type { FeedTab } from '../../data/repository';
import type { Forecast } from '../../domain/types';
import { Search, X } from 'lucide-react';

interface FeedPageProps {
  currentDateStr: string;
}

export function FeedPage({ currentDateStr }: FeedPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as FeedTab) || 'all';
  const filterStock = searchParams.get('stock') || searchParams.get('ticker') || '';

  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadFeed = () => {
    let list = repository.listFeed(currentTab, currentDateStr);
    if (filterStock) {
      list = list.filter(f => f.ticker.toLowerCase() === filterStock.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(f =>
        f.ticker.toLowerCase().includes(q) ||
        f.comment.toLowerCase().includes(q) ||
        (f.authorId && f.authorId.toLowerCase().includes(q))
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
    params.delete('ticker');
    setSearchParams(params);
  };

  return (
    <div className="w-full">
      {/* Header Banner */}
      <div className="mb-8">
        <div className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-500 mb-1">
          REALTIME FEED
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-2">
          실시간 예측 피드
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          모든 참여자의 미래 주가 궤적과 검증 완료 기록이 실시간으로 동기화됩니다.
        </p>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        {/* Pill Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', label: '전체 피드' },
            { id: 'following', label: '팔로잉' },
            { id: 'results', label: '검증 완료 결과' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as FeedTab)}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
                currentTab === tab.id
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="flex items-center gap-2">
          {filterStock && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
              <span>${filterStock.toUpperCase()}</span>
              <button onClick={handleClearStock} className="hover:text-rose-500">
                <X size={12} />
              </button>
            </div>
          )}

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="종목 또는 코멘트 검색"
              className="pl-8 pr-4 py-1.5 rounded-full text-xs sm:text-sm bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white w-48 sm:w-60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stream Cards Grid */}
      {forecasts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {forecasts.map(f => (
            <CompactForecastCard
              key={f.id}
              forecast={f}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 px-4 rounded-3xl bg-white dark:bg-[#0e1017] border border-zinc-200/80 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 mb-1">
            해당 조건의 예측 데이터가 없습니다.
          </p>
          <p className="text-xs text-zinc-400">
            검색어를 변경하거나 다른 탭을 선택해 보세요.
          </p>
        </div>
      )}
    </div>
  );
}
