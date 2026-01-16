import { useState } from 'react'
import { Calculator, TrendingUp, AlertTriangle, CheckCircle, DollarSign } from 'lucide-react'
import { calculateOptionGreeks, assessTradeRisk, generateTradeRecommendation } from '../utils/optionsCalculations'

function TradeReview({ tradeData, setTradeData, portfolioSettings, researchData }) {
  const [selectedSymbol, setSelectedSymbol] = useState('')
  const [strikePrice, setStrikePrice] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [tradeType, setTradeType] = useState('cashSecuredPut') // cashSecuredPut or coveredCall
  const [currentPrice, setCurrentPrice] = useState('')
  const [premium, setPremium] = useState('')
  const [fetchingPrice, setFetchingPrice] = useState(false)
  const [priceError, setPriceError] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)

  // Auto-determine option type based on trade type
  const optionType = tradeType === 'cashSecuredPut' ? 'put' : 'call'

  // Get available symbols from research data
  const availableSymbols = [...new Set(researchData.map(item => item.symbol))]

  // Fetch current market price from stockanalysis.com
  const fetchCurrentPrice = async (symbol) => {
    if (!symbol) return

    setFetchingPrice(true)
    setPriceError('')

    try {
      const response = await fetch(`/api/scrape/stock-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      })

      if (!response.ok) throw new Error('Failed to fetch price')

      const data = await response.json()
      if (data.price) {
        setCurrentPrice(data.price.toString())
        setPriceError('')
      } else {
        throw new Error('Price not found')
      }
    } catch (error) {
      console.error('Error fetching price:', error)
      setPriceError('Unable to fetch price. Please enter manually.')
    } finally {
      setFetchingPrice(false)
    }
  }

  // Fetch price when symbol changes
  const handleSymbolChange = (symbol) => {
    setSelectedSymbol(symbol)
    if (symbol) {
      fetchCurrentPrice(symbol)
    } else {
      setCurrentPrice('')
      setPriceError('')
    }
  }

  const handleAnalyze = async () => {
    if (!selectedSymbol || !strikePrice || !expirationDate || !currentPrice || !premium) return

    setLoading(true)
    try {
      // Use the manually entered or fetched current price
      const stockPrice = parseFloat(currentPrice)
      const premiumAmount = parseFloat(premium)

      // Get current stock data from research if available
      const companyData = researchData.find(item => item.symbol === selectedSymbol.toUpperCase())

      // Use default values if company not researched
      const volatility = companyData?.technicalAnalysis?.rating || 5
      const companyRating = companyData?.overallRating || 5

      // Calculate Greeks (still needed internally for risk calculations)
      const greeks = calculateOptionGreeks(
        stockPrice,
        parseFloat(strikePrice),
        new Date(expirationDate),
        optionType,
        0.02, // risk-free rate (2%)
        volatility // volatility proxy
      )

      // Fetch earnings and events data
      let earningsAndEvents = null
      try {
        const response = await fetch('/api/scrape/earnings-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: selectedSymbol.toUpperCase(),
            expirationDate
          })
        })

        if (response.ok) {
          earningsAndEvents = await response.json()
        }
      } catch (error) {
        console.error('Error fetching earnings/events:', error)
      }

      // Assess trade risk with earnings data
      const riskAssessment = assessTradeRisk(
        tradeType,
        stockPrice,
        parseFloat(strikePrice),
        greeks,
        portfolioSettings,
        earningsAndEvents
      )

      // Generate enhanced recommendation
      const recommendation = generateTradeRecommendation(
        tradeType,
        greeks,
        riskAssessment,
        companyRating,
        portfolioSettings,
        {
          premium: premiumAmount,
          stockPrice,
          strikePrice: parseFloat(strikePrice),
          daysToExpiration: Math.ceil((new Date(expirationDate) - new Date()) / (1000 * 60 * 60 * 24)),
          earningsAndEvents
        }
      )

      const tradeAnalysis = {
        id: Date.now(),
        symbol: selectedSymbol.toUpperCase(),
        tradeType,
        optionType,
        strikePrice: parseFloat(strikePrice),
        expirationDate,
        stockPrice,
        premium: premiumAmount,
        riskAssessment,
        recommendation,
        earningsAndEvents,
        timestamp: new Date().toISOString(),
        companyRating,
        hasResearchData: !!companyData
      }

      setAnalysis(tradeAnalysis)
      setTradeData(prev => [tradeAnalysis, ...prev])

      // Show warning if no research data
      if (!companyData) {
        setTimeout(() => {
          alert('Note: Analysis completed without company research data. For more accurate analysis, consider researching this company first.')
        }, 100)
      }
    } catch (error) {
      console.error('Analysis error:', error)
      alert('Error analyzing trade. Please check your inputs.')
    } finally {
      setLoading(false)
    }
  }

  const getRiskColor = (level) => {
    switch (level) {
      case 'Low': return 'text-green-400'
      case 'Medium': return 'text-yellow-400'
      case 'High': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getRiskIcon = (level) => {
    switch (level) {
      case 'Low': return <CheckCircle className="h-5 w-5 text-green-400" />
      case 'Medium': return <AlertTriangle className="h-5 w-5 text-yellow-400" />
      case 'High': return <AlertTriangle className="h-5 w-5 text-red-400" />
      default: return <AlertTriangle className="h-5 w-5 text-gray-400" />
    }
  }

  const getRecommendationColor = (action) => {
    switch (action) {
      case 'Strong Buy': return 'text-green-400 bg-green-900'
      case 'Buy': return 'text-green-400 bg-green-900'
      case 'Hold': return 'text-yellow-400 bg-yellow-900'
      case 'Sell': return 'text-red-400 bg-red-900'
      case 'Strong Sell': return 'text-red-400 bg-red-900'
      default: return 'text-gray-400 bg-gray-900'
    }
  }

  return (
    <div className="space-y-6">
      {/* Trade Setup Form */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Trade Analysis Setup</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Symbol Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Stock Symbol</label>
            <input
              type="text"
              list="symbol-suggestions"
              value={selectedSymbol}
              onChange={(e) => handleSymbolChange(e.target.value.toUpperCase())}
              onBlur={(e) => handleSymbolChange(e.target.value.toUpperCase())}
              placeholder="Enter symbol (e.g., AAPL)"
              className="input-primary w-full"
            />
            <datalist id="symbol-suggestions">
              {availableSymbols.map(symbol => (
                <option key={symbol} value={symbol} />
              ))}
            </datalist>
            {availableSymbols.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Select from researched symbols or enter any symbol
              </p>
            )}
          </div>

          {/* Trade Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Trade Type</label>
            <select
              value={tradeType}
              onChange={(e) => setTradeType(e.target.value)}
              className="input-primary w-full"
            >
              <option value="cashSecuredPut">Cash-Secured Put</option>
              <option value="coveredCall">Covered Call</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {tradeType === 'cashSecuredPut' ? 'Put Option' : 'Call Option'}
            </p>
          </div>

          {/* Current Market Price */}
          <div>
            <label className="block text-sm font-medium mb-2">Current Market Price</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                placeholder="0.00"
                className="input-primary w-full"
                disabled={fetchingPrice}
              />
              {fetchingPrice && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
                </div>
              )}
            </div>
            {priceError && (
              <p className="text-xs text-yellow-400 mt-1">{priceError}</p>
            )}
          </div>

          {/* Premium */}
          <div>
            <label className="block text-sm font-medium mb-2">Premium (per contract)</label>
            <input
              type="number"
              step="0.01"
              value={premium}
              onChange={(e) => setPremium(e.target.value)}
              placeholder="0.00"
              className="input-primary w-full"
            />
            <p className="text-xs text-gray-400 mt-1">Premium earned per share</p>
          </div>

          {/* Strike Price */}
          <div>
            <label className="block text-sm font-medium mb-2">Strike Price</label>
            <input
              type="number"
              step="0.01"
              value={strikePrice}
              onChange={(e) => setStrikePrice(e.target.value)}
              placeholder="150.00"
              className="input-primary w-full"
            />
          </div>

          {/* Expiration Date */}
          <div>
            <label className="block text-sm font-medium mb-2">Expiration Date</label>
            <input
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="input-primary w-full"
            />
          </div>

          {/* Analyze Button */}
          <div className="flex items-end">
            <button
              onClick={handleAnalyze}
              disabled={loading || !selectedSymbol || !strikePrice || !expirationDate || !currentPrice}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Analyzing...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <Calculator className="h-4 w-4" />
                  <span>Analyze Trade</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-4">
          {/* Trade Summary */}
          <div className="card border-l-4 border-l-primary-500">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold">
                  {analysis.symbol} {analysis.tradeType === 'cashSecuredPut' ? 'Cash-Secured Put' : 'Covered Call'} Analysis
                </h3>
                {!analysis.hasResearchData && (
                  <p className="text-xs text-yellow-400 mt-1">
                    ⚠️ Analysis based on default values (no research data available)
                  </p>
                )}
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getRecommendationColor(analysis.recommendation.action)}`}>
                {analysis.recommendation.action}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold">${analysis.stockPrice.toFixed(2)}</div>
                <div className="text-sm text-gray-400">Current Stock Price</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">${analysis.strikePrice.toFixed(2)}</div>
                <div className="text-sm text-gray-400">Strike Price</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {Math.ceil((new Date(analysis.expirationDate) - new Date()) / (1000 * 60 * 60 * 24))} Days
                </div>
                <div className="text-sm text-gray-400">Days to Expiration</div>
              </div>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="card">
            <h4 className="text-lg font-semibold mb-4 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Risk Assessment
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="flex items-center space-x-3">
                {getRiskIcon(analysis.riskAssessment.overallRisk)}
                <div>
                  <div className={`font-semibold ${getRiskColor(analysis.riskAssessment.overallRisk)}`}>
                    {analysis.riskAssessment.overallRisk} Risk
                  </div>
                  <div className="text-sm text-gray-400">Overall Risk Level</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <DollarSign className="h-5 w-5 text-green-400" />
                <div>
                  <div className="font-semibold text-green-400">
                    ${(analysis.riskAssessment.maxLoss || 0).toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-400">Maximum Loss</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {analysis.riskAssessment.factors?.map((factor, index) => (
                <div key={index} className={`p-3 rounded-lg ${
                  factor.type === 'positive' ? 'bg-green-900 text-green-300' :
                  factor.type === 'warning' ? 'bg-yellow-900 text-yellow-300' :
                  factor.type === 'info' ? 'bg-blue-900 text-blue-300' :
                  'bg-red-900 text-red-300'
                }`}>
                  <div className="font-medium">{factor.message}</div>
                  {factor.detail && (
                    <div className="text-xs mt-1 opacity-90">{factor.detail}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Market Sentiment section */}
            {analysis.earningsAndEvents?.marketSentiment && (
              <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                <h5 className="font-medium mb-2">Market Sentiment</h5>
                <p className="text-sm text-gray-300 mb-2">{analysis.earningsAndEvents.marketSentiment.description}</p>
                <ul className="space-y-1">
                  {analysis.earningsAndEvents.marketSentiment.factors.map((factor, idx) => (
                    <li key={idx} className="text-xs text-gray-400 flex items-start">
                      <span className="text-primary-500 mr-2">•</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Recommendation */}
          <div className="card">
            <h4 className="text-lg font-semibold mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Trade Recommendation
            </h4>

            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${getRecommendationColor(analysis.recommendation.action)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-lg">{analysis.recommendation.action}</div>
                    <div className="text-sm opacity-90">Confidence: {analysis.recommendation.confidence}%</div>
                    {analysis.recommendation.rating !== undefined && (
                      <div className="text-sm opacity-90 mt-1">Rating: {analysis.recommendation.rating}/10</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {analysis.recommendation.expectedReturn ? `$${analysis.recommendation.expectedReturn.toFixed(2)}` : 'N/A'}
                    </div>
                    <div className="text-sm opacity-90">Expected Return</div>
                  </div>
                </div>
              </div>

              <div>
                <h5 className="font-medium mb-3">Detailed Analysis</h5>
                <div className="space-y-3">
                  {(analysis.recommendation.rationale || 'No rationale provided').split('\n\n').map((section, idx) => {
                    // Extract the section title if it starts with **
                    const titleMatch = section.match(/^\*\*(.+?):\*\*/)
                    const title = titleMatch ? titleMatch[1] : null
                    const content = title ? section.replace(/^\*\*(.+?):\*\*\s*/, '') : section

                    // Determine card color based on title
                    let cardColor = 'bg-gray-700'
                    if (title && title.includes('STRONG BUY')) cardColor = 'bg-green-900 border-l-4 border-green-500'
                    else if (title && title.includes('BUY')) cardColor = 'bg-green-900/50 border-l-4 border-green-600'
                    else if (title && title.includes('AVOID')) cardColor = 'bg-red-900/50 border-l-4 border-red-600'
                    else if (title && title.includes('HOLD')) cardColor = 'bg-yellow-900/50 border-l-4 border-yellow-600'

                    return (
                      <div key={idx} className={`p-4 rounded-lg ${cardColor}`}>
                        {title && (
                          <h6 className="font-semibold text-sm mb-2 text-primary-300">{title}</h6>
                        )}
                        <div className="text-gray-300 text-sm leading-relaxed">
                          {content.split('**').map((part, i) =>
                            i % 2 === 1 ? <strong key={i} className="text-white">{part}</strong> : part
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {analysis.recommendation.warnings && analysis.recommendation.warnings.length > 0 && (
                <div>
                  <h5 className="font-medium mb-2 text-yellow-400">Warnings</h5>
                  <ul className="space-y-1">
                    {analysis.recommendation.warnings.map((warning, index) => (
                      <li key={index} className="text-sm text-yellow-300 flex items-start">
                        <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What to Watch section */}
              {analysis.earningsAndEvents?.whatToWatch && analysis.earningsAndEvents.whatToWatch.length > 0 && (
                <div>
                  <h5 className="font-medium mb-3">What to Watch</h5>
                  <div className="space-y-4">
                    {analysis.earningsAndEvents.whatToWatch.map((section, idx) => (
                      <div key={idx} className="bg-gray-700 p-3 rounded-lg">
                        <h6 className="font-medium text-primary-400 mb-2">{section.category}</h6>
                        <ul className="space-y-1">
                          {section.items.map((item, itemIdx) => (
                            <li key={itemIdx} className="text-xs text-gray-300 flex items-start">
                              <span className="text-primary-500 mr-2">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trade History */}
      {tradeData.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Trade Analysis History</h3>
          <div className="space-y-4">
            {tradeData.slice(0, 10).map((trade, index) => (
              <div key={index} className="flex justify-between items-center p-4 bg-gray-700 rounded-lg">
                <div>
                  <h4 className="font-semibold">
                    {trade.symbol} {trade.tradeType === 'cashSecuredPut' ? 'Put' : 'Call'}
                  </h4>
                  <p className="text-sm text-gray-400">
                    Strike: ${trade.strikePrice} • Exp: {new Date(trade.expirationDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`font-semibold ${getRecommendationColor(trade.recommendation.action)}`}>
                    {trade.recommendation.action}
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(trade.timestamp).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TradeReview