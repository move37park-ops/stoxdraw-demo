import { NavLink } from 'react-router-dom';
import { Compass, PenTool, ArrowUpRight, TrendingUp } from 'lucide-react';

export function LandingHero() {
  return (
    <section className="relative w-full overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-32 border-b border-white/10 bg-black">
      {/* Subtle balanced depth lighting */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-zinc-800/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] bg-blue-900/10 rounded-full blur-[160px] pointer-events-none" />
      
      {/* Subtle background grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '36px 36px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          
          {/* Left Column: Headline and Editorial Subtitles */}
          <div className="lg:col-span-8 space-y-6">
            {/* Live Indicator Pill (부제목 앞 점 제거, 정돈된 타이포그래피) */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-white/10 type-caption text-zinc-300">
              <span className="text-zinc-400 font-medium">Social Prediction Platform</span>
              <span className="text-zinc-700">|</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1.5 font-mono">
                <TrendingUp size={13} />
                Live Consensus
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="type-h1 text-white tracking-tight">
              말뿐인 예측은 그만,
              <br />
              차트 위에 <span className="text-white underline decoration-white/30 underline-offset-8 font-extrabold">내일의 궤적</span>을 그리다
            </h1>

            {/* Editorial Subcopy */}
            <div className="space-y-1.5 type-body text-zinc-400 max-w-2xl">
              <p>과거의 차트를 후행적으로 분석하는 데 그치지 마세요.</p>
              <p>캔버스 위에 5거래일 뒤 목표가와 변동 경로를 직접 스케치하고,</p>
              <p className="text-zinc-300">
                실시간 군집 합의(Consensus)와 대결하여 당신만의 검증된 트랙 레코드를 증명하세요.
              </p>
            </div>
          </div>

          {/* Right Column: Explore & DRAW Dual CTA Buttons */}
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-row items-stretch sm:items-center lg:justify-end gap-3.5 pt-4 lg:pt-0">
            {/* Explore Button */}
            <NavLink
              to="/stream"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-base border border-white/15 hover:border-white/30 transition shadow-sm group"
            >
              <Compass size={18} className="text-zinc-400 group-hover:text-white transition" />
              <span>Explore</span>
              <ArrowUpRight size={16} className="text-zinc-500 group-hover:text-white transition" />
            </NavLink>

            {/* DRAW Button (월가 샴페인 브래스 골드 프라이머리 CTA) */}
            <NavLink
              to="/draw"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-[#C5A059] hover:bg-[#d4af37] text-black font-bold text-base transition shadow-sm active:scale-[0.99]"
            >
              <PenTool size={18} className="stroke-[2.2]" />
              <span>DRAW</span>
            </NavLink>
          </div>

        </div>
      </div>
    </section>
  );
}
