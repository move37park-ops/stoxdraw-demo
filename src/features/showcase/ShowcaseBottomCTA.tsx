import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function ShowcaseBottomCTA() {
  const navigate = useNavigate();

  return (
    <section className="w-full max-w-6xl mx-auto px-4 mb-24">
      <div className="relative rounded-[36px] bg-[#0c0e14] border border-white/10 p-10 sm:p-20 text-center overflow-hidden">
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
            className="btn-signature-draw inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-sm sm:text-base tracking-wide"
          >
            <span>DRAW</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
