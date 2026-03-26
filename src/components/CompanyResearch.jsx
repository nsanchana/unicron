import { authHeaders } from '../utils/auth.js'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Loader2, AlertTriangle, CheckCircle, RefreshCw, Trash2, Plus, Bookmark } from 'lucide-react'
import { scrapeCompanyData } from '../services/webScraping'
import { fetchPrices as yahooFetchPrices } from '../services/priceService'
import { COMPANY_RESEARCH_VERSION } from '../config'
import { saveToLocalStorage, STORAGE_KEYS } from '../utils/storage'
import LargeTitle from './ui/LargeTitle'
import ResearchCard from './ResearchCard'
import ResearchReport from './ResearchReport'
import ChatSheet from './ChatSheet'
import { useToast } from './ui/Toast'

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
  const toast = useToast()
  const [selectedSymbols, setSelectedSymbols] = useState(new Set())
  const [symbol, setSymbol] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [currentLoadingSection, setCurrentLoadingSection] = useState('')
  const [companyData, setCompanyData] = useState(null)
  const [error, setError] = useState('')
  const [chatSheetOpen, setChatSheetOpen] = useState(false)

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
  // Chat state
  const [chatMessages, setChatMessages] = useState([])

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
      toast(`Research for ${companyData.symbol} updated`, 'success')
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
    toast(`Research for ${companyData.symbol} saved`, 'success')
  }

  const handleViewResearch = (research) => {
    // Display the saved research
    setCompanyData(research)
    if (onViewResearch) onViewResearch(research)
    setSymbol(research.symbol)
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

      // Scroll to top to show results
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError('Failed to rerun analysis. Please try again.')
      console.error('Rerun research error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Rendering functions moved to ResearchReport.jsx

  return (
    <div className="space-y-6 pb-12">
      {companyData ? (
        <>
          <ResearchReport
            companyData={companyData}
            onBack={() => setCompanyData(null)}
            onSave={handleSaveResearch}
            onOpenChat={() => setChatSheetOpen(true)}
          />
          <ChatSheet
            open={chatSheetOpen}
            onClose={() => setChatSheetOpen(false)}
            companyData={companyData}
            chatMessages={chatMessages}
            setChatMessages={setChatMessages}
          />
        </>
      ) : (
        <>
          <LargeTitle title="Research" subtitle="Deep-dive analysis and ratings for your watchlist.">
            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex gap-3 mt-4">
              <div className="flex-1 relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-tertiary group-focus-within:text-blue-400 transition-colors" />
                </div>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="Search ticker..."
                  className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl pl-12 pr-4 py-3 text-body text-white placeholder:text-disabled focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                />
              </div>
              <button type="submit" disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl transition-spring shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2 min-h-[44px]">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                <span className="hidden sm:inline">{loading ? 'Analyzing' : 'Research'}</span>
              </button>
            </form>
          </LargeTitle>

          {/* Loading progress */}
          {loading && (
            <div className="animate-fade-in">
              <div className="surface-2 rounded-2xl p-6 border-blue-500/30">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-primary">Analyzing {symbol.toUpperCase()}</h3>
                      <p className="text-sm text-secondary">Current step: <span className="text-blue-400 font-medium">{currentLoadingSection || 'Initializing...'}</span></p>
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
                    const isCompleted = loadingProgress > (i * 25)
                    const isActive = loadingProgress > (i * 25) && loadingProgress <= ((i + 1) * 25)
                    return (
                      <div key={step} className="text-center">
                        <div className={`text-overline mb-1 ${isCompleted ? 'text-blue-400' : 'text-tertiary'}`}>{step}</div>
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
            <div className="p-4 bg-rose-500/15 border border-rose-500/50 rounded-xl text-rose-200 flex items-start space-x-3 animate-fade-in">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Tracked Companies */}
          {allTrackedSymbols.length > 0 && (
            <div className="space-y-4">
              <div className="surface-2 rounded-2xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                      <Bookmark className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-primary">Tracked Companies</h3>
                        <span className="px-2 py-0.5 rounded-full surface-1 text-overline">{allTrackedSymbols.length}</span>
                      </div>
                      <p className="text-overline mt-0.5">
                        {researchData.length} researched
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
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-footnote font-medium rounded-full disabled:opacity-30 transition-all flex-shrink-0 min-h-[44px]"
                  >
                    <RefreshCw className={`h-3 w-3 ${priceLoading ? 'animate-spin' : ''}`} />
                    Refresh Prices
                  </button>
                </div>

                {/* Add to watchlist */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={watchInput}
                    onChange={e => setWatchInput(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleAddToWatch()}
                    placeholder="Add ticker to watch e.g. NVDA"
                    className="bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-2.5 text-sm font-semibold text-white placeholder:text-disabled focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all flex-1 max-w-xs uppercase"
                  />
                  <button
                    onClick={handleAddToWatch}
                    disabled={!watchInput.trim()}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-spring disabled:opacity-40 min-h-[44px]"
                  >
                    <Plus className="h-4 w-4" /> Watch
                  </button>
                </div>

                {/* Sort pills */}
                <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-0.5">
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
                      className={`flex-none flex items-center gap-1 px-3 py-1.5 rounded-full text-footnote font-medium transition-all whitespace-nowrap min-h-[44px] ${
                        sortBy === s.key
                          ? 'bg-blue-500 text-white'
                          : 'surface-1 text-tertiary hover:text-secondary'
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
                      <span className="text-footnote font-semibold text-blue-400">Queue</span>
                      <span className="text-footnote text-tertiary">{researchQueue.filter(t => t.status === 'completed').length}/{researchQueue.length} done</span>
                    </div>
                    <button onClick={onClearQueue} className="text-footnote text-tertiary hover:text-secondary flex items-center gap-1 transition-all min-h-[44px]">
                      <Trash2 className="h-3 w-3" /> Clear
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {researchQueue.map((task, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.status === 'processing' ? 'bg-blue-400 animate-pulse' : task.status === 'queued' ? 'bg-white/20' : 'bg-emerald-400'}`} />
                          <span className="text-footnote font-semibold text-secondary">{task.symbol}</span>
                          <span className="text-overline">{task.section || 'Waiting'}</span>
                        </div>
                        {task.status === 'processing' && <span className="text-overline text-blue-400">{task.progress}%</span>}
                        {task.status === 'completed' && <CheckCircle className="h-3 w-3 text-emerald-400" />}
                        {task.status === 'error' && <AlertTriangle className="h-3 w-3 text-rose-400" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Google Finance failure warning */}
              {googleFailed && !priceLoading && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-footnote">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Google Finance unavailable — prices are 15-min delayed (Yahoo Finance fallback).</span>
                </div>
              )}

              {/* Card Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {unifiedCards.map(({ symbol: sym, research: item, watchItem, livePrice, storedPrice, priceSource }) => (
                  <ResearchCard
                    key={sym}
                    symbol={sym}
                    research={item}
                    livePrice={livePrice}
                    storedPrice={storedPrice}
                    priceSource={priceSource}
                    onView={handleViewResearch}
                    onRerun={handleRerunResearch}
                    onDelete={handleRemoveFromWatch}
                    onRunResearch={(s) => { setSymbol(s); handleSearch(null, s) }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {allTrackedSymbols.length === 0 && !companyData && !loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 surface-1 rounded-2xl mb-4">
                <Bookmark className="h-8 w-8 text-disabled" />
              </div>
              <p className="text-sm font-medium text-tertiary">No companies tracked yet</p>
              <p className="text-overline mt-1">Run research above or add a ticker to watch</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default CompanyResearch

