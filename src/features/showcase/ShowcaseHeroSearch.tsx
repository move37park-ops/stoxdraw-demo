import { NavLink } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function ShowcaseHeroSearch() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 pt-14 pb-16 sm:pt-20 sm:pb-24 text-center">
      {/* 1. Header category tag matching reference ("소개") */}
      <div className="text-xs font-medium text-zinc-400 tracking-wider mb-3">
        소개
      </div>

      {/* 2. Main Title matching reference ("소개" / Typography H1: 40px/32px Bold) */}
      <h1 className="type-h1 text-white mb-4 tracking-tight">
        소개
      </h1>

      {/* 3. Subtitle (Typography Body: 16px Regular, 1.6 Leading) */}
      <p className="type-body text-zinc-400 max-w-xl mx-auto mb-14 text-center leading-relaxed">
        STOXDRAW의 사명은 모든 시장 참여자가 미래 주가를 직접 그리고,<br className="hidden sm:inline" />
        검증 가능한 데이터와 집단지성을 통해 시장의 미래를 읽도록 돕는 것입니다.
      </p>

      {/* 4. Large Featured Card (Exact layout as OpenAI reference) */}
      <div className="w-full rounded-3xl overflow-hidden border border-white/10 bg-[#0d0d10] text-left transition-all duration-300 hover:border-white/20">
        {/* Artistic Impressionist Visual Header */}
        <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] overflow-hidden bg-zinc-900">
          <img
            src="https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1400&q=80"
            alt="시장의 내일을 그리는 집단지성"
            className="w-full h-full object-cover filter brightness-[0.92] contrast-[1.05]"
            loading="eager"
          />

          {/* Minimalist chart trajectory watermark overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d10] via-black/20 to-transparent opacity-80" />

          {/* Subtle live indicator badge on top right */}
          <div className="absolute top-4 right-4 flex items-center px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-mono text-white">
            <span>실시간 5D 궤적 배틀</span>
          </div>
        </div>

        {/* Card Content Footer */}
        <div className="p-6 sm:p-8">
          <div className="text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
            <span>소셜 예측 플랫폼</span>
            <span>·</span>
            <span>2026</span>
          </div>

          <h2 className="type-h2 text-white mb-2 font-bold tracking-tight">
            시장의 내일을 먼저 그리는 집단지성
          </h2>

          <p className="type-body text-zinc-400 mb-6 max-w-2xl leading-relaxed">
            과거의 차트를 분석하는 데 그치지 않고, 5일 뒤 주가 궤적을 캔버스 위에 직접 브러시로 그리고 군집의 합의와 대결합니다.
          </p>

          <NavLink
            to="/arena"
            className="btn-flat-dark inline-flex items-center gap-2 text-xs sm:text-sm font-medium"
          >
            <span>플랫폼 시작하기</span>
            <ArrowRight size={14} />
          </NavLink>
        </div>
      </div>
    </div>
  );
}
