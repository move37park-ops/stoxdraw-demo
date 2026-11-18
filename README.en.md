# Orange Paths — Draw 7D BTC/USDT Forecast Paths on the Chart

Orange Paths is a **BTC/USDT 7-day (`D+1` to `D+7`) forecast path network**. Instead of guessing a single terminal price target, forecasters draw their expected 7-day price path directly on the chart, lock it once (`1-shot`), and compete under volatility-normalized quantitative scoring and zero-sum cohort reputation (`LP`).

---

## Core Mechanics

1. **Blind Contribution-to-Unlock**
   - Prior to locking a forecast, directional Bull/Bear crowd splits, peer `D+7` targets, memos, and path overlays remain hidden to avoid herding bias.
   - Locking a `D+7` forecast path (`Lock Your Forecast`) immediately reveals the in-chart **Crowd Path** (median trajectory), Bullish/Bearish split, unlocked `ParticipantsTable` metrics, and up to 3 rival chart overlays.
2. **Volatility-Normalized `50 / 25 / 25` Evaluation (0–100 pts)**
   - **Path Accuracy (50 pts)**: Time-weighted daily error normalized by realized daily volatility (`σ√t`).
   - **Shape Fidelity (25 pts)**: Cosine similarity of daily log-return vectors with smooth noise-floor attenuation.
   - **Price & Direction (25 pts)**: `D+7` closing precision (15 pts) + continuous final-direction accuracy (up to 10 pts).
3. **5-Tier Cohort Reputation Rating (`LP`, `K=40`)**
   - Tiers: `BRONZE` (`600+`), `SILVER` (`1200+`), `GOLD` (`1400+`), `PLATINUM` (`1600+`), `DIAMOND` (`1800+`).
   - Accounts with fewer than 3 evaluated rounds carry a `PROVISIONAL` badge, settling `-32 to +32 LP` per round relative to cohort percentiles.

---

## Workbench & Routes

- `/` — **Live Forecast Workbench**: Header (`BTC/USDT`, spot price, 15-day rolling round navigator for `OPEN`, `TRACKING 1/7..6/7`, and `EVALUATED 7/7` rounds), `8-col PathCanvas` + `4-col TicketPanel` (target readout, 3 preset curves, 1-line memo, 1-click lock / Crowd Path comparison), and `BottomTabs` (`ParticipantsTable` with score sorting and up to 3 rival overlays).
- `/practice` — **Blind Historical Practice**: Randomized blind historical 7-day BTC episodes (dates and USD prices hidden until evaluation) with instant 100-point scoring.
- `/leaderboard`, `/community` — **Leaderboard & Community**: Cohort LP rankings and discussion feed with blind gating for active rounds.
- `/me`, `/u/:handle` — **Forecaster Profile & Track Record**: Tier progress, calibration stats, forecast archive, and shareable handle pages.
- `/f/:id` — **Forecast Detail & Share Recovery**: Hash-verified forecast ticket, serverless URL payload reconstruction (`?p=...`), PNG card export, and clone-to-studio (`/?preset=...`).
- `/docs` — **Scoring & Rules Guide**: Chart controls, 100-point equations, LP tiers, and blind-gate policy.

---

## Tech Stack & Commands

- **Stack**: React 19, TypeScript 6, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), React Router v7, Lucide React
- **Checks**: Vitest (`npx vitest run`), oxlint (`npm run lint`)

```bash
npm install
npm run dev         # Start local Vite dev server
npx vitest run      # Run domain and repository tests
npm run lint        # Run oxlint static checks
npm run build       # Type-check and build production bundle
```
