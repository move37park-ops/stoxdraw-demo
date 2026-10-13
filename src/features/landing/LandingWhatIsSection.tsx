import { NavLink } from 'react-router-dom';
import { PenTool, BrainCircuit, Award, CheckCircle2, ArrowRight } from 'lucide-react';

export function LandingWhatIsSection() {
  return (
    <section className="w-full py-20 sm:py-32 bg-black relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Section Header: What Is STOXDRAW? (부제목 앞 점 제거) */}
        <div className="text-center max-w-3xl mx-auto mb-20 sm:mb-28">
          <div className="inline-flex items-center px-3.5 py-1 rounded-full bg-zinc-900 border border-white/10 type-caption font-mono text-zinc-400 mb-3">
            <span>CORE PILLARS</span>
          </div>
          <h2 className="type-h2 text-white mb-3">
            What Is STOXDRAW?
          </h2>
          <p className="type-body text-zinc-400">
            단순한 숫자 맞히기가 아닌, 주가 궤적을 직접 그리고 증명하는 차세대 소셜 예측 인텔리전스
          </p>
        </div>

        {/* Alternating Zig-Zag Grid */}
        <div className="space-y-24 sm:space-y-36">

          {/* ============================================================== */}
          {/* ROW 1: [01. 인터랙티브 캔버스 - Theme: Emerald Green] */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            
            {/* Visual Card (Left) */}
            <div className="lg:col-span-6 order-2 lg:order-1">
              <div className="relative w-full aspect-[4/3] rounded-3xl border border-white/10 bg-[#0d0d12] p-6 sm:p-8 overflow-hidden shadow-2xl group hover:border-emerald-500/30 transition-all duration-300">
                <div
                  className="absolute inset-0 opacity-[0.03]"
                  style={{
                    backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                  }}
                />

                {/* Simulated Interactive Drawing Canvas Card */}
                <div className="relative h-full flex flex-col justify-between z-10">
                  {/* Top Bar: Tool palette */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="type-caption font-mono text-zinc-400">Canvas Engine v2</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 type-caption font-mono border border-emerald-500/20">
                      <PenTool size={12} />
                      <span>Drawing Mode</span>
                    </div>
                  </div>

                  {/* Mid: Drawn Trajectory Line Graphic */}
                  <div className="relative w-full h-36 flex items-center justify-center">
                    <svg viewBox="0 0 320 120" className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="brushEmerald" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.95" />
                        </linearGradient>
                      </defs>

                      {/* Stock Candlestick historical bars */}
                      <g opacity="0.35">
                        <line x1="30" y1="50" x2="30" y2="90" stroke="#10b981" strokeWidth="1" />
                        <rect x="25" y="60" width="10" height="20" fill="#10b981" />
                        <line x1="60" y1="55" x2="60" y2="95" stroke="#f43f5e" strokeWidth="1" />
                        <rect x="55" y="65" width="10" height="22" fill="#f43f5e" />
                        <line x1="90" y1="40" x2="90" y2="85" stroke="#10b981" strokeWidth="1" />
                        <rect x="85" y="48" width="10" height="25" fill="#10b981" />
                      </g>

                      {/* Today Base Anchor */}
                      <circle cx="105" cy="55" r="4" fill="#ffffff" />
                      <text x="105" y="38" fill="#a1a1aa" fontSize="11" fontFamily="monospace" textAnchor="middle">
                        Today (Base)
                      </text>

                      {/* Smooth emerald bezier curve */}
                      <path
                        d="M 105 55 Q 150 85, 190 45 T 280 25"
                        fill="none"
                        stroke="url(#brushEmerald)"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />

                      {/* Target Endpoint */}
                      <g transform="translate(280, 25)">
                        <circle cx="0" cy="0" r="4" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                        <g transform="translate(10, 8)">
                          <rect x="0" y="0" width="76" height="22" rx="6" fill="#181820" stroke="rgba(16,185,129,0.3)" />
                          <text x="38" y="15" fill="#10b981" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                            +7.8% Target
                          </text>
                        </g>
                      </g>
                    </svg>
                  </div>

                  {/* Bottom: Metrics summary */}
                  <div className="flex items-center justify-between type-caption font-mono pt-3 border-t border-white/10 text-zinc-400">
                    <span>5-Day Trajectory Path</span>
                    <span className="text-white font-medium">소요 시간: 약 3초</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Text Description (Right) */}
            <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 type-caption font-mono text-emerald-400">
                <PenTool size={12} />
                <span>01. INTERACTIVE CANVAS</span>
              </div>
              <h3 className="type-h3 text-white">
                단순한 목표가를 넘어,<br />
                차트 위에 직접 그리는 <span className="text-emerald-400">5D 궤적</span>
              </h3>
              <div className="space-y-3 type-body text-zinc-400">
                <p>
                  단 하나의 숫자로만 표현되는 목표가는 주가가 도달하는 과정의 변동성과 시점을 전혀 담아내지 못합니다.
                </p>
                <p>
                  STOXDRAW에서는 캔버스 위에 마우스나 손가락으로 5거래일 동안의 주가 흐름을 직접 브러시로 스케치합니다.
                </p>
                <p className="text-zinc-300 font-medium">
                  선을 긋는 즉시 목표가와 예상 수익률이 실시간으로 연동되어, 가장 직관적인 예측 경험을 제공합니다.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <NavLink
                  to="/draw"
                  className="inline-flex items-center gap-2 type-caption font-semibold text-emerald-400 hover:text-emerald-300 transition group"
                >
                  <span>드로우 캔버스 직접 체험하기</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </NavLink>
              </div>
            </div>

          </div>

          {/* ============================================================== */}
          {/* ROW 2: [02. 군집 합의 AI - Theme: Intelligence Blue] */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            
            {/* Text Description (Left) */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 type-caption font-mono text-blue-400">
                <BrainCircuit size={12} />
                <span>02. COLLECTIVE INTELLIGENCE</span>
              </div>
              <h3 className="type-h3 text-white">
                수천 개의 궤적이 모여 만드는<br />
                실시간 <span className="text-blue-400">군집 합의(Consensus)</span>
              </h3>
              <div className="space-y-3 type-body text-zinc-400">
                <p>
                  개별 투자자의 편향과 시장의 일시적인 노이즈를 강력한 집단지성 알고리즘으로 상쇄합니다.
                </p>
                <p>
                  수많은 참여자가 그린 궤적을 실시간으로 집계하여 상하위 80% 신뢰 구간 밴드와 핵심 합의 곡선을 도출합니다.
                </p>
                <p className="text-zinc-300 font-medium">
                  극단적인 이상치를 자동 필터링하여, 시장 참여자들이 진정으로 기대하는 변곡점과 합의점을 한눈에 보여줍니다.
                </p>
              </div>

              <div className="pt-2">
                <NavLink
                  to="/arena"
                  className="inline-flex items-center gap-2 type-caption font-semibold text-blue-400 hover:text-blue-300 transition group"
                >
                  <span>실시간 컨센서스 아레나 보기</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </NavLink>
              </div>
            </div>

            {/* Visual Card (Right) */}
            <div className="lg:col-span-6">
              <div className="relative w-full aspect-[4/3] rounded-3xl border border-white/10 bg-[#0d0d12] p-6 sm:p-8 overflow-hidden shadow-2xl group hover:border-blue-500/30 transition-all duration-300">
                <div className="relative h-full flex flex-col justify-between z-10">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="type-caption font-mono text-zinc-400">Consensus Band & Heatmap</span>
                    <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      80% Confidence Band
                    </span>
                  </div>

                  {/* Multi-trajectory heatmap graphics */}
                  <div className="relative w-full h-36 flex items-center justify-center">
                    <svg viewBox="0 0 320 120" className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="bandGradBlue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.04" />
                        </linearGradient>
                      </defs>

                      {/* Wide confidence band */}
                      <path
                        d="M 20 60 Q 90 40, 160 30 T 300 20 L 300 70 Q 230 65, 160 70 T 20 65 Z"
                        fill="url(#bandGradBlue)"
                      />

                      {/* Individual user trajectories */}
                      <path d="M 20 60 Q 90 70, 160 55 T 300 45" fill="none" stroke="#f43f5e" strokeWidth="1" opacity="0.35" strokeDasharray="3 3" />
                      <path d="M 20 60 Q 80 35, 150 25 T 300 15" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.4" strokeDasharray="3 3" />
                      <path d="M 20 60 Q 100 50, 170 42 T 300 32" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.45" />

                      {/* Main bold consensus curve */}
                      <path
                        d="M 20 60 Q 90 48, 160 38 T 300 28"
                        fill="none"
                        stroke="#60a5fa"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                      />

                      <circle cx="300" cy="28" r="4" fill="#60a5fa" />
                    </svg>
                  </div>

                  {/* Bottom metrics (Semantic Colors) */}
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10 text-center font-mono">
                    <div className="p-1.5 rounded-lg bg-zinc-900/60">
                      <div className="type-caption text-zinc-500 text-[12px]">참여 궤적</div>
                      <div className="type-caption font-bold text-white">4,812건</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-zinc-900/60">
                      <div className="type-caption text-zinc-500 text-[12px]">Bulls 비율</div>
                      <div className="type-caption font-bold text-emerald-400">71.4%</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-zinc-900/60">
                      <div className="type-caption text-zinc-500 text-[12px]">합의 오차율</div>
                      <div className="type-caption font-bold text-blue-400">±1.8%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ============================================================== */}
          {/* ROW 3: [03. 타임스탬프 불변 검증 - Theme: Award Amber/Gold] */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            
            {/* Visual Card (Left) */}
            <div className="lg:col-span-6 order-2 lg:order-1">
              <div className="relative w-full aspect-[4/3] rounded-3xl border border-white/10 bg-[#0d0d12] p-6 sm:p-8 overflow-hidden shadow-2xl group hover:border-amber-500/30 transition-all duration-300">
                <div className="relative h-full flex flex-col justify-between z-10">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-1.5 type-caption font-mono text-zinc-300">
                      <CheckCircle2 size={13} className="text-amber-400" />
                      <span>Timestamp Immutable Lock</span>
                    </div>
                    <span className="type-caption font-mono text-amber-400/80 text-[12px]">BLOCK #18,492,012</span>
                  </div>

                  {/* Mid: Verifiable Ledger Card UI */}
                  <div className="my-auto space-y-3">
                    <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 font-bold">
                          <Award size={20} />
                        </div>
                        <div>
                          <div className="type-caption font-bold text-white flex items-center gap-1.5">
                            <span>Top 1% Master Forecaster</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-mono border border-amber-500/20">TIER S</span>
                          </div>
                          <div className="type-caption text-zinc-400 font-mono text-[13px]">
                            연속 12회 컨센서스 상위 적중
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <div className="type-caption text-zinc-400 text-[12px]">평균 MAE</div>
                        <div className="type-caption font-bold text-emerald-400 text-sm">0.84%</div>
                      </div>
                    </div>

                    {/* Historical verification snippet */}
                    <div className="p-3 rounded-xl bg-zinc-950/70 border border-white/5 type-caption font-mono space-y-1.5 text-zinc-400">
                      <div className="flex justify-between">
                        <span>예측 등록 시점:</span>
                        <span className="text-zinc-200">2026-10-05 09:00:00 KST</span>
                      </div>
                      <div className="flex justify-between">
                        <span>만기 결제일:</span>
                        <span className="text-zinc-200">2026-10-12 (5거래일)</span>
                      </div>
                      <div className="flex justify-between">
                        <span>채점 결과:</span>
                        <span className="text-amber-400 font-semibold">적중 (Score: 94.2 pts)</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Integrity statement */}
                  <div className="flex items-center justify-between type-caption font-mono pt-3 border-t border-white/10 text-zinc-400">
                    <span>사후 조작/삭제 원천 차단</span>
                    <span className="text-amber-400 font-medium">영구 보존</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Text Description (Right) */}
            <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 type-caption font-mono text-amber-400">
                <Award size={12} />
                <span>03. VERIFIABLE REPUTATION</span>
              </div>
              <h3 className="type-h3 text-white">
                과거 수정이 불가능한<br />
                타임스탬프 기반 <span className="text-amber-400">영구 트랙 레코드</span>
              </h3>
              <div className="space-y-3 type-body text-zinc-400">
                <p>
                  말뿐인 자칭 전문가들의 예측 삭제나 사후 짜맞추기는 STOXDRAW에서 구조적으로 불가능합니다.
                </p>
                <p>
                  모든 제출 궤적은 등록 즉시 정확한 시간과 함께 동결되며, 5거래일 뒤 실제 시장 종가와 자동으로 1:1 대조 채점됩니다.
                </p>
                <p className="text-zinc-300 font-medium">
                  수익률과 오차율(MAE)이 투명하게 증명된 진짜 고수들만의 명예의 전당과 리더보드를 확인하세요.
                </p>
              </div>

              <div className="pt-2">
                <NavLink
                  to="/leaderboard"
                  className="inline-flex items-center gap-2 type-caption font-semibold text-amber-400 hover:text-amber-300 transition group"
                >
                  <span>명예의 전당 리더보드 확인하기</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </NavLink>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
