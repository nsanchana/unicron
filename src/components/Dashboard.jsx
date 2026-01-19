import { useMemo } from 'react'
import { DollarSign, TrendingUp, Target, Calendar, AlertCircle, CheckCircle, Trash2, Edit } from 'lucide-react'
import { startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'
import { saveToLocalStorage } from '../utils/storage'

// Helper function to format dates as DD/MM/YYYY
const formatDateDDMMYYYY = (dateString) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

function Dashboard({ researchData, tradeData, setTradeData, settings }) {
  const handleDeleteTrade = (tradeId) => {
    if (!confirm('Are you sure you want to delete this trade?')) return

    const updatedTradeData = tradeData.filter(trade => trade.id !== tradeId)
    setTradeData(updatedTradeData)
    saveToLocalStorage('tradeData', updatedTradeData)
  }

  const handleEditTrade = () => {
    // Store the trade to edit and redirect to Trade Review tab
    // We'll need to communicate this to the parent App component
    alert('To edit this trade, please go to the Trade Review tab where it will be loaded for editing.')
  }

  const handleConvertToExecuted = (trade) => {
    if (!confirm('Convert this planned trade to executed? This will update the execution date to today and count toward your weekly goals.')) return

    // Update the trade to executed status with new timestamp
    const executedTrade = {
      ...trade,
      executed: true,
      planned: false,
      status: 'executed',
      timestamp: new Date().toISOString(), // Update to current date/time
      executionDate: new Date().toISOString() // Add execution date
    }

    // Update tradeData array
    const updatedTradeData = tradeData.map(t =>
      t.id === trade.id ? executedTrade : t
    )
    setTradeData(updatedTradeData)
    saveToLocalStorage('tradeData', updatedTradeData)

    alert(`Trade for ${trade.symbol} converted to EXECUTED! Execution date set to ${formatDateDDMMYYYY(new Date().toISOString())}.`)
  }
  const dashboardStats = useMemo(() => {
    const now = new Date()
    const weekStart = startOfWeek(now)
    const weekEnd = endOfWeek(now)

    // Calculate weekly premium from executed trades (saved trades)
    const weeklyTrades = tradeData.filter(trade => {
      const tradeDate = new Date(trade.timestamp)
      // Only include executed trades
      return trade.executed && isWithinInterval(tradeDate, { start: weekStart, end: weekEnd })
    })

    const weeklyPremium = weeklyTrades.reduce((sum, trade) => {
      // Only count premium from executed trades
      return sum + (trade.premium * trade.quantity * 100)
    }, 0)

    // Calculate progress positions relative to a scale where Max = 80%
    // This allows the bar to visually extend up to 125% of Max (reaching 100% width)
    const maxVal = settings.weeklyPremiumTarget.max || 1
    const barScaleValue = maxVal / 0.8
    const minPos = (settings.weeklyPremiumTarget.min / barScaleValue) * 100
    const maxPos = 80 // Max is always at 80% by definition of barScaleValue
    const currentPos = (weeklyPremium / barScaleValue) * 100

    // Portfolio allocation - only count executed trades
    const activeTrades = tradeData.filter(trade => trade.executed && !trade.closed)
    const totalAllocated = activeTrades.reduce((sum, trade) => {
      return sum + (trade.premium * trade.quantity * 100)
    }, 0)

    const allocationPercentage = (totalAllocated / settings.portfolioSize) * 100

    // Recent research
    const recentResearch = researchData.slice(0, 5)

    // Risk metrics - only check executed trades
    const highRiskTrades = tradeData.filter(trade =>
      trade.executed && trade.riskMetrics?.allocationPercentage > settings.maxTradePercentage
    )

    return {
      portfolioSize: settings.portfolioSize,
      weeklyPremium,
      premiumTarget: settings.weeklyPremiumTarget,
      premiumProgress: Math.min(Math.max((weeklyPremium / (settings.weeklyPremiumTarget.min || 1)) * 100, 0), 100),
      premiumProgressMax: Math.min(Math.max((weeklyPremium / maxVal) * 100, 0), 100),
      barScaleValue,
      minPos,
      maxPos,
      currentPos: Math.min(Math.max(currentPos, 0.5), 100), // Min 0.5% for visibility if > 0
      totalAllocated,
      allocationPercentage,
      activeTradesCount: activeTrades.length,
      recentResearch,
      highRiskTrades: highRiskTrades.length,
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
        <div className="card">
          <div className="flex items-center space-x-3">
            <DollarSign className="h-8 w-8 text-primary-400" />
            <div>
              <p className="text-sm text-gray-400">Portfolio Size</p>
              <p className="text-2xl font-bold">${dashboardStats.portfolioSize.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-8 w-8 text-green-400" />
            <div>
              <p className="text-sm text-gray-400">Weekly Premium</p>
              <p className="text-2xl font-bold">${dashboardStats.weeklyPremium.toFixed(0)}</p>
              <p className="text-xs text-gray-400">
                Target: ${settings.weeklyPremiumTarget.min}-${settings.weeklyPremiumTarget.max}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-3">
            <Target className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-sm text-gray-400">Allocated Capital</p>
              <p className={`text-2xl font-bold ${getAllocationColor(dashboardStats.allocationPercentage)}`}>
                ${dashboardStats.totalAllocated.toFixed(0)}
              </p>
              <p className="text-xs text-gray-400">
                {dashboardStats.allocationPercentage.toFixed(1)}% of portfolio
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-3">
            <Calendar className="h-8 w-8 text-purple-400" />
            <div>
              <p className="text-sm text-gray-400">Active Trades</p>
              <p className="text-2xl font-bold">{dashboardStats.activeTradesCount}</p>
              <p className="text-xs text-gray-400">
                {dashboardStats.totalTrades} total trades
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Premium Progress */}
      <div className="card bg-gradient-to-br from-gray-800 to-gray-800/50 border border-gray-700/50">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Target className="h-5 w-5 text-blue-400" />
          <span>Weekly Premium Progress</span>
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-3">
              <span className="font-medium text-blue-400">Current: ${dashboardStats.weeklyPremium.toFixed(0)}</span>
              <span className="text-gray-400">Target: ${settings.weeklyPremiumTarget.min} - ${settings.weeklyPremiumTarget.max}</span>
            </div>

            {/* Progress bar with markers */}
            <div className="relative pt-6 pb-2">
              {/* Background bar */}
              <div className="w-full bg-gray-700/50 rounded-full h-5 overflow-hidden border border-gray-600/30">
                {/* Progress fill */}
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out relative shadow-lg ${dashboardStats.weeklyPremium >= settings.weeklyPremiumTarget.max
                    ? 'bg-gradient-to-r from-green-500 via-emerald-400 to-cyan-400'
                    : dashboardStats.weeklyPremium >= settings.weeklyPremiumTarget.min
                      ? 'bg-gradient-to-r from-yellow-500 via-green-500 to-emerald-400'
                      : 'bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500'
                    }`}
                  style={{
                    width: `${dashboardStats.currentPos}%`,
                  }}
                >
                  {/* Glass highlight effect */}
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-white/20 rounded-t-full"></div>
                  {/* Animated shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
                </div>
              </div>

              {/* Min target marker */}
              <div
                className="absolute top-4 h-9 w-0.5 bg-yellow-400/80 z-10 transition-all duration-500"
                style={{ left: `${dashboardStats.minPos}%` }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-wider text-yellow-400 font-bold">Min</span>
                  <span className="text-[10px] text-gray-400 font-medium">${settings.weeklyPremiumTarget.min}</span>
                </div>
              </div>

              {/* Max target marker */}
              <div
                className="absolute top-4 h-9 w-0.5 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)] z-10 transition-all duration-500"
                style={{ left: `${dashboardStats.maxPos}%` }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Max</span>
                  <span className="text-[10px] text-gray-400 font-medium">${settings.weeklyPremiumTarget.max}</span>
                </div>
              </div>

              {/* Overflow Indicator */}
              {dashboardStats.weeklyPremium > settings.weeklyPremiumTarget.max && (
                <div
                  className="absolute -right-1 top-4 h-9 flex items-center"
                  style={{ left: `calc(${Math.min(dashboardStats.currentPos, 100)}% + 4px)` }}
                >
                  <div className="flex items-center space-x-1 animate-pulse">
                    <span className="text-[10px] font-bold text-cyan-400 whitespace-nowrap">
                      +{((dashboardStats.weeklyPremium / settings.weeklyPremiumTarget.max - 1) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Progress percentage text */}
            <div className="flex justify-between text-[10px] text-gray-500 mt-2 px-1">
              <span>0%</span>
              <span className="font-semibold text-blue-400">
                {dashboardStats.weeklyPremium > 0 ? (
                  <>
                    {dashboardStats.weeklyPremium.toFixed(0)} ({((dashboardStats.weeklyPremium / settings.weeklyPremiumTarget.max) * 100).toFixed(0)}% of max)
                  </>
                ) : '0'}
              </span>
              <span>125% of Max</span>
            </div>
          </div>

          {dashboardStats.premiumProgress >= 100 && (
            <div className="flex items-center space-x-2 text-green-400 bg-green-900/20 p-3 rounded-lg border border-green-500/30">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Weekly minimum target achieved! 🎉</span>
            </div>
          )}

          {dashboardStats.weeklyPremium >= settings.weeklyPremiumTarget.max && (
            <div className="flex items-center space-x-2 text-emerald-400 bg-emerald-900/20 p-3 rounded-lg border border-emerald-500/30">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Maximum target exceeded! Outstanding performance! 🚀</span>
            </div>
          )}

          {dashboardStats.premiumProgress < 75 && dashboardStats.premiumProgress > 0 && (
            <div className="flex items-center space-x-2 text-yellow-400 bg-yellow-900/20 p-3 rounded-lg border border-yellow-500/30">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm">Consider increasing trade frequency to meet weekly target</span>
            </div>
          )}
        </div>
      </div>

      {/* Risk Alerts */}
      {dashboardStats.highRiskTrades > 0 && (
        <div className="card border-l-4 border-l-red-500">
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
        <div className="card">
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
                  <div key={index} className="p-3 bg-gray-700 rounded-lg">
                    {/* Single Row: Symbol, Price Boxes, Date, Rating */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                        <p className="font-semibold text-lg">{item.symbol}</p>
                        {currentPrice && (
                          <div className="bg-gray-800 rounded px-2 py-1 flex items-center space-x-1">
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
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Recent Trades</h3>
          {tradeData.length > 0 ? (
            <div className="space-y-3">
              {tradeData.slice(0, 5).map((item, index) => (
                <div key={index} className={`flex justify-between items-center p-3 rounded-lg ${item.status === 'executed' ? 'bg-green-900/20 border border-green-700/30' :
                  item.status === 'planned' ? 'bg-blue-900/20 border border-blue-700/30' :
                    'bg-gray-700'
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