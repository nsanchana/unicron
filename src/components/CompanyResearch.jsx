import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Loader, Loader2, ChevronDown, ChevronUp, ChevronLeft, Star, AlertTriangle, CheckCircle, Save, RefreshCw, MessageCircle, Send, Bot, User, Trash2, TrendingUp, Plus, Bookmark, ExternalLink } from 'lucide-react'
import { scrapeCompanyData } from '../services/webScraping'
import { fetchPrices as yahooFetchPrices } from '../services/priceService'
import { COMPANY_RESEARCH_VERSION } from '../config'
import { saveToLocalStorage, STORAGE_KEYS } from '../utils/storage'
import CompanyLogo from './CompanyLogo'

const WATCHLIST_KEY = 'unicron_watchlist'

// Helper function to format dates as DD/MM/YYYY
const formatDateDDMMYYYY = (dateString) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = date.toLocaleString('default', { month: 'short' }).toUpperCase()
  const year = date.getFullYear()
  return `${day} ${month} ${year}`
}

// Helper function to format time as HH:MM:SS
const formatTime = (dateString) => {
  const date = new Date(dateString)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

// Format date as relative time
const formatRelativeDate = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return '1d ago'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

// Get sentiment from score
const getSentiment = (rating) => {
  if (rating >= 75) return { label: 'Bullish', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400', accent: 'bg-emerald-500' }
  if (rating >= 50) return { label: 'Neutral', bg: 'bg-amber-500/10', border: 'border-amber-500/25', text: 'text-amber-400', accent: 'bg-amber-500' }
  return { label: 'Bearish', bg: 'bg-rose-500/10', border: 'border-rose-500/25', text: 'text-rose-400', accent: 'bg-rose-500' }
}

function CompanyResearch({ researchData, setResearchData, lastRefresh, selectedResearch, onViewResearch, researchQueue, onAddToQueue, onClearQueue }) {
  const [selectedSymbols, setSelectedSymbols] = useState(new Set())
  const [symbol, setSymbol] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [currentLoadingSection, setCurrentLoadingSection] = useState('')
  const [companyData, setCompanyData] = useState(null)
  const [error, setError] = useState('')

  // Sync with global selectedResearch (e.g. from Dashboard)
  useEffect(() => {
    if (selectedResearch) {
      setCompanyData(selectedResearch)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [selectedResearch])

  // Handle URL-based ticker trigger
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const ticker = searchParams.get('ticker')
    if (ticker && !loading && !companyData) {
      const upperTicker = ticker.toUpperCase()
      setSymbol(upperTicker)
      handleSearch(null, upperTicker)
    }
  }, [])
  const [expandedSections, setExpandedSections] = useState({
    companyAnalysis: true,
    financialHealth: true,
    technicalAnalysis: true,
    recentDevelopments: true
  })

  // Chat state
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef(null)

  // Watchlist state (merged with research)
  const [watchlist, setWatchlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem(WATCHLIST_KEY)) || [] }
    catch { return [] }
  })
  const [watchInput, setWatchInput] = useState('')
  const [prices, setPrices] = useState({})
  const [priceSources, setPriceSources] = useState({})
  const [googleFailed, setGoogleFailed] = useState(false)
  const [priceLoading, setPriceLoading] = useState(false)
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null)

  // Sorting state for research history
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('research_sort_by') || 'rating')
  const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('research_sort_order') || 'desc')

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages])

  // Reset chat when company changes or load saved chat
  useEffect(() => {
    if (companyData) {
      if (companyData.chatHistory && companyData.chatHistory.length > 0) {
        setChatMessages(companyData.chatHistory)
      } else {
        setChatMessages([{
          role: 'assistant',
          content: `I've analyzed ${companyData.symbol} for you. Feel free to ask me any questions about the company's market position, business model, financials, growth strategy, or options trading opportunities.`
        }])
      }
    }
  }, [companyData?.symbol, companyData?.date])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!chatInput.trim() || chatLoading) return

    const userMessage = chatInput.trim()
    setChatInput('')

    // Add user message to chat
    const newMessages = [...chatMessages, { role: 'user', content: userMessage }]
    setChatMessages(newMessages)
    setChatLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          companyData: companyData,
          chatHistory: newMessages.slice(-10) // Send last 10 messages for context
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to get response')
      }

      const assistantMessage = { role: 'assistant', content: data.response }
      const finalMessages = [...newMessages, assistantMessage]
      setChatMessages(finalMessages)

      // If research is already saved, auto-update the chat history in storage
      if (companyData?.saved) {
        setCompanyData(prev => ({ ...prev, chatHistory: finalMessages }))

        // Update researchData array as well
        const researchIndex = researchData.findIndex(r => r.symbol === companyData.symbol && r.date === companyData.date)
        if (researchIndex !== -1) {
          const updatedResearchData = [...researchData]
          updatedResearchData[researchIndex] = { ...updatedResearchData[researchIndex], chatHistory: finalMessages }
          setResearchData(updatedResearchData)
          saveToLocalStorage(STORAGE_KEYS.RESEARCH_DATA, updatedResearchData)
        }
      }
    } catch (err) {
      console.error('Chat error:', err)
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.message}. Please try again.`
      }])
    } finally {
      setChatLoading(false)
    }
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleSearch = async (e, symbolOverride = null) => {
    if (e) e.preventDefault()
    const targetSymbol = symbolOverride || symbol
    if (!targetSymbol.trim()) return

    setLoading(true)
    setLoadingProgress(0)
    setError('')
    setCompanyData(null)

    try {
      const sections = [
        'companyAnalysis',
        'financialHealth',
        'technicalAnalysis',
        'recentDevelopments'
      ]

      const results = {}
      const lastRefresh = new Date()

      // Initialize with skeleton data to allow incremental updates
      setCompanyData({
        symbol: targetSymbol.toUpperCase(),
        date: lastRefresh.toISOString(),
        lastRefresh: lastRefresh.toISOString(),
        overallRating: 0,
        loading: true
      })

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i]
        setCurrentLoadingSection(section.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()))
        console.log(`Scraping ${section} for ${targetSymbol}...`)

        let sectionData = null
        let attempts = 0
        const maxAttempts = 3

        while (attempts < maxAttempts && !sectionData) {
          try {
            sectionData = await scrapeCompanyData(targetSymbol.toUpperCase(), section)
            console.log(`Successfully scraped ${section} on attempt ${attempts + 1}`)
          } catch (err) {
            attempts++
            console.warn(`Attempt ${attempts} failed for ${section}:`, err.message)
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 2000 * attempts))
            }
          }
        }

        if (!sectionData) {
          // Continue to next section instead of failing everything
          console.error(`Failed to scrape ${section} after ${maxAttempts} attempts`)
          continue
        }

        results[section] = sectionData

        // Update companyData incrementally
        setCompanyData(prev => {
          const updated = { ...prev, [section]: sectionData }

          // Flattened overall rating calculation for higher granularity
          // Incorporate all sub-ratings from companyAnalysis directly
          const companyPillars = [
            updated.companyAnalysis?.detailedAnalysis?.marketPosition?.rating || 0,
            updated.companyAnalysis?.detailedAnalysis?.businessModel?.rating || 0,
            updated.companyAnalysis?.detailedAnalysis?.industryTrends?.rating || 0,
            updated.companyAnalysis?.detailedAnalysis?.customerBase?.rating || 0,
            updated.companyAnalysis?.detailedAnalysis?.growthStrategy?.rating || 0,
            updated.companyAnalysis?.detailedAnalysis?.economicMoat?.rating || 0
          ].filter(r => r > 0)

          const otherModules = [
            updated.financialHealth?.rating || 0,
            updated.technicalAnalysis?.rating || 0,
            updated.recentDevelopments?.rating || 0
          ].filter(r => r > 0)

          const allRatings = [...companyPillars, ...otherModules]

          if (allRatings.length > 0) {
            updated.overallRating = Math.round(allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length)
          }

          return updated
        })

        setLoadingProgress(Math.round(((i + 1) / sections.length) * 100))

        // Delay between requests to avoid rate limiting (3 seconds)
        if (i < sections.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
      }

      setCompanyData(prev => ({ ...prev, loading: false }))
    } catch (err) {
      setError(`Failed to analyze company: ${err.message}. Please check the symbol and try again.`)
      console.error('Research error:', err)
    } finally {
      setLoading(false)
      setLoadingProgress(100)
      setCurrentLoadingSection('')
    }
  }

  const handleSaveResearch = () => {
    if (!companyData) return

    // Mark as saved and include current chat history
    const savedResearch = {
      ...companyData,
      saved: true,
      chatHistory: chatMessages
    }

    // Check if we are updating an existing save or adding a new one
    const existingIndex = researchData.findIndex(r => r.symbol === companyData.symbol && r.date === companyData.date)

    let updatedResearchData
    if (existingIndex !== -1) {
      updatedResearchData = [...researchData]
      updatedResearchData[existingIndex] = savedResearch
      
      setResearchData(updatedResearchData)
      saveToLocalStorage(STORAGE_KEYS.RESEARCH_DATA, updatedResearchData)
      setCompanyData(savedResearch)
      alert(`Research for ${companyData.symbol} updated successfully!`)
      return
    }

    // Check for duplicate symbols (previous research for the same company)
    const duplicateIndex = researchData.findIndex(r => r.symbol === companyData.symbol)
    
    if (duplicateIndex !== -1) {
      const choice = window.confirm(`Research for ${companyData.symbol} already exists. \n\nClick OK to REPLACE the existing entry.\nClick CANCEL to keep both as SEPARATE entries.`)
      
      if (choice) {
        // Replace: Filter out all previous entries for this symbol
        updatedResearchData = [savedResearch, ...researchData.filter(r => r.symbol !== companyData.symbol)]
      } else {
        // Keep separate: Just add to the list
        updatedResearchData = [savedResearch, ...researchData]
      }
    } else {
      updatedResearchData = [savedResearch, ...researchData]
    }

    setResearchData(updatedResearchData)

    // Persist to localStorage
    saveToLocalStorage(STORAGE_KEYS.RESEARCH_DATA, updatedResearchData)

    // Update current display
    setCompanyData(savedResearch)

    // Show success message
    alert(`Research for ${companyData.symbol} saved successfully!`)
  }

  const handleViewResearch = (research) => {
    // Display the saved research
    setCompanyData(research)
    if (onViewResearch) onViewResearch(research)
    setSymbol(research.symbol)
    // Expand all sections when viewing saved research
    setExpandedSections({
      companyAnalysis: true,
      financialHealth: true,
      technicalAnalysis: true,
      recentDevelopments: true
    })
    // Scroll to top to show the research
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteResearch = (index) => {
    const itemToDelete = researchData[index]
    if (window.confirm(`Delete research for ${itemToDelete.symbol}?`)) {
      const updatedResearchData = researchData.filter((_, i) => i !== index)
      setResearchData(updatedResearchData)
      saveToLocalStorage(STORAGE_KEYS.RESEARCH_DATA, updatedResearchData)

      // If the deleted item was being viewed, clear the display
      if (companyData && companyData.symbol === itemToDelete.symbol && companyData.date === itemToDelete.date) {
        setCompanyData(null)
      }
    }
  }

  // Watchlist helpers
  const saveWatchlist = (list) => {
    setWatchlist(list)
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list))
  }
  const handleAddToWatch = () => {
    const sym = watchInput.trim().toUpperCase()
    if (!sym) return
    if (!watchlist.some(w => w.symbol === sym)) {
      const updated = [...watchlist, { id: Date.now(), symbol: sym, addedAt: new Date().toISOString() }]
      saveWatchlist(updated)
      fetchPrices([sym])
    }
    setWatchInput('')
  }
  const handleRemoveFromWatch = (symbol) => {
    saveWatchlist(watchlist.filter(w => w.symbol !== symbol))
  }

  // Price fetching via /api/prices (Google Finance primary → Yahoo fallback)
  const fetchPrices = useCallback(async (symbols) => {
    if (!symbols || symbols.length === 0) return
    setPriceLoading(true)
    try {
      const priceMap = await yahooFetchPrices(symbols)
      const sources = priceMap.__sources || {}
      const gFailed = priceMap.__googleFailed || false
      // Strip metadata keys before storing
      const clean = Object.fromEntries(Object.entries(priceMap).filter(([k]) => !k.startsWith('__')))
      setPrices(prev => ({ ...prev, ...clean }))
      setPriceSources(prev => ({ ...prev, ...sources }))
      setGoogleFailed(gFailed)
      setLastPriceUpdate(new Date())
    } catch (err) {
      console.error('Price fetch failed:', err)
    } finally {
      setPriceLoading(false)
    }
  }, [])

  // Fetch prices for all tracked symbols on mount
  useEffect(() => {
    const allSymbols = [...new Set([
      ...watchlist.map(w => w.symbol),
      ...researchData.map(r => r.symbol)
    ])]
    if (allSymbols.length > 0) fetchPrices(allSymbols)
  }, []) // eslint-disable-line

  // Sorting function for research history
  const handleSort = (newSortBy) => {
    if (sortBy === newSortBy) {
      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc'
      setSortOrder(newOrder)
      localStorage.setItem('research_sort_order', newOrder)
    } else {
      setSortBy(newSortBy)
      setSortOrder('desc')
      localStorage.setItem('research_sort_by', newSortBy)
      localStorage.setItem('research_sort_order', 'desc')
    }
  }

  const sortedResearchData = [...researchData].sort((a, b) => {
    let aValue, bValue

    switch (sortBy) {
      case 'date':
        aValue = new Date(a.date)
        bValue = new Date(b.date)
        break
      case 'rating':
        aValue = a.overallRating || 0
        bValue = b.overallRating || 0
        break
      case 'currentPrice':
        const aCurrent = a.technicalAnalysis?.currentPrice || a.technicalAnalysis?.metrics?.find(m => m.label === 'Current Price')?.value
        const bCurrent = b.technicalAnalysis?.currentPrice || b.technicalAnalysis?.metrics?.find(m => m.label === 'Current Price')?.value
        aValue = aCurrent ? parseFloat(aCurrent.replace(/[$,]/g, '')) : 0
        bValue = bCurrent ? parseFloat(bCurrent.replace(/[$,]/g, '')) : 0
        break
      case 'targetPrice':
        const aTarget = a.technicalAnalysis?.targetPrice || a.technicalAnalysis?.metrics?.find(m => m.label === 'Target Price')?.value
        const bTarget = b.technicalAnalysis?.targetPrice || b.technicalAnalysis?.metrics?.find(m => m.label === 'Target Price')?.value
        aValue = aTarget ? parseFloat(aTarget.replace(/[$,]/g, '')) : 0
        bValue = bTarget ? parseFloat(bTarget.replace(/[$,]/g, '')) : 0
        break
      case 'noResearch':
        // No research first, then by symbol
        if (!a.overallRating && b.overallRating) return -1
        if (a.overallRating && !b.overallRating) return 1
        aValue = a.symbol; bValue = b.symbol
        break
      case 'stalest':
        aValue = a.date ? new Date(a.date) : new Date(0)
        bValue = b.date ? new Date(b.date) : new Date(0)
        break
      case 'symbol':
        aValue = a.symbol
        bValue = b.symbol
        break
      default:
        return 0
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
    }
  })

  // Unified watchlist + research list
  const allTrackedSymbols = [...new Set([
    ...watchlist.map(w => w.symbol),
    ...researchData.map(r => r.symbol)
  ])]

  const unifiedCards = allTrackedSymbols.map(sym => {
    const latestResearch = researchData
      .filter(r => r.symbol === sym)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0]
    const watchItem = watchlist.find(w => w.symbol === sym)
    // Live price from fetch; fall back to price stored in last research run
    const livePrice = prices[sym] ?? prices[sym?.toUpperCase()] ?? null
    const priceSource = priceSources[sym] || priceSources[sym?.toUpperCase()] || null
    const storedPrice = latestResearch?.technicalAnalysis?.currentPrice ||
      latestResearch?.technicalAnalysis?.metrics?.find(m => m.label === 'Current Price')?.value
    return { symbol: sym, research: latestResearch, watchItem, livePrice, storedPrice, priceSource }
  }).sort((a, b) => {
    if (sortBy === 'noResearch') {
      if (!a.research && b.research) return -1
      if (a.research && !b.research) return 1
      return a.symbol.localeCompare(b.symbol)
    }
    if (sortBy === 'stalest') {
      const aD = a.research ? new Date(a.research.date) : new Date(0)
      const bD = b.research ? new Date(b.research.date) : new Date(0)
      return aD - bD
    }
    if (sortBy === 'rating') {
      const aR = a.research?.overallRating ?? -1
      const bR = b.research?.overallRating ?? -1
      return sortOrder === 'desc' ? bR - aR : aR - bR
    }
    if (sortBy === 'symbol') {
      return sortOrder === 'desc' ? b.symbol.localeCompare(a.symbol) : a.symbol.localeCompare(b.symbol)
    }
    if (sortBy === 'date') {
      const aD = a.research ? new Date(a.research.date) : (a.watchItem ? new Date(a.watchItem.addedAt) : new Date(0))
      const bD = b.research ? new Date(b.research.date) : (b.watchItem ? new Date(b.watchItem.addedAt) : new Date(0))
      return sortOrder === 'desc' ? bD - aD : aD - bD
    }
    if (sortBy === 'currentPrice') {
      const aP = a.livePrice || 0; const bP = b.livePrice || 0
      return sortOrder === 'desc' ? bP - aP : aP - bP
    }
    return 0
  })

  const handleRerunResearch = async (oldSymbol) => {
    // Set the symbol and run a fresh analysis
    setSymbol(oldSymbol)
    setLoading(true)
    setError('')
    setCompanyData(null)

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

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Calculate overall rating
      const sectionRatings = [
        results.companyAnalysis?.rating || 0,
        results.financialHealth?.rating || 0,
        results.technicalAnalysis?.rating || 0,
        results.recentDevelopments?.rating || 0
      ].filter(rating => rating > 0)

      const overallRating = sectionRatings.length > 0
        ? Math.round(sectionRatings.reduce((sum, rating) => sum + rating, 0) / sectionRatings.length)
        : 0

      const researchEntry = {
        symbol: oldSymbol,
        date: new Date().toISOString(),
        ...results,
        overallRating,
        lastRefresh: new Date().toISOString(),
        saved: false
      }

      setCompanyData(researchEntry)

      // Expand all sections
      setExpandedSections({
        companyAnalysis: true,
        financialHealth: true,
        technicalAnalysis: true,
        recentDevelopments: true
      })

      // Scroll to top to show results
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError('Failed to rerun analysis. Please try again.')
      console.error('Rerun research error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getRatingColor = (rating) => {
    // Handling 0-100 scale
    if (rating >= 90) return 'text-emerald-400'
    if (rating >= 75) return 'text-green-400'
    if (rating >= 60) return 'text-yellow-400'
    if (rating >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  const getRatingIcon = (rating) => {
    if (rating >= 75) return <CheckCircle className="h-5 w-5 text-green-400" />
    if (rating >= 50) return <AlertTriangle className="h-5 w-5 text-yellow-400" />
    return <AlertTriangle className="h-5 w-5 text-red-400" />
  }

  // Render a detailed analysis subsection with rating
  const renderDetailedSubsection = (subsection) => {
    if (!subsection) return null
    return (
      <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5 mb-3">
        <div className="flex items-center justify-between mb-2">
          <h5 className="font-semibold text-blue-400">{subsection.title}</h5>
          <div className={`flex items-center space-x-1 ${getRatingColor(subsection.rating)}`}>
            <Star className="h-4 w-4 fill-current" />
            <span className="font-bold text-sm">{subsection.rating}/100</span>
          </div>
        </div>
        <p className="text-white/70 text-sm leading-relaxed">{subsection.content}</p>
      </div>
    )
  }

  const renderSection = (title, sectionKey, data, rating) => {
    const isExpanded = expandedSections[sectionKey]
    const isCompanyAnalysis = sectionKey === 'companyAnalysis'
    const isTechnicalAnalysis = sectionKey === 'technicalAnalysis'
    const isRecentDevelopments = sectionKey === 'recentDevelopments'

    return (
      <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] rounded-xl transition-colors"
        >
          <div className="flex items-center space-x-3">
            {getRatingIcon(rating)}
            <h3 className="text-sm font-semibold text-white/90">{title}</h3>
            {rating && (
              <div className={`flex items-center space-x-1 ${getRatingColor(rating)}`}>
                <Star className="h-4 w-4 fill-current" />
                <span className="font-bold">{rating}/100</span>
              </div>
            )}
          </div>
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {isExpanded && data && (
          <div className="px-4 pb-4 space-y-3">
            {/* Summary Analysis */}
            {data.analysis && (
              <div>
                <h4 className="text-[11px] font-semibold text-white/50 mb-2">Executive Summary</h4>
                <p className="text-white/70 text-sm leading-relaxed bg-white/[0.04] border border-white/[0.05] rounded-xl p-3">{data.analysis}</p>
              </div>
            )}

            {/* Key Metrics - Special rendering for Technical Analysis */}
            {data.metrics && data.metrics.length > 0 && isTechnicalAnalysis && (
              <div>
                <h4 className="text-[11px] font-semibold text-white/50 mb-3">Key Metrics</h4>
                
                {/* Current Price - Prominent Display */}
                {data.metrics.find(m => m.label === 'Current Price') && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-white/50 text-sm">Current Price</span>
                      {/* Root symbol or local state fallback */}
                      <span className="text-3xl font-black text-white/85">
                        {(companyData?.symbol || symbol || 'SYMBOL').toUpperCase()} ${data.metrics.find(m => m.label === 'Current Price')?.value || '0.00'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Target Price Analysis - Moved Here */}
                {data.detailedTechnical?.targetPriceAnalysis && (
                  <div className="bg-blue-500/[0.06] border border-blue-500/15 rounded-2xl p-4 mb-4">
                    <h5 className="font-semibold text-blue-400 mb-2">{data.detailedTechnical.targetPriceAnalysis.title}</h5>
                    {data.detailedTechnical.targetPriceAnalysis.targetPrice && (
                      <div className="flex items-center mb-3">
                        <span className="text-white/50 text-sm mr-2">Analyst Target:</span>
                        <span className="text-2xl font-bold text-blue-300">{data.detailedTechnical.targetPriceAnalysis.targetPrice}</span>
                      </div>
                    )}
                    <p className="text-white/50 text-sm leading-relaxed">{data.detailedTechnical.targetPriceAnalysis.content}</p>
                  </div>
                )}

                {/* Support & Resistance Visual Display */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Support Levels */}
                  <div className="bg-white/[0.05] backdrop-blur-2xl border border-emerald-500/20 rounded-[20px] p-5">
                    <h5 className="text-green-400 font-semibold mb-3 flex items-center">
                      <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                      Support Levels
                    </h5>
                    <div className="space-y-2">
                      {data.metrics
                        .filter(m => m.label.includes('Support'))
                        .map((metric, i) => (
                          <div key={i} className="bg-white/[0.05] border border-white/[0.06] rounded-xl px-3 py-2">
                            <div className="text-emerald-400 font-medium text-lg">
                              {metric.value.split(' - ')[0]}
                            </div>
                            <div className="text-white/50 text-sm mt-1">
                              {metric.value.split(' - ').slice(1).join(' - ')}
                            </div>
                          </div>
                        ))}
                      {data.metrics.filter(m => m.label.includes('Support')).length === 0 && (
                        <p className="text-white/50 text-sm">No support levels identified</p>
                      )}
                    </div>
                  </div>

                  {/* Resistance Levels */}
                  <div className="bg-white/[0.05] backdrop-blur-2xl border border-rose-500/20 rounded-[20px] p-5">
                    <h5 className="text-red-400 font-semibold mb-3 flex items-center">
                      <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                      Resistance Levels
                    </h5>
                    <div className="space-y-2">
                      {data.metrics
                        .filter(m => m.label.includes('Resistance'))
                        .map((metric, i) => (
                          <div key={i} className="bg-white/[0.05] border border-white/[0.06] rounded-xl px-3 py-2">
                            <div className="text-rose-400 font-medium text-lg">
                              {metric.value.split(' - ')[0]}
                            </div>
                            <div className="text-white/50 text-sm mt-1">
                              {metric.value.split(' - ').slice(1).join(' - ')}
                            </div>
                          </div>
                        ))}
                      {data.metrics.filter(m => m.label.includes('Resistance')).length === 0 && (
                        <p className="text-white/50 text-sm">No resistance levels identified</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Key Metrics - Standard rendering for other sections */}
            {data.metrics && data.metrics.length > 0 && !isTechnicalAnalysis && (
              <div>
                <h4 className="font-medium mb-2 text-white/85">Key Metrics</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {data.metrics.map((metric, index) => (
                    <div key={index} className="flex justify-between text-sm bg-white/[0.05] border border-white/[0.06] rounded-xl p-2">
                      <span className="text-white/50">{metric.label}:</span>
                      <span className="font-medium text-white/85">{metric.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Analysis Sections - Only for Company Analysis */}
            {isCompanyAnalysis && data.detailedAnalysis && (
              <div>
                <h4 className="font-medium mb-3 mt-4 text-lg border-b border-gray-600 pb-2 text-white/85">Detailed Analysis</h4>
                {renderDetailedSubsection(data.detailedAnalysis.marketPosition)}
                {renderDetailedSubsection(data.detailedAnalysis.businessModel)}
                {renderDetailedSubsection(data.detailedAnalysis.industryTrends)}
                {renderDetailedSubsection(data.detailedAnalysis.customerBase)}
                {renderDetailedSubsection(data.detailedAnalysis.growthStrategy)}
                {renderDetailedSubsection(data.detailedAnalysis.economicMoat)}
              </div>
            )}

            {/* Detailed Technical Analysis */}
            {isTechnicalAnalysis && data.detailedTechnical && (
              <div>
                <h4 className="font-medium mb-3 mt-4 text-lg border-b border-gray-600 pb-2 text-white/85">Technical Details</h4>

                {/* 30-60 Day Trend Outlook */}
                {data.detailedTechnical.trend30to60Days && (
                  <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5 mb-3">
                    <h5 className="font-semibold text-blue-400 mb-2">{data.detailedTechnical.trend30to60Days.title}</h5>
                    <p className="text-white/50 text-sm leading-relaxed">{data.detailedTechnical.trend30to60Days.content}</p>
                  </div>
                )}



                {/* Options Strategy */}
                {data.detailedTechnical.optionsStrategy && (
                  <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5 mb-3">
                    <h5 className="font-semibold text-blue-400 mb-2">{data.detailedTechnical.optionsStrategy.title}</h5>
                    <p className="text-white/50 text-sm leading-relaxed">{data.detailedTechnical.optionsStrategy.content}</p>
                  </div>
                )}
              </div>
            )}

            {/* Detailed Recent Developments */}
            {isRecentDevelopments && data.detailedDevelopments && (
              <div>
                <h4 className="font-medium mb-3 mt-4 text-lg border-b border-gray-600 pb-2 text-white/85">Event Details</h4>

                {/* Next Earnings Call */}
                {data.detailedDevelopments.nextEarningsCall && (
                  <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5 mb-3">
                    <h5 className="font-semibold text-blue-400 mb-2">{data.detailedDevelopments.nextEarningsCall.title}</h5>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-white/50">Next Earnings</span>
                      <span className="text-white/85">{data.detailedDevelopments.nextEarningsCall.date}</span>
                    </div>
                    <p className="text-white/50 text-sm leading-relaxed">{data.detailedDevelopments.nextEarningsCall.expectation}</p>
                  </div>
                )}

                {/* Major Events */}
                {data.detailedDevelopments.majorEvents && data.detailedDevelopments.majorEvents.events?.length > 0 && (
                  <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5 mb-3">
                    <h5 className="font-semibold text-blue-400 mb-2">{data.detailedDevelopments.majorEvents.title}</h5>
                    <div className="space-y-3">
                      {data.detailedDevelopments.majorEvents.events.map((event, i) => (
                        <div key={i} className="border-l-2 border-blue-500 pl-3">
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-white/85">{event.event}</span>
                            {event.date && <span className="text-xs text-white/50 ml-2">{event.date}</span>}
                          </div>
                          {event.expectedImpact && (
                            <p className="text-sm text-white/50 mt-1">{event.expectedImpact}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upcoming Catalysts */}
                {data.detailedDevelopments.catalysts && (
                  <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5 mb-3">
                    <h5 className="font-semibold text-blue-400 mb-2">{data.detailedDevelopments.catalysts.title}</h5>
                    <p className="text-white/50 text-sm leading-relaxed">{data.detailedDevelopments.catalysts.content}</p>
                  </div>
                )}

                {/* Options Implication */}
                {data.detailedDevelopments.optionsImplication && (
                  <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5 mb-3">
                    <h5 className="font-semibold text-blue-400 mb-2">{data.detailedDevelopments.optionsImplication.title}</h5>
                    <p className="text-white/50 text-sm leading-relaxed">{data.detailedDevelopments.optionsImplication.content}</p>
                  </div>
                )}
              </div>
            )}

            {/* Signals */}
            {data.signals && data.signals.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 text-white/85">Signals</h4>
                <div className="space-y-1">
                  {data.signals.map((signal, index) => (
                    <div key={index} className={`text-sm p-2 rounded ${signal.type === 'positive' ? 'bg-emerald-500/15 text-emerald-400' :
                      signal.type === 'negative' ? 'bg-rose-500/15 text-rose-400' :
                        'bg-amber-500/15 text-amber-400'
                      }`}>
                      {signal.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }


  return (
    <div className="space-y-8 pb-12">

      {/* Page Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-6 border-b border-white/[0.06]">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-500/10 rounded-2xl border border-violet-500/20">
              <Search className="h-6 w-6 text-violet-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Company Research</h1>
          </div>
          <p className="text-white/40 font-medium text-sm ml-0 sm:ml-[52px]">Deep-dive analysis and ratings for your watchlist.</p>
        </div>
      </header>

      {/* Search Form */}
      <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5 shadow-blue-500/5">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-white/50 group-focus-within:text-blue-400 transition-colors" />
            </div>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL, TSLA, NVDA..."
              className="bg-white/[0.06] border border-white/[0.10] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all w-full pl-12 py-4 text-base font-semibold tracking-wider placeholder:text-white/50"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 sm:py-0 rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/25 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 flex-shrink-0"
          >
            {loading ? (
              <RefreshCw className="h-5 w-5" />
            ) : (
              <Search className="h-5 w-5" />
            )}
            <span>{loading ? 'Analyzing' : 'Research'}</span>
          </button>
        </form>

        {/* Progress Bar when loading */}
        {loading && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5 p-6 border-blue-500/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white/85">Analyzing {symbol.toUpperCase()}</h3>
                    <p className="text-sm text-white/50">Current step: <span className="text-blue-400 font-medium">{currentLoadingSection || 'Initializing...'}</span></p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-blue-400">{loadingProgress}%</span>
              </div>

              <div className="w-full h-3 bg-gray-800/50 rounded-full overflow-hidden border border-white/5 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 via-primary-400 to-purple-400 rounded-full transition-all duration-700 ease-out shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {['Company', 'Financial', 'Technical', 'Events'].map((step, i) => {
                  const isCompleted = loadingProgress > (i * 25);
                  const isActive = loadingProgress > (i * 25) && loadingProgress <= ((i + 1) * 25);
                  return (
                    <div key={step} className="text-center">
                      <div className={`text-[10px] font-medium mb-1 ${isCompleted ? 'text-blue-400' : 'text-gray-600'}`}>
                        {step}
                      </div>
                      <div className={`h-1.5 rounded-full transition-colors duration-500 ${isCompleted ? 'bg-blue-500/50' : 'bg-gray-800'}`}>
                        {isActive && <div className="h-full bg-blue-400 rounded-full animate-pulse" style={{ width: '100%' }}></div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-8 p-4 bg-rose-500/15/30 border border-red-500/50 rounded-xl text-red-200 flex items-start space-x-3 animate-in fade-in slide-in-from-top-4">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}
      </div>

      {companyData && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Header with back button */}
          <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] overflow-hidden">
            {/* Top accent stripe based on sentiment */}
            <div className={`h-0.5 ${companyData.overallRating >= 75 ? 'bg-gradient-to-r from-emerald-500 to-transparent' : companyData.overallRating >= 50 ? 'bg-gradient-to-r from-amber-500 to-transparent' : 'bg-gradient-to-r from-rose-500 to-transparent'}`} />

            <div className="p-5">
              {/* Back + actions row */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCompanyData(null)}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-white/40 hover:text-white/70 transition-colors group"
                >
                  <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                  Back to Research
                </button>
                <div className="flex items-center gap-2">
                  {!companyData.saved ? (
                    <button onClick={handleSaveResearch}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-full text-sm font-semibold transition-all active:scale-95">
                      <Save className="h-3.5 w-3.5" />
                      Save Report
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Saved
                    </div>
                  )}
                </div>
              </div>

              {/* Symbol + score */}
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <CompanyLogo symbol={companyData.symbol} className="w-12 h-12" textSize="text-sm" />
                    <div>
                      <h2 className="text-2xl font-semibold text-white/90">{companyData.symbol}</h2>
                      <p className="text-[11px] text-white/40 mt-0.5">Full Intelligence Report</p>
                    </div>
                  </div>
                  {/* 4 section scores */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {[
                      { label: 'Company', score: companyData.companyAnalysis?.rating },
                      { label: 'Financial', score: companyData.financialHealth?.rating },
                      { label: 'Technical', score: companyData.technicalAnalysis?.rating },
                      { label: 'Events', score: companyData.recentDevelopments?.rating },
                    ].map(({ label, score }) => score ? (
                      <div key={label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium ${score >= 70 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : score >= 50 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                        <span className="text-white/40">{label}</span>
                        <span className="font-semibold">{score}</span>
                      </div>
                    ) : null)}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-5xl font-semibold font-mono ${companyData.overallRating >= 75 ? 'text-emerald-400' : companyData.overallRating >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {companyData.overallRating}
                  </div>
                  <div className="text-[11px] text-white/30 mt-0.5">Overall Score</div>
                </div>
              </div>
            </div>
          </div>

          {/* Fallback Warning */}
          {(companyData.isFallback || companyData.companyAnalysis?.isFallback) && (
            <div className="p-4 bg-orange-900/30 border border-orange-500/50 rounded-xl text-orange-200 flex items-start space-x-3 animate-in fade-in slide-in-from-top-4">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Displaying Basic Analysis</p>
                <p className="text-sm opacity-90">The AI engine encountered an issue or is not configured. Please check your GEMINI_API_KEY. {(companyData.error || companyData.companyAnalysis?.error) && `(Error: ${companyData.error || companyData.companyAnalysis?.error})`}</p>
              </div>
            </div>
          )}

          {/* Analysis Sections */}
          {renderSection('Company Analysis', 'companyAnalysis', companyData.companyAnalysis, companyData.companyAnalysis?.rating)}
          {renderSection('Financial Health', 'financialHealth', companyData.financialHealth, companyData.financialHealth?.rating)}
          {renderSection('Technical Analysis', 'technicalAnalysis', companyData.technicalAnalysis, companyData.technicalAnalysis?.rating)}
          {renderSection('Recent Developments', 'recentDevelopments', companyData.recentDevelopments, companyData.recentDevelopments?.rating)}

          {/* Chat Interface */}
          <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5">
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] rounded-xl transition-colors"
            >
              <div className="flex items-center space-x-3">
                <MessageCircle className="h-5 w-5 text-blue-400" />
                <h3 className="text-sm font-semibold text-white/90">Ask About {companyData.symbol}</h3>
              </div>
              {chatOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>

            {chatOpen && (
              <div className="px-4 pb-4">
                {/* Chat Messages */}
                <div className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-4 h-[400px] overflow-y-auto mb-4 pr-2 custom-scrollbar">
                  {chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex items-start space-x-3 mb-4 ${msg.role === 'user' ? 'justify-end' : ''
                        }`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center p-1">
                          <img src="/unicron-logo.jpg" alt="Unicron" className="h-full w-full object-contain rounded-full" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/[0.06] border border-white/[0.06] rounded-xl px-3 py-2 text-white/85'
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
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center p-1">
                        <img src="/unicron-logo.jpg" alt="Unicron" className="h-full w-full object-contain rounded-full" />
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
                    placeholder="Ask about market position, growth strategy, options trading..."
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

      {/* Unified Watchlist + Research Grid */}
      {allTrackedSymbols.length > 0 && (
        <div className="space-y-4">
          {/* Header + Controls */}
          <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                  <Bookmark className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white/90">Tracked Companies</h3>
                    <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[11px] font-medium text-white/40">{allTrackedSymbols.length}</span>
                  </div>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {researchData.length} researched · {allTrackedSymbols.length - researchData.filter(r => allTrackedSymbols.includes(r.symbol)).length > 0 ? `${allTrackedSymbols.length - [...new Set(researchData.map(r => r.symbol))].length} watching` : 'all researched'}
                    {lastPriceUpdate && <span className="ml-2">· prices {lastPriceUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const syms = [...new Set([...watchlist.map(w => w.symbol), ...researchData.map(r => r.symbol)])]
                  fetchPrices(syms)
                }}
                disabled={priceLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-[11px] font-medium rounded-full disabled:opacity-30 transition-all flex-shrink-0"
              >
                <RefreshCw className={`h-3 w-3 ${priceLoading ? 'animate-spin' : ''}`} />
                Refresh Prices
              </button>
            </div>

            {/* Add to watchlist input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={watchInput}
                onChange={e => setWatchInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleAddToWatch()}
                placeholder="Add ticker to watch e.g. NVDA"
                className="bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-2.5 text-sm font-semibold text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all flex-1 max-w-xs uppercase"
              />
              <button
                onClick={handleAddToWatch}
                disabled={!watchInput.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-semibold transition-all disabled:opacity-40"
              >
                <Plus className="h-4 w-4" /> Watch
              </button>
            </div>

            {/* Sort pills */}
            <div className="flex items-center gap-1.5 mt-3 overflow-x-auto scrollbar-hide pb-0.5">
              {[
                { key: 'rating',       label: 'Score'       },
                { key: 'date',         label: 'Recent'      },
                { key: 'currentPrice', label: 'Price'       },
                { key: 'symbol',       label: 'A–Z'         },
                { key: 'stalest',      label: 'Needs Refresh' },
                { key: 'noResearch',   label: 'No Research' },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => handleSort(s.key)}
                  className={`flex-none flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all whitespace-nowrap ${
                    sortBy === s.key
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.10] border border-white/[0.08]'
                  }`}
                >
                  {s.label}
                  {sortBy === s.key && !['noResearch','stalest'].includes(s.key) && (
                    <span className="text-[9px] opacity-70">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Research Queue */}
          {researchQueue.length > 0 && (
            <div className="p-3 bg-blue-500/[0.08] border border-blue-500/20 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-blue-400">Queue</span>
                  <span className="text-[11px] text-white/30">{researchQueue.filter(t => t.status === 'completed').length}/{researchQueue.length} done</span>
                </div>
                <button onClick={onClearQueue} className="text-[11px] text-white/30 hover:text-white/60 flex items-center gap-1 transition-all">
                  <Trash2 className="h-3 w-3" /> Clear
                </button>
              </div>
              <div className="space-y-1.5">
                {researchQueue.map((task, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.status === 'processing' ? 'bg-blue-400 animate-pulse' : task.status === 'queued' ? 'bg-white/20' : 'bg-emerald-400'}`} />
                      <span className="text-[11px] font-semibold text-white/70">{task.symbol}</span>
                      <span className="text-[10px] text-white/30">{task.section || 'Waiting'}</span>
                    </div>
                    {task.status === 'processing' && <span className="text-[10px] text-blue-400">{task.progress}%</span>}
                    {task.status === 'completed' && <CheckCircle className="h-3 w-3 text-emerald-400" />}
                    {task.status === 'error' && <AlertTriangle className="h-3 w-3 text-rose-400" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Google Finance failure warning */}
          {googleFailed && !priceLoading && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Google Finance unavailable — prices showing are 15-min delayed (Yahoo Finance fallback). Prices will auto-retry on next refresh.</span>
            </div>
          )}

          {/* Card Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unifiedCards.map(({ symbol: sym, research: item, watchItem, livePrice, storedPrice, priceSource }) => {
              const sentiment = item ? getSentiment(item.overallRating) : null

              let targetPrice = item?.technicalAnalysis?.targetPrice ||
                item?.technicalAnalysis?.metrics?.find(m => m.label === 'Target Price')?.value
              if (targetPrice) targetPrice = targetPrice.replace(/,\s*$/, '').trim()

              const fmtPrice = (p) => !p ? null : (p.startsWith('$') ? p : `$${p}`)
              const fmtTarget = fmtPrice(targetPrice)

              let upsidePercent = null
              if (livePrice && targetPrice) {
                const target = parseFloat(targetPrice.replace(/[$,]/g, ''))
                if (!isNaN(target) && livePrice > 0) {
                  upsidePercent = ((target - livePrice) / livePrice * 100).toFixed(1)
                }
              }

              const researchAge = item ? formatRelativeDate(item.date) : null
              const isStale = item ? Math.floor((new Date() - new Date(item.date)) / (1000 * 60 * 60 * 24)) > 14 : false
              const earningsDate = item?.recentDevelopments?.detailedDevelopments?.nextEarningsCall?.date ||
                item?.recentDevelopments?.metrics?.find(m => m.label === 'Next Earnings' || m.label === 'Earnings Date')?.value

              return (
                <div key={sym} className={`bg-white/[0.05] backdrop-blur-2xl border rounded-[20px] p-5 group hover:border-white/[0.14] transition-all flex flex-col gap-4 ${item ? (sentiment?.border || 'border-white/[0.08]') : 'border-white/[0.08]'}`}>
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <CompanyLogo symbol={sym} className="w-11 h-11" />
                      <div>
                        <span className="text-lg font-bold text-white/90">{sym}</span>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {sentiment ? (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${sentiment.bg} ${sentiment.border} ${sentiment.text}`}>
                              {sentiment.label}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/30">
                              No Research
                            </span>
                          )}
                          {researchAge && (
                            <span className={`text-[10px] flex items-center gap-0.5 ${isStale ? 'text-amber-400' : 'text-white/25'}`}>
                              {isStale && <AlertTriangle className="h-2.5 w-2.5" />}
                              {researchAge}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveFromWatch(sym)}
                      className="p-1.5 hover:bg-rose-500/15 text-white/15 hover:text-rose-400 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Price row */}
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-medium text-white/30">
                          {livePrice ? 'Live Price' : storedPrice ? 'Last Price' : 'Price'}
                        </span>
                        {livePrice && priceSource === 'google' && (
                          <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">GF</span>
                        )}
                        {livePrice && priceSource === 'yahoo' && (
                          <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20" title="15-min delayed">YF</span>
                        )}
                      </div>
                      {priceLoading && !livePrice && !storedPrice ? (
                        <div className="h-7 w-20 bg-white/[0.06] rounded-lg animate-pulse" />
                      ) : (
                        <div className={`text-2xl font-bold font-mono ${livePrice ? 'text-white/85' : 'text-white/40'}`}>
                          {livePrice
                            ? `$${parseFloat(livePrice).toFixed(2)}`
                            : storedPrice
                              ? `$${parseFloat(storedPrice.replace(/[$,]/g, '')).toFixed(2)}`
                              : '—'}
                        </div>
                      )}
                    </div>
                    {item && (
                      <div className="text-right">
                        <div className="text-[10px] font-medium text-white/30 mb-1">Score</div>
                        <div className={`text-2xl font-bold font-mono ${sentiment?.text || 'text-white/50'}`}>
                          {item.overallRating}<span className="text-sm text-white/25">/100</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Target + Upside */}
                  {fmtTarget && (
                    <div className="flex items-center justify-between px-3 py-2 bg-white/[0.04] rounded-xl border border-white/[0.06]">
                      <div>
                        <div className="text-[10px] text-white/30 mb-0.5">Analyst Target</div>
                        <div className="text-sm font-semibold font-mono text-blue-400">{fmtTarget}</div>
                      </div>
                      {upsidePercent !== null && (
                        <div className={`text-sm font-bold ${parseFloat(upsidePercent) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {parseFloat(upsidePercent) >= 0 ? '+' : ''}{upsidePercent}%
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section scores */}
                  {item && (
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { key: 'Co', label: 'Company',  score: item.companyAnalysis?.rating },
                        { key: 'Fi', label: 'Financial', score: item.financialHealth?.rating },
                        { key: 'Te', label: 'Technical', score: item.technicalAnalysis?.rating },
                        { key: 'Ev', label: 'Events',   score: item.recentDevelopments?.rating },
                      ].map(({ key, label, score }) => (
                        <div key={key} className="flex flex-col items-center p-1.5 bg-white/[0.04] rounded-lg border border-white/[0.05]">
                          <div className="text-[9px] text-white/30 mb-0.5">{key}</div>
                          <div className={`text-[11px] font-semibold ${!score ? 'text-white/20' : score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                            {score || '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Earnings */}
                  {earningsDate && (
                    <div className="text-[11px] text-amber-400/80 flex items-center gap-1">
                      <Star className="h-3 w-3" /> Next earnings: {earningsDate}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto pt-1">
                    {item ? (
                      <>
                        <button
                          onClick={() => handleViewResearch(item)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white/60 hover:text-white/90 rounded-xl text-[11px] font-semibold transition-all"
                        >
                          <ExternalLink className="h-3 w-3" /> View Report
                        </button>
                        <button
                          onClick={() => handleRerunResearch(sym)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-xl text-[11px] font-semibold transition-all"
                          title="Re-run Research"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setSymbol(sym); handleSearch(null, sym) }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-[11px] font-semibold transition-all"
                      >
                        <Search className="h-3 w-3" /> Run Research
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state when nothing tracked */}
      {allTrackedSymbols.length === 0 && !companyData && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 bg-white/[0.04] rounded-2xl mb-4">
            <Bookmark className="h-8 w-8 text-white/20" />
          </div>
          <p className="text-sm font-medium text-white/30">No companies tracked yet</p>
          <p className="text-[11px] text-white/15 mt-1">Run research above or add a ticker to watch</p>
        </div>
      )}

          </div>
  )
}

export default CompanyResearch
