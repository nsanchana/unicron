import { useState, useRef, useEffect } from 'react'
import { Calculator, TrendingUp, AlertTriangle, CheckCircle, DollarSign, Save, Trash2, Edit, Edit2, MessageCircle, Send, Bot, User, ChevronDown, ChevronUp, Loader, RefreshCw } from 'lucide-react'
import { calculateOptionGreeks, assessTradeRisk, generateTradeRecommendation } from '../utils/optionsCalculations'
import { saveToLocalStorage, STORAGE_KEYS } from '../utils/storage'
import CompanyLogo from './CompanyLogo'

// Helper function to format dates as DD/MM/YYYY
const formatDateDDMMYYYY = (dateString) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = date.toLocaleString('default', { month: 'short' }).toUpperCase()
  const year = date.getFullYear()
  return `${day} ${month} ${year}`
}

function TradeReview({ tradeData, setTradeData, portfolioSettings, researchData }) {
  const [selectedSymbol, setSelectedSymbol] = useState('')
  const [strikePrice, setStrikePrice] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().split('T')[0])
  const [tradeType, setTradeType] = useState('cashSecuredPut') // cashSecuredPut or coveredCall
  const [currentPrice, setCurrentPrice] = useState('')
  const [premium, setPremium] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [fetchingPrice, setFetchingPrice] = useState(false)
  const [priceError, setPriceError] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all') // 'all', 'planned', 'executed', 'expired'
  const [sortBy, setSortBy] = useState('newest') // newest, symbol, expiry, variance, premium
  const [editingId, setEditingId] = useState(null)

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
  const getPrice = async (symbol) => {
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
        return data.price.toString()
      }
      return null
    } catch (error) {
      console.error('Error fetching price:', error)
      return null
    }
  }

  const fetchCurrentPrice = async (symbol) => {
    if (!symbol) return

    setFetchingPrice(true)
    setPriceError('')

    const price = await getPrice(symbol)

    if (price) {
      setCurrentPrice(price)
      setPriceError('')
    } else {
      setPriceError('Unable to fetch price. Please enter manually.')
    }
    setFetchingPrice(false)
  }

  // Refresh prices for all active trades
  const refreshTradePrices = async () => {
    setLoading(true)
    const activeTrades = tradeData.filter(t => !t.closed)
    const uniqueSymbols = [...new Set(activeTrades.map(t => t.symbol))]

    // Create a map of symbol -> new price
    const priceMap = {}

    for (const symbol of uniqueSymbols) {
      const price = await getPrice(symbol)
      if (price) {
        priceMap[symbol] = parseFloat(price)
      }
    }

    // Update trade data
    const updatedTradeData = tradeData.map(trade => {
      // Only update if we have a new price and the trade is active or recently closed
      if (priceMap[trade.symbol]) {
        return {
          ...trade,
          currentMarketPrice: priceMap[trade.symbol],
          lastPriceUpdate: new Date().toISOString()
        }
      }
      return trade
    })

    setTradeData(updatedTradeData)
    saveToLocalStorage(STORAGE_KEYS.TRADE_DATA, updatedTradeData)
    setLoading(false)
    alert('Stock prices updated successfully!')
  }

  // Auto-refresh prices if data is stale (older than today)
  useEffect(() => {
    const checkAndRefreshPrices = async () => {
      if (tradeData.length === 0) return

      const activeTrades = tradeData.filter(t => !t.closed)
      if (activeTrades.length === 0) return

      const today = new Date().toISOString().split('T')[0]
      const needsUpdate = activeTrades.some(t => {
        if (!t.lastPriceUpdate) return true
        return t.lastPriceUpdate.split('T')[0] !== today
      })

      if (needsUpdate) {
        // Silent update
        const uniqueSymbols = [...new Set(activeTrades.map(t => t.symbol))]
        const priceMap = {}

        for (const symbol of uniqueSymbols) {
          const price = await getPrice(symbol)
          if (price) {
            priceMap[symbol] = parseFloat(price)
          }
        }

        const updatedTradeData = tradeData.map(trade => {
          if (priceMap[trade.symbol]) {
            return {
              ...trade,
              currentMarketPrice: priceMap[trade.symbol],
              lastPriceUpdate: new Date().toISOString()
            }
          }
          return trade
        })

        if (JSON.stringify(updatedTradeData) !== JSON.stringify(tradeData)) {
          setTradeData(updatedTradeData)
          saveToLocalStorage(STORAGE_KEYS.TRADE_DATA, updatedTradeData)
        }
      }
    }

    checkAndRefreshPrices()

    // Handle /log URL trigger
    const path = window.location.pathname
    if (path === '/log') {
      const params = new URLSearchParams(window.location.search)
      const ticker = params.get('ticker')
      const type = params.get('type')
      const strike = params.get('strike')
      const expiry = params.get('expiry')
      const prem = params.get('premium')

      if (ticker && type && strike && expiry && prem) {
        const createAutoTrade = async () => {
          setLoading(true)
          const price = await getPrice(ticker.toUpperCase())
          setLoading(false)

          if (price) {
            const stPrice = parseFloat(strike)
            const timestamp = new Date().toISOString()
            const quickTrade = {
              id: Date.now(),
              symbol: ticker.toUpperCase(),
              tradeType: type,
              type: type,
              optionType: type === 'cashSecuredPut' ? 'put' : 'call',
              strikePrice: stPrice,
              expirationDate: expiry,
              stockPrice: parseFloat(price),
              premium: parseFloat(prem),
              quantity: 1,
              closed: false,
              executed: false,
              planned: true,
              status: 'planned',
              timestamp,
              rating: 5,
              riskAssessment: { overallRisk: 'Medium', maxLoss: stPrice * 100, factors: [] },
              riskMetrics: { overallRisk: 'Medium', maxLoss: stPrice * 100, factors: [] },
              recommendation: { action: 'Auto Log', confidence: 0, rationale: 'Automatically logged from URL trigger.', rating: 5 },
              hasResearchData: false,
              quickSave: true
            }

            setTradeData(prev => {
              const next = [quickTrade, ...prev]
              saveToLocalStorage(STORAGE_KEYS.TRADE_DATA, next)
              return next
            })
            alert(`Trade for ${ticker.toUpperCase()} automatically logged as PLANNED!`)
            // Clear URL to prevent re-creation on refresh
            window.history.replaceState({}, document.title, '/trades')
          }
        }
        createAutoTrade()
      }
    }
  }, []) // Run once on mount

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
    if (!selectedSymbol || !strikePrice || !expirationDate || !currentPrice || !premium || !tradeDate || !quantity) {
      alert('Please fill in all required fields before saving.')
      return
    }

    const sPrice = parseFloat(currentPrice)
    const stPrice = parseFloat(strikePrice)
    const prem = parseFloat(premium)
    const qty = parseInt(quantity) || 1

    // Create timestamp from selected trade date
    // Set time to noon to avoid timezone issues shifting the date
    const timestamp = new Date(tradeDate)
    timestamp.setHours(12, 0, 0, 0)
    const timestampIso = timestamp.toISOString()

    // Calculate risk metrics for quick save
    const maxLoss = stPrice * 100
    const riskAssessment = {
      overallRisk: 'Medium',
      maxLoss: maxLoss,
      factors: []
    }

    // Create/Update trade record
    if (editingId) {
      const updatedTradeData = tradeData.map(trade => {
        if (trade.id === editingId) {
          return {
            ...trade,
            symbol: selectedSymbol.toUpperCase(),
            tradeType,
            type: tradeType,
            optionType,
            strikePrice: stPrice,
            expirationDate,
            stockPrice: sPrice,
            premium: prem,
            quantity: qty,
            executed: tradeStatus === 'executed',
            planned: tradeStatus === 'planned',
            status: tradeStatus,
            timestamp: timestampIso,
            executionDate: tradeStatus === 'executed' ? timestampIso : null,
            riskAssessment: {
              ...trade.riskAssessment,
              maxLoss: maxLoss
            },
            riskMetrics: {
              ...trade.riskMetrics,
              maxLoss: maxLoss
            }
          }
        }
        return trade
      })

      setTradeData(updatedTradeData)
      saveToLocalStorage(STORAGE_KEYS.TRADE_DATA, updatedTradeData)
      setEditingId(null)
      alert(`Trade for ${selectedSymbol} updated successfully!`)
    } else {
      const quickTrade = {
        id: Date.now(),
        symbol: selectedSymbol.toUpperCase(),
        tradeType,
        type: tradeType,
        optionType,
        strikePrice: stPrice,
        expirationDate,
        stockPrice: sPrice,
        premium: prem,
        quantity: qty,
        closed: false,
        executed: tradeStatus === 'executed',
        planned: tradeStatus === 'planned',
        status: tradeStatus,
        timestamp: timestampIso,
        executionDate: tradeStatus === 'executed' ? timestampIso : null,
        rating: 5,
        riskAssessment,
        riskMetrics: riskAssessment,
        recommendation: {
          action: 'Quick Save',
          confidence: 0,
          rationale: 'This trade was saved without full analysis.',
          rating: 5
        },
        hasResearchData: false,
        quickSave: true
      }

      setTradeData(prev => [quickTrade, ...prev])
      saveToLocalStorage(STORAGE_KEYS.TRADE_DATA, [quickTrade, ...tradeData])
      alert(tradeStatus === 'executed' ? `${selectedSymbol} trade saved as EXECUTED!` : `${selectedSymbol} trade saved as PLANNED!`)
    }

    // Clear the form
    setSelectedSymbol('')
    setStrikePrice('')
    setExpirationDate('')
    setCurrentPrice('')
    setPremium('')
    setQuantity('1')
    setPriceError('')
    // Keep the date as is, user might be entering multiple historic trades
  }

  const handleAnalyze = async () => {
    if (!selectedSymbol || !strikePrice || !expirationDate || !currentPrice || !premium || !tradeDate) return

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

      // Create timestamp from selected trade date
      const timestamp = new Date(tradeDate)
      timestamp.setHours(12, 0, 0, 0)
      const timestampIso = timestamp.toISOString()

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
        timestamp: timestampIso,
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
      status: tradeStatus,
      // Execution date matches the trade date for consistency if executed immediately
      executionDate: tradeStatus === 'executed' ? analysis.timestamp : null
    }

    // Update the current analysis
    setAnalysis(savedTrade)

    // Update tradeData array - replace the current analysis with saved version
    const updatedTradeData = tradeData.map(trade =>
      trade.id === analysis.id ? savedTrade : trade
    )
    setTradeData(updatedTradeData)

    // Persist to localStorage
    saveToLocalStorage(STORAGE_KEYS.TRADE_DATA, updatedTradeData)
    setEditingId(null)

    // Show success message
    const message = tradeStatus === 'executed'
      ? `Trade for ${analysis.symbol} saved as EXECUTED!`
      : `Trade for ${analysis.symbol} saved as PLANNED!`
    alert(message)
  }

  const handleDeleteTrade = (tradeId) => {
    if (!confirm('Are you sure you want to delete this trade?')) return

    const updatedTradeData = tradeData.filter(trade => trade.id !== tradeId)
    setTradeData(updatedTradeData)
    saveToLocalStorage(STORAGE_KEYS.TRADE_DATA, updatedTradeData)

    // If we deleted the current analysis, clear it
    if (analysis && analysis.id === tradeId) {
      setAnalysis(null)
    }
    if (editingId === tradeId) {
      setEditingId(null)
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
    setQuantity((trade.quantity || 1).toString())

    // Set timestamp/date - check if it's a valid date string
    if (trade.timestamp) {
      try {
        setTradeDate(new Date(trade.timestamp).toISOString().split('T')[0])
      } catch (e) {
        console.error("Invalid date in trade:", trade.timestamp)
        setTradeDate(new Date().toISOString().split('T')[0])
      }
    }

    // Set the analysis to the trade so it can be updated
    setAnalysis(trade)
    setEditingId(trade.id)

    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleConvertToExecuted = (trade) => {
    if (!confirm('Convert this planned trade to executed? This will mark it as executed on the original trade date.')) return

    // Update the trade to executed status
    const executedTrade = {
      ...trade,
      executed: true,
      planned: false,
      status: 'executed',
      // Maintain original timestamp/trade date, just set execution date to same
      executionDate: trade.timestamp
    }

    // Update tradeData array
    const updatedTradeData = tradeData.map(t =>
      t.id === trade.id ? executedTrade : t
    )
    setTradeData(updatedTradeData)
    saveToLocalStorage(STORAGE_KEYS.TRADE_DATA, updatedTradeData)

    // If this is the current analysis, update it
    if (analysis && analysis.id === trade.id) {
      setAnalysis(executedTrade)
    }

    alert(`Trade for ${trade.symbol} converted to EXECUTED on ${formatDateDDMMYYYY(trade.timestamp)}.`)
  }

  const handleCloseTrade = (tradeId, result) => {
    const updatedTradeData = tradeData.map(t => {
      if (t.id === tradeId) {
        return {
          ...t,
          closed: true,
          result: result, // 'assigned' or 'worthless'
          closedAt: new Date().toISOString()
        }
      }
      return t
    })
    setTradeData(updatedTradeData)
    saveToLocalStorage(STORAGE_KEYS.TRADE_DATA, updatedTradeData)

    // If current analysis is this trade, update it
    if (analysis && analysis.id === tradeId) {
      setAnalysis({
        ...analysis,
        closed: true,
        result: result,
        closedAt: new Date().toISOString()
      })
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
    <div className="space-y-8 pb-12">
      {/* Trade Setup Form */}
      <div className="glass-card overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600/10 to-transparent p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xl font-black tracking-tight flex items-center">
            <Calculator className="h-6 w-6 mr-3 text-blue-400" />
            Trade Deployment Engine
          </h3>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Manual Entry Terminal</div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Symbol Selection */}
            <div className="space-y-3">
              <label className="block text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Stock Symbol</label>
              <div className="relative group">
                <input
                  type="text"
                  list="symbol-suggestions"
                  value={selectedSymbol}
                  onChange={(e) => handleSymbolChange(e.target.value.toUpperCase())}
                  onBlur={(e) => handleSymbolChange(e.target.value.toUpperCase())}
                  placeholder="E.G. NVDA"
                  className="glass-input w-full py-4 text-xl font-black placeholder:text-gray-700"
                />
                <datalist id="symbol-suggestions">
                  {availableSymbols.map(symbol => (
                    <option key={symbol} value={symbol} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Trade Type */}
            <div className="space-y-3">
              <label className="block text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Strategy Type</label>
              <select
                value={tradeType}
                onChange={(e) => setTradeType(e.target.value)}
                className="glass-input w-full py-4 font-bold appearance-none cursor-pointer"
              >
                <option value="cashSecuredPut">Cash-Secured Put</option>
                <option value="coveredCall">Covered Call</option>
              </select>
            </div>

            {/* Current Market Price */}
            <div className="space-y-3">
              <label className="block text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Spot Price ($)</label>
              <div className="relative group">
                <input
                  type="number"
                  step="0.01"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  placeholder="0.00"
                  className="glass-input w-full py-4 text-xl font-black"
                  disabled={fetchingPrice}
                />
                {fetchingPrice && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                  </div>
                )}
              </div>
            </div>

            {/* Strike Price */}
            <div className="space-y-3">
              <label className="block text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Strike Price ($)</label>
              <input
                type="number"
                step="0.01"
                value={strikePrice}
                onChange={(e) => setStrikePrice(e.target.value)}
                placeholder="0.00"
                className="glass-input w-full py-4 text-xl font-black text-blue-400"
              />
            </div>

            {/* Premium */}
            <div className="space-y-3">
              <label className="block text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Premium ($)</label>
              <input
                type="number"
                step="0.01"
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                placeholder="0.00"
                className="glass-input w-full py-4 text-xl font-black text-emerald-400"
              />
            </div>

            {/* Trade Entry Date */}
            <div className="space-y-3">
              <label className="block text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Trade Entry Date</label>
              <input
                type="date"
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
                className="glass-input w-full py-4 font-bold"
              />
            </div>

            {/* Expiration Date */}
            <div className="space-y-3">
              <label className="block text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Terminal Date</label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="glass-input w-full py-4 font-bold"
              />
            </div>
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

          {editingId && (
            <button
              onClick={() => {
                setEditingId(null)
                setSelectedSymbol('')
                setStrikePrice('')
                setExpirationDate('')
                setCurrentPrice('')
                setPremium('')
                setAnalysis(null)
              }}
              className="flex-1 min-w-[120px] flex items-center justify-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <span>Cancel Edit</span>
            </button>
          )}
        </div>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-4">
          {/* Trade Summary */}
          <div className="glass-card border-l-4 border-l-primary-500">
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
          <div className="glass-card">
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
                <div key={index} className={`p-3 rounded-lg ${factor.type === 'positive' ? 'bg-green-900 text-green-300' :
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
              <div className="mt-4 glass-item">
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
          <div className="glass-card">
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
                      <div key={idx} className="glass-item">
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
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-lg transition-colors"
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
                <div className="glass-card p-4 h-80 overflow-y-auto mb-4">
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
                      className={`flex items-start space-x-3 mb-4 ${msg.role === 'user' ? 'justify-end' : ''
                        }`}
                    >
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'assistant' ? 'bg-primary-600' : 'bg-gray-600'}`}>
                        {msg.role === 'assistant' ? (
                          <Bot className="h-5 w-5 text-white" />
                        ) : (
                          <User className="h-5 w-5 text-white" />
                        )}
                      </div>
                      <div className={`
                          flex-1 px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed
                          ${msg.role === 'assistant'
                          ? 'bg-[var(--inner-card-bg)] border border-white/5 text-[var(--text-primary)]'
                          : 'bg-blue-600/10 border border-blue-500/20 text-[var(--text-primary)]'}
                        `}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-white" />
                      </div>
                      <div className="glass-item">
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Trade Analysis History</h3>
            <button
              onClick={refreshTradePrices}
              disabled={loading}
              className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Update Prices</span>
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            {/* Filter Buttons */}
            <div className="flex space-x-2">
              {['all', 'planned', 'executed', 'expired'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setHistoryFilter(filter)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${historyFilter === filter
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-[var(--inner-card-bg)] text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text-primary)]'
                    }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Sorting Select */}
            <div className="flex items-center space-x-3">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-gray-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Newest First</option>
                <option value="symbol">Symbol (A-Z)</option>
                <option value="expiry">Days to Expiry</option>
                <option value="variance">Variance ($)</option>
                <option value="premium">Premium Amount</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {tradeData
              .filter(trade => {
                const daysLeft = Math.ceil((new Date(trade.expirationDate) - new Date()) / (1000 * 60 * 60 * 24))
                const isExpired = daysLeft < 0

                if (historyFilter === 'all') return true
                if (historyFilter === 'expired') return isExpired
                if (historyFilter === 'executed') return trade.status === 'executed' && !isExpired
                if (historyFilter === 'planned') return (trade.status === 'planned' || !trade.status) && !isExpired
                return true
              })
              .sort((a, b) => {
                switch (sortBy) {
                  case 'symbol':
                    return a.symbol.localeCompare(b.symbol)
                  case 'expiry':
                    const daysA = Math.ceil((new Date(a.expirationDate) - new Date()) / (1000 * 60 * 60 * 24))
                    const daysB = Math.ceil((new Date(b.expirationDate) - new Date()) / (1000 * 60 * 60 * 24))
                    return daysA - daysB
                  case 'variance':
                    const varA = (a.currentMarketPrice || a.stockPrice) - a.strikePrice
                    const varB = (b.currentMarketPrice || b.stockPrice) - b.strikePrice
                    return varB - varA // Higher variance first
                  case 'premium':
                    return (b.premium * (b.quantity || 1)) - (a.premium * (a.quantity || 1))
                  default: // newest
                    return new Date(b.timestamp) - new Date(a.timestamp)
                }
              })
              .map((trade, index) => {
                const displayPrice = trade.currentMarketPrice || trade.stockPrice
                const priceDiff = displayPrice - trade.strikePrice
                const daysLeft = Math.ceil((new Date(trade.expirationDate) - new Date()) / (1000 * 60 * 60 * 24))
                const isExpired = daysLeft < 0

                return (
                  <div key={index} className={`p-4 rounded-lg transition-all ${trade.closed ? 'opacity-50 grayscale bg-gray-900/40 border border-white/5' :
                    isExpired ? 'bg-orange-900/10 border border-orange-500/20' :
                      trade.status === 'executed' ? 'bg-green-900/20 border border-green-700/30' :
                        trade.status === 'planned' ? 'bg-blue-900/20 border border-blue-700/30' :
                          'bg-gray-700'
                    }`}>
                    {/* Top Row: Symbol, Type, and Status */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center">
                        <CompanyLogo symbol={trade.symbol} className="w-10 h-10 mr-3" />
                        <h4 className="font-semibold text-lg flex items-center flex-wrap gap-2">
                          <span>{trade.symbol} {trade.tradeType === 'cashSecuredPut' ? 'Cash-Secured Put' : 'Covered Call'}</span>

                          {/* Status Badges moved here */}
                          {isExpired && (
                            <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded border border-gray-600">
                              EXPIRED
                            </span>
                          )}
                          {trade.status === 'executed' && !isExpired && (
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
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${getRecommendationColor(trade.recommendation.action)}`}>
                            {trade.recommendation.action}
                          </span>

                          <div className="flex items-center space-x-2 ml-2 hidden md:flex">
                            <div className="flex flex-col text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">
                              {trade.status === 'executed' ? 'Executed' : 'Planned'}: <span className="text-[var(--text-primary)] ml-1 font-black">{formatDateDDMMYYYY(trade.status === 'executed' ? trade.executionDate : trade.timestamp)}</span>
                            </div>
                            <div className="flex flex-col text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">
                              Expires: <span className="text-[var(--text-primary)] ml-1 font-black">{formatDateDDMMYYYY(trade.expirationDate)}</span>
                            </div>
                            {trade.closed && (
                              <span className={`px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-widest ${trade.result === 'assigned' ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'}`}>
                                Result: {trade.result}
                              </span>
                            )}
                          </div>
                        </h4>
                      </div>
                      <div className="flex items-center space-x-2">
                        {isExpired && !trade.closed && (
                          <div className="flex items-center space-x-2 mr-2">
                            <button
                              onClick={() => handleCloseTrade(trade.id, 'worthless')}
                              className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-black uppercase tracking-widest transition-colors"
                            >
                              Expired Worthless
                            </button>
                            <button
                              onClick={() => handleCloseTrade(trade.id, 'assigned')}
                              className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 rounded text-[10px] font-black uppercase tracking-widest transition-colors"
                            >
                              Assigned Stock
                            </button>
                          </div>
                        )}
                        <div className="flex items-center space-x-2 mr-2">
                          {!trade.closed && (
                            <button
                              onClick={() => handleEditTrade(trade)}
                              className={`p-2 rounded-lg transition-colors ${editingId === trade.id ? 'bg-blue-600 text-white' : 'hover:bg-blue-500/10 text-blue-400'}`}
                              title="Edit trade"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {trade.status === 'planned' && !trade.closed && (
                            <button
                              onClick={() => handleConvertToExecuted(trade)}
                              className="p-2 hover:bg-green-900/50 rounded-lg transition-colors"
                              title="Convert to executed trade"
                            >
                              <CheckCircle className="h-4 w-4 text-green-400" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteTrade(trade.id)}
                            className="p-2 hover:bg-red-900/50 rounded-lg transition-colors"
                            title="Delete trade"
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Trade Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="flex flex-col items-center p-3 bg-white/5 rounded-xl border border-white/5">
                        <span className="text-[10px] text-[var(--text-secondary)] uppercase font-black tracking-widest mb-1">Current Price</span>
                        <div className="text-lg font-black text-[var(--text-primary)] font-mono leading-none">
                          ${displayPrice.toFixed(2)}
                        </div>
                      </div>
                      <div className="flex flex-col items-center p-3 bg-white/5 rounded-xl border border-white/5">
                        <span className="text-[10px] text-[var(--text-secondary)] uppercase font-black tracking-widest mb-1">Strike</span>
                        <div className="text-lg font-black text-[var(--text-primary)] font-mono leading-none">${trade.strikePrice?.toFixed(2)}</div>
                      </div>
                      <div className="glass-item">
                        <div className="text-xs text-gray-400 mb-1">Variance</div>
                        <div className={`text-lg font-bold ${priceDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${priceDiff.toFixed(2)}
                          <span className="text-xs ml-1 opacity-70">
                            ({((priceDiff / trade.strikePrice) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      <div className="glass-item">
                        <div className="text-xs text-gray-400 mb-1">Premium</div>
                        <div className="text-lg font-bold text-emerald-400">${trade.premium?.toFixed(2)}</div>
                      </div>
                      <div className="glass-item">
                        <div className="text-xs text-gray-400 mb-1">Days Left</div>
                        <div className="text-lg font-bold text-blue-400">
                          {Math.ceil((new Date(trade.expirationDate) - new Date()) / (1000 * 60 * 60 * 24))}d
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )
      }
    </div >
  )
}

export default TradeReview
