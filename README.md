# STOXDRAW — 5일 주가 궤적 예측 & 퀀트 Elo 랭킹 플랫폼

[ **한국어** | [English](./README.en.md) ]

> **"말뿐인 의견은 그만, 차트 위에 5일간의 궤적을 그리다."**  
> STOXDRAW는 투자자가 인터랙티브 캔버스 위에 주가 궤적(5-Day Trajectory)을 직접 스케치하고, 장 시작 전 암호화 타임스탬프로 불변 박제(Immutable Lock)한 뒤, 실제 NYSE/NASDAQ 시장 종가와 대조하여 실력을 겨루는 **소셜 예측 인텔리전스 & 퀀트 Elo 플랫폼**입니다.

---

## 📸 전체 서비스 구조 & 아키텍처

Vercel Geist 디자인 시스템(순수 블랙 `#000000`, 1px 다크 헤어라인 `#222222`, 모서리 `+` 크로스헤어 정렬, Geist 타이포그래피)을 기반으로, 직관적인 시각적 예측과 금융 퀀트 검증 체계를 결합했습니다.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ▲ STOXDRAW  |  Studio   Overview   Leaderboard   My Record      ● 21:45:00 [D-0] [D+1] [D+3] [D+5]  🔔 ☀️  [Connect] │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
         │
         ├─── 1. 플래그십 트래젝토리 스튜디오 (/)
         │       • 스플릿 호라이즌 캔버스: 15일 과거 테이프 + 5일 미래 예측 캔버스
         │       • 일별 노드 드래그 조각 & 프리셋 (Breakout, Dip & Recovery, Pullback 등)
         │       • 실시간 군중 합의 밴드(P20–P80), 월가 컨센서스 목표가, 옵션 지지선
         │       • 역발상 가중치 기반 실시간 Elo 베팅 엔진 (+20 / -14 LP)
         │       • 피어 배포 스트림: 실시간 궤적 멀티 오버레이 & 1:1 맞불 대결(Counter-Draw)
         │
         ├─── 2. 워크스페이스 오버뷰 (/overview)
         │       • 시장 전반 텐션 모니터 (NVDA, TSLA, AAPL + 7개 벤치마크)
         │       • 15일 반응형 SVG 스파크라인 및 실시간 Bull/Bear 공방률 바
         │       • 시장 전체에서 쏟아지는 예측 배포 실시간 감사 피드
         │
         ├─── 3. 퀀트 Elo 리더보드 (/leaderboard)
         │       • Master / Diamond / Gold / Silver Elo 등급 티어 (제로 인플레이션 K=32 시스템)
         │       • 변동성 보정 평균 오차율, 적중률, 획득 LP 기반 명예의 전당 디렉터리
         │
         ├─── 4. 불변 검증 영수증 원장 (/f/:id)
         │       • 사후 조작이 불가능한 암호화 해시 영수증 (예: 0x45bedb...)
         │       • 실제 시장 종가와 예측 경로를 일자별로 1:1 대조한 정산 매트릭스
         │
         └─── 5. 타임워프 시뮬레이션 엔진 (Time-Warp Engine)
                 • [D-0 Lock]  : 예측 제출 가능, 월요일 09:30 ET 마감
                 • [D+1 Live]  : 1일차 거래 세션 종가 반영
                 • [D+3 Mid]   : 주중 변동성 반영 및 실시간 라이브 궤적 추적
                 • [D+5 Settle]: 금요일 최종 종가 기반 100점 루브릭 자동 채점 & Elo 정산
```

---

## ⚡ 6대 핵심 기둥 (Core Pillars)

### 1. 인터랙티브 5일 궤적 조각 (`SplitHorizonCanvas`)
단순한 "상승/하락" 이분법 투표나 모호한 텍스트 전망 대신, 참가자는 차트 위에서 5거래일($D+1 \dots D+5$)의 일별 노드를 직접 드래그하여 "주중 조정 후 금요일 돌파"와 같은 비선형적이고 입체적인 주가 시나리오를 구체화합니다.

### 2. 타임스탬프 불변 락 (Immutable Cryptographic Lock)
모든 예측은 뉴욕 증시 개장 전(월요일 09:30 ET)에 완전히 잠깁니다. 락이 걸린 예측은 암호화 해시 영수증이 발급되며, 이후 수정이나 삭제가 일체 불가능하여 **사후 확증 편향(Hindsight Bias)과 가짜 수익률 조작을 원천 차단**합니다.

### 3. 정량적 100점 하이브리드 채점 루브릭
라운드 종료 시 실제 시장 종가와 대조하여 3가지 축으로 정밀 채점합니다:
- **경로 정밀도 (Path Accuracy, 50점):** 5일 전체 일별 오차(MSE)를 종목별 고유 변동성($\sigma$)으로 정규화하여 정밀도 측정.
- **방향성 기술 (Directional Skill, 30점):** 전일 대비 일별 등락 방향(상승/하락) 일치 여부 판정.
- **최종 타깃 적중 (Friday Target Hit, 20점):** 금요일 최종 종가와의 괴리율 채점.

### 4. 제로 인플레이션 Elo 레이팅 시스템
포캐스터는 `1200 LP (Silver)`에서 시작하여 실력에 따라 `Gold (1400+)`, `Diamond (1600+)`, `Master (1800+)` 티어로 승급합니다. 다수의 군중 의견과 다른 과감한 역발상(Contrarian) 포지션이 적중할 경우 더 높은 Elo LP 보상을 획득합니다.

### 5. 멀티 피어 오버레이 & 1:1 맞불 대결 (Counter-Draw)
캔버스 위에서 다른 라이벌들의 궤적을 색상별로 실시간 오버레이하여 내 궤적과 비교할 수 있으며, 피드에 등록된 특정 의견에 반박하는 1:1 "Counter-Draw"를 즉시 전개할 수 있습니다.

### 6. 타임워프 시뮬레이션 엔진
상단 커맨드 바에 탑재된 타임라인 스크러버(`[D-0]`, `[D+1]`, `[D+3]`, `[D+5]`)를 통해, 실제 1주일을 기다릴 필요 없이 오픈 → 장중 진행 → 금요일 정산 및 영수증 발급까지의 **전체 플랫폼 라이프사이클을 1초 만에 시뮬레이션**할 수 있습니다.

---

## 🎨 Vercel Geist 디자인 철학

본 프로젝트는 Vercel 디자인 가이드라인(`vercel-design.md`, `vercel-design.dark.md`)을 100% 준수하여 제작되었습니다:
- **단일 52px 커맨드 바:** 2단 구조의 불필요한 시각적 층위를 단일 헤더로 통합하여 32px의 쾌적한 세로 공간 확보.
- **Hairline Rails & Crosshairs:** `1px solid #222222` 다크 헤어라인 레일과 모서리 `+` 크로스헤어로 군더더기 없는 엔지니어링 미학 구현.
- **Strict Geist Typography:** 레이블과 본문은 `Geist Sans`, 가격/수치/타임스탬프는 `Geist Mono`로 완벽한 숫자 정렬 보장.

---

## 🛠️ 기술 스택 (Tech Stack)

- **프레임워크:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **라우팅:** [React Router v7](https://reactrouter.com/)
- **빌드 도구:** [Vite 8](https://vitejs.dev/)
- **스타일링:** [Tailwind CSS](https://tailwindcss.com/) + 커스텀 Geist 토큰 (`vercel-geist.css`)
- **아이콘:** [Lucide React](https://lucide.dev/)
- **테스트:** [Vitest 5](https://vitest.dev/) (도메인 채점, 라이프사이클, 라운드 및 Elo 정산 단위 테스트)

---

## 🚀 빠른 시작 (Quick Start)

### 사전 요구사항
- Node.js (v18 이상 권장)
- npm 또는 pnpm

### 설치 및 로컬 서버 실행

```bash
# 1. 저장소 복제
git clone https://github.com/move37park-ops/stoxdraw-demo.git
cd stoxdraw-demo

# 2. 의존성 패키지 설치
npm install

# 3. 로컬 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속합니다.

### 검증 및 빌드 테스트

```bash
# 도메인 비즈니스 로직 단위 테스트 실행 (20개 테스트 전원 통과)
npm test

# TypeScript 타입 검사 및 프로덕션 빌드
npm run build
```

---

## 📂 프로젝트 구조 (Project Structure)

```
src/
├── components/          # 공용 UI 컴포넌트 (AppShell, 모달, 피드 카드 등)
├── data/                # 주가 데이터, 시드 포캐스터, 세션 및 로컬 저장소
│   ├── market.ts        # 과거 가격 테이프 및 종목 메타데이터 (NVDA, TSLA, AAPL 등)
│   ├── seed.ts          # 검증된 시드 사용자 및 과거/진행 중인 궤적 데이터
│   ├── session.ts       # 익명 브라우저 세션 및 유저 인증 관리
│   └── localRepository.ts # 구독(Subscribe) 패턴 기반 반응형 로컬 저장소
├── domain/              # 순수 비즈니스 로직 및 수학적 채점 엔진
│   ├── arena.ts         # 군중 합의(Consensus) 집계 및 텐션 계산
│   ├── elo.ts           # 제로 인플레이션 Elo 스테이크 및 LP 승강 엔진
│   ├── scoring.ts       # 100점 하이브리드 궤적 평가 루브릭
│   ├── round.ts         # 라운드 사이클, 마감 시점 및 실시간 카운트다운
│   └── resolution.ts    # 시장 실제 종가 대조 정산 엔진
└── features/            # 핵심 기능 모듈
    ├── studio/          # 플래그십 5일 트래젝토리 스튜디오 & 스플릿 캔버스
    ├── workspace/       # 마켓 워크스페이스 오버뷰 & 배포 스트림
    ├── leaderboard/     # 퀀트 Elo 리더보드 & 검증 디렉터리
    ├── detail/          # 불변 예측 영수증 & 일별 대조 감사 원장
    ├── profile/         # 내 전적 도시에, Elo 진척도 및 배포 히스토리
    └── auth/            # 계정/지갑 연결 모달
```

---

## 📄 라이선스 (License)

비공개 데모 프로젝트입니다. All rights reserved.
