import { NavLink } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function ShowcaseStorySpotlight() {
  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left Column: Narrative Headline & 3 Key Value Props */}
        <div className="lg:col-span-6">
          <div className="text-xs font-mono font-bold text-emerald-400 mb-3 uppercase tracking-wider">
            WHY STOXDRAW
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-5 leading-tight">
            집단 지성이 만드는<br />새로운 금융 데이터
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 mb-8 leading-relaxed font-normal">
            단순한 텍스트 댓글이나 추측 대신, 누구나 검증 가능한 선(궤적)으로 자신의 전망을 기록하고 집단 지성과 대결합니다.
          </p>

          <div className="space-y-6 mb-8">
            <div className="flex gap-4 items-start">
              <span className="font-mono text-sm font-bold text-emerald-400 pt-0.5">01</span>
              <div>
                <h3 className="font-bold text-white text-sm mb-1">차트에 직접 그리는 주가 경로</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  마우스나 터치로 원하는 목표가와 만료 시점의 경로를 직관적으로 그립니다.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <span className="font-mono text-sm font-bold text-emerald-400 pt-0.5">02</span>
              <div>
                <h3 className="font-bold text-white text-sm mb-1">군중 컨센서스와 실시간 대조</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  수천 명의 집단 지성 평균선 및 상위 랭커들의 선과 한 차트에서 겹쳐 비교합니다.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <span className="font-mono text-sm font-bold text-emerald-400 pt-0.5">03</span>
              <div>
                <h3 className="font-bold text-white text-sm mb-1">100% 투명한 자동 채점</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  기간 만료 시 실제 시장 가격과 자동 대조되어 오차율과 적중 스코어가 영구 보존됩니다.
                </p>
              </div>
            </div>
          </div>

          <NavLink
            to="/draw"
            className="btn-signature-draw px-6 py-3 rounded-full text-sm font-bold"
          >
            <span>지금 선 그어보기 (DRAW)</span>
            <ArrowRight size={15} className="stroke-[2.5]" />
          </NavLink>
        </div>

        {/* Right Column: Sleek Visual Card Showcase */}
        <div className="lg:col-span-6">
          <div className="rounded-3xl bg-[#0c0e14] border border-white/10 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10 text-xs font-mono">
              <span className="font-bold text-white">$TSLA · 30D 스윙 궤적</span>
              <span className="text-emerald-400">+14.2% 상방 기대</span>
            </div>

            <div className="aspect-[16/10] bg-[#07080b] rounded-2xl border border-white/5 p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
                <span>기준가 $248.50</span>
                <span className="text-emerald-400 font-bold">목표 $283.80</span>
              </div>

              {/* Minimal SVG Graphic */}
              <svg viewBox="0 0 400 120" className="w-full h-full my-auto" preserveAspectRatio="none">
                <path
                  d="M 10 90 Q 70 75 130 85 T 200 65"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                <path
                  d="M 200 65 Q 260 45 330 35 T 390 20"
                  fill="none"
                  stroke="#047857"
                  strokeWidth="2.5"
                />
                <circle cx="200" cy="65" r="4" fill="#ffffff" />
                <circle cx="390" cy="20" r="4" fill="#10b981" />
              </svg>

              <div className="text-[11px] text-zinc-400 font-mono flex justify-between">
                <span>현재 진행 중</span>
                <span>30일 후 실제 주가와 자동 대조</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
