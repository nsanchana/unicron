import { useState, useMemo } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Target, Calendar, AlertCircle, CheckCircle, Trash2, Edit, RefreshCw, Briefcase, BarChart3 } from 'lucide-react'
import {
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  isWithinInterval
} from 'date-fns'
import { saveToLocalStorage, STORAGE_KEYS } from '../utils/storage'
import { scrapeCompanyData } from '../services/webScraping'
import CompanyLogo from './CompanyLogo'
import StrategySection from './StrategySection'

// Helper function to format dates as DD/MM/YYYY
const formatDateDDMMYYYY = (dateString) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = date.toLocaleString('default', { month: 'short' }).toUpperCase()
  const year = date.getFullYear()
  return `${day} ${month} ${year}`
}

const getRecommendationColor = (action) => {
  if (!action) return 'bg-gray-600 text-gray-300'
  const lower = action.toLowerCase()
  if (lower.includes('strong') || lower.includes('quick') || lower.includes('execute')) return 'bg-green-600 text-green-100'
  if (lower.includes('consider') || lower.includes('monitor')) return 'bg-yellow-600 text-yellow-100'
  return 'bg-red-600 text-red-100'
}

const getVarianceColor = (variance) => {
  const val = parseFloat(variance)
  if (val >= 10) return 'text-green-400'
  if (val >= 5) return 'text-yellow-400'
  return 'text-red-400'
}

const getDaysLeft = (dateString) => {
  if (!dateString) return 0
  const today = new Date()
  const target = new Date(dateString)
  const diffTime = target - today
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

// Reusable Progress Bar Component with Premium Aesthetic
const PremiumProgressBar = ({ label, current, min, max, icon: Icon, projection, subtitle }) => {
  const barScaleValue = Math.max(max, current, projection || 0) / 0.8
  const minPos = (min / barScaleValue) * 100
  const maxPos = (max / barScaleValue) * 100
  const currentPos = Math.min(Math.max((current / barScaleValue) * 100, 0.5), 100)
  const projectionPos = projection ? Math.min(Math.max((projection / barScaleValue) * 100, 0.5), 100) : null

  const isMinAchieved = current >= min
  const isMaxAchieved = current >= max

  // Dynamic colors for the glow effect
  const glowColor = isMaxAchieved ? 'rgba(16, 185, 129, 0.3)' : isMinAchieved ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.15)'

  return (
    <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-4 sm:p-6 group relative overflow-hidden flex flex-col h-full">
      {/* Background glow pulse */}
      <div
        className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] transition-all duration-700 group-hover:blur-[60px]"
        style={{ backgroundColor: glowColor }}
      ></div>

      {/* Header Section */}
      <div className="relative z-10 mb-6 flex items-center space-x-3">
        <div className={`p-2 rounded-lg ${isMaxAchieved ? 'bg-emerald-500/10' : 'bg-blue-500/10'}`}>
          <Icon className={`h-5 w-5 ${isMaxAchieved ? 'text-emerald-400' : 'text-blue-400'}`} />
        </div>
        <h3 className="text-sm font-black tracking-[0.2em] text-white/50 uppercase">{label} Earnings</h3>
      </div>

      <div className="flex-1 flex flex-col justify-between relative z-10">
        {/* New 3-Column Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Target Card */}
          <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden group/card shadow-black/20">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/20 to-emerald-500/50"></div>
            <p className="text-[10px] text-white/50 font-black uppercase tracking-[0.2em] mb-2">Target</p>
            <span className="text-lg lg:text-xl font-black text-emerald-400 font-mono tracking-tight">
              ${max.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>

          {/* Current Card */}
          <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden shadow-black/20">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-white/10 to-white/30"></div>
            <p className="text-[10px] text-white/50 font-black uppercase tracking-[0.2em] mb-2">Current</p>
            <span className="text-lg lg:text-xl font-black text-white/85 font-mono tracking-tight">
              ${current.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>

          {/* % Target Card */}
          <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden shadow-black/20">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500/20 to-yellow-500/50"></div>
            <p className="text-[10px] text-white/50 font-black uppercase tracking-[0.2em] mb-2 whitespace-nowrap">% Target</p>
            <span className={`text-lg lg:text-xl font-black font-mono tracking-tight ${isMinAchieved ? 'text-yellow-400' : 'text-orange-400'}`}>
              {((current / max) * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Progress System */}
        <div className="relative pt-12 pb-6">
          {/* Main Bar Track */}
          <div className="w-full bg-gray-900 rounded-full h-4 overflow-visible border border-gray-700/50 relative">
            {/* Projection Bar */}
            {projectionPos && projectionPos > currentPos && (
              <div
                className="absolute top-0 h-4 rounded-full transition-all duration-1000 ease-out bg-blue-500/10 border-y border-r border-blue-500/20 z-0"
                style={{
                  left: `${currentPos}%`,
                  width: `${Math.min(projectionPos, 100) - currentPos}%`,
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(59, 130, 246, 0.1) 4px, rgba(59, 130, 246, 0.1) 8px)'
                }}
              ></div>
            )}

            {/* Current Value Bar */}
            <div
              className={`absolute top-0 left-0 h-4 rounded-full transition-all duration-1000 ease-out relative z-10 ${isMaxAchieved ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' :
                isMinAchieved ? 'bg-gradient-to-r from-blue-600 to-blue-400' :
                  'bg-gradient-to-r from-orange-600 to-yellow-500'
                }`}
              style={{ width: `${Math.min(currentPos, 100)}%`, boxShadow: `0 0 15px ${glowColor}` }}
            >
              {/* Shine effect */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-white/20 rounded-t-full"></div>
            </div>

            {/* Current Position Dot (Pulse) */}
            <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] border-2 border-gray-900 z-20" style={{ left: `${Math.min(currentPos, 100)}%`, transform: 'translate(-50%, -50%)' }}></div>

            {/* FLOATING MARKERS (Aligned Dots) */}

            {/* MIN Marker */}
            <div className="absolute top-1/2 -translate-y-1/2 z-30" style={{ left: `${minPos}%` }}>
              <div className="relative flex flex-col items-center -translate-x-1/2">
                <div className="absolute bottom-2 flex flex-col items-center pb-1">
                  <span className="bg-white/[0.05] text-yellow-600 dark:text-yellow-500 border border-yellow-500/30 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider shadow-xl whitespace-nowrap mb-1">
                    MIN ${min.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  <div className="h-4 w-[1px] bg-yellow-500/50"></div>
                </div>
                <div className={`w-2 h-2 rounded-full border border-black ${isMinAchieved ? 'bg-yellow-500' : 'bg-gray-700'}`}></div>
              </div>
            </div>

            {/* GOAL Marker */}
            <div className="absolute top-1/2 -translate-y-1/2 z-40" style={{ left: `${maxPos}%` }}>
              <div className="relative flex flex-col items-center -translate-x-1/2">
                <div className="absolute bottom-2 flex flex-col items-center pb-1">
                  <span className="bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider shadow-xl shadow-emerald-900/20 whitespace-nowrap mb-1">
                    GOAL ${max.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  <div className="h-8 w-[1px] bg-emerald-500/50"></div>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full border border-black ${isMaxAchieved ? 'bg-emerald-400' : 'bg-gray-600'}`}></div>
              </div>
            </div>

            {/* Projection Marker */}
            {projectionPos && (
              <div className="absolute top-1/2 -translate-y-1/2 z-20" style={{ left: `${Math.min(projectionPos, 100)}%` }}>
                <div className="relative flex flex-col items-center -translate-x-1/2">
                  <div className="absolute bottom-2 flex flex-col items-center pb-1">
                    <span className="bg-blue-950/80 dark:bg-blue-950/80 bg-white text-blue-400 border border-blue-500/30 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider shadow-xl backdrop-blur-sm whitespace-nowrap mb-1">
                      PROJECTED ${projection.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <div className="h-12 w-[1px] bg-blue-500/30 border-l border-dashed border-blue-400/50"></div>
                  </div>
                  <div className="w-2 h-2 rounded-full border border-black bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Messaging */}
        <div className="mt-4">
          {isMaxAchieved ? (
            <div className="flex items-center justify-center space-x-2 text-emerald-400 bg-[#022c22] py-3 px-4 rounded-xl border border-emerald-500/20 shadow-lg">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span className="uppercase tracking-widest text-[9px] font-black">Incredible performance! Goal smashed 🚀</span>
            </div>
          ) : isMinAchieved ? (
            <div className="flex items-center justify-center space-x-2 text-blue-400 bg-[#081a3e] py-3 px-4 rounded-xl border border-blue-500/20 shadow-lg">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span className="uppercase tracking-widest text-[9px] font-black">Minimum floor reached. Great job! 🎉</span>
            </div>
          ) : projection >= max ? (
            <div className="flex items-center justify-center space-x-2 text-blue-400 bg-[#081a3e] py-3 px-4 rounded-xl border border-blue-500/20 shadow-lg">
              <TrendingUp className="h-4 w-4 shrink-0" />
              <span className="uppercase tracking-widest text-[9px] font-black">On track to hit your targets 📈</span>
            </div>
          ) : current > 0 && (
            <div className="flex items-center justify-center space-x-2 text-yellow-400 bg-[#1e1e1e] py-3 px-4 rounded-xl border border-yellow-500/20 shadow-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="uppercase tracking-widest text-[9px] font-black">Keep pushing to reach that goal</span>
            </div>
          )}
          {subtitle && (
            <p className="text-center text-[10px] text-white/35 font-mono mt-2 tracking-wide">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  )
}




// New Monthly Performance Tracker Component
const MonthlyPerformanceTracker = ({ history, monthlyTarget }) => {
  const months = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
  ]

  const currentMonthIdx = new Date().getMonth()

  return (
    <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-8 animate-slide-in-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-8">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <Calendar className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/85">Annual Performance Roadmap</h3>
            <p className="text-[11px] text-white/50 mt-0.5">Month-by-month target achievement</p>
          </div>
        </div>
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 bg-white/5 px-3 py-2 rounded-xl border border-white/5 self-start md:self-auto">
          <div className="flex items-center space-x-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0"></div>
            <span className="text-[10px] font-medium text-white/50">Goal Reached</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="h-2 w-2 rounded-full bg-yellow-500 flex-shrink-0"></div>
            <span className="text-[10px] font-medium text-white/50">Min Reached</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0"></div>
            <span className="text-[10px] font-medium text-white/50">On Track</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {months.map((name, idx) => {
          const stats = history[idx] || { premium: 0 }
          const isAchieved = stats.premium >= monthlyTarget.max
          const isMinAchieved = stats.premium >= monthlyTarget.min
          const isCurrentMonth = idx === currentMonthIdx
          const isFutureMonth = idx > currentMonthIdx
          const achievementPercent = Math.min((stats.premium / monthlyTarget.max) * 100, 100)

          return (
            <div
              key={name}
              className={`relative p-4 rounded-2xl border transition-all duration-300 group/month ${isFutureMonth ? 'bg-gray-900/5 border-white/5 opacity-50' :
                isCurrentMonth ? 'bg-blue-500/5 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]' :
                  isAchieved ? 'bg-emerald-500/5 border-emerald-500/20' :
                    'bg-white/[0.04] border-white/5'
                }`}
            >
              <div className="flex justify-between items-start mb-3">
                <span className={`text-xs font-black tracking-widest ${isCurrentMonth ? 'text-blue-400' : 'text-white/50'}`}>
                  {name}
                </span>
                <div className="flex items-center space-x-2">
                  {isAchieved ? (
                    <CheckCircle className="h-3 w-3 text-emerald-400" />
                  ) : isMinAchieved ? (
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="h-3 w-3 text-yellow-400" />
                      <span className="text-[8px] font-black text-yellow-500 uppercase">MIN</span>
                    </div>
                  ) : !isFutureMonth && (
                    <AlertCircle className="h-3 w-3 text-gray-400" />
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-black text-white/85 font-mono">
                  ${stats.premium.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ease-out ${isAchieved ? 'bg-emerald-500' :
                      isMinAchieved ? 'bg-yellow-500' :
                        isCurrentMonth ? 'bg-blue-500' : 'bg-gray-700'
                      }`}
                    style={{ width: `${achievementPercent}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-tighter">
                  <span className={isAchieved ? 'text-emerald-500' : isMinAchieved ? 'text-yellow-500' : 'text-gray-500'}>
                    {achievementPercent.toFixed(0)}%
                  </span>
                  <span className="text-gray-600">
                    Min ${Math.round(monthlyTarget.min / 1000)}k | Goal ${Math.round(monthlyTarget.max / 1000)}k
                  </span>
                </div>
              </div>

              {isCurrentMonth && (
                <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-blue-500 text-[8px] font-black rounded-lg uppercase tracking-tighter shadow-lg">
                  Active
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const Dashboard = ({ researchData, setResearchData, tradeData, setTradeData, settings, stockData, onViewResearch, onGlobalRefresh, isRefreshing, strategyNotes, onSaveStrategy }) => {
  const [rerunningId, setRerunningId] = useState(null)

  const handleDeleteTrade = (tradeId) => {
    if (!confirm('Are you sure you want to delete this trade?')) return

    const updatedTradeData = tradeData.filter(trade => trade.id !== tradeId)
    setTradeData(updatedTradeData)
    saveToLocalStorage(STORAGE_KEYS.TRADE_DATA, updatedTradeData)
  }

  const handleEditTrade = () => {
    alert('To edit this trade, please go to the Trade Review tab where it will be loaded for editing.')
  }

  const handleDeleteResearch = (index) => {
    const itemToDelete = researchData[index]
    if (window.confirm(`Delete research for ${itemToDelete.symbol}?`)) {
      const updatedResearchData = researchData.filter((_, i) => i !== index)
      setResearchData(updatedResearchData)
      saveToLocalStorage(STORAGE_KEYS.RESEARCH_DATA, updatedResearchData)
    }
  }

  const handleRerunResearch = async (oldSymbol, index) => {
    setRerunningId(index)

    try {
      const sections = [
        'companyAnalysis',
        'financialHealth',
        'technicalAnalysis',
        'recentDevelopments'
      ]

      const results = {}

      for (const section of sections) {
        console.log(`Scraping ${section} for ${oldSymbol}...`)
        const sectionData = await scrapeCompanyData(oldSymbol, section)
        results[section] = sectionData
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Calculate flattened overall rating for higher granularity
      const companyPillars = [
        results.companyAnalysis?.detailedAnalysis?.marketPosition?.rating || 0,
        results.companyAnalysis?.detailedAnalysis?.businessModel?.rating || 0,
        results.companyAnalysis?.detailedAnalysis?.industryTrends?.rating || 0,
        results.companyAnalysis?.detailedAnalysis?.customerBase?.rating || 0,
        results.companyAnalysis?.detailedAnalysis?.growthStrategy?.rating || 0,
        results.companyAnalysis?.detailedAnalysis?.economicMoat?.rating || 0
      ].filter(r => r > 0)

      const otherModules = [
        results.financialHealth?.rating || 0,
        results.technicalAnalysis?.rating || 0,
        results.recentDevelopments?.rating || 0
      ].filter(r => r > 0)

      const allRatings = [...companyPillars, ...otherModules]

      const overallRating = allRatings.length > 0
        ? Math.round((allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length) * 10)
        : 0

      const updatedEntry = {
        symbol: oldSymbol,
        date: new Date().toISOString(),
        ...results,
        overallRating,
        lastRefresh: new Date().toISOString(),
        saved: true
      }

      // Update in place (or move to top? usually move to top)
      // Moving to top seems better for "Recent"
      const filteredData = researchData.filter((_, i) => i !== index)
      const updatedResearchData = [updatedEntry, ...filteredData]

      setResearchData(updatedResearchData)
      saveToLocalStorage(STORAGE_KEYS.RESEARCH_DATA, updatedResearchData)

      alert(`Successfully refreshed research for ${oldSymbol}!`)
    } catch (err) {
      console.error('Rerun error:', err)
      alert(`Failed to refresh research: ${err.message}`)
    } finally {
      setRerunningId(null)
    }
  }

  const handleConvertToExecuted = (trade) => {
    if (!confirm('Convert this planned trade to executed? This will update the execution date to today and count toward your weekly goals.')) return

    const executedTrade = {
      ...trade,
      executed: true,
      planned: false,
      status: 'executed',
      timestamp: new Date().toISOString(),
      executionDate: new Date().toISOString()
    }

    const updatedTradeData = tradeData.map(t =>
      t.id === trade.id ? executedTrade : t
    )
    setTradeData(updatedTradeData)
    saveToLocalStorage(STORAGE_KEYS.TRADE_DATA, updatedTradeData)

    alert(`Trade for ${trade.symbol} converted to EXECUTED! Execution date set to ${formatDateDDMMYYYY(new Date().toISOString())}.`)
  }

  const dashboardStats = useMemo(() => {
    const now = new Date()

    // Intervals
    const week = { start: startOfWeek(now), end: endOfWeek(now) }
    const month = { start: startOfMonth(now), end: endOfMonth(now) }
    const year = { start: startOfYear(now), end: endOfYear(now) }

    // Filter executed trades
    const executedTrades = tradeData.filter(t => t.executed)

    // Calculate premiums
    // Calculate premiums + Realized Stock P&L
    const calculatePremium = (interval) => {
      const optionPremium = executedTrades
        .filter(t => isWithinInterval(new Date(t.timestamp), interval))
        .reduce((sum, t) => {
          // Use netPremium (fees + buyback deducted) if available; fall back to gross for old trades
          const net = t.netPremium != null ? t.netPremium : (t.premium * (t.quantity || 1) * 100)
          return sum + net
        }, 0)

      const stockPnL = (stockData || [])
        .filter(s => s.dateSold && s.soldPrice && isWithinInterval(new Date(s.dateSold), interval))
        .reduce((sum, s) => {
          const sold = parseFloat(s.soldPrice) || 0
          const assigned = parseFloat(s.assignedPrice) || 0
          const shares = parseFloat(s.shares) || 0
          return sum + ((sold - assigned) * shares)
        }, 0)

      return optionPremium + stockPnL
    }

    const weeklyPremium = calculatePremium(week)
    const monthlyPremium = calculatePremium(month)
    const yearlyPremium = calculatePremium(year)

    // Targets
    const pSize = settings.portfolioSize || 1
    const monthlyTarget = { min: (pSize * 0.25) / 12, max: (pSize * 0.30) / 12 }
    const yearlyTarget = { min: pSize * 0.25, max: pSize * 0.30 }

    // Active trades (open, not expired)
    const activeTrades = executedTrades.filter(t => {
      if (t.closed) return false
      const daysLeft = Math.ceil((new Date(t.expirationDate) - now) / (1000 * 60 * 60 * 24))
      return daysLeft >= 0
    })

    // Stock totals — currently held (no soldPrice / dateSold)
    const heldStocks = (stockData || []).filter(s => !s.soldPrice && !s.dateSold)
    const totalInvested = heldStocks.reduce((sum, s) =>
      sum + ((parseFloat(s.assignedPrice) || 0) * (parseFloat(s.shares) || 0)), 0)
    const currentStockValue = heldStocks.reduce((sum, s) => {
      const price = parseFloat(s.currentPrice) || parseFloat(s.assignedPrice) || 0
      return sum + (price * (parseFloat(s.shares) || 0))
    }, 0)
    const stockPnL = currentStockValue - totalInvested
    const stockPnLPct = totalInvested > 0 ? (stockPnL / totalInvested) * 100 : 0

    // Cash available after buying stocks — declared before totalAllocated to guarantee
    // initialisation order in the minified bundle (prevents esbuild TDZ reordering)
    const availableCash = pSize - totalInvested + yearlyPremium

    // Portfolio allocation - Sum of Strike Price * 100 for active Cash Secured Puts
    const totalAllocated = activeTrades
      .filter(t => t.tradeType === 'cashSecuredPut') // Only count CSPs
      .reduce((sum, t) => sum + (t.strikePrice * t.quantity * 100), 0)
    const allocationPercentage = availableCash > 0 ? (totalAllocated / availableCash) * 100 : 0

    // Calculate Run Rate Projection
    const startOfYr = startOfYear(now)
    const msElapsed = now - startOfYr
    const daysElapsed = Math.max(msElapsed / (1000 * 60 * 60 * 24), 1)
    const yearlyProjection = (yearlyPremium / daysElapsed) * 365


    // Calculate Monthly History for Tracker
    const monthlyHistory = Array.from({ length: 12 }, (_, i) => {
      const monthStart = startOfMonth(new Date(now.getFullYear(), i, 1))
      const monthEnd = endOfMonth(monthStart)
      const interval = { start: monthStart, end: monthEnd }
      return {
        monthIndex: i,
        premium: calculatePremium(interval)
      }
    })

    return {
      portfolioSize: pSize,
      weeklyPremium,
      monthlyPremium,
      yearlyPremium,
      yearlyProjection,
      weeklyTarget: settings.weeklyPremiumTarget,
      monthlyTarget,
      yearlyTarget,
      totalAllocated,
      allocationPercentage,
      activeTradesCount: activeTrades.length,
      recentResearch: researchData.slice(0, 5),
      highRiskTrades: executedTrades.filter(t => (t.riskMetrics?.allocationPercentage || 0) > settings.maxTradePercentage).length,
      totalResearch: researchData.length,
      totalTrades: tradeData.length,
      totalInvested,
      currentStockValue,
      stockPnL,
      stockPnLPct,
      availableCash,
      portfolioTotal: currentStockValue + availableCash,
      monthlyHistory
    }
  }, [researchData, tradeData, settings, stockData])

  const getAllocationColor = (percentage) => {
    if (percentage > settings.maxTradePercentage) return 'text-red-400'
    if (percentage > settings.maxTradePercentage * 0.8) return 'text-yellow-400'
    return 'text-green-400'
  }

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-6 border-b border-white/[0.06]">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-2xl border border-blue-500/20">
              <BarChart3 className="h-6 w-6 text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
          </div>
          <p className="text-white/40 font-medium text-sm ml-[52px]">Your portfolio overview and key metrics.</p>
        </div>
      </header>

      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">

        {/* Card 1 — Portfolio Total */}
        {(() => {
          const deposited = parseFloat(settings?.totalDeposited) || dashboardStats.portfolioSize
          const totalReturn = deposited > 0
            ? ((dashboardStats.portfolioTotal - deposited) / deposited) * 100
            : 0
          const isUp = dashboardStats.portfolioTotal >= deposited
          return (
            <div className={`bg-white/[0.05] backdrop-blur-2xl rounded-[20px] p-5 flex flex-col justify-between border ${isUp ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
              <div className="flex items-center space-x-4 mb-3">
                <div className={`p-3 rounded-2xl border ${isUp ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                  <Briefcase className={`h-6 w-6 ${isUp ? 'text-emerald-400' : 'text-red-400'}`} />
                </div>
                <p className="text-[11px] text-white/50 uppercase font-black tracking-[0.2em]">Portfolio</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Total Value</span>
                  <span className={`text-sm font-black font-mono ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${dashboardStats.portfolioTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Deposited</span>
                  <span className="text-sm font-black text-white/50 font-mono">${deposited.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="h-px bg-white/[0.06] my-1" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Total Return</span>
                  <span className={`text-sm font-black font-mono ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Card 2 — Stocks Value */}
        <div className={`bg-white/[0.05] backdrop-blur-2xl rounded-[20px] p-5 flex flex-col justify-between border ${dashboardStats.stockPnL >= 0 ? 'border-violet-500/20' : 'border-red-500/20'}`}>
          <div className="flex items-center space-x-4 mb-3">
            <div className={`p-3 rounded-2xl border ${dashboardStats.stockPnL >= 0 ? 'bg-violet-500/10 border-violet-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
              {dashboardStats.stockPnL >= 0 ? <TrendingUp className="h-6 w-6 text-violet-400" /> : <TrendingDown className="h-6 w-6 text-red-400" />}
            </div>
            <p className="text-[11px] text-white/50 uppercase font-black tracking-[0.2em]">Stocks</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Invested</span>
              <span className="text-sm font-black text-white/70 font-mono">${dashboardStats.totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Current</span>
              <span className="text-sm font-black text-white/85 font-mono">${dashboardStats.currentStockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="h-px bg-white/[0.06] my-1" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">P&L</span>
              <span className={`text-sm font-black font-mono ${dashboardStats.stockPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {dashboardStats.stockPnL >= 0 ? '+' : ''}${dashboardStats.stockPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                <span className="text-[10px] ml-1 opacity-70">({dashboardStats.stockPnLPct >= 0 ? '+' : ''}{dashboardStats.stockPnLPct.toFixed(1)}%)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Card 3 — Available Cash */}
        <div className={`bg-white/[0.05] backdrop-blur-2xl rounded-[20px] p-5 flex flex-col justify-between border ${dashboardStats.availableCash >= 0 ? 'border-sky-500/20' : 'border-red-500/20'}`}>
          <div className="flex items-center space-x-4 mb-4">
            <div className={`p-3 rounded-2xl border ${dashboardStats.availableCash >= 0 ? 'bg-sky-500/10 border-sky-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
              <DollarSign className={`h-6 w-6 ${dashboardStats.availableCash >= 0 ? 'text-sky-400' : 'text-red-400'}`} />
            </div>
            <p className="text-[11px] text-white/50 uppercase font-black tracking-[0.2em]">Available Cash</p>
          </div>
          <div>
            <p className={`text-3xl font-black font-mono leading-none tracking-tighter ${dashboardStats.availableCash >= 0 ? 'text-sky-400' : 'text-red-400'}`}>
              ${dashboardStats.availableCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-2">
              {((dashboardStats.availableCash / dashboardStats.portfolioSize) * 100).toFixed(1)}% of portfolio undeployed
            </p>
          </div>
        </div>

        {/* Card 4 — Allocated Capital */}
        <div className="bg-white/[0.05] backdrop-blur-2xl border border-purple-500/20 rounded-[20px] p-5 flex flex-col justify-between">
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
              <Target className="h-6 w-6 text-purple-400" />
            </div>
            <p className="text-[11px] text-white/50 uppercase font-black tracking-[0.2em]">Allocated Capital</p>
          </div>
          <div>
            <p className={`text-3xl font-black font-mono leading-none tracking-tighter ${getAllocationColor(dashboardStats.allocationPercentage)}`}>
              ${dashboardStats.totalAllocated.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-2">{dashboardStats.allocationPercentage.toFixed(1)}% of available cash</p>
          </div>
        </div>

        {/* Card 5 — Active Trades */}
        <div className="bg-white/[0.05] backdrop-blur-2xl border border-amber-500/20 rounded-[20px] p-5 flex flex-col justify-between">
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20">
              <Calendar className="h-6 w-6 text-orange-400" />
            </div>
            <p className="text-[11px] text-white/50 uppercase font-black tracking-[0.2em]">Active Trades</p>
          </div>
          <div>
            <p className="text-3xl font-black text-white/85 font-mono leading-none tracking-tighter">{dashboardStats.activeTradesCount}</p>
            <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-2">{dashboardStats.totalTrades} total trades</p>
          </div>
        </div>

      </div>

      {/* Premium Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PremiumProgressBar
          label="Weekly"
          current={dashboardStats.weeklyPremium}
          min={dashboardStats.weeklyTarget.min}
          max={dashboardStats.weeklyTarget.max}
          icon={Target}
        />
        <PremiumProgressBar
          label="Monthly"
          current={dashboardStats.monthlyPremium}
          min={dashboardStats.monthlyTarget.min}
          max={dashboardStats.monthlyTarget.max}
          icon={Calendar}
        />
        <PremiumProgressBar
          label="Yearly"
          current={dashboardStats.yearlyPremium}
          min={dashboardStats.yearlyTarget.min}
          max={dashboardStats.yearlyTarget.max}
          icon={TrendingUp}
          projection={dashboardStats.yearlyProjection}
          subtitle={`~${((dashboardStats.yearlyProjection / dashboardStats.portfolioSize) * 100).toFixed(1)}% est. annual return on portfolio`}
        />
      </div>


      {/* Monthly Performance Tracker */}
      <MonthlyPerformanceTracker
        history={dashboardStats.monthlyHistory}
        monthlyTarget={dashboardStats.monthlyTarget}
      />

      {/* Risk Alerts */}
      {dashboardStats.highRiskTrades > 0 && (
        <div className="bg-white/[0.05] backdrop-blur-2xl border border-l-4 border-l-rose-500 border-white/[0.08] rounded-[20px] p-5 animate-slide-in-up">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-6 w-6 text-red-400" />
            <div>
              <h3 className="font-semibold text-red-400">Risk Alert</h3>
              <p className="text-sm text-gray-300">
                {dashboardStats.highRiskTrades} trade{dashboardStats.highRiskTrades > 1 ? 's' : ''} exceed{dashboardStats.highRiskTrades > 1 ? '' : 's'} your {settings.maxTradePercentage}% allocation limit
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Board - Moved from Unicron AI */}
      <div className="animate-slide-in-up">
        <StrategySection
          notes={strategyNotes}
          onSave={onSaveStrategy}
        />
      </div>
    </div>
  )
}

export default Dashboard