import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function ShowcaseBottomCTA() {
  const navigate = useNavigate();

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 mb-20">
      <div className="relative rounded-[32px] sm:rounded-[40px] bg-zinc-100 dark:bg-[#0d0f16] border border-zinc-200 dark:border-zinc-800 p-8 sm:p-16 text-center overflow-hidden">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 bg-radial-gradient from-sky-400/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-4">
            STOXDRAW로 미래를 직접 그려보세요
          </h2>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mb-8 leading-relaxed">
            사람들은 이미 미래 주가에 대해 끊임없이 예측하고 있습니다.
            <br className="hidden sm:inline" />
            그 예측을 흘려보내지 말고, <strong>검증 가능한 데이터</strong>와 <strong>당신만의 트랙 레코드</strong>로 축적하세요.
          </p>

          <button
            type="button"
            onClick={() => navigate('/draw')}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-sm sm:text-base shadow-lg transition-all active:scale-95"
          >
            <span>지금 첫 궤적 그리기</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
