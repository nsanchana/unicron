# Unicron Apple Design Review — Full Spec

**Date:** 2026-03-26
**Scope:** Full design review of web and mobile experience, aligned to Apple Human Interface Guidelines (HIG) and Apple product aesthetic. Covers navigation, Company Research redesign, design system standardization, and per-screen polish.
**Approach:** Hybrid — structural navigation overhaul + progressive polish using Dashboard as the gold standard.

---

## 1. Navigation Overhaul

### Problem
The current mobile navigation uses a hamburger sidebar requiring 2 taps to switch tabs. This violates Apple HIG, which mandates a bottom tab bar for primary navigation on iPhone and iPad portrait.

### Design

#### Bottom Tab Bar (iPhone & iPad Portrait, <768px)
- 5 primary destinations: **Home, Trades, Research, Performance, More**
- "More" opens a bottom sheet containing: Stocks, Watchlist, Settings
- Frosted glass background: `bg-white/[0.08] backdrop-blur-2xl border-t border-white/[0.06]`
- Safe area padding for notch/home indicator devices (`env(safe-area-inset-bottom)`)
- Active state: filled icon + blue-500 tint + label. Inactive: outline icon + white/35
- 44px minimum touch target per tab item

#### Sidebar (Desktop >1024px)
- Keep current sidebar structure but refine:
  - Tighter spacing aligned to 8pt grid
  - SF-style active indicators: filled icon + blue tint background pill
  - Consistent icon set (currently Dashboard and Research both use BarChart3)

#### Collapsible Sidebar (iPad Landscape, 768-1024px)
- Sidebar collapses to icon-only rail (56px wide)
- Expand on hover/tap to full 256px sidebar
- Smooth transition with spring curve

#### Large Title Headers
- Every page gets an Apple-style large title (28px, bold, -0.5 tracking)
- Collapses into a compact header bar on scroll (like iOS Settings)
- Provides context without relying on navigation highlighting alone

#### Files Affected
- `src/App.jsx` — Complete navigation rewrite (remove hamburger, add tab bar + adaptive logic)
- `src/index.css` — Add safe area styles, tab bar transitions

---

## 2. Company Research Redesign

### Problem
Research is the most problematic screen. Monolithic layout with search, results, watchlist grid, and queue all stacked vertically. Report view dumps 4 sections with deep nesting. Cards are dense and break on mobile. Delete button is hover-only (invisible on touch).

### Design: Two-State Architecture

#### State 1: Watchlist Grid (Browsing)
- **Large Title** "Research" that collapses on scroll
- **Apple-style search bar** below the title, sticky on scroll
- **Horizontally scrollable filter chips** for sorting (Score, Recent, Price, A-Z, Needs Refresh, No Research)
- **Adaptive card layout:**
  - Mobile (<768px): compact list-style cards — symbol, price, score, sentiment in a single row
  - Desktop (>768px): current grid layout (2-3 columns) with refined spacing
- **Card content:**
  - Company logo + symbol + sentiment badge + research age
  - Live price (right-aligned, prominent)
  - Score with semantic color
  - Section scores using **full labels** (Company, Financial, Technical, Events) — no abbreviations
  - Target price + upside percentage (when available)
  - Earnings date indicator
- **Swipe actions** (mobile): swipe left reveals Delete (red) and Re-run (blue) actions
- **Long-press context menu**: View Report, Re-run, Add to Queue, Delete
- **Add to watchlist**: inline input below search bar

#### State 2: Report Detail (Reading)
- **Back navigation**: "‹ Research" in top-left (Apple style)
- **Company header**: logo + symbol + overall score + section score pills (full labels)
- **Segmented control** replacing 4 stacked accordions:
  - Tabs: Company | Financial | Technical | Events
  - Apple-style segmented control (`bg-white/[0.06]` track, `bg-white/[0.1]` active segment)
  - Tap to switch — shows one section at a time
  - Eliminates the overwhelming wall of content
- **Section content** renders below the segmented control with consistent card styling
- **Floating chat button**: bottom-right FAB (48px, gradient blue/indigo, shadow)
  - Opens a bottom sheet (not inline accordion)
  - Apple Messages-style chat bubbles
  - Always accessible while reading the report
- **Action bar**: Save Report, Share (future), Overflow menu (···)

#### Files Affected
- `src/components/CompanyResearch.jsx` — Full rewrite (split into sub-components)
- New: `src/components/ResearchCard.jsx` — Extracted card component
- New: `src/components/ResearchReport.jsx` — Report detail view
- New: `src/components/SegmentedControl.jsx` — Reusable segmented control
- New: `src/components/ChatSheet.jsx` — Bottom sheet chat component
- New: `src/components/SwipeableRow.jsx` — Swipeable list item with actions

---

## 3. Design System Standardization

### Typography Scale

| Level | Size | Weight | Tracking | Opacity | Usage |
|-------|------|--------|----------|---------|-------|
| Large Title | 28px | Bold (700) | -0.5px | 1.0 | Page headers |
| Title 1 | 20px | Semibold (600) | -0.3px | 1.0 | Section headers |
| Title 2 | 16px | Semibold (600) | Normal | 1.0 | Card headers, subsections |
| Body | 14px | Regular (400) | Normal | 0.85 | Primary content |
| Callout | 13px | Medium (500) | Normal | 0.6 | Secondary text, descriptions |
| Footnote | 12px | Medium (500) | Normal | 0.4 | Labels, timestamps, metadata |
| Overline | 10px | Semibold (600) | 0.15em | 0.35 | Category labels (uppercase) |

### Spacing — 8pt Grid
- All spacing uses multiples of 8: 8, 16, 24, 32, 40, 48
- Card internal padding: 16px (mobile) / 24px (desktop)
- Between major sections: 32px
- Between cards within a section: 12px (exception to 8pt for density)
- Between elements inside a card: 16px
- Page side padding: 16px (mobile) / 24px (tablet) / 32px (desktop)
- Max content width: 1200px

### Corner Radii — 3 Sizes
| Token | Value | Usage |
|-------|-------|-------|
| `rounded-lg` | 8px | Small elements: pills, badges, inline tags |
| `rounded-xl` | 12px | Inputs, buttons, inner cards, tooltips |
| `rounded-2xl` | 16px | Outer cards, containers, panels, sheets |

**Remove:** `rounded-[20px]` and `rounded-[28px]` throughout the codebase.

### Surface System — 3 Glass Levels

| Surface | Background | Border | Blur | Usage |
|---------|-----------|--------|------|-------|
| Surface 1 | `bg-white/[0.03]` | `border-white/[0.06]` | None | Inner elements, nested cards, table rows |
| Surface 2 | `bg-white/[0.05]` | `border-white/[0.08]` | `backdrop-blur-xl` | Primary cards, containers, panels |
| Surface 3 | `bg-white/[0.08]` | `border-white/[0.12]` | `backdrop-blur-2xl` | Modals, sheets, popovers, tab bar |

### Semantic Colors

| Purpose | Color | Token |
|---------|-------|-------|
| Positive / Bullish | Emerald | `emerald-400` (text), `emerald-500/10` (bg), `emerald-500/20` (border) |
| Neutral / Caution | Amber | `amber-400` (text), `amber-500/10` (bg), `amber-500/20` (border) |
| Negative / Bearish | Rose | `rose-400` (text), `rose-500/10` (bg), `rose-500/20` (border) |
| Interactive / Accent | Blue | `blue-400` (text), `blue-500` (solid bg), `blue-500/20` (border) |

**Fix:** Replace all `green-400`/`green-600` with `emerald-400`/`emerald-600` for consistency.

### Text Opacity Levels

| Level | Opacity | Usage |
|-------|---------|-------|
| Primary | 0.9 | Headings, key values, active labels |
| Secondary | 0.6 | Descriptions, supporting text |
| Tertiary | 0.35 | Metadata, timestamps, inactive labels |
| Disabled | 0.2 | Disabled states, placeholders |

**Fix:** Replace the current inconsistent mix of /85, /70, /50, /40, /30, /25 with these 4 levels.

### Interactions & Motion

#### Touch Targets
- Minimum 44x44px on all interactive elements (Apple HIG requirement)
- Audit and fix: sort pills, card action buttons, nav items, chat send button

#### Transitions
- Enter: `cubic-bezier(0.2, 0.8, 0.2, 1)` (Apple spring curve), 300ms
- Exit: `ease-out`, 200ms
- **Remove:** current mixed durations (300ms, 500ms, 700ms) — standardize

#### Haptic Feedback (PWA)
- `navigator.vibrate(10)` on: tab switches, save confirmations, pull-to-refresh
- Light, subtle — enhances native feel

#### Native Alerts → Custom Components
Replace all `alert()` and `window.confirm()` calls with:
- **Toast notifications**: slide down from top, auto-dismiss after 3s, Surface 3 glass
- **Confirmation sheets**: bottom sheet with action buttons, blur overlay
- **Affected locations** (6+ instances): save research, delete research, delete trade, price update results, duplicate research handling, data export

#### Files Affected
- `tailwind.config.js` — Add design tokens (surface classes, typography utilities)
- `src/index.css` — Add utility classes, transition presets, safe area styles
- New: `src/components/ui/Toast.jsx` — Toast notification component
- New: `src/components/ui/ConfirmSheet.jsx` — Confirmation sheet component
- New: `src/components/ui/SegmentedControl.jsx` — Reusable segmented control
- New: `src/components/ui/BottomSheet.jsx` — Bottom sheet container
- New: `src/components/ui/LargeTitle.jsx` — Collapsible large title header

---

## 4. Per-Screen Polish

### Dashboard (Light — Baseline)
1. Migrate corner radii from `rounded-[20px]` to `rounded-2xl`
2. Add Large Title "Dashboard" header (collapsible)
3. Align summary card grid to 8pt spacing
4. PremiumProgressBar: use Surface 1 for inner cards
5. Replace `text-[10px]` overline labels with standardized Overline class

### Performance (Light)
1. Migrate `rounded-[28px]` to `rounded-2xl`
2. Year/month selector: Apple segmented control style
3. Recharts tooltip: Surface 3 glass style
4. Add Large Title header, align to type scale

### Trades (Moderate)
1. Trade entry form: redesign as bottom sheet modal
2. Trade list: Apple grouped list with section headers (Active, Closed) + swipe actions
3. Greeks display: compact pill layout on mobile
4. Replace `window.confirm()` with confirmation sheets
5. Standardize all surfaces, radii, and spacing

### Stock Portfolio (Moderate)
1. Filter bar: horizontally scrollable chip row on mobile
2. Stock list: Apple grouped list with swipe-to-sell
3. P&L: consistent semantic colors (emerald gains, rose losses)
4. Entry form as bottom sheet modal

### Settings (Heavy)
1. iOS Settings pattern: grouped rows (label left, value right, chevron for drill-in)
2. Group into sections: Account, Portfolio Rules, Targets, Data Management, About
3. Stepper controls (+ / -) for numeric inputs
4. iOS-style toggle switch for theme
5. Funding history as expandable list rows

### Login (Light)
1. Center card vertically/horizontally
2. Larger logo with subtle fade-in animation
3. Inputs: `rounded-xl` with 16px text
4. Error state: shake + red border

### Unicron AI / Portfolio Chat (Moderate)
1. Apple Messages-style chat bubbles with tail and proper padding
2. Sticky input bar at bottom with safe area padding, multiline expansion
3. Quick prompt pills: horizontally scrollable above input
4. Session list: swipe-to-delete, new chat button in nav bar

---

## 5. Implementation Priority

| Phase | Scope | Risk |
|-------|-------|------|
| **Phase 1** | Design tokens + shared UI components (surfaces, typography, Toast, Sheet, SegmentedControl, LargeTitle, BottomSheet, SwipeableRow) | Low — additive, no breaking changes |
| **Phase 2** | Navigation overhaul (bottom tab bar, adaptive sidebar, large titles) | Medium — touches App.jsx, affects all screens |
| **Phase 3** | Company Research redesign (two-state, segmented report, floating chat, swipe actions) | Medium — largest single component rewrite |
| **Phase 4** | Dashboard + Performance polish (token migration, minor layout) | Low — mostly find-and-replace |
| **Phase 5** | Trades + Stock Portfolio rework (sheet modals, grouped lists, swipe actions) | Medium — form restructuring |
| **Phase 6** | Settings redesign + Login polish + AI Chat | Medium — Settings is a full rewrite, others are moderate |

---

## 6. Files Inventory

### New Files
- `src/components/ui/Toast.jsx`
- `src/components/ui/ConfirmSheet.jsx`
- `src/components/ui/SegmentedControl.jsx`
- `src/components/ui/BottomSheet.jsx`
- `src/components/ui/LargeTitle.jsx`
- `src/components/ui/TabBar.jsx`
- `src/components/ui/SwipeableRow.jsx`
- `src/components/ResearchCard.jsx`
- `src/components/ResearchReport.jsx`
- `src/components/ChatSheet.jsx`

### Modified Files
- `src/App.jsx` — Navigation rewrite
- `src/components/CompanyResearch.jsx` — Full redesign
- `src/components/Dashboard.jsx` — Token migration, Large Title
- `src/components/Performance.jsx` — Token migration, segmented control
- `src/components/TradeReview.jsx` — Sheet modals, grouped lists
- `src/components/StockPortfolio.jsx` — Chips, grouped list, sheet modal
- `src/components/SettingsPanel.jsx` — Full iOS Settings redesign
- `src/components/PortfolioChat.jsx` — Messages-style chat
- `src/components/UnicronAI.jsx` — Messages-style chat
- `src/components/Login.jsx` — Centered layout, polish
- `src/index.css` — Utility classes, transitions, safe area
- `tailwind.config.js` — Design tokens
- `public/manifest.json` — Verify theme color alignment

### No Changes
- `src/services/*` — Data layer untouched
- `src/utils/*` — Business logic untouched
- `api/*` — Backend untouched
- `server.js` — Backend untouched
