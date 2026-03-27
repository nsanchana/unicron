# Dashboard Daily AI Insights — Spec

**Date:** 2026-03-27
**Scope:** Add an AI-powered Daily Insights section to the Dashboard that reviews active trades and held stocks, providing actionable recommendations (roll, close, sell call, warnings, opportunities).
**Approach:** Client-side with daily cache — first Dashboard load of the day triggers a Gemini API call, caches the result in localStorage for 24 hours, with a manual Refresh button.

---

## 1. API Endpoint

### `POST /api/daily-insights`

**Request body:**
```json
{
  "trades": [{ "symbol", "tradeType", "strikePrice", "premium", "expirationDate", "stockPrice", "currentMarketPrice", "quantity", "fees", "buybackCost", "netPremium", "notes" }],
  "stocks": [{ "symbol", "shares", "assignedPrice", "currentPrice", "dateAssigned" }],
  "settings": { "portfolioSize", "riskTolerance", "weeklyPremiumTarget", "tradingRules", "maxTradePercentage" },
  "weeklyPremium": 0,
  "weeklyTarget": { "min": 0, "max": 0 }
}
```

Only active trades (`executed && !closed`) and held stocks (`!soldPrice`) are sent. Current market prices should be refreshed before calling this endpoint.

**Gemini prompt structure:**
- System role: "You are Unicron, an options trading analyst. Review the user's active positions and provide actionable daily insights."
- Include: all active trades with DTE calculated, all held stocks with unrealized P&L, portfolio settings and weekly progress
- Request: structured JSON response with insight objects
- Guidance: prioritize time-sensitive actions (expiring trades, theta decay opportunities), flag risk (earnings proximity, over-allocation), suggest covered call opportunities on held stocks trending up

**Response format:**
```json
{
  "insights": [
    {
      "type": "roll" | "close" | "sell_call" | "warning" | "opportunity",
      "priority": "high" | "medium" | "low",
      "symbol": "AAPL",
      "title": "Consider rolling your AAPL $180 call",
      "reasoning": "Only 1 DTE remaining with 85% theta captured. Rolling to next week locks in gains.",
      "metric": "$42 premium captured of $48 total"
    }
  ],
  "summary": "3 actions suggested across 12 active positions"
}
```

**Model:** `gemini-2.0-flash` (same as existing portfolio AI)

**Error handling:** If Gemini returns invalid JSON, attempt to parse the response as markdown and extract insights. If that fails, return `{ insights: [], summary: "Unable to generate insights", error: true }`.

---

## 2. Client-Side Caching

**Cache key:** `unicron_daily_insights_YYYY-MM-DD` in localStorage

**Cache structure:**
```json
{
  "date": "2026-03-27",
  "generatedAt": "2026-03-27T13:14:00.000Z",
  "insights": [...],
  "summary": "..."
}
```

**Cache logic in Dashboard:**
1. On mount, check if `unicron_daily_insights_{today}` exists in localStorage
2. If yes → render cached insights immediately, no API call
3. If no → show loading state, call `/api/daily-insights` with current portfolio data, cache result, render
4. Manual "Refresh" button → delete today's cache, re-trigger step 3

**Cache cleanup:** On each load, delete any `unicron_daily_insights_*` keys that aren't today (prevent localStorage bloat).

---

## 3. UI Component: `DailyInsights`

### Props
```jsx
DailyInsights({ tradeData, stockData, settings, weeklyPremium, weeklyTarget })
```

### Position
Top of Dashboard, above the Daily Quote section.

### States

**Loading:**
- Shimmer skeleton card matching the loaded layout dimensions
- Text: "Generating daily insights..."
- Non-blocking — rest of Dashboard renders below

**Loaded:**
- Card with `surface-2 rounded-2xl` styling
- **Header row:**
  - Left: Sparkles icon (lucide) + "Daily Insights" (title-2) + summary text (footnote, tertiary)
  - Right: Refresh button (RefreshCw icon, min-h-[44px])
- **Insight list:**
  - Each insight is a row with:
    - Priority dot: `h-2 w-2 rounded-full` — red (`bg-rose-500`) for high, amber (`bg-amber-500`) for medium, blue (`bg-blue-500`) for low
    - Type icon (16px): RotateCcw for roll, XCircle for close, TrendingUp for sell_call, AlertTriangle for warning, Zap for opportunity
    - Symbol badge: `text-overline px-1.5 py-0.5 rounded-lg surface-1`
    - Title: `text-body font-semibold text-primary` — single line
    - Reasoning: `text-callout text-secondary` — truncated to 2 lines with `line-clamp-2`
    - Metric pill (right): `text-footnote font-mono` with semantic color based on type
  - Default: show first 3 insights
  - "Show all (N)" / "Show less" toggle if more than 3
- **Footer:** "Generated today at {time}" in `text-overline text-tertiary`

**Empty state:**
- Shown when no active trades AND no held stocks
- Icon: Sparkles (muted) + "No active positions to analyze"

**Error state:**
- "Couldn't generate insights" + Retry button
- Non-blocking, rest of Dashboard renders normally

### Interaction
- Informational only — no deep-linking or inline actions
- Refresh button clears cache and re-fetches
- Collapse/expand for 3+ insights

---

## 4. Files

### New Files
- `api/daily-insights.js` — Vercel serverless function, Gemini API call
- `src/components/DailyInsights.jsx` — Dashboard UI component

### Modified Files
- `src/components/Dashboard.jsx` — Import and render `<DailyInsights>` above Daily Quote, pass required props

### No Changes
- `src/services/*` — Price service unchanged (caller refreshes prices before calling insights)
- `src/utils/*` — Storage utils unchanged (component manages its own cache key)
- `server.js` — Local dev proxy already forwards `/api/*` to Vercel functions or local server

---

## 5. Insight Types Reference

| Type | Icon | When to suggest |
|------|------|----------------|
| `roll` | RotateCcw | Trade near expiration with significant theta captured, worth extending |
| `close` | XCircle | Trade has captured 80%+ of premium, theta remaining is minimal, close to lock in |
| `sell_call` | TrendingUp | Held stock trending up, good opportunity to sell covered call for income |
| `warning` | AlertTriangle | Earnings approaching on a position, over-allocation risk, DTE rule violation |
| `opportunity` | Zap | Weekly target not met and positions available, market conditions favorable |
