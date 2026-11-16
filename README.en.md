# Orange Paths — Draw 7D BTC/USDT Price Paths on the Chart

Orange Paths is a **BTC/USDT 7-day (`D+1` to `D+7`) trajectory prediction network**. Instead of guessing a single terminal price target, forecasters sketch the expected 7-day price path directly on the chart, lock it once (`1-shot`), and compete under volatility-normalized quantitative scoring and zero-sum cohort Elo.

---

## Core Mechanics

1. **Blind Contribution-to-Unlock**
   - Prior to locking a forecast, directional Bull/Bear crowd splits, peer `D+7` targets, rationales, and trajectory overlays remain hidden to avoid anchoring bias.
   - Users see the 7-day realized volatility cone and active participant count (`OverviewReport`), plus masked participant rows.
   - Permanently locking a `D+7` path unlocks the 3-block crowd analysis (`DeepReport`), 10th–90th percentile crowd bands, the `Top-Tier` cohort trajectory (`Elo >= 1500` or top 25%), and up to 3 rival chart overlays.
2. **Volatility-Normalized `50 / 25 / 25` Scoring (0–100 pts)**
   - **Path (50 pts)**: Time-weighted daily trajectory deviation normalized by realized daily volatility (`σ√t`).
   - **Shape (25 pts)**: Cosine similarity of daily log-return vectors with flat-line noise dampening.
   - **Target (25 pts)**: `D+7` closing precision (15 pts) + continuous final-direction accuracy (10 pts).
3. **5-Tier Cohort Elo Rating (`K=40`)**
   - Tiers: `BRONZE` (`600+`), `SILVER` (`1200+`), `GOLD` (`1400+`), `PLATINUM` (`1600+`), `DIAMOND` (`1800+`).
   - Accounts with fewer than 3 verified rounds carry a `PROVISIONAL` badge.

---

## Workbench & Routes

- `/` — **Live Forecast Workbench**: `8-col PathCanvas` + `4-col TicketPanel`, market header (`BTC/USDT`, `7D`, spot quote, countdown), `BottomTabs` (`OverviewReport` / unlocked past-trend + `7D` `DeepReport` + `ParticipantsTable`), and footer demo time-warp (`D-0`, `+2D`, `+4D`, `+7D Final`).
- `/practice` — **Historical Replay Trainer**: 4 real BTC market episodes scored on the `D+7` horizon.
- `/community`, `/leaderboard` — **Community & Cohort Elo Rankings**: Unified hub combining verified commentary/discussion posts (with blind gating for active rounds) and Elo tier rankings.
- `/me`, `/u/:handle` — **Profile & Track Record**: Tier progress, calibration stats, forecast archive, and shareable handle pages.
- `/f/:id` — **Share & Verification**: Hash-verified forecast detail, serverless URL payload reconstruction (`?p=...`), PNG ticket export, and clone-to-studio (`/?preset=...`).
- `/docs` — **Specification**: Scoring formula, Elo tiers, and blind-gate policy.

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
