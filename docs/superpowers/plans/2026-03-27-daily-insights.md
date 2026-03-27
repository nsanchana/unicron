# Daily AI Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily AI insights section to the Dashboard that reviews active trades and held stocks, providing actionable recommendations via Gemini.

**Architecture:** New `/api/daily-insights` serverless function calls Gemini with portfolio context and returns structured JSON insights. New `DailyInsights` component renders at the top of Dashboard with daily localStorage caching.

**Tech Stack:** React 18, Tailwind CSS, Google Generative AI (Gemini 2.0 Flash), Vercel serverless functions, localStorage caching.

**Spec:** `docs/superpowers/specs/2026-03-27-daily-insights-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `api/daily-insights.js` | Create | Serverless endpoint — builds Gemini prompt from portfolio data, returns structured insights JSON |
| `src/components/DailyInsights.jsx` | Create | UI component — caching logic, loading/loaded/empty/error states, insight rendering |
| `src/components/Dashboard.jsx` | Modify | Import and render `<DailyInsights>` above DailyQuote, pass props |

---

### Task 1: API Endpoint

**Files:**
- Create: `api/daily-insights.js`

- [ ] **Step 1: Create the endpoint file**

Follow the exact pattern from `api/unicron-ai.js` (auth, CORS, POST-only, Gemini client). The endpoint receives active trades, held stocks, and settings, then asks Gemini for structured daily insights.

```javascript
import { GoogleGenerativeAI } from '@google/generative-ai'
import { requireAuth, setCors } from './_auth.js'

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return res.status(500).json({ error: 'API key not configured' })
  }

  try {
    const { trades, stocks, settings, weeklyPremium, weeklyTarget } = req.body

    // Calculate DTE for each trade
    const now = new Date()
    const tradesWithDTE = (trades || []).map(t => {
      const exp = new Date(t.expirationDate)
      const dte = Math.ceil((exp - now) / (1000 * 60 * 60 * 24))
      return { ...t, dte }
    })

    // Calculate unrealized P&L for each stock
    const stocksWithPnL = (stocks || []).map(s => {
      const pnl = s.currentPrice && s.assignedPrice
        ? ((s.currentPrice - s.assignedPrice) * s.shares).toFixed(2)
        : 'N/A'
      const pnlPct = s.currentPrice && s.assignedPrice
        ? (((s.currentPrice - s.assignedPrice) / s.assignedPrice) * 100).toFixed(1)
        : 'N/A'
      return { ...s, unrealizedPnL: pnl, unrealizedPnLPct: pnlPct }
    })

    const tradesBlock = tradesWithDTE.length > 0
      ? tradesWithDTE.map(t =>
          `  ${t.symbol} ${t.tradeType === 'cashSecuredPut' ? 'CSP' : 'CC'} $${t.strikePrice} strike | Premium $${t.premium}/sh | Net $${t.netPremium || t.premium} | DTE: ${t.dte}d | Current: $${t.currentMarketPrice || 'N/A'}${t.buybackCost ? ` | Buyback: $${t.buybackCost}` : ''}`
        ).join('\n')
      : 'None'

    const stocksBlock = stocksWithPnL.length > 0
      ? stocksWithPnL.map(s =>
          `  ${s.symbol} ${s.shares}sh @ $${s.assignedPrice} | Current: $${s.currentPrice || 'N/A'} | P&L: $${s.unrealizedPnL} (${s.unrealizedPnLPct}%)`
        ).join('\n')
      : 'None'

    const systemPrompt = `You are Unicron AI — a sharp options trading analyst. The user trades the Wheel strategy (Cash Secured Puts → assignment → Covered Calls).

Review the user's current positions and provide DAILY ACTIONABLE INSIGHTS.

ACTIVE TRADES (${tradesWithDTE.length}):
${tradesBlock}

HELD STOCKS (${stocksWithPnL.length}):
${stocksBlock}

PORTFOLIO SETTINGS:
  Size: $${settings?.portfolioSize?.toLocaleString() || 'N/A'}
  Risk tolerance: ${settings?.riskTolerance || 'moderate'}
  CSP max DTE: ${settings?.tradingRules?.cashSecuredPut?.maxDays || 30} days
  CC max DTE: ${settings?.tradingRules?.coveredCall?.maxDays || 5} days
  Max allocation per trade: ${settings?.maxTradePercentage || 50}%

WEEKLY PROGRESS:
  Premium this week: $${weeklyPremium || 0}
  Target: $${weeklyTarget?.min || 0} - $${weeklyTarget?.max || 0}

INSTRUCTIONS:
- Return ONLY valid JSON (no markdown fences, no extra text)
- Analyze each position and identify actionable insights
- Prioritize: expiring trades, theta decay opportunities, covered call opportunities on held stocks, risk warnings
- For each insight, explain WHY concisely

Return this exact JSON structure:
{
  "insights": [
    {
      "type": "roll" | "close" | "sell_call" | "warning" | "opportunity",
      "priority": "high" | "medium" | "low",
      "symbol": "TICKER",
      "title": "Short action-oriented title",
      "reasoning": "1-2 sentence explanation with specific numbers from the data",
      "metric": "Key number like '$42 premium captured' or '2 DTE remaining'"
    }
  ],
  "summary": "N actions suggested across M active positions"
}`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt
    })

    const result = await model.generateContent('Generate today\'s daily insights for my portfolio.')
    const text = result.response.text()

    // Parse JSON — handle potential markdown fences
    let parsed
    try {
      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON:', text)
      return res.status(200).json({
        insights: [],
        summary: 'Unable to parse AI response',
        error: true,
        raw: text
      })
    }

    return res.status(200).json({
      insights: parsed.insights || [],
      summary: parsed.summary || `${(parsed.insights || []).length} insights generated`
    })

  } catch (error) {
    console.error('Daily insights error:', error)
    return res.status(500).json({
      error: 'Failed to generate insights',
      details: error.message || error.toString()
    })
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd /c/Projects/unicron && npm run build`
Expected: Build succeeds (serverless functions aren't bundled by Vite, but no import errors).

- [ ] **Step 3: Commit**

```bash
git add api/daily-insights.js
git commit -m "feat: add /api/daily-insights endpoint — Gemini-powered portfolio insights"
```

---

### Task 2: DailyInsights Component

**Files:**
- Create: `src/components/DailyInsights.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, RotateCcw, XCircle, TrendingUp, AlertTriangle, Zap } from 'lucide-react'
import { authHeaders } from '../utils/auth.js'

const CACHE_PREFIX = 'unicron_daily_insights_'

const TYPE_ICONS = {
  roll: RotateCcw,
  close: XCircle,
  sell_call: TrendingUp,
  warning: AlertTriangle,
  opportunity: Zap,
}

const PRIORITY_COLORS = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
}

const METRIC_COLORS = {
  roll: 'text-blue-400',
  close: 'text-emerald-400',
  sell_call: 'text-emerald-400',
  warning: 'text-amber-400',
  opportunity: 'text-blue-400',
}

function getTodayKey() {
  return CACHE_PREFIX + new Date().toISOString().split('T')[0]
}

function cleanOldCache() {
  const todayKey = getTodayKey()
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key && key.startsWith(CACHE_PREFIX) && key !== todayKey) {
      localStorage.removeItem(key)
    }
  }
}

export default function DailyInsights({ tradeData, stockData, settings, weeklyPremium, weeklyTarget }) {
  const [insights, setInsights] = useState(null)
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [generatedAt, setGeneratedAt] = useState(null)
  const [expanded, setExpanded] = useState(false)

  // Filter to active trades and held stocks
  const activeTrades = (tradeData || []).filter(t => t.executed && !t.closed)
  const heldStocks = (stockData || []).filter(s => !s.soldPrice && !s.dateSold)

  const hasPositions = activeTrades.length > 0 || heldStocks.length > 0

  const fetchInsights = async () => {
    if (!hasPositions) return

    setLoading(true)
    setError(false)

    try {
      const response = await fetch('/api/daily-insights', {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          trades: activeTrades.map(t => ({
            symbol: t.symbol,
            tradeType: t.tradeType || t.type,
            strikePrice: t.strikePrice,
            premium: t.premium,
            expirationDate: t.expirationDate,
            stockPrice: t.stockPrice,
            currentMarketPrice: t.currentMarketPrice,
            quantity: t.quantity || 1,
            fees: t.fees || 0,
            buybackCost: t.buybackCost || 0,
            netPremium: t.netPremium || t.premium,
            notes: t.notes,
          })),
          stocks: heldStocks.map(s => ({
            symbol: s.symbol,
            shares: s.shares,
            assignedPrice: s.assignedPrice || s.assignedAt,
            currentPrice: s.currentPrice,
            dateAssigned: s.dateAssigned,
          })),
          settings: {
            portfolioSize: settings?.portfolioSize,
            riskTolerance: settings?.riskTolerance,
            weeklyPremiumTarget: settings?.weeklyPremiumTarget,
            tradingRules: settings?.tradingRules,
            maxTradePercentage: settings?.maxTradePercentage,
          },
          weeklyPremium: weeklyPremium || 0,
          weeklyTarget: weeklyTarget || { min: 0, max: 0 },
        })
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        throw new Error(data.details || data.error || 'Failed to generate insights')
      }

      const cached = {
        date: new Date().toISOString().split('T')[0],
        generatedAt: new Date().toISOString(),
        insights: data.insights || [],
        summary: data.summary || '',
      }

      localStorage.setItem(getTodayKey(), JSON.stringify(cached))
      setInsights(cached.insights)
      setSummary(cached.summary)
      setGeneratedAt(new Date(cached.generatedAt))
    } catch (err) {
      console.error('Daily insights error:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cleanOldCache()

    // Check cache
    const cached = localStorage.getItem(getTodayKey())
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        setInsights(parsed.insights)
        setSummary(parsed.summary)
        setGeneratedAt(new Date(parsed.generatedAt))
        return
      } catch { /* fall through to fetch */ }
    }

    // No cache — fetch
    if (hasPositions) {
      fetchInsights()
    }
  }, []) // eslint-disable-line

  const handleRefresh = () => {
    localStorage.removeItem(getTodayKey())
    fetchInsights()
  }

  // Empty state — no positions
  if (!hasPositions && !loading) {
    return (
      <div className="surface-2 rounded-2xl p-5 flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-tertiary" />
        <span className="text-callout text-tertiary">No active positions to analyze</span>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="surface-2 rounded-2xl p-5 space-y-3 animate-pulse">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-blue-400 animate-spin" />
          <span className="text-callout text-secondary">Generating daily insights...</span>
        </div>
        <div className="space-y-2">
          <div className="h-12 bg-white/[0.03] rounded-xl" />
          <div className="h-12 bg-white/[0.03] rounded-xl" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="surface-2 rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <span className="text-callout text-secondary">Couldn't generate insights</span>
        </div>
        <button onClick={handleRefresh} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-footnote font-medium rounded-xl transition-spring min-h-[44px]">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    )
  }

  // No insights returned
  if (!insights || insights.length === 0) return null

  const displayedInsights = expanded ? insights : insights.slice(0, 3)
  const timeStr = generatedAt ? generatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''

  return (
    <div className="surface-2 rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/10 rounded-xl border border-violet-500/20">
            <Sparkles className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-title-2 text-primary">Daily Insights</h3>
            <p className="text-footnote text-tertiary">{summary}</p>
          </div>
        </div>
        <button onClick={handleRefresh} className="p-2 hover:bg-white/[0.05] rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" title="Refresh insights">
          <RefreshCw className="h-4 w-4 text-tertiary" />
        </button>
      </div>

      {/* Insight list */}
      <div className="space-y-2">
        {displayedInsights.map((insight, i) => {
          const Icon = TYPE_ICONS[insight.type] || Zap
          const priorityColor = PRIORITY_COLORS[insight.priority] || PRIORITY_COLORS.low
          const metricColor = METRIC_COLORS[insight.type] || 'text-blue-400'

          return (
            <div key={i} className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-xl">
              <div className="flex items-center gap-2 mt-0.5 flex-shrink-0">
                <div className={`h-2 w-2 rounded-full ${priorityColor}`} />
                <Icon className="h-4 w-4 text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-overline px-1.5 py-0.5 rounded-lg surface-1">{insight.symbol}</span>
                  <span className="text-body font-semibold text-primary">{insight.title}</span>
                </div>
                <p className="text-callout text-secondary line-clamp-2">{insight.reasoning}</p>
              </div>
              {insight.metric && (
                <span className={`text-footnote font-mono font-semibold whitespace-nowrap flex-shrink-0 ${metricColor}`}>
                  {insight.metric}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Show all / show less */}
      {insights.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-footnote text-blue-400 hover:text-blue-300 font-medium transition-colors"
        >
          {expanded ? 'Show less' : `Show all (${insights.length})`}
        </button>
      )}

      {/* Timestamp */}
      {timeStr && (
        <p className="overline">Generated today at {timeStr}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd /c/Projects/unicron && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/DailyInsights.jsx
git commit -m "feat: add DailyInsights component with daily cache and loading states"
```

---

### Task 3: Integrate into Dashboard

**Files:**
- Modify: `src/components/Dashboard.jsx`

- [ ] **Step 1: Add import**

At the top of `src/components/Dashboard.jsx`, add:

```jsx
import DailyInsights from './DailyInsights'
```

- [ ] **Step 2: Compute weeklyPremium and weeklyTarget for props**

These values are already computed inside `dashboardStats` (as `weeklyPremium` and `weeklyTarget`). They'll be passed as props from the Dashboard render.

- [ ] **Step 3: Add DailyInsights to the return JSX**

In the return block, add `<DailyInsights>` between the `<LargeTitle>` and `<DailyQuote>`:

```jsx
<LargeTitle title="Dashboard" subtitle="Your portfolio overview and key metrics." />

{/* AI Daily Insights */}
<DailyInsights
  tradeData={tradeData}
  stockData={stockData}
  settings={settings}
  weeklyPremium={dashboardStats.weeklyPremium}
  weeklyTarget={dashboardStats.weeklyTarget}
/>

{/* Daily Investor Quote */}
<DailyQuote />
```

- [ ] **Step 4: Verify build**

Run: `cd /c/Projects/unicron && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Manual test**

Run: `npm run dev`, open Dashboard.
- If you have active trades: should show loading shimmer → insights appear
- If no active trades: should show "No active positions to analyze"
- Refresh the page: should load from cache instantly (no loading state)
- Click Refresh button: should re-generate insights

- [ ] **Step 6: Commit**

```bash
git add src/components/Dashboard.jsx
git commit -m "feat: integrate DailyInsights into Dashboard above DailyQuote"
```

---

### Task 4: Add local dev proxy route

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Check if server.js already proxies all /api/* routes**

Read `server.js` to see how existing API routes are handled locally. If it uses a catch-all proxy or dynamic import pattern for `api/*.js`, this step may not be needed.

If a new route needs to be added manually, add:

```javascript
app.post('/api/daily-insights', async (req, res) => {
  const handler = (await import('./api/daily-insights.js')).default
  return handler(req, res)
})
```

Follow the exact pattern used by other routes in `server.js`.

- [ ] **Step 2: Verify dev server**

Run: `npm start`, open Dashboard on localhost:3000.
Verify the insights API call works locally (check browser Network tab for `/api/daily-insights`).

- [ ] **Step 3: Commit (if changes were needed)**

```bash
git add server.js
git commit -m "feat: add /api/daily-insights route to local dev server"
```
