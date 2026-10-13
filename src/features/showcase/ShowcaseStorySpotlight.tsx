import { NavLink } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function ShowcaseStorySpotlight() {
  return (
    <section className="w-full max-w-4xl mx-auto px-4 py-16 sm:py-24">
      {/* 1. Large Centered Editorial Manifesto / Quote Statement */}
      <div className="py-12 sm:py-20 text-center">
        <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-relaxed max-w-3xl mx-auto tracking-tight">
          STOXDRAW는 단순히 주가를 추측하는 곳이 아닙니다.<br className="hidden sm:inline" />
          모든 예측을 타임스탬프와 함께 투명하게 공개하고,<br className="hidden sm:inline" />
          데이터와 집단지성으로 시장의 미래를 실증하는 가장 솔직한 기록입니다.
        </p>
      </div>

      {/* 2. Editorial Media 1: People in conversation */}
      <div className="w-full rounded-3xl overflow-hidden border border-white/10 bg-[#0d0d10] mb-8">
        <div className="w-full aspect-[16/9] overflow-hidden bg-zinc-900">
          <img
            src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1400&q=80"
            alt="집단지성의 대화와 협업"
            className="w-full h-full object-cover filter brightness-[0.92] contrast-[1.05]"
            loading="lazy"
          />
        </div>
      </div>

      {/* Mid-page Centered Statement & Flat Pill Button */}
      <div className="text-center py-6 mb-16">
        <h3 className="type-h2 text-white mb-2 font-bold">
          우리의 지향점
        </h3>
        <p className="type-body text-zinc-400 mb-6 max-w-xl mx-auto">
          수많은 개인 투자자들의 직관과 정량적 데이터가 만나는 지점.
        </p>
        <NavLink
          to="/arena"
          className="btn-flat-dark inline-flex items-center gap-2 text-xs sm:text-sm font-medium"
        >
          <span>비전 살펴보기</span>
          <ArrowRight size={14} />
        </NavLink>
      </div>

      {/* 3. Editorial Media 2: Colleagues at wooden desk with laptops */}
      <div className="w-full rounded-3xl overflow-hidden border border-white/10 bg-[#0d0d10]">
        <div className="w-full aspect-[16/9] overflow-hidden bg-zinc-900">
          <img
            src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1400&q=80"
            alt="STOXDRAW 연구팀 및 커뮤니티 빌더"
            className="w-full h-full object-cover filter brightness-[0.92] contrast-[1.05]"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
