import { useNavigate, NavLink } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function ShowcaseBottomCTA() {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-20 sm:pb-28">
      {/* 1. Second Large Featured Card: Solitary Tree / Verifiable Ledger (Matches OpenAI reference) */}
      <div className="w-full rounded-3xl overflow-hidden border border-white/10 bg-[#0d0d10] text-left mb-16 sm:mb-20">
        <div className="w-full aspect-[16/10] sm:aspect-[16/9] overflow-hidden bg-zinc-900">
          <img
            src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1400&q=80"
            alt="투명한 검증과 보상"
            className="w-full h-full object-cover filter brightness-[0.95] contrast-[1.05]"
            loading="lazy"
          />
        </div>

        <div className="p-6 sm:p-8">
          <h2 className="type-h2 text-white mb-2 font-bold tracking-tight">
            투명한 검증과 보상
          </h2>
          <p className="type-body text-zinc-400 mb-5 max-w-2xl leading-relaxed">
            모든 드로잉은 수정 불가능한 타임스탬프와 함께 기록되며, 5거래일 후 실제 시장 종가와 비교하여 정확도에 따른 명예의 전당 랭킹과 보상이 부여됩니다.
          </p>
          <NavLink
            to="/arena"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-zinc-300 hover:text-white transition font-medium"
          >
            <span>평가 기준 알아보기</span>
            <ArrowRight size={14} />
          </NavLink>
        </div>
      </div>

      {/* 2. Flat Dark CTA Banner: "미래 시장을 함께 만들어가세요" (Matches OpenAI bottom banner) */}
      <div className="w-full rounded-3xl bg-[#141416] border border-white/10 p-12 sm:p-20 text-center">
        <h2 className="type-h1 text-white mb-8 tracking-tight font-bold">
          미래 시장을 함께 만들어가세요
        </h2>

        <div>
          <button
            type="button"
            onClick={() => navigate('/draw')}
            className="btn-flat-white text-xs sm:text-sm font-semibold px-6 py-3"
          >
            <span>지금 시작하기</span>
          </button>
        </div>
      </div>
    </div>
  );
}
