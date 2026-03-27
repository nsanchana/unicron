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

    if (hasPositions) {
      fetchInsights()
    }
  }, []) // eslint-disable-line

  const handleRefresh = () => {
    localStorage.removeItem(getTodayKey())
    fetchInsights()
  }

  if (!hasPositions && !loading) {
    return (
      <div className="surface-2 rounded-2xl p-5 flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-tertiary" />
        <span className="text-callout text-tertiary">No active positions to analyze</span>
      </div>
    )
  }

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
