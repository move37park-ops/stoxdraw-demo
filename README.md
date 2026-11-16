# Orange Paths — 차트에 직접 그리는 7일 BTC/USDT 예측 네트워크

가격 목표를 숫자로 적는 대신 차트 위에 향후 **7일(`D+1`~`D+7`) 가격 경로(trajectory)** 를 직접 그려 제출하고, 일일 변동성 기반 100점 정량 채점과 제로섬 코호트 Elo로 실력을 겨루는 BTC/USDT 예측 워크벤치입니다.

---

## 핵심 메커니즘

1. **블라인드 기여 후 열람 (Contribution-to-Unlock)**
   - 예측 잠금 전에는 방향성 Bull/Bear 비율, 타 참가자의 `D+7` 목표가, 논거 메모, 경로 오버레이를 모두 숨깁니다.
   - 잠금 전 하단 탭에는 7일 실현 변동성 밴드와 라운드 참여 인원(`OverviewReport`), 익명화/마스킹된 참여자 목록만 노출됩니다.
   - 내 `D+7` 경로를 1회 영구 잠금(`Lock Forecast`, 수정/삭제 불가)하는 즉시 집단 분석 리포트(`DeepReport`), 10th~90th 분위수 컨센서스 밴드, 상위 티어(`Top-Tier`, `Elo >= 1500` 또는 상위 25%) 분리 궤적, 라이벌 오버레이(최대 3명)가 해금됩니다.
2. **변동성 정규화 100점 정량 채점 (`50 / 25 / 25`)**
   - **경로 (Path, 50점)**: 일간 실현 변동성(`σ√t`)으로 정규화된 `D+1..D+7` 구간 오차
   - **형태 (Shape, 25점)**: 일별 로그 수익률 벡터의 코사인 유사도 (수평선 편법 감쇠 포함)
   - **목표 (Target, 25점)**: `D+7` 최종 종가 정밀도 15점 + 최종 방향 적중 10점
3. **5단계 코호트 Elo 레이팅 (`K=40`)**
   - `BRONZE` (`600+`) · `SILVER` (`1200+`) · `GOLD` (`1400+`) · `PLATINUM` (`1600+`) · `DIAMOND` (`1800+`)
   - 신규 계정은 3라운드 미만까지 `PROVISIONAL`로 표시되며, 라운드 만기 시 동일 라운드 코호트 백분위 대비 기대 승률(`calculateExpectedPeerPercentile`) 기준으로 정산됩니다.

---

## 워크벤치 및 라우트 구성

```
TopNav:    Orange Paths · 예측(/) · 훈련(/practice) · 커뮤니티(/community) · 내 기록(/me) · EN/KO · 테마 · 로그인
Workbench: [ 1줄 시장 헤더: BTC/USDT 7D · 현재가 · 24h · 만기 · 마감 · 참여자 ]
           [ 8 cols: PathCanvas (휠 줌 7D–240D + 향후 7일 앵커 최대 5개) ] [ 4 cols: TicketPanel (앵커 진행도 -> 2단계 확정 잠금) ]
Bottom:    [ 집단 분석 (잠금 전: OverviewReport / 잠금 후: 과거 추이+7D 궤적맵 & DeepReport) | 참여자 예측 테이블 ]
Footer:    요약 가이드 · 상세 규칙 (/docs)   |   Orange Paths   |   데모 시뮬레이터 [오늘 / 2일 뒤 / 4일 뒤 / 7일 만기]
```

| 경로 | 화면 | 설명 |
| --- | --- | --- |
| `/` | 라이브 예측 워크벤치 | BTC/USDT `D+7` 경로 드로잉, 마우스 휠 확대·축소, 2단계 확정 잠금, 컨센서스 및 라이벌 오버레이 |
| `/practice` | 역사적 리플레이 훈련 | 실제 BTC 강세·횡보·반등 구간(4개 시나리오)으로 `D+7` 드로잉 및 즉시 채점 연습 |
| `/community`, `/leaderboard` | 커뮤니티 · Elo 랭킹 | `[피드 · 토론]`(관점 글·만기 복기·현재 라운드 블라인드 가드) + `[Elo 랭킹]` 통합 허브 |
| `/me`, `/u/:handle` | 개인 프로필 & 기록 | 티어 진행도, 캘리브레이션 통계, 제출 이력, 공개 프로필 URL(`/u/:handle`) |
| `/f/:id` | 예측 상세 & 공유 복원 | 해시 검증 티켓, URL Payload(`?p=...`) 기반 서버리스 예측 재구성 및 복제 드로잉(`/?preset=...`) |
| `/docs` | 상세 채점·Elo 명세 | 스코어링 공식, 티어 기준, `Top-Tier` 코호트 규칙 |

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
