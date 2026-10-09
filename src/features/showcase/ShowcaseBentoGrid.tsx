import { useNavigate } from 'react-router-dom';
import { ArrowRight, Flame, Users, CheckCircle2 } from 'lucide-react';

interface ShowcaseBentoGridProps {
  currentDateStr?: string;
}

export function ShowcaseBentoGrid({ currentDateStr: _currentDateStr }: ShowcaseBentoGridProps) {
  const navigate = useNavigate();

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 mb-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* 1. Large Left Featured Hero Card (Matches 'GPT-5 with Intelligent UI' card) */}
        <div
          onClick={() => navigate('/arena?ticker=NVDA')}
          className="lg:col-span-8 group relative rounded-[28px] sm:rounded-[32px] bg-white dark:bg-[#0d0f16] border border-zinc-200/80 dark:border-zinc-800 p-6 sm:p-8 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 cursor-pointer min-h-[440px]"
        >
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-sky-400/10 via-emerald-400/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          {/* Top Header Tags */}
          <div className="flex items-center justify-between mb-6 z-10">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5">
                <Flame size={13} className="text-amber-500 fill-amber-500" />
                실시간 최대 격전지
              </span>
              <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                NVDA · 5D Horizon
              </span>
            </div>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/50 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Users size={12} />
              1,420명 참여
            </span>
          </div>

          {/* Center Graphic: Sleek Visual Chart Preview */}
          <div className="relative w-full aspect-[21/9] sm:aspect-[24/9] bg-zinc-50 dark:bg-[#07080b] rounded-2xl border border-zinc-100 dark:border-zinc-800/80 p-4 mb-6 flex flex-col justify-between overflow-hidden">
            {/* Stock details */}
            <div className="flex items-center justify-between text-xs font-mono z-10">
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-900 dark:text-white text-sm">$NVDA</span>
                <span className="text-zinc-400">기준가 $128.80</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  군중 중간값 $144.50 (+12.2%)
                </span>
              </div>
            </div>

            {/* SVG Chart paths */}
            <svg viewBox="0 0 500 120" className="w-full h-full my-auto overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="bentoConsensusGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Line */}
              <line x1="0" y1="60" x2="500" y2="60" stroke="currentColor" strokeDasharray="3 3" className="text-zinc-200 dark:text-zinc-800" />
              <line x1="200" y1="10" x2="200" y2="110" stroke="currentColor" strokeDasharray="4 4" className="text-zinc-300 dark:text-zinc-700" />

              {/* Past Trend */}
              <path
                d="M 10 75 Q 80 50 120 70 T 200 60"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-zinc-400 dark:text-zinc-500"
              />

              {/* Base Point */}
              <circle cx="200" cy="60" r="4.5" className="fill-zinc-900 dark:fill-white" />

              {/* Crowd Consensus Future Path */}
              <path
                d="M 200 60 C 260 45, 340 30, 480 20"
                fill="none"
                stroke="#0284c7"
                strokeWidth="3.5"
                strokeDasharray="6 4"
                strokeLinecap="round"
              />
              <path
                d="M 200 60 C 260 45, 340 30, 480 20 L 480 90 L 200 60 Z"
                fill="url(#bentoConsensusGrad)"
              />
              <circle cx="480" cy="20" r="5" fill="#0284c7" />

              {/* Bear Alternative Line */}
              <path
                d="M 200 60 C 260 70, 360 85, 480 95"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2"
                strokeDasharray="4 4"
                strokeOpacity="0.6"
              />
              <circle cx="480" cy="95" r="4" fill="#f43f5e" fillOpacity="0.6" />
            </svg>

            {/* Bottom Sentiment Bar */}
            <div className="flex items-center justify-between text-[11px] font-mono mt-1 z-10 text-zinc-500">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Bull 67% (951명)</span>
              <span className="text-rose-500 dark:text-rose-400 font-semibold">Bear 33% (469명)</span>
            </div>
          </div>

          {/* Bottom Card Title & CTA */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 z-10">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">
                모두를 위한 NVDA의 미래 궤적 배틀
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xl leading-relaxed">
                실적 발표를 앞두고 군중의 기대선과 탑 랭커들의 궤적이 정면으로 충돌하고 있습니다.
                당신의 판단을 선으로 그려보세요.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="px-5 py-2.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs sm:text-sm font-semibold flex items-center gap-2 group-hover:bg-sky-600 dark:group-hover:bg-sky-400 dark:group-hover:text-black transition shadow-sm">
                <span>배틀 참전하기</span>
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </div>
        </div>

        {/* 2. Right Stacked Bento Column (3 Distinct Cards) */}
        <div className="lg:col-span-4 flex flex-col gap-5 sm:gap-6">
          {/* Card A: Warm Sunset Gradient Card (Matches sunset card in user's image) */}
          <div
            onClick={() => navigate('/arena?ticker=TSLA')}
            className="group relative rounded-[28px] p-6 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white overflow-hidden shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all duration-300 cursor-pointer min-h-[140px] flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-black/25 backdrop-blur-md">
                $TSLA · 30D 스윙
              </span>
              <span className="text-xs font-mono font-bold">+14.2% 상방 기대</span>
            </div>

            <div className="mt-3">
              <h3 className="text-lg font-bold tracking-tight leading-snug">
                테슬라 메가 트렌드 돌파 시나리오
              </h3>
              <p className="text-xs text-white/80 mt-1 line-clamp-1">
                로보택시 모멘텀과 군중의 30일 가격 궤적
              </p>
            </div>
          </div>

          {/* Card B: Dark Card with Neon Dots (Matches 'dots' card in user's image) */}
          <div
            onClick={() => navigate('/stream')}
            className="group relative rounded-[28px] p-6 bg-[#090a10] border border-zinc-800 text-white overflow-hidden shadow-sm hover:shadow-xl hover:border-zinc-700 transition-all duration-300 cursor-pointer min-h-[140px] flex flex-col justify-between"
          >
            {/* Playful Neon Dots Graphic */}
            <div className="flex items-center gap-2.5 mb-2">
              <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
              <span className="w-3.5 h-3.5 rounded-full bg-pink-500 shadow-[0_0_10px_#ec4899]" />
              <span className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-[0_0_10px_#fbbf24]" />
              <span className="text-xs font-mono text-zinc-400 ml-auto">Crowd Matrix</span>
            </div>

            <div>
              <h3 className="text-lg font-bold tracking-tight text-white group-hover:text-cyan-300 transition-colors">
                군중 지성(Crowd Expectation) 데이터
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                수천 명의 주관적 예측선이 모여 만드는 금융 컨센서스
              </p>
            </div>
          </div>

          {/* Card C: Modern R&D Track Record Card (Matches R&D card in user's image) */}
          <div
            onClick={() => navigate('/u/alpha_seeker')}
            className="group relative rounded-[28px] p-6 bg-zinc-100 dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white overflow-hidden shadow-sm hover:shadow-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 cursor-pointer min-h-[140px] flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                <CheckCircle2 size={12} className="text-sky-500" />
                100% 투명한 검증
              </span>
              <span className="text-xs font-mono text-zinc-400">Track Record</span>
            </div>

            <div>
              <h3 className="text-lg font-bold tracking-tight">
                기록되고 채점되는 포캐스트
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                시간이 지나면 실제 시장 가격과 일관된 기준으로 자동 대조됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
