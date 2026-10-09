import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Search, X, ArrowRight } from 'lucide-react';

interface ShowcaseHeroSearchProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onTagSelect: (tag: string) => void;
}

const CATEGORY_CHIPS = [
  { label: '실시간 격전지 NVDA', query: 'NVDA' },
  { label: '실시간 격전지 TSLA', query: 'TSLA' },
  { label: '5일 단기 승부 AAPL', query: 'AAPL' },
  { label: '30일 스윙 PLTR', query: 'PLTR' },
  { label: '실적 발표 변곡점 MSFT', query: 'MSFT' },
];

export function ShowcaseHeroSearch({
  searchQuery,
  onSearchChange,
  onTagSelect,
}: ShowcaseHeroSearchProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pt-12 pb-8 sm:pt-16 sm:pb-12 text-center">
      {/* 1. Main Headline & Subtitle */}
      <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-3">
        다음 주가, 당신은 어떻게 보나요?
      </h1>
      <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto mb-8 font-normal">
        당신의 예측을 그리고 다른 사람들의 전망과 비교해 보세요.
      </p>

      {/* 2. Primary Actions */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <NavLink
          to="/draw"
          className="btn-signature-draw px-6 py-3 rounded-full text-sm sm:text-base tracking-wide"
        >
          <span>DRAW</span>
          <ArrowRight size={16} className="stroke-[2.5]" />
        </NavLink>

        <button
          type="button"
          onClick={() => {
            const section = document.getElementById('battle-section');
            if (section) section.scrollIntoView({ behavior: 'smooth' });
          }}
          className="px-6 py-3 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-sm sm:text-base transition"
        >
          실시간 배틀 보기
        </button>
      </div>

      {/* 3. 3-Step "How STOXDRAW Works" (Zero emojis, pristine typography) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 max-w-3xl mx-auto mb-8 text-left">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0e1017] border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <div className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-500 mb-1.5 uppercase tracking-wide">
            01 선 긋기
          </div>
          <div className="text-sm font-bold text-zinc-900 dark:text-white mb-1">
            차트에 미래 궤적 그리기
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            마우스나 터치로 본인이 생각하는 미래 주가 경로를 직접 선으로 그립니다.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#0e1017] border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <div className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-500 mb-1.5 uppercase tracking-wide">
            02 실시간 대결
          </div>
          <div className="text-sm font-bold text-zinc-900 dark:text-white mb-1">
            군중 컨센서스와 비교
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            수천 명의 집단 지성 평균선과 상위 랭커들의 선을 한 차트에서 대조합니다.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#0e1017] border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <div className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-500 mb-1.5 uppercase tracking-wide">
            03 기록 & 검증
          </div>
          <div className="text-sm font-bold text-zinc-900 dark:text-white mb-1">
            실제 주가로 스코어 검증
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            만료일에 실제 시장 가격과 자동 대조되어 적중률과 순위가 영구 기록됩니다.
          </p>
        </div>
      </div>

      {/* 4. Purpose-Driven Category Chips (No emojis) */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap mb-4">
        {CATEGORY_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => onTagSelect(chip.query)}
            className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60 transition"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* 5. Compact Secondary Search Bar */}
      <div className="max-w-md mx-auto relative">
        <div
          className={`flex items-center w-full px-4 py-2.5 rounded-full bg-white dark:bg-[#12141c] border transition-all duration-200 shadow-sm ${
            isFocused
              ? 'border-emerald-700 dark:border-emerald-500 ring-2 ring-emerald-700/10'
              : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <Search size={16} className="text-zinc-400 dark:text-zinc-500 mr-2.5 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="종목 티커(NVDA, TSLA...) 또는 예측가 검색"
            className="w-full bg-transparent text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
