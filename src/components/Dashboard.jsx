import { useMemo } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Target, Calendar, AlertCircle, CheckCircle, Trash2, Edit, RefreshCw } from 'lucide-react'
import {
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  isWithinInterval
} from 'date-fns'
import { saveToLocalStorage, STORAGE_KEYS } from '../utils/storage'
import { scrapeCompanyData } from '../services/webScraping'
import { useState } from 'react'

// Helper function to format dates as DD/MM/YYYY
const formatDateDDMMYYYY = (dateString) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = date.toLocaleString('defaut', { month: 'short' }).toUpperCase()
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
const PremiumProgressBar = ({ label, current, min, max, icon: Icon, projection }) => {
  const barScaleValue = Math.max(max, current, projection || 0) / 0.8
  const minPos = (min / barScaleValue) * 100
  const maxPos = (max / barScaleValue) * 100
  const currentPos = Math.min(Math.max((current / barScaleValue) * 100, 0.5), 100)
  const projectionPos = projection ? Math.min(Math.max((projection / barScaleValue) * 100, 0.5), 100) : null

  const isMinAchieved = current >= min
  const isMaxAchieved = current >= max
  const isProjectedAchieved = projection >= max

  // Dynamic colors for the glow effect
  const glowColor = isMaxAchieved ? 'rgba(16, 185, 129, 0.3)' : isMinAchieved ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.15)'

  return (
    <div className="glass-card group relative overflow-hidden">
      {/* Background glow pulse */}
      <div
        className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] transition-all duration-700 group-hover:blur-[60px]"
        style={{ backgroundColor: glowColor }}
      ></div>

      <h3 className="text-lg font-bold mb-6 flex items-center justify-between relative z-10">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl border border-gray-700/50 bg-gray-900/50 ${isMaxAchieved ? 'text-emerald-400' : 'text-blue-400'}`}>
            {Icon && <Icon className="h-5 w-5" />}
          </div>
          <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{label} Earnings</span>
        </div>
        <div className="text-sm tracking-wider text-emerald-400 font-black uppercase bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30 font-mono">
          Goal: ${max.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      </h3>

      <div className="space-y-7 relative z-10">
        <div>
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2">Current Position</p>
              <div className="flex flex-col space-y-1">
                <span className="text-4xl font-black text-white font-mono leading-none">${current.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                {projection && (
                  <div className="flex items-center space-x-2 pt-1">
                    <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest bg-blue-500/10 px-1.5 py-0.5 rounded">Projected</span>
                    <span className="text-lg font-black text-blue-300 font-mono tracking-tight">${projection.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right pt-1">
              <span className={`text-2xl font-black font-mono leading-none ${isMinAchieved ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {((current / max) * 100).toFixed(0)}%
              </span>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">of target</p>
            </div>
          </div>

          <div className="relative pt-10 pb-8 mt-4">
            {/* Main Bar Track */}
            <div className="w-full bg-gray-900/80 rounded-full h-5 overflow-hidden border border-gray-700/30 shadow-inner">
              {/* Projection Ghost Bar */}
              {projectionPos && projectionPos > currentPos && (
                <div
                  className="absolute h-5 rounded-full transition-all duration-1000 ease-out bg-blue-500/20 border-r border-blue-400/50 z-0"
                  style={{
                    left: `${currentPos}%`,
                    width: `${Math.min(projectionPos, 100) - currentPos}%`,
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(59, 130, 246, 0.1) 5px, rgba(59, 130, 246, 0.1) 10px)'
                  }}
                ></div>
              )}

              {/* Actual Progress Bar */}
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out relative z-10 ${isMaxAchieved ? 'bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500' :
                  isMinAchieved ? 'bg-gradient-to-r from-yellow-500 via-emerald-500 to-emerald-400' :
                    'bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500'
                  }`}
                style={{ width: `${Math.min(currentPos, 100)}%`, boxShadow: `0 0 20px ${glowColor}` }}
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-white/10 rounded-t-full"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>
              </div>
            </div>

            {/* Threshold Markers - Updated for better spacing */}
            <div className="absolute top-8 h-12 w-[1px] bg-yellow-400/30 z-20" style={{ left: `${minPos}%` }}>
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <div className={`w-2 h-2 rounded-full mb-1 transition-all ${isMinAchieved ? 'bg-yellow-400 shadow-[0_0_8px_#facc15]' : 'bg-gray-600'}`}></div>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter font-mono bg-black/40 px-1 rounded-sm">${min.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            <div className="absolute top-8 h-12 w-[1px] bg-emerald-400/30 z-20" style={{ left: `${maxPos}%` }}>
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <div className={`w-2 h-2 rounded-full mb-1 transition-all ${isMaxAchieved ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-gray-600'}`}></div>
                <span className="text-[9px] text-emerald-400/70 font-black uppercase tracking-tighter font-mono bg-black/40 px-1 rounded-sm">${max.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            {/* Projection Marker - Fixed positioning */}
            {projectionPos && (
              <div className="absolute top-8 h-14 w-[1px] bg-blue-400/50 z-20 border-l border-blue-400/30" style={{ left: `${projectionPos}%` }}>
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className={`w-2 h-2 rounded-full mb-1 transition-all bg-blue-400 shadow-[0_0_10px_#60a5fa]`}></div>
                  <span className="text-[8px] text-blue-400 font-black uppercase tracking-[0.1em] whitespace-nowrap bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10">Run-Rate</span>
                </div>
              </div>
            )}

            {current > max && currentPos < 100 && (
              <div className="absolute -right-2 top-8 h-10 flex items-center" style={{ left: `calc(${currentPos}% + 8px)` }}>
                <span className="text-[10px] font-black text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded border border-cyan-400/20 animate-pulse">
                  +{((current / max - 1) * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {isMaxAchieved ? (
          <div className="flex items-center space-x-3 text-emerald-400 bg-emerald-950/30 p-3 rounded-xl border border-emerald-500/20 text-xs font-bold animate-float">
            <CheckCircle className="h-4 w-4" />
            <span className="uppercase tracking-wide">Target exceeded! Incredible performance! 🚀</span>
          </div>
        ) : isMinAchieved ? (
          <div className="flex items-center space-x-3 text-green-400 bg-green-950/30 p-3 rounded-xl border border-green-500/20 text-xs font-bold">
            <CheckCircle className="h-4 w-4" />
            <span className="uppercase tracking-wide">Minimum floor target achieved! 🎉</span>
          </div>
        ) : projection >= max ? (
          <div className="flex items-center space-x-3 text-blue-400 bg-blue-950/30 p-3 rounded-xl border border-blue-500/20 text-xs font-bold">
            <TrendingUp className="h-4 w-4" />
            <span className="uppercase tracking-wide">On track to reach yearly target! Keep it up! 📈</span>
          </div>
        ) : current > 0 && (
          <div className="flex items-center space-x-3 text-yellow-400 bg-yellow-950/20 p-3 rounded-xl border border-yellow-500/20 text-xs font-bold">
            <AlertCircle className="h-4 w-4" />
            <span className="uppercase tracking-wide">Increase volume to reach goal</span>
          </div>
        )}
      </div>
    </div>
  )
}

const Dashboard = ({ researchData, setResearchData, tradeData, setTradeData, settings, stockData }) => {
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
        .reduce((sum, t) => sum + (t.premium * t.quantity * 100), 0)

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

    // Portfolio allocation - Sum of Strike Price * 100 for active Cash Secured Puts
    const activeTrades = executedTrades.filter(t => !t.closed)
    const totalAllocated = activeTrades
      .filter(t => t.tradeType === 'cashSecuredPut') // Only count CSPs
      .reduce((sum, t) => sum + (t.strikePrice * t.quantity * 100), 0)
    const allocationPercentage = (totalAllocated / pSize) * 100

    // Total Stock P&L (Unrealized + Realized)
    const totalStockPnL = (stockData || []).reduce((sum, s) => {
      const sold = parseFloat(s.soldPrice)
      const assigned = parseFloat(s.assignedPrice) || 0
      const current = parseFloat(s.currentPrice)
      const shares = parseFloat(s.shares) || 0

      if (sold) return sum + ((sold - assigned) * shares)
      if (current) return sum + ((current - assigned) * shares)
      return sum
    }, 0)

    // Calculate Run Rate Projection
    const startOfYr = startOfYear(now)
    const msElapsed = now - startOfYr
    const daysElapsed = Math.max(msElapsed / (1000 * 60 * 60 * 24), 1)
    const yearlyProjection = (yearlyPremium / daysElapsed) * 365

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
      totalStockPnL
    }
  }, [researchData, tradeData, settings, stockData])

  const getAllocationColor = (percentage) => {
    if (percentage > settings.maxTradePercentage) return 'text-red-400'
    if (percentage > settings.maxTradePercentage * 0.8) return 'text-yellow-400'
    return 'text-green-400'
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="stat-card-primary">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-500/10 rounded-2xl">
              <DollarSign className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 uppercase font-bold tracking-widest">Portfolio Size</p>
              <p className="text-2xl font-black text-white">${dashboardStats.portfolioSize.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="stat-card-success">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 uppercase font-bold tracking-widest">Est. Annual Return</p>
              <p className="text-2xl font-black text-white">~{((dashboardStats.yearlyPremium / dashboardStats.portfolioSize) * 100).toFixed(1)}%</p>
              <p className="text-[10px] text-gray-500">Based on YTD premium</p>
            </div>
          </div>
        </div>

        <div className="stat-card-primary border-purple-500/20">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-500/10 rounded-2xl">
              <Target className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 uppercase font-bold tracking-widest">Allocated Capital</p>
              <p className={`text-2xl font-black ${getAllocationColor(dashboardStats.allocationPercentage)}`}>
                ${dashboardStats.totalAllocated.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] text-gray-500">{dashboardStats.allocationPercentage.toFixed(1)}% of portfolio</p>
            </div>
          </div>
        </div>

        <div className="stat-card-warning">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-orange-500/10 rounded-2xl">
              <Calendar className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 uppercase font-bold tracking-widest">Active Trades</p>
              <p className="text-2xl font-black text-white">{dashboardStats.activeTradesCount}</p>
              <p className="text-[10px] text-gray-500">{dashboardStats.totalTrades} total trades</p>
            </div>
          </div>
        </div>

        <div className={`stat-card-primary ${dashboardStats.totalStockPnL >= 0 ? 'border-green-500/20' : 'border-red-500/20'}`}>
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-2xl ${dashboardStats.totalStockPnL >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              {dashboardStats.totalStockPnL >= 0 ? (
                <TrendingUp className="h-6 w-6 text-green-400" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-400" />
              )}
            </div>
            <div>
              <p className="text-[11px] text-gray-400 uppercase font-bold tracking-widest">Stock P&L</p>
              <p className={`text-2xl font-black ${dashboardStats.totalStockPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {dashboardStats.totalStockPnL >= 0 ? '+' : ''}${dashboardStats.totalStockPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] text-gray-500">Total Unrealized + Realized</p>
            </div>
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
        />
      </div>

      {/* Risk Alerts */}
      {dashboardStats.highRiskTrades > 0 && (
        <div className="glass-card border-l-4 border-l-red-500 bg-gradient-to-br from-red-500/5 to-transparent animate-slide-in-up">
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

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Research */}
        <div className="glass-card">
          <h3 className="text-lg font-semibold mb-4">Recent Research</h3>
          {dashboardStats.recentResearch.length > 0 ? (
            <div className="space-y-3">
              {dashboardStats.recentResearch.map((item, index) => {
                // Extract current price and target price from technical analysis
                let currentPrice = item.technicalAnalysis?.currentPrice ||
                  item.technicalAnalysis?.metrics?.find(m => m.label === 'Current Price')?.value
                let targetPrice = item.technicalAnalysis?.targetPrice ||
                  item.technicalAnalysis?.metrics?.find(m => m.label === 'Target Price')?.value

                // Sanitize prices (remove trailing commas/spaces)
                if (currentPrice) currentPrice = currentPrice.replace(/,\s*$/, '').trim()
                if (targetPrice) targetPrice = targetPrice.replace(/,\s*$/, '').trim()

                // Calculate upside
                let upsidePercent = null
                if (currentPrice && targetPrice) {
                  const current = parseFloat(currentPrice.replace(/[$,]/g, ''))
                  const target = parseFloat(targetPrice.replace(/[$,]/g, ''))
                  if (!isNaN(current) && !isNaN(target) && current > 0) {
                    upsidePercent = ((target - current) / current * 100).toFixed(1)
                  }
                }

                const isRerunning = rerunningId === index

                return (
                  <div key={index} className="glass-item p-5 hover:bg-white/5 transition-all duration-300 border border-white/5 hover:border-white/10 group relative overflow-hidden">
                    {/* Background Glow Effect */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity opacity-50 group-hover:opacity-100"></div>

                    {/* Header Row */}
                    <div className="flex justify-between items-start mb-6 relative z-10">
                      <div className="flex items-center space-x-4">
                        {/* Gradient Initials Icon */}
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 p-[1px] shadow-lg shadow-blue-500/20">
                          <div className="w-full h-full rounded-2xl bg-gray-900/90 backdrop-blur-xl flex items-center justify-center">
                            <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400">
                              {item.symbol.slice(0, 2)}
                            </span>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-2xl font-black tracking-tight text-white mb-0.5">{item.symbol}</h4>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Research Report</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end space-y-1">
                        {/* Action Buttons (Top Right) */}
                        <div className="flex items-center space-x-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRerunResearch(item.symbol, index); }}
                            disabled={isRerunning}
                            className={`p-1.5 rounded-lg transition-all ${isRerunning ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-blue-500/20 text-gray-400 hover:text-blue-400'}`}
                            title="Rerun research"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${isRerunning ? 'animate-spin' : ''}`} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteResearch(index); }}
                            className="p-1.5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-all"
                            title="Delete research"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Date & Rating Row */}
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">
                            {formatDateDDMMYYYY(item.date)}
                          </span>

                          <div className={`px-3 py-1 rounded-lg border flex items-center shadow-lg font-black tracking-wide ${item.overallRating >= 70 ? 'bg-green-500/10 border-green-500/20 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.1)]' :
                            item.overallRating >= 50 ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.1)]' :
                              'bg-red-500/10 border-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
                            }`}>
                            <span className="text-[10px] font-black uppercase tracking-widest mr-2 opacity-70">Rating:</span>
                            <span className="text-sm font-bold">{item.overallRating}/100</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metrics Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
                      {/* Current Price Box */}
                      <div className="bg-[#0f172a]/80 rounded-xl p-3 border border-white/5 shadow-inner">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Current</div>
                        <div className="text-xl font-bold text-white">
                          {currentPrice ? (currentPrice.startsWith('$') ? currentPrice : `$${currentPrice}`) : 'N/A'}
                        </div>
                      </div>

                      {/* Target Price Box */}
                      <div className="bg-[#1e293b]/50 rounded-xl p-3 border border-blue-500/10 shadow-inner group-hover:border-blue-500/20 transition-colors">
                        <div className="text-[10px] font-bold text-blue-400/70 uppercase tracking-widest mb-1">Target</div>
                        <div className="text-xl font-bold text-blue-100">
                          {targetPrice ? (targetPrice.startsWith('$') ? targetPrice : `$${targetPrice}`) : 'N/A'}
                        </div>
                      </div>

                      {/* Potential Box */}
                      <div className={`rounded-xl p-3 border shadow-inner transition-colors ${parseFloat(upsidePercent) >= 0
                        ? 'bg-green-900/10 border-green-500/10 group-hover:border-green-500/20'
                        : 'bg-red-900/10 border-red-500/10 group-hover:border-red-500/20'
                        }`}>
                        <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${parseFloat(upsidePercent) >= 0 ? 'text-green-400/70' : 'text-red-400/70'
                          }`}>Potential</div>
                        <div className={`text-xl font-bold ${parseFloat(upsidePercent) >= 0 ? 'text-green-100' : 'text-red-100'
                          }`}>
                          {upsidePercent !== null ? (
                            <>
                              {parseFloat(upsidePercent) >= 0 ? '+' : ''}{upsidePercent}%
                            </>
                          ) : 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Detailed Ratings & Earnings */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 border-t border-white/5 pt-4">
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Company</div>
                        <div className={`text-sm font-bold ${(item.companyAnalysis?.rating || 0) >= 7 ? 'text-green-400' :
                          (item.companyAnalysis?.rating || 0) >= 5 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                          {item.companyAnalysis?.rating || '-'}/10
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Technical</div>
                        <div className={`text-sm font-bold ${(item.technicalAnalysis?.rating || 0) >= 7 ? 'text-green-400' :
                          (item.technicalAnalysis?.rating || 0) >= 5 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                          {item.technicalAnalysis?.rating || '-'}/10
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Developments</div>
                        <div className={`text-sm font-bold ${(item.recentDevelopments?.rating || 0) >= 7 ? 'text-green-400' :
                          (item.recentDevelopments?.rating || 0) >= 5 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                          {item.recentDevelopments?.rating || '-'}/10
                        </div>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-center flex flex-col justify-center">
                        <div className="text-[9px] text-blue-400/70 uppercase font-bold tracking-widest mb-1">Next Earnings</div>
                        <div className="text-xs font-bold text-blue-100">
                          {(() => {
                            const dateStr = item.recentDevelopments?.detailedDevelopments?.nextEarningsCall?.date || item.recentDevelopments?.nextEarningsDate
                            return dateStr ? formatDateDDMMYYYY(dateStr) : 'N/A'
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-400">No research data available</p>
          )}
        </div>

        {/* Recent Trades */}
        <div className="glass-card">
          <h3 className="text-lg font-semibold mb-4">Recent Trades</h3>
          {tradeData.length > 0 ? (
            <div className="space-y-3">
              {tradeData.slice(0, 5).map((item, index) => {
                const currentPrice = item.currentMarketPrice || item.stockPrice || 0
                const strikePrice = item.strikePrice || 0
                const variance = currentPrice > 0 && strikePrice > 0 ? (currentPrice - strikePrice) : 0
                const variancePct = strikePrice > 0 ? (variance / strikePrice) * 100 : 0
                // For Cash Secured Put: You sell a put. You want Stock > Strike so it expires worthless.
                // So (Stock - Strike) > 0 is GOOD (Green). < 0 is BAD (Red/ITM - Assignment risk).
                // So Positive Variance = Green.

                return (
                  <div key={index} className={`glass-item block ${item.status === 'executed' ? 'border-green-500/30 bg-green-900/10' :
                    item.status === 'planned' ? 'border-blue-500/30 bg-blue-900/10' :
                      item.status === 'expired' ? 'border-gray-500/30 bg-gray-900/10' :
                        ''
                    }`}>
                    <div className="flex justify-between items-start mb-4">
                      {/* Left: Title & Badges */}
                      <div className="flex items-center flex-wrap gap-2">
                        <h4 className="font-bold text-lg text-white">
                          {item.symbol} {item.type === 'put' || item.tradeType === 'cashSecuredPut' ? 'Cash-Secured Put' : 'Covered Call'}
                        </h4>

                        {item.status === 'planned' && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-blue-600 text-white rounded">
                            PLANNED
                          </span>
                        )}
                        {item.status === 'expired' && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-gray-600 text-white rounded">
                            EXPIRED
                          </span>
                        )}

                        {item.recommendation?.action && (
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${getRecommendationColor(item.recommendation.action)}`}>
                            {item.recommendation.action}
                          </span>
                        )}

                        <div className="flex items-center space-x-2 hidden sm:flex ml-2">
                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-gray-400 font-mono">
                            {item.status === 'executed' ? 'Executed:' : 'Planned:'} <span className="text-gray-200 ml-1">{formatDateDDMMYYYY(item.status === 'executed' ? item.executionDate : item.timestamp)}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-gray-400 font-mono">
                            Expires: <span className="text-gray-200 ml-1">{formatDateDDMMYYYY(item.expirationDate)}</span>
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center space-x-1">
                        {item.status === 'planned' && (
                          <button
                            onClick={() => handleEditTrade(item)}
                            className="p-1.5 hover:bg-blue-500/20 rounded-lg transition-colors border border-transparent hover:border-blue-500/30 group"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4 text-blue-400 group-hover:text-blue-300" />
                          </button>
                        )}
                        {item.status === 'planned' && (
                          <button
                            onClick={() => handleConvertToExecuted(item)}
                            className="p-1.5 hover:bg-green-500/20 rounded-lg transition-colors border border-transparent hover:border-green-500/30 group"
                            title="Convert"
                          >
                            <CheckCircle className="h-4 w-4 text-green-400 group-hover:text-green-300" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteTrade(item.id)}
                          className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors border border-transparent hover:border-red-500/30 group"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-400 group-hover:text-red-300" />
                        </button>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {/* Stock Price Card */}
                      <div className="bg-[#0f172a]/60 rounded-lg p-2.5 border border-white/5">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Stock Price</div>
                        <div className="text-sm font-bold text-white">
                          ${currentPrice.toFixed(2)}
                        </div>
                      </div>

                      {/* Strike Price Card */}
                      <div className="bg-[#0f172a]/60 rounded-lg p-2.5 border border-white/5">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Strike Price</div>
                        <div className="text-sm font-bold text-white">
                          ${strikePrice.toFixed(2)}
                        </div>
                      </div>

                      {/* Variance Card */}
                      <div className="bg-[#0f172a]/60 rounded-lg p-2.5 border border-white/5">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Variance</div>
                        <div className={`text-sm font-bold ${variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${variance.toFixed(2)} <span className="text-[10px] opacity-70">({variancePct.toFixed(1)}%)</span>
                        </div>
                      </div>

                      {/* Premium Card */}
                      <div className="bg-[#0f172a]/60 rounded-lg p-2.5 border border-white/5">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Premium</div>
                        <div className="text-sm font-bold text-emerald-400">
                          ${item.premium || '0.00'}
                        </div>
                      </div>

                      {/* Days Left Card */}
                      <div className="bg-[#0f172a]/60 rounded-lg p-2.5 border border-white/5">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Days Left</div>
                        <div className="text-sm font-bold text-blue-200">
                          {getDaysLeft(item.expirationDate)}d
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-400">No trade data available</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard