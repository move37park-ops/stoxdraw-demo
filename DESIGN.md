# DESIGN.md — Orange Paths Design System

Orange Paths follows a **DeepBook Flush Hairline** surface system paired with an **Orange Signature (`--op-orange`)** accent on the forecast trajectory. The UI uses light/dark CSS color tokens (`color-scheme: light dark` and `light-dark()`) built through Tailwind CSS v4 (`@tailwindcss/vite`) and component primitives in `src/styles/orange-paths.css`.

---

## 1. Visual Principles

- **Flush Hairline Grid**: Components sit on 1px structural borders (`--op-line`, `--op-line-strong`) and `2px` border radius without drop-shadow clutter.
- **High-Contrast Canvas**: Background canvas stays pure black (`#000000`) in dark mode and pure white (`#ffffff`) in light mode so price candles, consensus bands, and drawn orange anchors remain unambiguous.
- **Orange Exclusivity**: `--op-orange` (`#ff6b00` dark / `#e65c00` light) is reserved exclusively for user-authored forecast paths, primary lock actions, and active identity markers.
- **Semantic Role Separation**: Crowd median lines stay neutral grey (`--op-crowd`), Top-Tier cohort lines use blue (`--op-smart`), realized gains/losses use green (`--op-bull`) and red (`--op-bear`).

---

## 2. Color Tokens (`src/styles/orange-paths.css`)

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--op-canvas` | `#ffffff` | `#000000` | Primary background and chart canvas |
| `--op-panel` | `#fafafa` | `#08080a` | Secondary panels, ticket surface, table headers |
| `--op-raised` | `#ebebeb` | `#111114` | Elevated interactive states and segmented active fill |
| `--op-line` | `#eaeaea` | `#18181b` | Structural dividers and grid hairlines |
| `--op-line-strong` | `#d4d4d4` | `#27272a` | Container framing borders and control outlines |
| `--op-ink` | `#171717` | `#ededed` | Primary typography |
| `--op-ink-2` | `#666666` | `#a1a1a1` | Secondary labels and descriptions |
| `--op-ink-3` | `#8f8f8f` | `#666666` | Muted metadata and axis ticks |
| `--op-orange` | `#e65c00` | `#ff6b00` | User trajectory, primary CTA, active indicators |
| `--op-smart` | `#0070f3` | `#52a8ff` | Top-Tier cohort overlays and Elo badges |
| `--op-crowd` | `#737373` | `#888888` | Aggregate crowd median path and interquartile bands |
| `--op-bull` | `#16803c` | `#46a758` | Positive return / direction hit |
| `--op-bear` | `#d93036` | `#e5484d` | Negative return / bearish leg |

---

## 3. Typography

- **Primary Sans**: `'Geist'`, `'Pretendard Variable'`, `'Pretendard'`, system fallbacks (`14px` base, `1.5` line-height, `-0.015em` letter spacing).
- **Monospace & Tabular Figures**: `'Geist Mono'`, `'Pretendard Variable'` with `font-variant-numeric: tabular-nums` (`.op-mono`, `.op-num`) on prices, percentages, Elo scores, countdowns, and score tables to prevent layout jitter.

---

## 4. Layout & Staged Lean Information Architecture

- **Navigation (`TopNav`)**: `h-12` desktop top bar (`예측하기`, `연습하기`, `리더보드`, `프로필`, language toggle, theme toggle, summary guide `?`, connect account) + dedicated 4-column mobile sub-navigation (`< md`: `/`, `/practice`, `/leaderboard`, `/me`) so links never clip at `390px`.
- **Workbench (`/`)**:
  - Single compact header bar (`BTC/USDT`, spot/base quote + 15-day rolling daily round navigator `← Prev | Range · Status | Next → | Today` covering `OPEN`, `TRACKING 1/7..6/7`, and `EVALUATED 7/7`).
  - `12`-column CSS grid (`lg:grid-cols-12`): `8` columns `PathCanvas` (zoomable 7D–240D history, scalable Y-axis + 7D drawing region) and `4` columns `TicketPanel`.
  - **Empty Canvas Onboarding**: Before the first anchor exists, an overlay prompt on the chart invites direct drawing or applying a one-click sample forecast path.
  - **Streamlined `TicketPanel`**: `OPEN` rounds show the `D+7` target price/return readout, 3 preset chips (`Dip & Rally`, `Pullback Breakout`, `Peak & Pullback`), optional 1-line memo (`maxLength=140`), and 1-click lock (`Lock Your Forecast`); after lock, transitions directly to `My Forecast vs. Crowd Path` comparison and Share/Details actions; `TRACKING`/`EVALUATED` rounds show actual close vs Crowd Path, interim/final score, round leader overlay toggle, and return to today CTA.
- **Blind Contribution Gate (`BottomTabs`)**:
  - Hosts the unified `ParticipantsTable`: pre-lock rows mask peer targets and memos behind Blind Mode, while post-lock and closed rounds unlock score-sorted metrics, detail links, and up to 3 concurrent rival path overlays on `PathCanvas`.

---

## 5. Canvas Interaction & Accessibility

- **Input Modes**: Direct pointer draw/drag across `D+1..D+7` (up to `5` anchors), keyboard anchor editing via day/price sliders & `Backspace`/`Delete`, and touch-friendly `Del D+N` chip when an anchor is selected.
- **Scroll Zoom & Y-Axis Scale**: Direct mouse wheel / trackpad scroll over the chart canvas zooms historical lookback (`7D–240D`); scrolling, dragging, or double-clicking on the right Y-axis scales/resets price amplitude. Idle SVG keeps `touch-pan-y` so mobile page vertical scrolling stays unobstructed, switching to `touch-none` only while actively dragging an anchor or price axis.
- **Accessibility**: Native `<dialog>` modals (`GuideModal`, `ConnectModal`, `ShareTicketModal`), `popover="manual"` submission toast with ARIA live-region fallback, explicit `aria-pressed` states, and ARIA `tablist`/`tab`/`tabpanel` keyboard navigation on `BottomTabs`.
