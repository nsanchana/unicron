import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, RotateCcw, XCircle, TrendingUp, AlertTriangle, Zap, Clock, ShieldAlert } from 'lucide-react'
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

const TIMEFRAME_LABELS = {
  today: 'Act today',
  this_week: 'This week',
  monitor: 'Monitor',
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

export default function DailyInsights({ tradeData, stockData, settings, dashboardStats }) {
  const [insights, setInsights] = useState(null)
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [generatedAt, setGeneratedAt] = useState(null)
  const [expanded, setExpanded] = useState(false)

  const activeTrades = (tradeData || []).filter(t => t.executed && !t.closed)
  const closedTrades = (tradeData || []).filter(t => t.executed && t.closed)
  const heldStocks = (stockData || []).filter(s => !s.soldPrice && !s.dateSold)
  const hasPositions = activeTrades.length > 0 || heldStocks.length > 0

  // Compute per-symbol history from closed trades
  const buildSymbolHistory = () => {
    const bySymbol = {}
    closedTrades.forEach(t => {
      const sym = t.symbol
      if (!bySymbol[sym]) bySymbol[sym] = { trades: 0, wins: 0, totalNet: 0, avgDTE: 0, dteSum: 0 }
      bySymbol[sym].trades++
      const net = t.netPremium != null ? t.netPremium : (t.premium * (t.quantity || 1) * 100)
      bySymbol[sym].totalNet += net
      if (t.expiredWorthless || t.closed) bySymbol[sym].wins++
      if (t.expirationDate && t.timestamp) {
        const dte = Math.ceil((new Date(t.expirationDate) - new Date(t.timestamp)) / (1000 * 60 * 60 * 24))
        bySymbol[sym].dteSum += dte
      }
    })
    return Object.entries(bySymbol).map(([sym, d]) => ({
      symbol: sym,
      trades: d.trades,
      winRate: d.trades > 0 ? Math.round((d.wins / d.trades) * 100) : 0,
      totalNet: Math.round(d.totalNet),
      avgDTE: d.trades > 0 ? Math.round(d.dteSum / d.trades) : 0,
    }))
  }

  const fetchInsights = async () => {
    if (!hasPositions) return

    setLoading(true)
    setError(false)

    try {
      const now = new Date()
      const symbolHistory = buildSymbolHistory()

      // Enrich trades with computed fields
      const enrichedTrades = activeTrades.map(t => {
        const exp = new Date(t.expirationDate)
        const opened = new Date(t.timestamp || t.executionDate || now)
        const dte = Math.ceil((exp - now) / (1000 * 60 * 60 * 24))
        const totalDte = Math.ceil((exp - opened) / (1000 * 60 * 60 * 24))
        const thetaProgress = totalDte > 0 ? Math.round(((totalDte - dte) / totalDte) * 100) : 100
        const currentPrice = t.currentMarketPrice || t.stockPrice
        const strikeProximity = currentPrice && t.strikePrice
          ? ((currentPrice - t.strikePrice) / t.strikePrice * 100).toFixed(1)
          : null
        const symHist = symbolHistory.find(s => s.symbol === t.symbol)

        return {
          symbol: t.symbol,
          tradeType: t.tradeType || t.type,
          strikePrice: t.strikePrice,
          premium: t.premium,
          netPremium: t.netPremium || t.premium,
          expirationDate: t.expirationDate,
          currentMarketPrice: currentPrice,
          quantity: t.quantity || 1,
          buybackCost: t.buybackCost || 0,
          fees: t.fees || 0,
          dte,
          thetaProgress,
          strikeProximityPct: strikeProximity,
          notes: t.notes,
          symbolHistory: symHist || null,
        }
      })

      // Enrich stocks with computed fields
      const enrichedStocks = heldStocks.map(s => {
        const assignedPrice = parseFloat(s.assignedPrice || s.assignedAt) || 0
        const currentPrice = parseFloat(s.currentPrice) || 0
        const shares = parseFloat(s.shares) || 0
        const unrealizedPnL = currentPrice && assignedPrice ? ((currentPrice - assignedPrice) * shares).toFixed(2) : 'N/A'
        const unrealizedPnLPct = currentPrice && assignedPrice ? (((currentPrice - assignedPrice) / assignedPrice) * 100).toFixed(1) : 'N/A'
        const daysHeld = s.dateAssigned ? Math.ceil((now - new Date(s.dateAssigned)) / (1000 * 60 * 60 * 24)) : null
        const symHist = symbolHistory.find(h => h.symbol === s.symbol)

        return {
          symbol: s.symbol,
          shares,
          assignedPrice,
          currentPrice,
          unrealizedPnL,
          unrealizedPnLPct,
          daysHeld,
          dateAssigned: s.dateAssigned,
          symbolHistory: symHist || null,
        }
      })

      const response = await fetch('/api/unicron-ai', {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          mode: 'daily-insights',
          trades: enrichedTrades,
          stocks: enrichedStocks,
          symbolHistory,
          settings: {
            portfolioSize: settings?.portfolioSize,
            riskTolerance: settings?.riskTolerance,
            weeklyPremiumTarget: settings?.weeklyPremiumTarget,
            tradingRules: settings?.tradingRules,
            maxTradePercentage: settings?.maxTradePercentage,
          },
          portfolio: {
            availableCash: dashboardStats?.availableCash,
            totalAllocated: dashboardStats?.totalAllocated,
            allocationPct: dashboardStats?.allocationPercentage,
            currentStockValue: dashboardStats?.currentStockValue,
            totalInvested: dashboardStats?.totalInvested,
            yearlyPremium: dashboardStats?.yearlyPremium,
            yearlyProjection: dashboardStats?.yearlyProjection,
            portfolioTotal: dashboardStats?.portfolioTotal,
          },
          weeklyPremium: dashboardStats?.weeklyPremium || 0,
          weeklyTarget: dashboardStats?.weeklyTarget || { min: 0, max: 0 },
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
        // Validate cached data: summary must be a string, insights must be an array of objects with string fields
        const validSummary = typeof parsed.summary === 'string' ? parsed.summary : ''
        const validInsights = Array.isArray(parsed.insights)
          ? parsed.insights.filter(i => i && typeof i.title === 'string')
          : []
        if (validInsights.length > 0) {
          setInsights(validInsights)
          setSummary(validSummary)
          setGeneratedAt(new Date(parsed.generatedAt))
          return
        }
        // Invalid cache — clear and re-fetch
        localStorage.removeItem(getTodayKey())
      } catch {
        localStorage.removeItem(getTodayKey())
      }
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
          <span className="text-callout text-secondary">Analyzing positions...</span>
        </div>
        <div className="space-y-2">
          <div className="h-16 bg-white/[0.03] rounded-xl" />
          <div className="h-16 bg-white/[0.03] rounded-xl" />
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
            <p className="text-footnote text-tertiary">{typeof summary === 'string' ? summary : ''}</p>
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
            <div key={i} className="p-3 bg-white/[0.03] rounded-xl space-y-2">
              {/* Top row: priority dot, icon, symbol, title, metric */}
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 mt-0.5 flex-shrink-0">
                  <div className={`h-2 w-2 rounded-full ${priorityColor}`} />
                  <Icon className="h-4 w-4 text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-overline px-1.5 py-0.5 rounded-lg surface-1">{String(insight.symbol || '')}</span>
                    <span className="text-body font-semibold text-primary">{String(insight.title || '')}</span>
                  </div>
                  <p className="text-callout text-secondary">{String(insight.reasoning || '')}</p>
                </div>
                {insight.metric && (
                  <span className={`text-footnote font-mono font-semibold whitespace-nowrap flex-shrink-0 ${metricColor}`}>
                    {String(insight.metric)}
                  </span>
                )}
              </div>

              {/* Bottom row: suggested action, risk, timeframe */}
              {(insight.suggestedAction || insight.risk || insight.timeframe) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-8 text-footnote">
                  {insight.suggestedAction && (
                    <span className="text-emerald-400">
                      <TrendingUp className="h-3 w-3 inline mr-1 -mt-0.5" />
                      {insight.suggestedAction}
                    </span>
                  )}
                  {insight.risk && (
                    <span className="text-amber-400/80">
                      <ShieldAlert className="h-3 w-3 inline mr-1 -mt-0.5" />
                      {insight.risk}
                    </span>
                  )}
                  {insight.timeframe && (
                    <span className="text-tertiary">
                      <Clock className="h-3 w-3 inline mr-1 -mt-0.5" />
                      {TIMEFRAME_LABELS[insight.timeframe] || insight.timeframe}
                    </span>
                  )}
                </div>
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
