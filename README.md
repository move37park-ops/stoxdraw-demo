# STOXDRAW — 5-Day Social Stock Trajectory Forecasting & Quantitative Elo Platform

> **"Draw the next 5 days on the chart. Lock your prediction, challenge the crowd, and get scored against real market closes."**  
> STOXDRAW is a financial prediction platform where traders sculpt exact 5-day stock price trajectories directly on interactive charts, lock them with immutable cryptographic receipts before market open, and compete on a quantitative Elo rating ladder settled against real NYSE/NASDAQ daily closes.

---

## 📸 Overview & Architecture

Designed under the **Vercel Geist Design System** (`#000000` deep black canvas, 1px `#222222` hairline rails, `+` crosshair corner alignment, and Geist typography), STOXDRAW fuses interactive visual forecasting with institutional settlement rigor:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ▲ STOXDRAW  |  Studio   Overview   Leaderboard   My Record      ● 21:45:00 [D-0] [D+1] [D+3] [D+5]  🔔 ☀️  [Connect] │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
         │
         ├─── 1. Flagship Trajectory Studio (/)
         │       • Split Horizon Canvas: 15-day historical tape + 5-day sculpt horizon
         │       • Interactive node dragging & curve sculpt presets (Breakout, Dip & Recovery, etc.)
         │       • Real-time crowd consensus envelope (P20–P80), Wall St targets, and options support
         │       • Dynamic contrarian Elo stake engine (+20 / -14 LP)
         │       • Peer deployment stream with instant Multi-Overlay and 1v1 Counter-Draw
         │
         ├─── 2. Workspace Overview (/overview)
         │       • Multi-asset tension monitor (NVDA, TSLA, AAPL + 7 benchmarks)
         │       • 15D reactive SVG sparklines and Bull/Bear ratio bars
         │       • Real-time stream of crowd deployments across the entire market
         │
         ├─── 3. Quantitative Elo Leaderboard (/leaderboard)
         │       • Master / Diamond / Gold / Silver Elo tiers (Zero-inflation K=32 system)
         │       • Verified forecaster directory with Mean Score, Hit Rate, and Mean Error %
         │
         ├─── 4. Immutable Prediction Receipt (/f/:id)
         │       • Cryptographically hashed immutable audit ledger (e.g. 0x45bedb...)
         │       • Daily settlement matrix comparing predicted path vs real market closes
         │
         └─── 5. Time-Warp Simulation Engine
                 • [D-0 Lock]  : Predictions open, locking at Monday 09:30 ET
                 • [D+1 Live]  : First trading session close recorded
                 • [D+3 Mid]   : Midweek market movement & live trajectory tracking
                 • [D+5 Settle]: Final Friday close, automated rubric scoring & LP settlement
```

---

## ⚡ Core Pillars

### 1. Interactive 5-Day Trajectory Sculpting (`SplitHorizonCanvas`)
Instead of binary up/down polling or vague verbal forecasts, participants drag daily nodes ($D+1 \dots D+5$) on an interactive canvas to express non-linear price hypotheses—such as midweek pullbacks before Friday breakouts.

### 2. Time-Stamped Immutable Lock
All forecasts lock prior to market open (Monday 09:30 ET). Once locked, predictions receive an immutable cryptographic receipt and cannot be deleted or modified, eliminating hindsight bias and fake track records.

### 3. Quantitative Scoring Rubric (100-pt Hybrid)
Settlement evaluates forecasts against actual market closes using a balanced 3-factor quantitative model:
- **Path Accuracy (50 pts):** Mean Squared Error across all 5 daily nodes, normalized by asset volatility.
- **Directional Skill (30 pts):** Binary accuracy of day-over-day price movements.
- **Friday Target Hit (20 pts):** Terminal distance to final Friday close.

### 4. Zero-Inflation Elo Rating System
Forecasters start at `1200 LP (Silver)` and progress through `Gold (1400+)`, `Diamond (1600+)`, and `Master (1800+)`. Elo stakes are dynamically weighted: taking contrarian positions against high crowd consensus yields higher LP rewards.

### 5. Multi-Peer Overlays & 1v1 Counter-Draws
Directly compare rival predictions by toggling multi-colored curve overlays on the main canvas, or initiate a direct 1v1 "Counter-Draw" against any thesis in the live feed.

### 6. Built-in Time-Warp Engine
The integrated timeline scrubber (`[D-0]`, `[D+1]`, `[D+3]`, `[D+5]`) allows testing and experiencing the entire platform lifecycle—from open round to live market movement and settled Elo receipts—without having to wait a calendar week.

---

## 🛠️ Tech Stack

- **Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Routing:** [React Router v7](https://reactrouter.com/)
- **Build Tool:** [Vite 8](https://vitejs.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) + Custom Vercel Geist design tokens (`vercel-geist.css`)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Testing:** [Vitest 5](https://vitest.dev/) (Unit testing domain scoring, round logic, and Elo settlements)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or pnpm

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/move37park-ops/stoxdraw-demo.git
cd stoxdraw-demo

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Verification & Testing

```bash
# Run unit test suite (20 tests covering lifecycle, scoring, rounds, and Elo)
npm test

# Production build & TypeScript check
npm run build
```

---

## 📂 Project Structure

```
src/
├── components/          # Shared components (AppShell, Modals, Cards)
├── data/                # Market history, mock quotes, session, and local repository
│   ├── market.ts        # Historical prices and asset metadata (NVDA, TSLA, AAPL, etc.)
│   ├── seed.ts          # Authentic seed forecasters & locked trajectory theses
│   ├── session.ts       # User authentication and anonymous session manager
│   └── localRepository.ts # Reactive storage engine with subscription hooks
├── domain/              # Pure domain business logic & mathematical models
│   ├── arena.ts         # Consensus calculations and crowd aggregation
│   ├── elo.ts           # Zero-inflation Elo stake and LP rating engine
│   ├── scoring.ts       # 100-point hybrid trajectory scoring rubric
│   ├── round.ts         # Round cycles, locks, and countdown timers
│   └── resolution.ts    # Settlement engine matching paths against market closes
└── features/            # Feature modules
    ├── studio/          # Flagship 5-Day Trajectory Studio & Split Horizon Canvas
    ├── workspace/       # Workspace Overview & deployment streams
    ├── leaderboard/     # Elo rankings & verified forecaster directory
    ├── detail/          # Immutable prediction receipt & daily audit breakdown
    ├── profile/         # User profile, Elo dossier, and personal deployments
    └── auth/            # Wallet / Account connection modal
```

---

## 📄 License

Private demonstration project. All rights reserved.
