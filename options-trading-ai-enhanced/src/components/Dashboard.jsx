import { useMemo } from 'react'
import { DollarSign, TrendingUp, Target, Calendar, AlertCircle, CheckCircle } from 'lucide-react'
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'

function Dashboard({ researchData, tradeData, settings }) {
  const dashboardStats = useMemo(() => {
    const now = new Date()
    const weekStart = startOfWeek(now)
    const weekEnd = endOfWeek(now)

    // Calculate weekly premium from executed trades (saved trades)
    const weeklyTrades = tradeData.filter(trade => {
      const tradeDate = new Date(trade.timestamp)
      return isWithinInterval(tradeDate, { start: weekStart, end: weekEnd })
    })

    const weeklyPremium = weeklyTrades.reduce((sum, trade) => {
      // Only count premium from saved trades (executed)
      return sum + (trade.premium * trade.quantity * 100)
    }, 0)

    const premiumProgress = (weeklyPremium / settings.weeklyPremiumTarget.min) * 100
    const premiumProgressMax = (weeklyPremium / settings.weeklyPremiumTarget.max) * 100

    // Portfolio allocation
    const activeTrades = tradeData.filter(trade => !trade.closed)
    const totalAllocated = activeTrades.reduce((sum, trade) => {
      return sum + (trade.premium * trade.quantity * 100)
    }, 0)

    const allocationPercentage = (totalAllocated / settings.portfolioSize) * 100

    // Recent research
    const recentResearch = researchData.slice(0, 5)

    // Risk metrics
    const highRiskTrades = tradeData.filter(trade =>
      trade.riskMetrics?.allocationPercentage > settings.maxTradePercentage
    )

    return {
      portfolioSize: settings.portfolioSize,
      weeklyPremium,
      premiumTarget: settings.weeklyPremiumTarget,
      premiumProgress: Math.min(premiumProgress, 100),
      premiumProgressMax: Math.min(premiumProgressMax, 100),
      totalAllocated,
      allocationPercentage,
      activeTradesCount: activeTrades.length,
      recentResearch,
      highRiskTrades: highRiskTrades.length,
      totalResearch: researchData.length,
      totalTrades: tradeData.length
    }
  }, [researchData, tradeData, settings])

  const getProgressColor = (progress) => {
    if (progress >= 100) return 'bg-green-500'
    if (progress >= 75) return 'bg-yellow-500'
    return 'bg-red-500'
  }

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
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Target className="h-5 w-5 text-primary-400" />
          <span>Weekly Premium Progress</span>
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Current: ${dashboardStats.weeklyPremium.toFixed(0)}</span>
              <span>Target: ${settings.weeklyPremiumTarget.min} - ${settings.weeklyPremiumTarget.max}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${getProgressColor(dashboardStats.premiumProgress)}`}
                style={{ width: `${Math.max(dashboardStats.premiumProgress, 5)}%` }}
              ></div>
            </div>
          </div>

          {dashboardStats.premiumProgress >= 100 && (
            <div className="flex items-center space-x-2 text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm">Weekly target achieved! 🎉</span>
            </div>
          )}

          {dashboardStats.premiumProgress < 75 && (
            <div className="flex items-center space-x-2 text-yellow-400">
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
              {dashboardStats.recentResearch.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                  <div>
                    <p className="font-semibold">{item.symbol}</p>
                    <p className="text-sm text-gray-400">
                      {format(new Date(item.date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">Rating: {item.overallRating}/10</p>
                    <p className={`text-xs capitalize ${
                      item.overallRating >= 7 ? 'text-green-400' :
                      item.overallRating >= 5 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {item.overallRating >= 7 ? 'Strong Buy' :
                       item.overallRating >= 5 ? 'Hold' : 'Avoid'}
                    </p>
                  </div>
                </div>
              ))}
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
                <div key={index} className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                  <div>
                    <p className="font-semibold">{item.symbol} {item.type.toUpperCase()}</p>
                    <p className="text-sm text-gray-400">
                      {format(new Date(item.timestamp), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">${item.premium} premium</p>
                    <p className={`text-xs ${
                      item.rating >= 7 ? 'text-green-400' :
                      item.rating >= 5 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      Rating: {item.rating}/10
                    </p>
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