import { authHeaders } from '../utils/auth.js'
import { useState, useRef, useEffect } from 'react'
import { fetchPrice, fetchPrices } from '../services/priceService'
import { Calculator, TrendingUp, AlertTriangle, CheckCircle, DollarSign, Save, Trash2, Edit, Edit2, MessageCircle, Send, Bot, User, ChevronDown, ChevronUp, Loader, RefreshCw, Sparkles } from 'lucide-react'
import LargeTitle from './ui/LargeTitle'
import { calculateOptionGreeks, assessTradeRisk, generateTradeRecommendation } from '../utils/optionsCalculations'
import { saveToLocalStorage, STORAGE_KEYS } from '../utils/storage'
import CompanyLogo from './CompanyLogo'
import EarningsBadge from "./EarningsBadge"
import { fetchEarningsDates } from "../services/earningsService"

// Helper function to format dates as DD/MM/YYYY
const formatDateDDMMYYYY = (dateString) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = date.toLocaleString('default', { month: 'short' }).toUpperCase()
  const year = date.getFullYear()
  return `${day} ${month} ${year}`
}

function TradeReview({ tradeData, setTradeData, portfolioSettings, researchData, stockData, setStockData }) {
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
  const [historyFilter, setHistoryFilter] = useState(() => localStorage.getItem('trades_filter') || 'executed')
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('trades_sort') || 'variance')
  const [editingId, setEditingId] = useState(null)
  const [earningsDates, setEarningsDates] = useState({})

  // After setting prices, also fetch earnings
  useEffect(() => {
    const activeTrades = tradeData.filter(t => !t.closed)
    if (!activeTrades || activeTrades.length === 0) return
    const symbols = [...new Set(activeTrades.map(t => t.symbol).filter(Boolean))]
    fetchEarningsDates(symbols).then(dates => setEarningsDates(dates))
  }, [tradeData])

  // Feature: per-trade notes
  const [notes, setNotes] = useState('')

  // Feature: fees per trade
  const [fees, setFees] = useState('0.65')

  // Feature: roll tracking
  const [isRoll, setIsRoll] = useState(false)
  const [rolledFromId, setRolledFromId] = useState('')
  const [buybackCost, setBuybackCost] = useState('')   // per-share price paid to close old contract
  const [buybackFees, setBuybackFees] = useState('0.65') // commission on the buyback leg

  // Feature: expanded notes cards
  const [expandedNotes, setExpandedNotes] = useState(new Set())

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
        headers: authHeaders(),
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

  // Fetch current market price via Yahoo Finance (client-side)
  const getPrice = async (symbol) => {
    try {
      const price = await fetchPrice(symbol)
      return price != null ? price.toString() : null
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

    // Batch fetch all prices at once via Yahoo Finance
    const priceMap = await fetchPrices(uniqueSymbols)

    // Update trade data
    const updatedTradeData = tradeData.map(trade => {
      const price = priceMap[trade.symbol?.toUpperCase()]
      if (price != null) {
        return {
          ...trade,
          currentMarketPrice: price,
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
        const priceMap = await fetchPrices(uniqueSymbols)

        const updatedTradeData = tradeData.map(trade => {
          const price = priceMap[trade.symbol?.toUpperCase()]
          if (price != null) {
            return { ...trade, currentMarketPrice: price, lastPriceUpdate: new Date().toISOString() }
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
    const tradeFees = parseFloat(fees) || 0
    const bbCost = isRoll ? (parseFloat(buybackCost) || 0) : 0
    const bbFees = isRoll ? (parseFloat(buybackFees) || 0) : 0
    const netPremium = (prem * qty * 100) - tradeFees - (bbCost * qty * 100) - bbFees

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
        quickSave: true,
        notes: notes.trim() || null,
        rolledFromId: isRoll && rolledFromId ? rolledFromId : null,
        fees: tradeFees,
        buybackCost: bbCost,
        buybackFees: bbFees,
        netPremium,
      }

      // If this is a roll, auto-close the source trade
      let baseData = isRoll && rolledFromId
        ? tradeData.map(t => String(t.id) === String(rolledFromId)
            ? { ...t, closed: true, closedAt: new Date().toISOString(), closedReason: 'Rolled', result: 'rolled' }
            : t)
        : tradeData

      setTradeData([quickTrade, ...baseData])
      saveToLocalStorage(STORAGE_KEYS.TRADE_DATA, [quickTrade, ...baseData])
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
    setNotes('')
    setFees('0.65')
    setIsRoll(false)
    setRolledFromId('')
    setBuybackCost('')
    setBuybackFees('0.65')
    // Keep the date as is, user might be entering multiple historic trades
  }

  // Save as planned AND run AI analysis in background — attaches review to trade card
  const handleSavePlannedAnalyzed = async () => {
    if (!selectedSymbol || !strikePrice || !expirationDate || !currentPrice || !premium || !tradeDate || !quantity) {
      alert('Please fill in all required fields before saving.')
      return
    }

    const sPrice = parseFloat(currentPrice)
    const stPrice = parseFloat(strikePrice)
    const prem = parseFloat(premium)
    const qty = parseInt(quantity) || 1
    const tradeFees2 = parseFloat(fees) || 0
    const bbCost2 = isRoll ? (parseFloat(buybackCost) || 0) : 0
    const bbFees2 = isRoll ? (parseFloat(buybackFees) || 0) : 0
    const netPremium2 = (prem * qty * 100) - tradeFees2 - (bbCost2 * qty * 100) - bbFees2
    const timestamp = new Date(tradeDate)
    timestamp.setHours(12, 0, 0, 0)
    const timestampIso = timestamp.toISOString()
    const tradeId = Date.now()

    // Save immediately with a pending indicator
    const baseTrade = {
      id: tradeId,
      symbol: selectedSymbol.toUpperCase(),
      tradeType, type: tradeType, optionType,
      strikePrice: stPrice, expirationDate,
      stockPrice: sPrice, premium: prem, quantity: qty,
      closed: false, executed: false, planned: true, status: 'planned',
      timestamp: timestampIso, executionDate: null,
      rating: 5,
      riskAssessment: { overallRisk: 'Medium', maxLoss: stPrice * 100, factors: [] },
      riskMetrics: { overallRisk: 'Medium', maxLoss: stPrice * 100, factors: [] },
      recommendation: { action: 'Analyzing…', confidence: 0, rationale: 'AI review in progress…', rating: 5 },
      hasResearchData: false, aiReviewPending: true, aiReviewed: false,
      notes: notes.trim() || null,
      rolledFromId: isRoll && rolledFromId ? rolledFromId : null,
      fees: tradeFees2,
      buybackCost: bbCost2,
      buybackFees: bbFees2,
      netPremium: netPremium2,
    }

    // If this is a roll, auto-close the source trade first
    let baseData = isRoll && rolledFromId
      ? tradeData.map(t => String(t.id) === String(rolledFromId)
          ? { ...t, closed: true, closedAt: new Date().toISOString(), closedReason: 'Rolled', result: 'rolled' }
          : t)
      : tradeData

    const newData = [baseTrade, ...baseData]
    setTradeData(newData)
    saveToLocalStorage(STORAGE_KEYS.TRADE_DATA, newData)

    // Clear form
    setSelectedSymbol('')
    setStrikePrice('')
    setExpirationDate('')
    setCurrentPrice('')
    setPremium('')
    setQuantity('1')
    setPriceError('')
    setNotes('')
    setFees('0.65')
    setIsRoll(false)
    setRolledFromId('')
    setBuybackCost('')
    setBuybackFees('0.65')

    // Run analysis in background
    setLoading(true)
    try {
      const companyData = researchData.find(item => item.symbol === selectedSymbol.toUpperCase())
      const volatility = companyData?.technicalAnalysis?.rating || 5
      const companyRating = companyData?.overallRating || 5
      const greeks = calculateOptionGreeks(sPrice, stPrice, new Date(expirationDate), optionType, 0.02, volatility)

      let earningsAndEvents = null
      try {
        const r = await fetch('/api/scrape/earnings-events', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ symbol: selectedSymbol.toUpperCase(), expirationDate })
        })
        if (r.ok) earningsAndEvents = await r.json()
      } catch (e) { console.error('Earnings fetch:', e) }

      const riskAssessment = assessTradeRisk(tradeType, sPrice, stPrice, greeks, portfolioSettings, earningsAndEvents)
      const recommendation = generateTradeRecommendation(tradeType, greeks, riskAssessment, companyRating, portfolioSettings, {
        premium: prem, stockPrice: sPrice, strikePrice: stPrice,
        daysToExpiration: Math.ceil((new Date(expirationDate) - new Date()) / (1000 * 60 * 60 * 24)),
        earningsAndEvents
      })

      const analyzedTrade = {
        ...baseTrade,
        rating: recommendation.rating,
        riskAssessment, riskMetrics: riskAssessment,
        recommendation, earningsAndEvents,
        companyRating, hasResearchData: !!companyData,
        aiReviewPending: false, aiReviewed: true
      }

      setTradeData(prev => {
        const updated = prev.map(t => t.id === tradeId ? analyzedTrade : t)
        saveToLocalStorage(STORAGE_KEYS.TRADE_DATA, updated)
        return updated
      })
    } catch (error) {
      console.error('AI review error:', error)
      setTradeData(prev => {
        const updated = prev.map(t => t.id === tradeId ? { ...t, aiReviewPending: false, aiReviewFailed: true } : t)
        saveToLocalStorage(STORAGE_KEYS.TRADE_DATA, updated)
        return updated
      })
    } finally {
      setLoading(false)
    }
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
      case 'Low': return 'text-emerald-400'
      case 'Medium': return 'text-yellow-400'
      case 'High': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getRiskIcon = (level) => {
    switch (level) {
      case 'Low': return <CheckCircle className="h-5 w-5 text-emerald-400" />
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
      executionDate: tradeStatus === 'executed' ? analysis.timestamp : null,
      notes: analysis.notes ?? (notes.trim() || null),
      rolledFromId: analysis.rolledFromId ?? (isRoll && rolledFromId ? rolledFromId : null),
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

    // Restore notes, fees and roll state
    setNotes(trade.notes || '')
    setFees((trade.fees != null ? trade.fees : 0.65).toString())
    setIsRoll(!!trade.rolledFromId)
    setRolledFromId(trade.rolledFromId ? String(trade.rolledFromId) : '')
    setBuybackCost(trade.buybackCost ? trade.buybackCost.toString() : '')
    setBuybackFees((trade.buybackFees != null ? trade.buybackFees : 0.65).toString())

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
    const trade = tradeData.find(t => t.id === tradeId)

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

    // Handle stock portfolio updates on assignment
    if (result === 'assigned' && trade && setStockData && stockData) {
      const optionType = (trade.optionType || trade.tradeType || '').toLowerCase()
      const isPut = optionType.includes('put')
      const isCall = optionType.includes('call')
      const shares = (trade.quantity || 1) * 100
      const assignDate = trade.expirationDate || new Date().toISOString().split('T')[0]

      if (isPut) {
        // Put assignment: receive shares at strike price
        const newStock = {
          id: Date.now(),
          dateAssigned: assignDate,
          symbol: trade.symbol,
          shares: shares,
          assignedPrice: trade.strikePrice,
          dateSold: '',
          soldPrice: '',
          currentPrice: trade.currentMarketPrice || '',
          lastPriceUpdate: trade.lastPriceUpdate || null,
        }
        const updated = [newStock, ...stockData]
        setStockData(updated)
        alert(`📈 ${shares} shares of ${trade.symbol} added to Stock Portfolio at $${trade.strikePrice} (assigned from put).`)
      } else if (isCall) {
        // Call assignment: shares called away at strike price — sell lowest-cost lot first
        const unsoldLots = stockData
          .filter(s => s.symbol === trade.symbol && !s.soldPrice && !s.dateSold)
          .sort((a, b) => (parseFloat(a.assignedPrice) || 0) - (parseFloat(b.assignedPrice) || 0))

        if (unsoldLots.length === 0) {
          alert(`⚠️ No unsold ${trade.symbol} stock found to sell. Trade closed as assigned but no stock entry was updated.`)
          return
        }

        let sharesToSell = shares
        const updatedStockData = stockData.map(s => {
          if (sharesToSell <= 0) return s
          if (s.symbol !== trade.symbol || s.soldPrice || s.dateSold) return s
          // Check if this is the next cheapest lot
          if (unsoldLots.find(lot => lot.id === s.id) && sharesToSell > 0) {
            const lotShares = parseFloat(s.shares) || 0
            const sellShares = Math.min(lotShares, sharesToSell)
            sharesToSell -= sellShares
            const costBasis = parseFloat(s.assignedPrice) || 0
            const pnl = (trade.strikePrice - costBasis) * sellShares
            return {
              ...s,
              soldPrice: String(trade.strikePrice),
              dateSold: assignDate,
              stockPnL: pnl,
            }
          }
          return s
        })

        setStockData(updatedStockData)
        const soldCount = shares - sharesToSell
        alert(`📉 ${soldCount} shares of ${trade.symbol} sold at $${trade.strikePrice} (called away).${sharesToSell > 0 ? ` ⚠️ ${sharesToSell} shares could not be matched to a stock lot.` : ''}`)
      }
    }
  }

  const getRecommendationColor = (action) => {
    switch (action) {
      case 'Strong Buy': return 'text-emerald-400 bg-emerald-500/15'
      case 'Buy': return 'text-emerald-400 bg-emerald-500/15'
      case 'Hold': return 'text-yellow-400 bg-amber-500/15'
      case 'Sell': return 'text-red-400 bg-rose-500/15'
      case 'Strong Sell': return 'text-red-400 bg-rose-500/15'
      default: return 'text-gray-400 bg-gray-900'
    }
  }

  return (
    <div className="space-y-8 pb-12">

      <LargeTitle title="Trade Log" subtitle="Log, analyze, and review your options trades." />

      {/* Log Trade Form */}
      <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <Calculator className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white/90">{editingId ? 'Edit Trade' : 'Log Trade'}</h3>
              <p className="text-[11px] text-white/40 mt-0.5">Analyze, save planned, or record an executed trade</p>
            </div>
          </div>
        </div>

        {/* Form fields */}
        <div className="p-5">
          {/* Strategy toggle — replaces broken native select */}
          <div className="mb-4">
            <label className="block text-[11px] font-medium text-white/40 mb-2">Strategy</label>
            <div className="flex rounded-xl bg-white/[0.06] border border-white/[0.10] p-1 gap-1 w-fit">
              <button
                onClick={() => setTradeType('cashSecuredPut')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tradeType === 'cashSecuredPut' ? 'bg-blue-500 text-white' : 'text-white/40 hover:text-white/70'}`}
              >
                Cash-Secured Put
              </button>
              <button
                onClick={() => setTradeType('coveredCall')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tradeType === 'coveredCall' ? 'bg-blue-500 text-white' : 'text-white/40 hover:text-white/70'}`}
              >
                Covered Call
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
            {/* Symbol */}
            <div className="col-span-2 md:col-span-1 lg:col-span-1 space-y-2">
              <label className="block text-[11px] font-medium text-white/40">Symbol</label>
              <div className="relative">
                <input
                  type="text"
                  list="symbol-suggestions"
                  value={selectedSymbol}
                  onChange={(e) => handleSymbolChange(e.target.value.toUpperCase())}
                  onBlur={(e) => handleSymbolChange(e.target.value.toUpperCase())}
                  placeholder="NVDA"
                  className="bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-3 text-base font-semibold text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all w-full"
                />
                <datalist id="symbol-suggestions">
                  {availableSymbols.map(symbol => (
                    <option key={symbol} value={symbol} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Market Price */}
            <div className="space-y-2">
              <label className="block text-[11px] font-medium text-white/40">Market Price ($)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  placeholder="0.00"
                  className="bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-3 text-base font-semibold text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all w-full"
                  disabled={fetchingPrice}
                />
                {fetchingPrice && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Strike Price */}
            <div className="space-y-2">
              <label className="block text-[11px] font-medium text-white/40">Strike Price ($)</label>
              <input
                type="number"
                step="0.01"
                value={strikePrice}
                onChange={(e) => setStrikePrice(e.target.value)}
                placeholder="0.00"
                className="bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-3 text-base font-semibold text-blue-400 placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all w-full"
              />
            </div>

            {/* Premium */}
            <div className="space-y-2">
              <label className="block text-[11px] font-medium text-white/40">Premium ($)</label>
              <input
                type="number"
                step="0.01"
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                placeholder="0.00"
                className="bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-3 text-base font-semibold text-emerald-400 placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all w-full"
              />
            </div>

            {/* Entry Date */}
            <div className="space-y-2">
              <label className="block text-[11px] font-medium text-white/40">Entry Date</label>
              <input
                type="date"
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
                className="bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all w-full"
              />
            </div>

            {/* Expiry Date */}
            <div className="space-y-2">
              <label className="block text-[11px] font-medium text-white/40">Expiry Date</label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all w-full"
              />
            </div>

            {/* Fees */}
            <div className="space-y-2">
              <label className="block text-[11px] font-medium text-white/40">Fees ($)</label>
              <input
                type="number"
                step="0.01"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                placeholder="0.65"
                className="bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-3 text-base font-semibold text-amber-400 placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all w-full"
              />
            </div>
          </div>

          {priceError && (
            <p className="mt-2 text-[11px] text-amber-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {priceError}
            </p>
          )}

          {/* Roll tracking */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setIsRoll(v => !v); if (isRoll) setRolledFromId('') }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
                  isRoll
                    ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
                    : 'bg-white/[0.06] border-white/[0.10] text-white/40 hover:text-white/60'
                }`}
              >
                🔄 Rolling an existing position?
              </button>
            </div>
            {isRoll && (
              <div className="space-y-3">
                <select
                  value={rolledFromId}
                  onChange={e => setRolledFromId(e.target.value)}
                  className="bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-all w-full max-w-md dark:[color-scheme:dark]"
                >
                  <option value="">— Select position being rolled —</option>
                  {tradeData.filter(t => t.executed && !t.closed).map(t => (
                    <option key={t.id} value={String(t.id)}>
                      {t.symbol} — ${t.strikePrice?.toFixed(2)} — {t.expirationDate}
                    </option>
                  ))}
                </select>
                {/* Buyback cost fields */}
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-rose-400/80">Buyback Price ($/share)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={buybackCost}
                      onChange={e => setBuybackCost(e.target.value)}
                      placeholder="e.g. 0.15"
                      className="bg-white/[0.06] border border-rose-500/20 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-400 placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition-all w-full"
                    />
                    <p className="text-[10px] text-white/25">Price you paid per share to close old contract</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-rose-400/80">Buyback Fees ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={buybackFees}
                      onChange={e => setBuybackFees(e.target.value)}
                      placeholder="0.65"
                      className="bg-white/[0.06] border border-rose-500/20 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-400 placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition-all w-full"
                    />
                    <p className="text-[10px] text-white/25">Commission on the buyback trade</p>
                  </div>
                </div>
                {/* Live net preview */}
                {premium && (
                  <div className="max-w-md px-3 py-2 bg-cyan-500/[0.06] border border-cyan-500/15 rounded-xl">
                    <div className="text-[11px] text-white/40 mb-1">Roll net preview</div>
                    <div className="flex items-center gap-2 text-[12px] font-mono flex-wrap">
                      <span className="text-emerald-400">+${(parseFloat(premium || 0) * (parseInt(quantity) || 1) * 100).toFixed(0)} new</span>
                      {buybackCost && <><span className="text-white/30">−</span><span className="text-rose-400">${(parseFloat(buybackCost || 0) * (parseInt(quantity) || 1) * 100).toFixed(0)} buyback</span></>}
                      <span className="text-white/30">−</span><span className="text-amber-400">${((parseFloat(fees || 0)) + (buybackCost ? parseFloat(buybackFees || 0) : 0)).toFixed(2)} fees</span>
                      <span className="text-white/30">=</span>
                      <span className={`font-semibold ${
                        (parseFloat(premium || 0) * (parseInt(quantity) || 1) * 100) - (parseFloat(buybackCost || 0) * (parseInt(quantity) || 1) * 100) - (parseFloat(fees || 0)) - (buybackCost ? parseFloat(buybackFees || 0) : 0) >= 0
                          ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        ${((parseFloat(premium || 0) * (parseInt(quantity) || 1) * 100) - (parseFloat(buybackCost || 0) * (parseInt(quantity) || 1) * 100) - (parseFloat(fees || 0)) - (buybackCost ? parseFloat(buybackFees || 0) : 0)).toFixed(2)} net
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Trade notes */}
          <div className="mt-4 space-y-1.5">
            <label className="block text-[11px] font-medium text-white/40">Trade Notes <span className="text-white/20 font-normal">(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Why did you take this trade? What was your thesis?"
              rows={2}
              className="bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all w-full resize-none"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
          <button
            onClick={handleAnalyze}
            disabled={loading || !selectedSymbol || !strikePrice || !expirationDate || !currentPrice || !premium}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Calculator className="h-4 w-4" />}
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>

          <button
            onClick={handleSavePlannedAnalyzed}
            disabled={loading || !selectedSymbol || !strikePrice || !expirationDate || !currentPrice || !premium}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.10] text-white/70 rounded-full text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles className="h-4 w-4" />
            Save Planned
          </button>

          <button
            onClick={() => handleQuickSave('executed')}
            disabled={loading || !selectedSymbol || !strikePrice || !expirationDate || !currentPrice || !premium}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-full text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle className="h-4 w-4" />
            Save Executed
          </button>

          {editingId && (
            <button
              onClick={() => { setEditingId(null); setSelectedSymbol(''); setStrikePrice(''); setExpirationDate(''); setCurrentPrice(''); setPremium(''); setAnalysis(null); setNotes(''); setIsRoll(false); setRolledFromId('') }}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/40 rounded-full text-sm font-medium transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-4">
          {/* Trade Summary */}
          <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-5 border-l-4 border-l-primary-500">
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
                      className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-5 py-2 font-semibold text-sm transition-all flex items-center space-x-2"
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
                  <div className="flex items-center space-x-2 text-emerald-400">
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
          <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-5">
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
                <DollarSign className="h-5 w-5 text-emerald-400" />
                <div>
                  <div className="font-semibold text-emerald-400">
                    ${(analysis.riskAssessment.maxLoss || 0).toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-400">Maximum Loss</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {analysis.riskAssessment.factors?.map((factor, index) => (
                <div key={index} className={`p-3 rounded-lg ${factor.type === 'positive' ? 'bg-emerald-500/15 text-emerald-400' :
                  factor.type === 'warning' ? 'bg-amber-500/15 text-amber-400' :
                    factor.type === 'info' ? 'bg-blue-900 text-blue-300' :
                      'bg-rose-500/15 text-rose-400'
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
              <div className="mt-4 bg-white/[0.05] border border-white/[0.06] rounded-xl px-3 py-2">
                <h5 className="font-medium mb-2">Market Sentiment</h5>
                <p className="text-sm text-gray-300 mb-2">{analysis.earningsAndEvents.marketSentiment.description}</p>
                <ul className="space-y-1">
                  {analysis.earningsAndEvents.marketSentiment.factors.map((factor, idx) => (
                    <li key={idx} className="text-xs text-gray-400 flex items-start">
                      <span className="text-blue-500 mr-2">•</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Recommendation */}
          <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-5">
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
                    if (title && title.includes('STRONG BUY')) cardColor = 'bg-emerald-500/15 border-l-4 border-emerald-500'
                    else if (title && title.includes('BUY')) cardColor = 'bg-emerald-500/15/50 border-l-4 border-emerald-600'
                    else if (title && title.includes('AVOID')) cardColor = 'bg-rose-500/15/50 border-l-4 border-red-600'
                    else if (title && title.includes('HOLD')) cardColor = 'bg-amber-500/15/50 border-l-4 border-yellow-600'

                    return (
                      <div key={idx} className={`p-4 rounded-lg ${cardColor}`}>
                        {title && (
                          <h6 className="font-semibold text-sm mb-2 text-blue-300">{title}</h6>
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
                      <li key={index} className="text-sm text-amber-400 flex items-start">
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
                      <div key={idx} className="bg-white/[0.05] border border-white/[0.06] rounded-xl px-3 py-2">
                        <h6 className="font-medium text-blue-400 mb-2">{section.category}</h6>
                        <ul className="space-y-1">
                          {section.items.map((item, itemIdx) => (
                            <li key={itemIdx} className="text-xs text-gray-300 flex items-start">
                              <span className="text-blue-500 mr-2">•</span>
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
          <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-5">
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <MessageCircle className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-semibold">Ask Questions About This Trade</h3>
              </div>
              {chatOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>

            {chatOpen && (
              <div className="px-4 pb-4">
                {/* Chat Messages */}
                <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-5 p-4 h-80 overflow-y-auto mb-4">
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
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'assistant' ? 'bg-blue-600' : 'bg-gray-600'}`}>
                        {msg.role === 'assistant' ? (
                          <Bot className="h-5 w-5 text-white" />
                        ) : (
                          <User className="h-5 w-5 text-white" />
                        )}
                      </div>
                      <div className={`
                          flex-1 px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed
                          ${msg.role === 'assistant'
                          ? 'bg-white/[0.04] border border-white/5 text-white/85'
                          : 'bg-blue-600/10 border border-blue-500/20 text-white/85'}
                        `}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-white" />
                      </div>
                      <div className="bg-white/[0.05] border border-white/[0.06] rounded-xl px-3 py-2">
                        <Loader className="h-5 w-5 animate-spin text-blue-400" />
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
                    className="bg-white/[0.06] border border-white/[0.10] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all flex-1"
                    disabled={chatLoading}
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-5 py-2 font-semibold text-sm transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
      {tradeData.length > 0 && (() => {
        const filterTrade = (trade) => {
          const daysLeft = Math.ceil((new Date(trade.expirationDate) - new Date()) / (1000 * 60 * 60 * 24))
          const isExpired = daysLeft < 0
          if (historyFilter === 'all') return true
          if (historyFilter === 'expired') return isExpired
          if (historyFilter === 'executed') return trade.status === 'executed' && !isExpired
          if (historyFilter === 'planned') return (trade.status === 'planned' || !trade.status) && !isExpired
          return true
        }

        const getVarStatus = (trade) => {
          const dp = trade.currentMarketPrice || trade.stockPrice
          const diff = dp - trade.strikePrice
          const pct = (diff / trade.strikePrice) * 100
          const isCSP = trade.tradeType === 'cashSecuredPut'
          const isAtRisk = isCSP ? diff < 0 : diff > 0
          const isWatch = isCSP ? (diff >= 0 && pct < 5) : (diff <= 0 && Math.abs(pct) < 5)
          return { diff, pct, isAtRisk, isWatch }
        }

        const handleFilterChange = (f) => {
          setHistoryFilter(f)
          localStorage.setItem('trades_filter', f)
        }
        const handleSortChange = (s) => {
          setSortBy(s)
          localStorage.setItem('trades_sort', s)
        }

        const counts = {
          all: tradeData.length,
          executed: tradeData.filter(t => t.status === 'executed' && Math.ceil((new Date(t.expirationDate) - new Date()) / 86400000) >= 0).length,
          planned: tradeData.filter(t => (t.status === 'planned' || !t.status) && Math.ceil((new Date(t.expirationDate) - new Date()) / 86400000) >= 0).length,
          expired: tradeData.filter(t => Math.ceil((new Date(t.expirationDate) - new Date()) / 86400000) < 0).length,
        }

        const filtered = tradeData.filter(filterTrade).sort((a, b) => {
          switch (sortBy) {
            case 'symbol': return a.symbol.localeCompare(b.symbol)
            case 'expiry':
              return Math.ceil((new Date(a.expirationDate) - new Date()) / 86400000) - Math.ceil((new Date(b.expirationDate) - new Date()) / 86400000)
            case 'variance':
              const vA = getVarStatus(a), vB = getVarStatus(b)
              return Math.abs(vA.pct) > Math.abs(vB.pct) ? -1 : 1
            case 'premium':
              return (b.premium * (b.quantity || 1)) - (a.premium * (a.quantity || 1))
            default: return new Date(b.timestamp) - new Date(a.timestamp)
          }
        })

        return (
          <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-2xl overflow-hidden">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white/90">Trade History</h3>
                    <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[11px] font-medium text-white/40">{tradeData.length}</span>
                  </div>
                  <p className="text-[11px] text-white/40 mt-0.5">Executed trades sorted by risk exposure · tap card to edit</p>
                </div>
              </div>
              <button onClick={refreshTradePrices} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-[11px] font-medium rounded-full disabled:opacity-30 transition-all self-start sm:self-auto">
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                Update Prices
              </button>
            </div>

            {/* Filter + Sort toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-2.5 bg-white/[0.02] border-b border-white/[0.04]">
              {/* Filter pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                {[
                  { key: 'executed', label: 'Executed' },
                  { key: 'planned', label: 'Planned' },
                  { key: 'all', label: 'All' },
                  { key: 'expired', label: 'Expired' },
                ].map(f => (
                  <button key={f.key} onClick={() => handleFilterChange(f.key)}
                    className={`flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all whitespace-nowrap ${
                      historyFilter === f.key ? 'bg-blue-500 text-white' : 'bg-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.10] border border-white/[0.08]'
                    }`}>
                    {f.label}
                    <span className={`text-[9px] px-1 py-0.5 rounded-full ${historyFilter === f.key ? 'bg-white/20' : 'bg-white/[0.08]'}`}>{counts[f.key]}</span>
                  </button>
                ))}
              </div>
              {/* Sort pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-shrink-0">
                {[
                  { key: 'variance', label: 'Risk' },
                  { key: 'expiry', label: 'Expiry' },
                  { key: 'newest', label: 'Recent' },
                  { key: 'premium', label: 'Premium' },
                  { key: 'symbol', label: 'A–Z' },
                ].map(s => (
                  <button key={s.key} onClick={() => handleSortChange(s.key)}
                    className={`flex-none flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all whitespace-nowrap ${
                      sortBy === s.key ? 'bg-white/[0.10] text-white/80 border border-white/[0.15]' : 'text-white/30 hover:text-white/50'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Trade Cards */}
            <div className="divide-y divide-white/[0.04]">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-white/30 text-sm">No trades in this view</div>
              ) : filtered.map((trade, index) => {
                const displayPrice = trade.currentMarketPrice || trade.stockPrice
                const daysLeft = Math.ceil((new Date(trade.expirationDate) - new Date()) / (1000 * 60 * 60 * 24))
                const isExpired = daysLeft < 0
                const varStatus = getVarStatus(trade)
                const isExecuted = trade.status === 'executed'
                const totalPremium = trade.premium * (trade.quantity || 1) * 100

                return (
                  <div key={index} className={`transition-all ${trade.closed ? 'opacity-40' : ''}`}>
                    {/* Assignment risk top stripe for executed trades */}
                    {isExecuted && !trade.closed && !isExpired && (
                      <div className={`h-0.5 ${varStatus.isAtRisk ? 'bg-gradient-to-r from-rose-500 to-transparent' : varStatus.isWatch ? 'bg-gradient-to-r from-amber-500 to-transparent' : 'bg-gradient-to-r from-emerald-500/40 to-transparent'}`} />
                    )}

                    <div className="px-5 py-4">
                      {/* Card Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <CompanyLogo symbol={trade.symbol} className="w-9 h-9" />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-base text-white/90">{trade.symbol}</span>
                              <EarningsBadge earningsTs={earningsDates[trade.symbol?.toUpperCase()]} compact />
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/40">
                                {trade.tradeType === 'cashSecuredPut' ? 'CSP' : 'Covered Call'}
                              </span>
                              {isExecuted && !isExpired && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">Executed</span>
                              )}
                              {(trade.status === 'planned' || !trade.status) && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">Planned</span>
                              )}
                              {isExpired && !trade.closed && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">Expired</span>
                              )}
                              {trade.closed && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${trade.result === 'assigned' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : trade.result === 'rolled' ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-white/[0.06] border-white/[0.08] text-white/40'}`}>
                                  {trade.result === 'assigned' ? 'Assigned' : trade.result === 'rolled' ? 'Rolled' : 'Expired Worthless'}
                                </span>
                              )}
                              {/* Roll: source badge */}
                              {trade.rolledFromId && (() => {
                                const src = tradeData.find(t => String(t.id) === String(trade.rolledFromId))
                                return src ? (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                                    🔄 Rolled from {src.symbol} ${src.strikePrice?.toFixed(0)}
                                  </span>
                                ) : null
                              })()}
                              {/* Roll: successor badge */}
                              {(() => {
                                const successor = tradeData.find(t => String(t.rolledFromId) === String(trade.id))
                                return successor ? (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                    → Rolled to {successor.symbol} ${successor.strikePrice?.toFixed(0)}
                                  </span>
                                ) : null
                              })()}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-white/30">
                              <span>{isExecuted ? 'Executed' : 'Planned'} {formatDateDDMMYYYY(trade.executionDate || trade.timestamp)}</span>
                              <span className="text-white/15">·</span>
                              <span>Expires {formatDateDDMMYYYY(trade.expirationDate)}</span>
                              {trade.lastPriceUpdate && (
                                <>
                                  <span className="text-white/15">·</span>
                                  <span>Price updated {new Date(trade.lastPriceUpdate).toLocaleDateString()}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!trade.closed && (
                            <button onClick={() => handleEditTrade(trade)}
                              className={`p-2 rounded-xl transition-all ${editingId === trade.id ? 'bg-blue-500 text-white' : 'hover:bg-blue-500/10 text-white/30 hover:text-blue-400'}`}
                              title="Edit">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {trade.status === 'planned' && !trade.closed && (
                            <button onClick={() => handleConvertToExecuted(trade)}
                              className="p-2 hover:bg-emerald-500/15 text-white/30 hover:text-emerald-400 rounded-xl transition-all"
                              title="Mark as executed">
                              <CheckCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleDeleteTrade(trade.id)}
                            className="p-2 hover:bg-rose-500/15 text-white/30 hover:text-rose-400 rounded-xl transition-all"
                            title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* ASSIGNMENT RISK ALERT */}
                      {isExecuted && !trade.closed && !isExpired && varStatus.isAtRisk && (
                        <div className="flex items-center gap-2 mb-3 px-3 py-2.5 bg-rose-500/10 border border-rose-500/25 rounded-xl">
                          <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
                          <div>
                            <span className="text-xs font-semibold text-rose-400">Assignment Risk</span>
                            <span className="text-[11px] text-rose-400/70 ml-2">Stock price has dropped below your strike — you may be assigned at expiry</span>
                          </div>
                        </div>
                      )}
                      {isExecuted && !trade.closed && !isExpired && varStatus.isWatch && (
                        <div className="flex items-center gap-2 mb-3 px-3 py-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                          <span className="text-xs font-semibold text-amber-400">Watch Zone — </span>
                          <span className="text-[11px] text-amber-400/70">Price within 5% of strike, monitor closely</span>
                        </div>
                      )}

                      {/* VARIANCE HERO (executed active trades only) */}
                      {isExecuted && !trade.closed && (
                        <div className={`mb-4 p-4 rounded-2xl border ${varStatus.isAtRisk ? 'bg-rose-500/[0.06] border-rose-500/20' : varStatus.isWatch ? 'bg-amber-500/[0.06] border-amber-500/20' : 'bg-emerald-500/[0.04] border-emerald-500/15'}`}>
                          <div className="flex items-end justify-between gap-4">
                            <div>
                              <div className="text-[11px] font-medium text-white/40 mb-1">Variance (Current vs Strike)</div>
                              <div className={`text-3xl font-semibold font-mono tracking-tight ${varStatus.isAtRisk ? 'text-rose-400' : varStatus.isWatch ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {varStatus.diff >= 0 ? '+' : ''}${varStatus.diff.toFixed(2)}
                              </div>
                              <div className={`text-sm font-medium mt-0.5 ${varStatus.isAtRisk ? 'text-rose-400/70' : varStatus.isWatch ? 'text-amber-400/70' : 'text-emerald-400/70'}`}>
                                {varStatus.pct >= 0 ? '+' : ''}{varStatus.pct.toFixed(1)}% from strike
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-[11px] font-medium text-white/40 mb-1">Net Premium</div>
                              <div className="text-2xl font-semibold font-mono text-emerald-400">
                                ${(trade.netPremium != null ? trade.netPremium : totalPremium).toFixed(0)}
                              </div>
                              <div className="text-[11px] text-white/30 mt-0.5">${trade.premium?.toFixed(2)}/sh × {(trade.quantity || 1) * 100}</div>
                              {trade.fees > 0 && <div className="text-[10px] text-amber-400/60 mt-0.5">−${(trade.fees + (trade.buybackFees || 0)).toFixed(2)} fees</div>}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Stats row */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <div className="p-3 bg-white/[0.04] rounded-xl border border-white/[0.05]">
                          <div className="text-[10px] font-medium text-white/40 mb-1">Current Price</div>
                          <div className="text-base font-semibold font-mono text-white/85">${displayPrice?.toFixed(2)}</div>
                        </div>
                        <div className="p-3 bg-white/[0.04] rounded-xl border border-white/[0.05]">
                          <div className="text-[10px] font-medium text-white/40 mb-1">Strike Price</div>
                          <div className="text-base font-semibold font-mono text-white/85">${trade.strikePrice?.toFixed(2)}</div>
                        </div>
                        <div className="p-3 bg-white/[0.04] rounded-xl border border-white/[0.05]">
                          <div className="text-[10px] font-medium text-white/40 mb-1">Net Premium</div>
                          <div className="text-base font-semibold font-mono text-emerald-400">
                            ${(trade.netPremium != null ? trade.netPremium : trade.premium * (trade.quantity || 1) * 100).toFixed(0)}
                          </div>
                          {trade.fees > 0 && (
                            <div className="text-[9px] text-white/25 mt-0.5">−${trade.fees.toFixed(2)} fees</div>
                          )}
                          {trade.buybackCost > 0 && (
                            <div className="text-[9px] text-rose-400/50 mt-0.5">−${(trade.buybackCost * (trade.quantity || 1) * 100).toFixed(0)} buyback</div>
                          )}
                        </div>
                        {/* Break-even (active executed trades only) */}
                        {isExecuted && !trade.closed && (() => {
                          const be = trade.tradeType === 'cashSecuredPut'
                            ? (trade.strikePrice - trade.premium)
                            : (trade.stockPrice - trade.premium)
                          const atRisk = displayPrice && displayPrice < be
                          return (
                            <div className={`p-3 rounded-xl border ${atRisk ? 'bg-rose-500/[0.06] border-rose-500/15' : 'bg-white/[0.04] border-white/[0.05]'}`}>
                              <div className="text-[10px] font-medium text-white/40 mb-1">Break-even</div>
                              <div className={`text-base font-semibold font-mono ${atRisk ? 'text-rose-400' : 'text-white/85'}`}>${be.toFixed(2)}</div>
                            </div>
                          )
                        })()}
                        <div className={`p-3 rounded-xl border ${isExpired ? 'bg-white/[0.04] border-white/[0.05]' : daysLeft <= 7 ? 'bg-rose-500/10 border-rose-500/20' : daysLeft <= 14 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/[0.04] border-white/[0.05]'}`}>
                          <div className="text-[10px] font-medium text-white/40 mb-1">Days to Expiry</div>
                          <div className={`text-base font-semibold font-mono ${isExpired ? 'text-white/30' : daysLeft <= 7 ? 'text-rose-400' : daysLeft <= 14 ? 'text-amber-400' : 'text-white/85'}`}>
                            {isExpired ? 'Expired' : `${daysLeft}d`}
                          </div>
                        </div>
                      </div>

                      {/* AI Review (auto-triggered on Save Planned) */}
                      {trade.aiReviewPending && (
                        <div className="mt-3 flex items-center gap-2 px-3 py-2.5 bg-purple-500/[0.06] border border-purple-500/15 rounded-xl">
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-purple-400/30 border-t-purple-400 animate-spin flex-shrink-0" />
                          <span className="text-[11px] text-purple-400/80">AI review running…</span>
                        </div>
                      )}
                      {trade.aiReviewed && trade.recommendation && trade.recommendation.action !== 'Quick Save' && trade.recommendation.action !== 'Analyzing…' && (
                        <div className="mt-3 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                          <div className="flex items-start gap-2.5">
                            <Sparkles className="h-3.5 w-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="text-[10px] font-semibold text-purple-400">AI Review</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${getRecommendationColor(trade.recommendation.action)}`}>
                                  {trade.recommendation.action}
                                </span>
                                {trade.hasResearchData && (
                                  <span className="text-[10px] text-white/25">Based on your research data</span>
                                )}
                              </div>
                              <p className="text-[11px] text-white/50 leading-relaxed">{trade.recommendation.rationale}</p>
                              {trade.riskAssessment?.factors?.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {trade.riskAssessment.factors.slice(0, 3).map((f, i) => (
                                    <span key={i} className="text-[10px] px-2 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded-full text-white/40">{typeof f === 'string' ? f : f?.message || ''}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {trade.aiReviewFailed && (
                        <div className="mt-3 flex items-center gap-2 px-3 py-2 text-[11px] text-white/30">
                          <AlertTriangle className="h-3 w-3" /> AI review unavailable
                        </div>
                      )}

                      {/* Per-trade notes */}
                      {trade.notes && (
                        <div className="mt-3">
                          <button
                            onClick={() => setExpandedNotes(prev => {
                              const next = new Set(prev)
                              next.has(trade.id) ? next.delete(trade.id) : next.add(trade.id)
                              return next
                            })}
                            className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/50 transition-colors"
                          >
                            📝 <span className="font-medium">Notes</span>
                            <span className="text-white/20">{expandedNotes.has(trade.id) ? '▲' : '▼'}</span>
                          </button>
                          {expandedNotes.has(trade.id) && (
                            <div className="mt-2 bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                              <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{trade.notes}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expired: close actions */}
                      {isExpired && !trade.closed && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button onClick={() => handleCloseTrade(trade.id, 'worthless')}
                            className="py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5">
                            <CheckCircle className="h-3.5 w-3.5" /> Expired Worthless
                          </button>
                          <button onClick={() => handleCloseTrade(trade.id, 'assigned')}
                            className="py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5" /> Assigned Stock
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div >
  )
}

export default TradeReview
