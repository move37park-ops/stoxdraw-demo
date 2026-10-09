import { NavLink } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface ShowcaseHeroSearchProps {
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onTagSelect?: (tag: string) => void;
}

export function ShowcaseHeroSearch({}: ShowcaseHeroSearchProps) {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 pt-16 pb-12 sm:pt-24 sm:pb-16 text-center">
      {/* 1. Ambient Glowing Badge (Matches reference) */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-medium mb-6 backdrop-blur-md shadow-[0_0_24px_rgba(4,120,87,0.3)] font-mono">
        실시간 주가 예측 플랫폼
      </div>

      {/* 2. Main Headline & Subtitle */}
      <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-4 leading-[1.15]">
        다음 주가, 당신은 어떻게 보나요?
      </h1>
      <p className="text-base sm:text-lg text-zinc-400 max-w-xl mx-auto mb-8 font-normal leading-relaxed">
        당신의 예측을 그리고 다른 사람들의 전망과 비교해 보세요.
      </p>

      {/* 3. Primary Actions */}
      <div className="flex items-center justify-center gap-4 mb-14">
        <NavLink
          to="/draw"
          className="btn-signature-draw px-7 py-3.5 rounded-full text-sm sm:text-base tracking-wide"
        >
          <span>DRAW</span>
          <ArrowRight size={16} className="stroke-[2.5]" />
        </NavLink>

        <NavLink
          to="/arena"
          className="text-sm font-semibold text-zinc-400 hover:text-white transition px-4 py-3.5 flex items-center gap-1.5"
        >
          <span>아레나 둘러보기</span>
          <ArrowRight size={15} />
        </NavLink>
      </div>

      {/* 4. Floating Cinematic Mockup Window (Matches the floating mockup cards in reference) */}
      <div className="max-w-4xl mx-auto relative rounded-3xl bg-[#0c0e14] border border-white/10 p-5 sm:p-7 shadow-[0_20px_70px_-15px_rgba(0,0,0,0.9)] overflow-hidden text-left">
        {/* Subtle radial glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Window Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-white text-base">$NVDA</span>
            <span className="text-xs text-zinc-400 font-mono">기준가 $128.80</span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-800/60">
              실시간 배틀
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-zinc-400 hidden sm:inline">1,420명 참여</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        {/* Sleek SVG Chart Canvas */}
        <div className="relative w-full aspect-[21/9] sm:aspect-[24/9] bg-[#07080b] rounded-2xl border border-white/5 p-4 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between text-xs font-mono z-10">
            <span className="text-zinc-500">최근 5일 추세 (실제 주가)</span>
            <span className="text-emerald-400 font-bold">
              군중 컨센서스 $144.50 (+12.2%)
            </span>
          </div>

          <svg viewBox="0 0 500 120" className="w-full h-full my-auto overflow-visible" preserveAspectRatio="none">
            <defs>
              <linearGradient id="heroConsensusGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#047857" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#047857" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            <line x1="0" y1="60" x2="500" y2="60" stroke="#181a24" strokeDasharray="3 3" />
            <line x1="200" y1="10" x2="200" y2="110" stroke="#252a38" strokeDasharray="4 4" />

            {/* Past Trend Line */}
            <path
              d="M 10 75 Q 80 50 120 70 T 200 60"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
            />

            {/* Forecast Area Band */}
            <path
              d="M 200 60 Q 280 40 380 30 T 490 25 L 490 65 Q 380 65 280 70 Z"
              fill="url(#heroConsensusGrad)"
            />

            {/* Consensus Path */}
            <path
              d="M 200 60 Q 280 48 380 42 T 490 35"
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
            />

            {/* Current Price Pin */}
            <circle cx="200" cy="60" r="5" fill="#ffffff" />
            <text x="200" y="80" fill="#a1a1aa" fontSize="10" fontFamily="monospace" textAnchor="middle">
              현재가 $128.80
            </text>

            {/* End Target Pin */}
            <circle cx="490" cy="35" r="5" fill="#10b981" />
            <text x="450" y="25" fill="#34d399" fontSize="10" fontFamily="monospace" fontWeight="bold">
              예측 목표 $144.50
            </text>
          </svg>

          <div className="flex items-center justify-between text-xs text-zinc-500 font-mono z-10 pt-2 border-t border-white/5">
            <span>시작일 10/05</span>
            <span className="text-zinc-400">만료 시 실제 주가 자동 대조 검증</span>
            <span>목표일 10/12 (5D)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
