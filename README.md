# Orange Paths — 차트에 직접 그리는 7일 BTC/USDT 예측 네트워크

가격 목표를 숫자로 적는 대신 차트 위에 향후 **7일(`D+1`~`D+7`) 예측 경로(Forecast Path)** 를 직접 그려 제출하고, 일일 변동성 기반 100점 정량 예측 평가와 제로섬 코호트 평판 점수(LP)로 실력을 겨루는 BTC/USDT 예측 워크벤치입니다.

---

## 핵심 메커니즘

1. **블라인드 제출 후 집단 전망 열람 (Blind Mode → Unlock)**
   - 예측 제출 전에는 참여자의 상승/하락 비중, 타 참여자의 `D+7` 목표가, 한 줄 메모, 경로 겹쳐 보기를 모두 숨깁니다.
   - 내 `D+7` 예측 경로를 1회 제출(`7일 예측 제출하기`, 수정/삭제 불가)하는 즉시 차트 내 **집단 중앙 경로(`Crowd Path`)**, **상승/하락 비중**, **참여자 예측 테이블 상세 수치**, 그리고 **라이벌 경로 겹쳐 보기(최대 3명)**가 해금됩니다.
2. **변동성 정규화 100점 정량 예측 평가 (`50 / 25 / 25`)**
   - **경로 정확도 (50점)**: 일간 실현 변동성(`σ√t`)으로 정규화된 `D+1..D+7` 시간가중 구간 오차
   - **가격 흐름 유사도 (25점)**: 일별 로그 수익률 벡터의 코사인 유사도 (미세 변동 보정 포함)
   - **가격·방향 (25점)**: `D+7` 최종 종가 정밀도 15점 + 최종 방향 적중 최대 10점
3. **5단계 평판 점수(`LP`, `K=40`)**
   - `BRONZE` (`600+`) · `SILVER` (`1200+`) · `GOLD` (`1400+`) · `PLATINUM` (`1600+`) · `DIAMOND` (`1800+`)
   - 신규 계정은 평가 완료 라운드 3회 미만까지 `PROVISIONAL`로 표시되며, 라운드 종료 시 동일 라운드 코호트 백분위 대비 기대 승률(`calculateExpectedPeerPercentile`) 기준으로 `-32 ~ +32 LP` 범위에서 정산됩니다.

---

## 워크벤치 및 라우트 구성

```
TopNav:    Orange Paths · 예측하기(/) · 연습하기(/practice) · 리더보드(/leaderboard) · 프로필(/me) · EN/KO · 테마 · 가이드(?) · 로그인
Workbench: [ 1줄 헤더: BTC/USDT · 현재가 | 일간 라운드 날짜 이동 (← 이전 | 날짜·상태 | 다음 → | Today) ]
           [ 8 cols: PathCanvas (휠 줌 7D–240D + Y축 스케일 + 향후 7일 예측 지점 최대 5개) ] [ 4 cols: TicketPanel (목표가 · 3종 프리셋 · 메모 -> 제출 / 집단 비교 / 라운드 결과) ]
Bottom:    [ 참여자 예측 현황 테이블 (블라인드 가드 · 점수순 정렬 · 최대 3명 차트 겹쳐 보기 · 상세 이동) ]
Footer:    Orange Paths · Predict. Compare. Prove.   |   BTC/USDT 일간 7일 예측 네트워크 · 평가 및 이용 규칙 (/docs)
```

| 경로 | 화면 | 설명 |
| --- | --- | --- |
| `/` | 실전 7일 예측 워크벤치 | BTC/USDT `D+7` 경로 그리기, 마우스 휠·가격축 배율 조절, 1회 확정 제출, 집단 중앙 경로(`Crowd Path`), 일간 롤링 라운드 조회(`OPEN` / `TRACKING` / `EVALUATED`), 라이벌 겹쳐 보기 |
| `/practice` | 블라인드 연습 모드 | 날짜·가격을 가린 무작위 과거 7일 실제 BTC 구간으로 드로잉 및 즉시 100점 정량 채점 |
| `/leaderboard`, `/community` | 리더보드 · 커뮤니티 | 평판 점수(LP)·등급 랭킹과 관점 피드·토론 통합 허브 (진행 중 라운드 블라인드 가드 적용) |
| `/me`, `/u/:handle` | 프로필 & 기록 | 예측자 등급 진행도, 캘리브레이션 통계, 제출 이력, 공개 프로필 URL(`/u/:handle`) |
| `/f/:id` | 예측 상세 & 공유 복원 | 제출 시점 검증 해시 티켓, URL Payload(`?p=...`) 기반 서버리스 예측 재구성 및 복제 그리기(`/?preset=...`) |
| `/docs` | 평가 및 이용 규칙 | 차트 조작법, 100점 평가 공식, 등급·LP 산정 기준, 블라인드 원칙 상세 가이드 |

---

## 기술 스택 및 실행

- **Frontend**: React 19, TypeScript 6, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), React Router v7, Lucide React
- **Storage / Sharing**: `localStorage` 리포지토리(`op_v2_btc7d_*` 네임스페이스) + UTF-8 URL-safe Base64 공유 페이로드
- **Verification**: Vitest, oxlint

```bash
npm install
npm run dev         # 개발 서버 실행
npx vitest run      # 도메인/저장소 단위 테스트 실행
npm run lint        # oxlint 정적 검사
npm run build       # tsc -b && vite build (dist/ 프로덕션 번들)
```

---

## 디렉터리 구조

```
src/
├─ components/            # TopNav, Footer, AppShell, ShareTicketModal, CompactForecastCard
├─ data/                  # btcMarket (BTC/USDT 시드 & 4개 7D 리플레이 시나리오), localRepository, seed, session
├─ domain/                # scoring(50/25/25), elo(600~1800+ K=40), interpolation, crowd, audit, round, sharePayload
├─ features/
│  ├─ auth/               # ConnectModal (Google/Kakao 모의 로그인)
│  ├─ community/          # CommunityPage (관점 피드·토론 + 통합 Elo 랭킹)
│  ├─ detail/             # DetailPage (?p= 서버리스 복원, PNG 티켓 내보내기)
│  ├─ docs/               # DocsPage (채점·Elo·블라인드 정책 명세)
│  ├─ leaderboard/        # LeaderboardPage (Elo 랭킹 테이블 및 티어 필터)
│  ├─ onboarding/         # GuideModal (요약 모달)
│  ├─ practice/           # PracticePage (7D 역사적 구간 리플레이 훈련)
│  ├─ predict/            # PredictPage, PathCanvas, CanvasToolbar, TicketPanel, OverviewReport, DeepReport, ParticipantsTable, BottomTabs, RoundCountdown
│  └─ profile/            # ProfilePage
├─ lib/                   # analytics, i18n, i18nCore
└─ styles/                # orange-paths.css (DeepBook Flush Hairline + Orange 디자인 토큰)
```
