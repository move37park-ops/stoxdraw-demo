import { useState } from 'react';
import { Search, X } from 'lucide-react';

interface ShowcaseHeroSearchProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onTagSelect: (tag: string) => void;
}

const POPULAR_TAGS = [
  { label: 'NVDA 실적 변곡점', query: 'NVDA' },
  { label: 'TSLA 30D 스윙', query: 'TSLA' },
  { label: 'AAPL 전고점', query: 'AAPL' },
  { label: 'PLTR 모멘텀', query: 'PLTR' },
  { label: '1위 @alpha_seeker', query: 'alpha_seeker' },
  { label: '빅테크 AI 배틀', query: 'MSFT' },
];

export function ShowcaseHeroSearch({
  searchQuery,
  onSearchChange,
  onTagSelect,
}: ShowcaseHeroSearchProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pt-12 pb-8 sm:pt-16 sm:pb-12 text-center">
      {/* Editorial Headline */}
      <div className="text-xs font-mono font-bold tracking-widest text-emerald-600 dark:text-emerald-500 uppercase mb-3">
        STOXDRAW
      </div>
      <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-3">
        다음 주가, 당신은 어떻게 보나요?
      </h1>
      <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto mb-8 font-normal">
        당신의 예측을 그리고 다른 사람들의 전망과 비교해 보세요.
      </p>

      {/* Pill-shaped Search Input */}
      <div className="max-w-2xl mx-auto relative mb-4">
        <div
          className={`flex items-center w-full px-5 py-3.5 sm:py-4 rounded-full bg-white dark:bg-[#12141c] border transition-all duration-200 shadow-sm ${
            isFocused
              ? 'border-emerald-600 dark:border-emerald-500 shadow-lg ring-2 ring-emerald-600/10 dark:ring-emerald-500/20'
              : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <Search size={20} className="text-zinc-400 dark:text-zinc-500 mr-3 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="종목 티커(NVDA, TSLA...) 또는 예측가 검색"
            className="w-full bg-transparent text-sm sm:text-base text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Quick Filter Tag Pills */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
        {POPULAR_TAGS.map((tag) => (
          <button
            key={tag.label}
            type="button"
            onClick={() => onTagSelect(tag.query)}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60 transition"
          >
            {tag.label}
          </button>
        ))}
      </div>
    </div>
  );
}
