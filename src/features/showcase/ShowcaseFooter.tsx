import { NavLink } from 'react-router-dom';

export function ShowcaseFooter() {
  return (
    <footer className="w-full border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#050608] py-12 sm:py-16 text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Col */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <span className="font-extrabold text-base tracking-tight text-zinc-900 dark:text-white font-mono">
                STOXDRAW
              </span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-sm mb-4">
              STOXDRAW는 사람들이 미래 주가에 대한 예측을 만들고, 공유하고,
              서로의 전망을 비교하며 실제 결과를 통해 그 기록을 검증하는 Social Forecasting Platform입니다.
            </p>
            <div className="text-[11px] text-zinc-400 font-mono">
              Human Expectation Data Engine v1.0
            </div>
          </div>

          {/* Col 1: Platform */}
          <div>
            <h4 className="font-bold text-zinc-900 dark:text-white text-xs mb-3 font-mono">
              플랫폼
            </h4>
            <ul className="space-y-2 text-xs">
              <li><NavLink to="/arena" className="hover:text-zinc-900 dark:hover:text-white transition">배틀 아레나</NavLink></li>
              <li><NavLink to="/draw" className="hover:text-zinc-900 dark:hover:text-white transition">캔버스 그리기</NavLink></li>
              <li><NavLink to="/stream" className="hover:text-zinc-900 dark:hover:text-white transition">실시간 스트림</NavLink></li>
              <li><NavLink to="/u/alpha_seeker" className="hover:text-zinc-900 dark:hover:text-white transition">명예의 전당</NavLink></li>
            </ul>
          </div>

          {/* Col 2: Data & Quant */}
          <div>
            <h4 className="font-bold text-zinc-900 dark:text-white text-xs mb-3 font-mono">
              데이터 & 리서치
            </h4>
            <ul className="space-y-2 text-xs">
              <li><span className="hover:text-zinc-900 dark:hover:text-white transition cursor-pointer">Human Expectation API</span></li>
              <li><span className="hover:text-zinc-900 dark:hover:text-white transition cursor-pointer">군중 컨센서스 밴드</span></li>
              <li><span className="hover:text-zinc-900 dark:hover:text-white transition cursor-pointer">변동성 왜도(Skew) 분석</span></li>
              <li><span className="hover:text-zinc-900 dark:hover:text-white transition cursor-pointer">B2B 연구용 데이터셋</span></li>
            </ul>
          </div>

          {/* Col 3: Guidelines */}
          <div>
            <h4 className="font-bold text-zinc-900 dark:text-white text-xs mb-3 font-mono">
              가이드 & 규정
            </h4>
            <ul className="space-y-2 text-xs">
              <li><span className="hover:text-zinc-900 dark:hover:text-white transition cursor-pointer">평가 채점 규칙 v1</span></li>
              <li><span className="hover:text-zinc-900 dark:hover:text-white transition cursor-pointer">거래일 캘린더 기준</span></li>
              <li><span className="hover:text-zinc-900 dark:hover:text-white transition cursor-pointer">투자 위험 고지</span></li>
              <li><span className="hover:text-zinc-900 dark:hover:text-white transition cursor-pointer">개인정보 처리방침</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright & disclaimer */}
        <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div>
            © 2026 STOXDRAW. 본 서비스의 예측 및 데이터는 투자 권유가 아니며, 정보 제공 목적으로만 활용됩니다.
          </div>
          <div className="flex items-center gap-4 text-zinc-400 font-mono text-[11px]">
            <span>System Status: Operational</span>
            <span>한국어 (KO)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
