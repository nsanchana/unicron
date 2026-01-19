import { useMemo } from 'react'
import { DollarSign, TrendingUp, Target, Calendar, AlertCircle, CheckCircle, Trash2, Edit } from 'lucide-react'
import {
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  isWithinInterval
} from 'date-fns'
import { saveToLocalStorage } from '../utils/storage'

// Helper function to format dates as DD/MM/YYYY
const formatDateDDMMYYYY = (dateString) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

// Reusable Progress Bar Component with Premium Aesthetic
const PremiumProgressBar = ({ label, current, min, max, icon: Icon }) => {
  const barScaleValue = max / 0.8
  const minPos = (min / barScaleValue) * 100
  const maxPos = 80
  const currentPos = Math.min(Math.max((current / barScaleValue) * 100, 0.5), 100)

  const isMinAchieved = current >= min
  const isMaxAchieved = current >= max

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
          <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{label} Premium</span>
        </div>
        <div className="text-[10px] tracking-widest text-gray-500 uppercase font-bold">
          Goal: ${max.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      </h3>

      <div className="space-y-6 relative z-10">
        <div>
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Current Premium</p>
              <span className="text-3xl font-black text-white">${current.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="text-right">
              <span className={`text-sm font-bold ${isMinAchieved ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {((current / max) * 100).toFixed(0)}%
              </span>
              <p className="text-[10px] text-gray-500 font-bold uppercase">of target</p>
            </div>
          </div>

          <div className="relative pt-6 pb-4">
            {/* Main Bar Track */}
            <div className="w-full bg-gray-900/80 rounded-full h-4 overflow-hidden border border-gray-700/30">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out relative ${isMaxAchieved ? 'bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500' :
                  isMinAchieved ? 'bg-gradient-to-r from-yellow-500 via-emerald-500 to-emerald-400' :
                    'bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500'
                  }`}
                style={{ width: `${currentPos}%`, boxShadow: `0 0 20px ${glowColor}` }}
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-white/10 rounded-t-full"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>
              </div>
            </div>

            {/* Threshold Markers - Refined Design */}
            <div className="absolute top-4 h-10 w-[1px] bg-yellow-400/30 z-10" style={{ left: `${minPos}%` }}>
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <div className={`w-1.5 h-1.5 rounded-full mb-1 transition-all ${isMinAchieved ? 'bg-yellow-400 shadow-[0_0_8px_#facc15]' : 'bg-gray-600'}`}></div>
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">${min.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            <div className="absolute top-4 h-10 w-[1px] bg-emerald-400/30 z-10" style={{ left: `${maxPos}%` }}>
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <div className={`w-1.5 h-1.5 rounded-full mb-1 transition-all ${isMaxAchieved ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-gray-600'}`}></div>
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">${max.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            {current > max && (
              <div className="absolute -right-2 top-4 h-10 flex items-center" style={{ left: `calc(${Math.min(currentPos, 100)}% + 8px)` }}>
                <span className="text-[10px] font-black text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded border border-cyan-400/20 animate-pulse">
                  +{((current / max - 1) * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {isMaxAchieved ? (
          <div className="flex items-center space-x-2 text-emerald-400 bg-emerald-900/20 p-2.5 rounded-xl border border-emerald-500/20 text-xs font-medium animate-float">
            <CheckCircle className="h-4 w-4" />
            <span>Target exceeded! Incredible performance! 🚀</span>
          </div>
        ) : isMinAchieved ? (
          <div className="flex items-center space-x-2 text-green-400 bg-green-900/20 p-2.5 rounded-xl border border-green-500/20 text-xs font-medium">
            <CheckCircle className="h-4 w-4" />
            <span>Minimum floor target achieved! 🎉</span>
          </div>
        ) : current > 0 && (
          <div className="flex items-center space-x-2 text-yellow-400 bg-yellow-900/10 p-2.5 rounded-xl border border-yellow-500/20 text-xs font-medium">
            <AlertCircle className="h-4 w-4" />
            <span>Keep going to reach your {label.toLowerCase()} goal</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Dashboard({ researchData, tradeData, setTradeData, settings }) {
  const handleDeleteTrade = (tradeId) => {
    if (!confirm('Are you sure you want to delete this trade?')) return

    const updatedTradeData = tradeData.filter(trade => trade.id !== tradeId)
    setTradeData(updatedTradeData)
    saveToLocalStorage('tradeData', updatedTradeData)
  }

  const handleEditTrade = () => {
    alert('To edit this trade, please go to the Trade Review tab where it will be loaded for editing.')
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
    saveToLocalStorage('tradeData', updatedTradeData)

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
    const calculatePremium = (interval) => executedTrades
      .filter(t => isWithinInterval(new Date(t.timestamp), interval))
      .reduce((sum, t) => sum + (t.premium * t.quantity * 100), 0)

    const weeklyPremium = calculatePremium(week)
    const monthlyPremium = calculatePremium(month)
    const yearlyPremium = calculatePremium(year)

    // Targets
    const pSize = settings.portfolioSize || 1
    const monthlyTarget = { min: (pSize * 0.25) / 12, max: (pSize * 0.30) / 12 }
    const yearlyTarget = { min: pSize * 0.25, max: pSize * 0.30 }

    // Portfolio allocation
    const activeTrades = executedTrades.filter(t => !t.closed)
    const totalAllocated = activeTrades.reduce((sum, t) => sum + (t.premium * t.quantity * 100), 0)
    const allocationPercentage = (totalAllocated / pSize) * 100

    return {
      portfolioSize: pSize,
      weeklyPremium,
      monthlyPremium,
      yearlyPremium,
      weeklyTarget: settings.weeklyPremiumTarget,
      monthlyTarget,
      yearlyTarget,
      totalAllocated,
      allocationPercentage,
      activeTradesCount: activeTrades.length,
      recentResearch: researchData.slice(0, 5),
      highRiskTrades: executedTrades.filter(t => (t.riskMetrics?.allocationPercentage || 0) > settings.maxTradePercentage).length,
      totalResearch: researchData.length,
      totalTrades: tradeData.length
    }
  }, [researchData, tradeData, settings])

  const getAllocationColor = (percentage) => {
    if (percentage > settings.maxTradePercentage) return 'text-red-400'
    if (percentage > settings.maxTradePercentage * 0.8) return 'text-yellow-400'
    return 'text-green-400'
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                ${dashboardStats.totalAllocated.toFixed(0)}
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
                const currentPrice = item.technicalAnalysis?.currentPrice ||
                  item.technicalAnalysis?.metrics?.find(m => m.label === 'Current Price')?.value
                const targetPrice = item.technicalAnalysis?.targetPrice ||
                  item.technicalAnalysis?.metrics?.find(m => m.label === 'Target Price')?.value

                // Calculate upside
                let upsidePercent = null
                if (currentPrice && targetPrice) {
                  const current = parseFloat(currentPrice.replace(/[$,]/g, ''))
                  const target = parseFloat(targetPrice.replace(/[$,]/g, ''))
                  if (!isNaN(current) && !isNaN(target) && current > 0) {
                    upsidePercent = ((target - current) / current * 100).toFixed(1)
                  }
                }

                return (
                  <div key={index} className="glass-item cursor-pointer">
                    {/* Single Row: Symbol, Price Boxes, Date, Rating */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                        <p className="font-semibold text-lg">{item.symbol}</p>
                        {currentPrice && (
                          <div className="glass-item px-2 py-1 flex items-center space-x-1">
                            <span className="text-xs text-gray-400">Current:</span>
                            <span className="text-white font-medium">{currentPrice.startsWith('$') ? currentPrice : `$${currentPrice}`}</span>
                          </div>
                        )}
                        {targetPrice && (
                          <div className="bg-blue-900/40 border border-blue-700/50 rounded px-2 py-1 flex items-center space-x-1">
                            <span className="text-xs text-blue-300">Target:</span>
                            <span className="text-blue-400 font-medium">{targetPrice.startsWith('$') ? targetPrice : `$${targetPrice}`}</span>
                          </div>
                        )}
                        {upsidePercent !== null && (
                          <div className={`rounded px-2 py-1 font-medium text-sm ${parseFloat(upsidePercent) >= 0 ? 'bg-green-900/40 border border-green-700/50 text-green-400' : 'bg-red-900/40 border border-red-700/50 text-red-400'}`}>
                            {parseFloat(upsidePercent) >= 0 ? '+' : ''}{upsidePercent}%
                          </div>
                        )}
                        <span className="text-sm text-gray-400">
                          {formatDateDDMMYYYY(item.date)}
                        </span>
                      </div>
                      <div className={`text-lg font-bold ${item.overallRating >= 7 ? 'text-green-400' :
                        item.overallRating >= 5 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                        {item.overallRating}/100
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
              {tradeData.slice(0, 5).map((item, index) => (
                <div key={index} className={`flex justify-between items-center p-3 rounded-lg ${item.status === 'executed' ? 'bg-green-900/20 border border-green-700/30' :
                  item.status === 'planned' ? 'bg-blue-900/20 border border-blue-700/30' :
                    'glass-item'
                  }`}>
                  <div className="flex-1">
                    <p className="font-semibold">
                      {item.symbol} {item.type?.toUpperCase() || item.tradeType?.toUpperCase()}
                      {item.status === 'executed' && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-green-600 text-green-100 rounded">
                          EXECUTED
                        </span>
                      )}
                      {item.status === 'planned' && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-blue-600 text-blue-100 rounded">
                          PLANNED
                        </span>
                      )}
                      {!item.status && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-gray-600 text-gray-300 rounded">
                          RESEARCH
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-400">
                      {formatDateDDMMYYYY(item.timestamp)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <p className="text-sm">${item.premium} premium</p>
                      <p className={`text-xs ${item.rating >= 7 ? 'text-green-400' :
                        item.rating >= 5 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                        Rating: {item.rating}/10
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {item.status === 'planned' && (
                        <>
                          <button
                            onClick={() => handleEditTrade(item)}
                            className="p-2 hover:bg-blue-900/50 rounded-lg transition-colors"
                            title="Edit planned trade (opens in Trade Review)"
                          >
                            <Edit className="h-3 w-3 text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleConvertToExecuted(item)}
                            className="p-2 hover:bg-green-900/50 rounded-lg transition-colors"
                            title="Convert to executed trade"
                          >
                            <CheckCircle className="h-3 w-3 text-green-400" />
                          </button>
                        </>
                      )}
                      {(item.status === 'planned' || item.status === 'executed') && (
                        <button
                          onClick={() => handleDeleteTrade(item.id)}
                          className="p-2 hover:bg-red-900/50 rounded-lg transition-colors"
                          title="Delete trade"
                        >
                          <Trash2 className="h-3 w-3 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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