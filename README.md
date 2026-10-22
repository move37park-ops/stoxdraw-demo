# STOXDRAW — Social Stock Trajectory Forecasting Platform

> **"말뿐인 예측은 그만, 차트 위에 내일의 궤적을 그리다"**  
> STOXDRAW는 미래 주가 궤적을 직접 캔버스에 그리고, 타임스탬프 기반으로 불변 박제하여 실제 시장과 검증하며, 집단지성(Crowd Consensus)과 대결하는 차세대 소셜 예측 인텔리전스 플랫폼입니다.

---

## 📚 전체 서비스 구조 상세 문서
서비스의 전체 구조, 도메인 엔진, 수학적 채점 수식, 데이터 흐름, 컴포넌트 아키텍처 및 디자인 시스템을 담은 **상세 기술 명세서**는 아래 파일에서 확인하실 수 있습니다:

👉 **[SERVICE_STRUCTURE.md](./SERVICE_STRUCTURE.md)** (서비스 구조 전체를 담은 마스터 문서)

---

## ⚡ 빠른 시작 (Quick Start)

### 1. 패키지 설치
```bash
npm install
```

### 2. 로컬 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:5173`으로 접속합니다.

### 3. 도메인 단위 테스트 실행
```bash
npm test
# 또는
npx vitest run
```

### 4. 프로덕션 빌드
```bash
npm run build
```

---

## 🌟 핵심 기능 요약 (Core Pillars)

1. **인터랙티브 드로잉 캔버스 (`/draw`):**
   - 5거래일(5D) 미래 주가 궤적을 마우스나 터치로 직접 스케치
   - 실시간 목표 수익률 연동 및 되돌리기(Undo)/초기화(Clear) 지원
2. **타임스탬프 불변 락 (Timestamp Immutable Lock):**
   - 예측 확정 즉시 기준가와 작성 시점이 박제되어 사후 조작 및 삭제 차단
   - 기준 시점 경과 시 실제 시장 종가(OHLC)와 1:1 대조 자동 채점
3. **군집 합의 AI & 콜드스타트 (`crowd.ts`):**
   - 참여자들의 일별 궤적 중앙값(Median)과 80% 신뢰 구간 밴드 실시간 산출
   - 5명 미만 시 이상치 왜곡 방지를 위한 Cold Start 보호 알고리즘 적용
4. **실시간 궤적 아레나 (`/arena`):**
   - 10대 빅테크 종목별 실시간 Bull/Bear 공방률 및 군중 기대치 가격 분포도
   - 최대 3인 다자간 궤적 동시 비교 오버레이
5. **[YOUR DRAW] 맞불 대결 및 소셜 스트림 (`/f/:id`, `/stream`):**
   - 다른 사용자의 예측에 반박 궤적을 그리고 1:1로 승부
   - 좋아요, 댓글, 실시간 반응 알림 센터
6. **타임 트래블 시뮬레이터 (Time Travel Engine):**
   - 상단 헤더의 기준 시점(9/28, 10/05, 10/08, 10/12, 10/26) 변경으로 라이프사이클(LOCKED -> LIVE -> RESOLVED) 실시간 검증
7. **명예의 전당 리더보드 (`/leaderboard`):**
   - 100% 검증된 실제 성적 기반 상위 1% 마스터 포캐스터 랭킹

---

## 🛠️ 기술 스택 (Tech Stack)

- **Frontend:** React 19, TypeScript, React Router DOM v7
- **Styling:** Tailwind CSS, Pretendard Variable 가변 폰트, 60-30-10 에디토리얼 디자인 토큰
- **Icons:** Lucide React
- **Graphics:** HTML5 Canvas & Native Reactive SVG Engine
- **Test:** Vitest 5.0 (도메인 비즈니스 로직 단위 테스트 11건 통과)
- **Deployment:** Vercel SPA
