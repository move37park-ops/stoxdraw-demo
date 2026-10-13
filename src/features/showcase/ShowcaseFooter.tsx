import { NavLink } from 'react-router-dom';

export function ShowcaseFooter() {
  return (
    <footer className="w-full border-t border-white/10 bg-black py-16 text-zinc-400 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 sm:gap-12 mb-16">
          {/* Col 1: 플랫폼 */}
          <div>
            <h4 className="font-semibold text-white text-xs mb-4 tracking-wider">
              플랫폼
            </h4>
            <ul className="space-y-3 text-xs text-zinc-400">
              <li><NavLink to="/arena" className="hover:text-white transition">아레나 (Arena)</NavLink></li>
              <li><NavLink to="/draw" className="hover:text-white transition">DRAW 스케치</NavLink></li>
              <li><NavLink to="/stream" className="hover:text-white transition">실시간 피드</NavLink></li>
              <li><NavLink to="/record" className="hover:text-white transition">내 기록 (Record)</NavLink></li>
              <li><NavLink to="/leaderboard" className="hover:text-white transition">명예의 전당</NavLink></li>
            </ul>
          </div>

          {/* Col 2: 모델 & 연구 */}
          <div>
            <h4 className="font-semibold text-white text-xs mb-4 tracking-wider">
              모델 & 연구
            </h4>
            <ul className="space-y-3 text-xs text-zinc-400">
              <li><span className="hover:text-white transition cursor-pointer">군집 컨센서스 알고리즘</span></li>
              <li><span className="hover:text-white transition cursor-pointer">5D 궤적 평가 수식</span></li>
              <li><span className="hover:text-white transition cursor-pointer">Human Expectation API</span></li>
              <li><span className="hover:text-white transition cursor-pointer">시장 왜도(Skew) 분석</span></li>
              <li><span className="hover:text-white transition cursor-pointer">리서치 논문 아카이브</span></li>
            </ul>
          </div>

          {/* Col 3: 평가 규정 */}
          <div>
            <h4 className="font-semibold text-white text-xs mb-4 tracking-wider">
              검증 규정
            </h4>
            <ul className="space-y-3 text-xs text-zinc-400">
              <li><span className="hover:text-white transition cursor-pointer">타임스탬프 불변성 규칙</span></li>
              <li><span className="hover:text-white transition cursor-pointer">5거래일 만기 채점 방식</span></li>
              <li><span className="hover:text-white transition cursor-pointer">스코어링 산출 기준</span></li>
              <li><span className="hover:text-white transition cursor-pointer">거래일 캘린더 안내</span></li>
              <li><span className="hover:text-white transition cursor-pointer">어뷰징 방지 정책</span></li>
            </ul>
          </div>

          {/* Col 4: 회사 & 소개 */}
          <div>
            <h4 className="font-semibold text-white text-xs mb-4 tracking-wider">
              회사 소개
            </h4>
            <ul className="space-y-3 text-xs text-zinc-400">
              <li><NavLink to="/" className="hover:text-white transition">소개 (About)</NavLink></li>
              <li><span className="hover:text-white transition cursor-pointer">채용 정보</span></li>
              <li><span className="hover:text-white transition cursor-pointer">뉴스룸</span></li>
              <li><span className="hover:text-white transition cursor-pointer">보안 가이드</span></li>
              <li><span className="hover:text-white transition cursor-pointer">문의하기</span></li>
            </ul>
          </div>

          {/* Col 5: 법적 고지 */}
          <div>
            <h4 className="font-semibold text-white text-xs mb-4 tracking-wider">
              약관 & 고지
            </h4>
            <ul className="space-y-3 text-xs text-zinc-400">
              <li><span className="hover:text-white transition cursor-pointer">이용약관</span></li>
              <li><span className="hover:text-white transition cursor-pointer">개인정보 처리방침</span></li>
              <li><span className="hover:text-white transition cursor-pointer">투자 위험 고지</span></li>
              <li><span className="hover:text-white transition cursor-pointer">오픈소스 라이선스</span></li>
              <li><span className="hover:text-white transition cursor-pointer">쿠키 설정</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Language Selector */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white tracking-tight">STOXDRAW</span>
            <span>© 2026 STOXDRAW Inc. 본 플랫폼의 예측은 투자 권유가 아닙니다.</span>
          </div>

          <div className="flex items-center gap-6 text-zinc-400">
            <span className="hover:text-white cursor-pointer transition">한국어 (KR)</span>
            <span className="hover:text-white cursor-pointer transition">English</span>
            <span className="text-[11px] font-mono text-zinc-600">v1.0.4</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
