import { useState, useRef, useEffect } from 'react'
import { Calculator, TrendingUp, AlertTriangle, CheckCircle, DollarSign, Save, Trash2, Edit, MessageCircle, Send, Bot, User, ChevronDown, ChevronUp, Loader } from 'lucide-react'
import { calculateOptionGreeks, assessTradeRisk, generateTradeRecommendation } from '../utils/optionsCalculations'
import { saveToLocalStorage } from '../utils/storage'

// Helper function to format dates as DD/MM/YYYY
const formatDateDDMMYYYY = (dateString) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

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

  // Chat state
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef(null)

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages])

  // Reset chat when analysis changes
  useEffect(() => {
    setChatMessages([])
    setChatOpen(false)
  }, [analysis?.id])

  // Handle sending chat message
  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!chatInput.trim() || chatLoading || !analysis) return

    const userMessage = { role: 'user', content: chatInput.trim() }
    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setChatLoading(true)

    try {
      const response = await fetch('/api/trade-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage.content,
          tradeData: analysis,
          chatHistory: chatMessages
        })
      })

      if (!response.ok) throw new Error('Chat request failed')

      const data = await response.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch (error) {
      console.error('Chat error:', error)
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }])
    } finally {
      setChatLoading(false)
    }
  }

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
        credentials: 'include',
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

  const handleQuickSave = (tradeStatus) => {
    if (!selectedSymbol || !strikePrice || !expirationDate || !currentPrice || !premium) {
      alert('Please fill in all required fields before saving.')
      return
    }

    // Create a minimal trade record without full analysis
    const quickTrade = {
      id: Date.now(),
      symbol: selectedSymbol.toUpperCase(),
      tradeType,
      type: tradeType,
      optionType,
      strikePrice: parseFloat(strikePrice),
      expirationDate,
      stockPrice: parseFloat(currentPrice),
      premium: parseFloat(premium),
      quantity: 1,
      closed: false,
      executed: tradeStatus === 'executed',
      planned: tradeStatus === 'planned',
      status: tradeStatus,
      timestamp: new Date().toISOString(),
      executionDate: tradeStatus === 'executed' ? new Date().toISOString() : null,
      // Minimal data for quick save (no full analysis)
      rating: 5, // Neutral rating
      riskAssessment: {
        overallRisk: 'Medium',
        maxLoss: parseFloat(strikePrice) * 100,
        factors: []
      },
      riskMetrics: {
        overallRisk: 'Medium',
        maxLoss: parseFloat(strikePrice) * 100,
        factors: []
      },
      recommendation: {
        action: 'Quick Save',
        confidence: 0,
        rationale: 'This trade was saved without full analysis.',
        rating: 5
      },
      hasResearchData: false,
      quickSave: true // Flag to indicate this was a quick save
    }

    // Add to trade data
    setTradeData(prev => [quickTrade, ...prev])
    saveToLocalStorage('tradeData', [quickTrade, ...tradeData])

    // Show success message
    const message = tradeStatus === 'executed'
      ? `${selectedSymbol} trade saved as EXECUTED! This will count toward your weekly premium goal.`
      : `${selectedSymbol} trade saved as PLANNED! This is tracked but won't count toward your goals until executed.`
    alert(message)

    // Clear the form
    setSelectedSymbol('')
    setStrikePrice('')
    setExpirationDate('')
    setCurrentPrice('')
    setPremium('')
    setPriceError('')
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
          credentials: 'include',
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
        type: tradeType, // Dashboard expects this
        optionType,
        strikePrice: parseFloat(strikePrice),
        expirationDate,
        stockPrice,
        premium: premiumAmount,
        quantity: 1, // Default to 1 contract
        closed: false, // Dashboard expects this for active trades
        executed: false, // To distinguish from saved/executed trades
        rating: recommendation.rating, // Dashboard expects this at top level
        riskAssessment,
        riskMetrics: riskAssessment, // Dashboard expects this property name
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

  const handleSaveTrade = (tradeStatus) => {
    if (!analysis) return

    // Mark the trade with appropriate status
    const savedTrade = {
      ...analysis,
      executed: tradeStatus === 'executed',
      planned: tradeStatus === 'planned',
      status: tradeStatus
    }

    // Update the current analysis
    setAnalysis(savedTrade)

    // Update tradeData array - replace the current analysis with saved version
    const updatedTradeData = tradeData.map(trade =>
      trade.id === analysis.id ? savedTrade : trade
    )
    setTradeData(updatedTradeData)

    // Persist to localStorage
    saveToLocalStorage('tradeData', updatedTradeData)

    // Show success message
    const message = tradeStatus === 'executed'
      ? `Trade for ${analysis.symbol} saved as EXECUTED! This will count toward your weekly premium goal and capital utilization.`
      : `Trade for ${analysis.symbol} saved as PLANNED! This is tracked but won't count toward your goals until executed.`
    alert(message)
  }

  const handleDeleteTrade = (tradeId) => {
    if (!confirm('Are you sure you want to delete this trade?')) return

    const updatedTradeData = tradeData.filter(trade => trade.id !== tradeId)
    setTradeData(updatedTradeData)
    saveToLocalStorage('tradeData', updatedTradeData)

    // If we deleted the current analysis, clear it
    if (analysis && analysis.id === tradeId) {
      setAnalysis(null)
    }
  }

  const handleEditTrade = (trade) => {
    // Load the trade data into the form for editing
    setSelectedSymbol(trade.symbol)
    setStrikePrice(trade.strikePrice.toString())
    setExpirationDate(trade.expirationDate)
    setTradeType(trade.tradeType)
    setCurrentPrice(trade.stockPrice.toString())
    setPremium(trade.premium.toString())

    // Set the analysis to the trade so it can be updated
    setAnalysis(trade)

    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

    // If this is the current analysis, update it
    if (analysis && analysis.id === trade.id) {
      setAnalysis(executedTrade)
    }

    alert(`Trade for ${trade.symbol} converted to EXECUTED! Execution date set to ${formatDateDDMMYYYY(new Date().toISOString())}.`)
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
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={handleAnalyze}
            disabled={loading || !selectedSymbol || !strikePrice || !expirationDate || !currentPrice || !premium}
            className="btn-primary flex-1 min-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed"
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

          <button
            onClick={() => handleQuickSave('planned')}
            disabled={loading || !selectedSymbol || !strikePrice || !expirationDate || !currentPrice || !premium}
            className="flex-1 min-w-[180px] flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            <span>Quick Save as Planned</span>
          </button>

          <button
            onClick={() => handleQuickSave('executed')}
            disabled={loading || !selectedSymbol || !strikePrice || !expirationDate || !currentPrice || !premium}
            className="flex-1 min-w-[180px] flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className="h-4 w-4" />
            <span>Quick Save as Executed</span>
          </button>
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
              <div className="flex items-center space-x-4">
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${getRecommendationColor(analysis.recommendation.action)}`}>
                  {analysis.recommendation.action}
                </div>
                {!analysis.status && (
                  <>
                    <button
                      onClick={() => handleSaveTrade('planned')}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Save className="h-4 w-4" />
                      <span>Save as Planned</span>
                    </button>
                    <button
                      onClick={() => handleSaveTrade('executed')}
                      className="btn-primary flex items-center space-x-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Save as Executed</span>
                    </button>
                  </>
                )}
                {analysis.status === 'planned' && (
                  <div className="flex items-center space-x-2 text-blue-400">
                    <Save className="h-5 w-5" />
                    <span className="text-sm font-medium">Planned Trade</span>
                  </div>
                )}
                {analysis.status === 'executed' && (
                  <div className="flex items-center space-x-2 text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Executed Trade</span>
                  </div>
                )}
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

          {/* Chat Interface */}
          <div className="card">
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <MessageCircle className="h-5 w-5 text-primary-400" />
                <h3 className="text-lg font-semibold">Ask Questions About This Trade</h3>
              </div>
              {chatOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>

            {chatOpen && (
              <div className="px-4 pb-4">
                {/* Chat Messages */}
                <div className="bg-gray-800 rounded-lg p-4 h-80 overflow-y-auto mb-4">
                  {chatMessages.length === 0 && (
                    <div className="text-center text-gray-400 py-8">
                      <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Ask me anything about this trade!</p>
                      <p className="text-xs mt-2 text-gray-500">
                        Try: "What are the risks?", "Should I adjust the strike?", "What's my breakeven?"
                      </p>
                    </div>
                  )}
                  {chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex items-start space-x-3 mb-4 ${
                        msg.role === 'user' ? 'justify-end' : ''
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                          <Bot className="h-5 w-5 text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === 'user'
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-700 text-gray-200'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      {msg.role === 'user' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                          <User className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-white" />
                      </div>
                      <div className="bg-gray-700 rounded-lg p-3">
                        <Loader className="h-5 w-5 animate-spin text-primary-400" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about risk management, adjustments, alternative strategies..."
                    className="input-primary flex-1"
                    disabled={chatLoading}
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trade History */}
      {tradeData.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Trade Analysis History</h3>
          <div className="space-y-4">
            {tradeData.slice(0, 10).map((trade, index) => (
              <div key={index} className={`p-4 rounded-lg ${
                trade.status === 'executed' ? 'bg-green-900/20 border border-green-700/30' :
                trade.status === 'planned' ? 'bg-blue-900/20 border border-blue-700/30' :
                'bg-gray-700'
              }`}>
                {/* Top Row: Symbol, Type, and Status */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-lg">
                      {trade.symbol} {trade.tradeType === 'cashSecuredPut' ? 'Cash-Secured Put' : 'Covered Call'}
                    </h4>
                    <div className="flex items-center space-x-2 mt-1">
                      {trade.status === 'executed' && (
                        <span className="text-xs px-2 py-0.5 bg-green-600 text-green-100 rounded">
                          EXECUTED
                        </span>
                      )}
                      {trade.status === 'planned' && (
                        <span className="text-xs px-2 py-0.5 bg-blue-600 text-blue-100 rounded">
                          PLANNED
                        </span>
                      )}
                      {!trade.status && (
                        <span className="text-xs px-2 py-0.5 bg-gray-600 text-gray-300 rounded">
                          RESEARCH
                        </span>
                      )}
                      <span className={`text-sm font-medium px-2 py-0.5 rounded ${getRecommendationColor(trade.recommendation.action)}`}>
                        {trade.recommendation.action}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {trade.status === 'planned' && (
                      <>
                        <button
                          onClick={() => handleEditTrade(trade)}
                          className="p-2 hover:bg-blue-900/50 rounded-lg transition-colors"
                          title="Edit planned trade"
                        >
                          <Edit className="h-4 w-4 text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleConvertToExecuted(trade)}
                          className="p-2 hover:bg-green-900/50 rounded-lg transition-colors"
                          title="Convert to executed trade"
                        >
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        </button>
                      </>
                    )}
                    {(trade.status === 'planned' || trade.status === 'executed') && (
                      <button
                        onClick={() => handleDeleteTrade(trade.id)}
                        className="p-2 hover:bg-red-900/50 rounded-lg transition-colors"
                        title="Delete trade"
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Trade Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Strike Price</div>
                    <div className="text-lg font-bold text-white">${trade.strikePrice}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Expiry Date</div>
                    <div className="text-lg font-bold text-yellow-400">{formatDateDDMMYYYY(trade.expirationDate)}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Premium</div>
                    <div className="text-lg font-bold text-green-400">${trade.premium}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Analysis Date</div>
                    <div className="text-lg font-bold text-gray-300">{formatDateDDMMYYYY(trade.timestamp)}</div>
                  </div>
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