import { useState, useEffect, useCallback, useRef } from 'react'
import { TrendingUp, BarChart3, Settings, Download, RefreshCw, LogOut, Cloud, CloudOff, Briefcase, Bookmark, Menu, X } from 'lucide-react'
import CompanyResearch from './components/CompanyResearch'
import TradeReview from './components/TradeReview'
import Dashboard from './components/Dashboard'
import StockPortfolio from './components/StockPortfolio'
import SettingsPanel from './components/SettingsPanel'
import Login from './components/Login'
import Performance from './components/Performance'
import StrategySection from './components/StrategySection'
import Watchlist from './components/Watchlist'
import { saveToLocalStorage, loadFromLocalStorage, exportToCSV, STORAGE_KEYS } from './utils/storage'
import { scrapeCompanyData } from './services/webScraping'
import { fetchPrices } from './services/priceService'
import { API_BASE_URL } from './config'

// Helper function to format time as HH:MM:SS with DD/MM/YYYY
const formatDateTime = (date) => {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`
}

// Check if current time is within US Trading Hours (9:30 AM - 4:00 PM ET, Mon-Fri)
const isUSTradingHours = () => {
  const now = new Date()

  // Convert current time to ET (it's simpler to use intl for TZ conversion)
  const etTimeStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  const etDate = new Date(etTimeStr)

  const day = etDate.getDay() // 0 = Sun, 6 = Sat
  const hours = etDate.getHours()
  const minutes = etDate.getMinutes()

  // 0 (Sunday) or 6 (Saturday) are closed
  if (day === 0 || day === 6) return false

  const timeInMinutes = hours * 60 + minutes
  const marketOpen = 9 * 60 + 30 // 9:30 AM
  const marketClose = 16 * 60    // 4:00 PM

  return timeInMinutes >= marketOpen && timeInMinutes < marketClose
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(() => {
    const path = window.location.pathname
    const searchParams = new URLSearchParams(window.location.search)
    if (path === '/log') return 'trades'
    if (searchParams.has('ticker')) return 'research'
    return localStorage.getItem('active_tab') || 'dashboard'
  })
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    localStorage.setItem('active_tab', tab)
    setIsMobileMenuOpen(false)
  }
  const [researchData, setResearchData] = useState([])
  const [tradeData, setTradeData] = useState([])
  const [stockData, setStockData] = useState([])
  const [settings, setSettings] = useState({
    portfolioSize: 71000,
    weeklyPremiumTarget: { min: 340, max: 410 },
    maxTradePercentage: 50
  })
  const [strategyNotes, setStrategyNotes] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [theme, setTheme] = useState('dark')
  const [cloudSyncStatus, setCloudSyncStatus] = useState('idle') // 'idle', 'syncing', 'synced', 'error'
  const [lastCloudSync, setLastCloudSync] = useState(null)
  const [selectedResearch, setSelectedResearch] = useState(null)
  const [refreshingPrices, setRefreshingPrices] = useState(false)
  const [researchQueue, setResearchQueue] = useState([]) // Array of { symbol, status, progress, section }
  const saveTimeoutRef = useRef(null)

  // Research Queue Worker
  useEffect(() => {
    const processQueue = async () => {
      const pendingTaskIndex = researchQueue.findIndex(t => t.status === 'queued' || t.status === 'processing')
      if (pendingTaskIndex === -1) return

      const task = researchQueue[pendingTaskIndex]
      if (task.status === 'processing') return // Already being handled

      // Mark as processing
      const updateTask = (updates) => {
        setResearchQueue(prev => {
          const next = [...prev]
          next[pendingTaskIndex] = { ...next[pendingTaskIndex], ...updates }
          return next
        })
      }

      updateTask({ status: 'processing', progress: 0, section: 'Initializing' })

      try {
        const { symbol } = task
        const sections = ['companyAnalysis', 'financialHealth', 'technicalAnalysis', 'recentDevelopments']
        const results = {}
        const startTime = new Date()

        for (let i = 0; i < sections.length; i++) {
          const section = sections[i]
          const sectionDisplayName = section.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())

          updateTask({ section: sectionDisplayName, progress: Math.round((i / sections.length) * 100) })

          let sectionData = null
          let attempts = 0
          const maxAttempts = 2

          while (attempts < maxAttempts && !sectionData) {
            try {
              sectionData = await scrapeCompanyData(symbol, section)
            } catch (err) {
              attempts++
              if (attempts < maxAttempts) await new Promise(r => setTimeout(r, 2000))
            }
          }

          if (sectionData) {
            results[section] = sectionData
          }

          // Small delay between sections
          await new Promise(r => setTimeout(r, 1000))
        }

        // Finalize Research Object
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
          ? Math.round(allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length)
          : 0

        const newResearch = {
          symbol,
          date: startTime.toISOString(),
          ...results,
          overallRating,
          lastRefresh: startTime.toISOString(),
          saved: true,
          chatHistory: []
        }

        // Update Research Data
        setResearchData(prev => {
          const filtered = prev.filter(r => r.symbol !== symbol)
          const next = [newResearch, ...filtered]
          saveToLocalStorage(STORAGE_KEYS.RESEARCH_DATA, next)
          return next
        })

        updateTask({ status: 'completed', progress: 100, section: 'Done' })

        // Auto-remove completed tasks after 5 seconds
        setTimeout(() => {
          setResearchQueue(prev => prev.filter(t => t.symbol !== symbol))
        }, 5000)

      } catch (error) {
        console.error(`Research queue error for ${task.symbol}:`, error)
        updateTask({ status: 'error', section: 'Failed' })
      }
    }

    processQueue()
  }, [researchQueue, researchData])

  const handleAddToResearchQueue = (symbols) => {
    const symbolsArray = Array.isArray(symbols) ? symbols : [symbols]
    const newTasks = symbolsArray.map(s => ({
      symbol: s.toUpperCase(),
      status: 'queued',
      progress: 0,
      section: 'Waiting'
    }))

    setResearchQueue(prev => {
      const existingSymbols = new Set(prev.map(t => t.symbol))
      const filtered = newTasks.filter(t => !existingSymbols.has(t.symbol))
      return [...prev, ...filtered]
    })
  }

  const handleClearResearchQueue = () => {
    setResearchQueue(prev => prev.filter(t => t.status === 'processing' || t.status === 'queued'))
  }

  const handleGlobalPriceUpdate = async (isAutoRefresh = false) => {
    if (refreshingPrices) return
    setRefreshingPrices(true)

    try {
      // 1. Identify unique symbols that need updating
      const activeTradeSymbols = tradeData.filter(t => !t.closed).map(t => t.symbol)
      const activeStockSymbols = stockData.filter(s => !s.soldPrice).map(s => s.symbol)
      const uniqueSymbols = [...new Set([...activeTradeSymbols, ...activeStockSymbols])].filter(Boolean)

      if (uniqueSymbols.length === 0) {
        if (!isAutoRefresh) alert('No active trades or stocks to update.')
        setRefreshingPrices(false)
        return
      }

      // 2. Fetch prices in batch via Yahoo Finance (client-side, no server needed)
      const priceMap = await fetchPrices(uniqueSymbols)

      const now = new Date().toISOString()
      let updatedCount = 0

      // 3. Update Trade Data
      const updatedTradeData = tradeData.map(trade => {
        const price = priceMap[trade.symbol.toUpperCase()]
        if (!trade.closed && price != null) {
          updatedCount++
          return { ...trade, currentMarketPrice: price, lastPriceUpdate: now, priceSource: 'yahoo_finance' }
        }
        return trade
      })

      // 4. Update Stock Data
      const updatedStockData = stockData.map(stock => {
        const price = priceMap[stock.symbol.toUpperCase()]
        if (!stock.soldPrice && price != null) {
          updatedCount++
          return { ...stock, currentPrice: price, lastPriceUpdate: now, priceSource: 'yahoo_finance' }
        }
        return stock
      })

      // 5. Update State if changes and Persist
      if (updatedCount > 0) {
        setTradeData(updatedTradeData)
        setStockData(updatedStockData)
        saveToLocalStorage(STORAGE_KEYS.TRADE_DATA, updatedTradeData)
        saveToLocalStorage(STORAGE_KEYS.STOCK_DATA, updatedStockData)

        // Final sync attempt - Use existing saveToCloud helper
        if (user) {
          await saveToCloud(user.id || user.username, {
            researchData,
            tradeData: updatedTradeData,
            settings,
            stockData: updatedStockData,
            strategyNotes,
            chatHistory
          })
        }

        if (!isAutoRefresh) alert(`Successfully updated prices for ${Object.keys(priceMap).length} symbols.`)
      } else {
        if (!isAutoRefresh) alert('No prices were updated. Please check symbols or try again later.')
      }

    } catch (error) {
      console.error('Global price update failed:', error)
      if (!isAutoRefresh) alert(`An error occurred during the global price update: ${error.message}`)
    } finally {
      setRefreshingPrices(false)
    }
  }

  const handleViewResearch = (item) => {
    setSelectedResearch(item)
    handleTabChange('research')
  }

  const handleSettingsUpdate = (newSettings) => {
    setSettings(newSettings)
    saveToLocalStorage(STORAGE_KEYS.PORTFOLIO_SETTINGS, newSettings)
    if (user) {
      debouncedSaveToCloud(user.id || user.username, {
        researchData,
        tradeData,
        settings: newSettings,
        stockData,
        strategyNotes,
        chatHistory
      })
    }
  }

  const handleThemeToggle = (newTheme) => {
    setTheme(newTheme)
    localStorage.setItem('unicron_theme', newTheme)
    document.documentElement.classList.toggle('light-mode', newTheme === 'light')
  }

  const [initialCloudLoadComplete, setInitialCloudLoadComplete] = useState(false)

  // Migration helper for chat history
  const migrateChatHistory = useCallback((history) => {
    if (!history || !Array.isArray(history)) return []
    if (history.length === 0) return []

    // If first item has no 'messages' property but has 'role', it's the old format
    const isOldFormat = history[0] && !history[0].messages && history[0].role

    if (isOldFormat) {
      return [{
        id: `session-${Date.now()}`,
        title: 'Imported Chat',
        messages: history,
        lastModified: new Date().toISOString()
      }]
    }
    return history
  }, [])

  // Load data from cloud
  const loadFromCloud = useCallback(async (userId) => {
    try {
      setCloudSyncStatus('syncing')
      const response = await fetch(`/api/user-data?userId=${userId}`, {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to load from cloud')

      const cloudData = await response.json()

      // Always update local state with cloud data to ensure sync (even if empty)
      if (cloudData.researchData !== undefined) {
        setResearchData(cloudData.researchData)
        saveToLocalStorage(STORAGE_KEYS.RESEARCH_DATA, cloudData.researchData)
      }
      if (cloudData.tradeData !== undefined) {
        setTradeData(cloudData.tradeData)
        saveToLocalStorage(STORAGE_KEYS.TRADE_DATA, cloudData.tradeData)
      }
      if (cloudData.settings) {
        setSettings(cloudData.settings)
        saveToLocalStorage(STORAGE_KEYS.PORTFOLIO_SETTINGS, cloudData.settings)
      }
      if (cloudData.stockData !== undefined && Array.isArray(cloudData.stockData)) {
        setStockData(cloudData.stockData)
        saveToLocalStorage(STORAGE_KEYS.STOCK_DATA, cloudData.stockData)
      }
      if (cloudData.strategyNotes !== undefined) {
        setStrategyNotes(cloudData.strategyNotes)
        saveToLocalStorage(STORAGE_KEYS.STRATEGY_NOTES, cloudData.strategyNotes)
      }
      if (cloudData.chatHistory !== undefined) {
        const migratedChat = migrateChatHistory(cloudData.chatHistory)
        setChatHistory(migratedChat)
        saveToLocalStorage(STORAGE_KEYS.CHAT_HISTORY, migratedChat)
      }

      setLastCloudSync(cloudData.lastSynced ? new Date(cloudData.lastSynced) : null)
      setCloudSyncStatus('synced')
      return true
    } catch (error) {
      console.error('Failed to load from cloud:', error)
      setCloudSyncStatus('error')
      return false
    } finally {
      setInitialCloudLoadComplete(true)
    }
  }, [])

  // Save data to cloud (debounced)
  const saveToCloud = useCallback(async (userId, data) => {
    try {
      setCloudSyncStatus('syncing')
      const response = await fetch(`/api/user-data?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      })

      if (!response.ok) throw new Error('Failed to save to cloud')

      const result = await response.json()
      setLastCloudSync(new Date(result.lastSynced))
      setCloudSyncStatus('synced')
      return true
    } catch (error) {
      console.error('Failed to save to cloud:', error)
      setCloudSyncStatus('error')
      return false
    }
  }, [])

  // Debounced auto-save to cloud
  const debouncedSaveToCloud = useCallback((userId, data) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveToCloud(userId, data)
    }, 2000) // Save 2 seconds after last change
  }, [saveToCloud])

  useEffect(() => {
    // Check authentication status from localStorage
    const storedUser = localStorage.getItem('unicron_user')
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (error) {
        console.error('Failed to parse stored user:', error)
        localStorage.removeItem('unicron_user')
      }
    }

    // Load theme preference
    const savedTheme = localStorage.getItem('unicron_theme') || 'dark'
    setTheme(savedTheme)
    document.documentElement.classList.toggle('light-mode', savedTheme === 'light')

    setLoading(false)
  }, [])

  useEffect(() => {
    // Load saved data only when authenticated
    if (!user) return

    // First load from localStorage for immediate display
    const savedResearch = loadFromLocalStorage(STORAGE_KEYS.RESEARCH_DATA)
    if (savedResearch) setResearchData(savedResearch)
    const savedTrades = loadFromLocalStorage(STORAGE_KEYS.TRADE_DATA)
    if (savedTrades) setTradeData(savedTrades)
    const savedSettings = loadFromLocalStorage(STORAGE_KEYS.PORTFOLIO_SETTINGS)
    if (savedSettings) setSettings(savedSettings)
    const savedStocks = loadFromLocalStorage(STORAGE_KEYS.STOCK_DATA)
    if (savedStocks) setStockData(savedStocks)
    const savedNotes = loadFromLocalStorage(STORAGE_KEYS.STRATEGY_NOTES)
    if (savedNotes) setStrategyNotes(savedNotes)
    const savedChat = loadFromLocalStorage(STORAGE_KEYS.CHAT_HISTORY)
    if (savedChat) setChatHistory(migrateChatHistory(savedChat))

    // Then sync from cloud (will override local data if cloud has data)
    loadFromCloud(user.id || user.username)

    // Auto-refresh logic
    const refreshInterval = setInterval(() => {
      setLastRefresh(new Date())

      // If within US trading hours, trigger active price update
      if (isUSTradingHours()) {
        console.log('[Auto-Refresh] Market is open, updating prices...')
        handleGlobalPriceUpdate(true)
      }
    }, 60 * 1000) // 1 minute

    return () => clearInterval(refreshInterval)
  }, [user, loadFromCloud])

  // Auto-save to cloud when data changes
  useEffect(() => {
    if (!user || !initialCloudLoadComplete) return

    // Don't save on initial load if no data exists
    const hasData = researchData.length > 0 ||
      tradeData.length > 0 ||
      stockData.length > 0 ||
      (chatHistory && chatHistory.length > 0) ||
      (strategyNotes && strategyNotes.trim().length > 0)

    if (hasData) {
      debouncedSaveToCloud(user.id || user.username, {
        researchData,
        tradeData,
        settings,
        stockData,
        strategyNotes,
        chatHistory
      })
    }

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [user, researchData, tradeData, settings, debouncedSaveToCloud, stockData, strategyNotes, chatHistory])

  // Handle full data import
  const handleImportData = (importedData) => {
    try {
      if (importedData.researchData) setResearchData(importedData.researchData)
      if (importedData.tradeData) setTradeData(importedData.tradeData)
      if (importedData.stockData) setStockData(importedData.stockData)
      if (importedData.settings) {
        setSettings(importedData.settings)
        // Also update local storage for settings immediately
        localStorage.setItem('settings', JSON.stringify(importedData.settings))
      }
      if (importedData.strategyNotes) setStrategyNotes(importedData.strategyNotes)
      if (importedData.chatHistory) setChatHistory(importedData.chatHistory)

      // Force a save to cloud if user is logged in
      if (user) {
        debouncedSaveToCloud(user.id || user.username, {
          researchData: importedData.researchData || researchData,
          tradeData: importedData.tradeData || tradeData,
          stockData: importedData.stockData || stockData,
          settings: importedData.settings || settings,
          strategyNotes: importedData.strategyNotes || strategyNotes,
          chatHistory: importedData.chatHistory || chatHistory
        })
      }
      return true
    } catch (error) {
      console.error('Import failed:', error)
      return false
    }
  }

  // Handle full data export
  const handleExportData = () => {
    const fullData = {
      researchData,
      tradeData,
      stockData,
      settings,
      exportDate: new Date().toISOString(),
      version: '1.0'
    }

    // Create and download JSON file
    const dataStr = JSON.stringify(fullData, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `unicron_backup_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleLoginSuccess = (userData) => {
    setUser(userData)
    localStorage.setItem('unicron_user', JSON.stringify(userData))
  }

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      })
    } catch (error) {
      console.error('Logout failed:', error)
    }

    // Clear user and localStorage
    setUser(null)
    localStorage.removeItem('unicron_user')
    // Clear local data
    setResearchData([])
    setTradeData([])
    setStockData([])
  }

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-blue-500 animate-spin mx-auto" />
          <p className="text-sm text-white/40 font-medium">Loading…</p>
        </div>
      </div>
    )
  }

  // Show login if not authenticated
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />
  }

  const tabs = [
    { id: 'dashboard',   label: 'Dashboard',   shortLabel: 'Home',     icon: BarChart3  },
    { id: 'performance', label: 'Performance', shortLabel: 'Perf',     icon: TrendingUp },
    { id: 'research',    label: 'Research',    shortLabel: 'Research', icon: BarChart3  },
    { id: 'trades',      label: 'Trades',      shortLabel: 'Trades',   icon: TrendingUp },
    { id: 'stocks',      label: 'Stocks',      shortLabel: 'Stocks',   icon: Briefcase  },
    { id: 'settings',    label: 'Settings',    shortLabel: 'Settings', icon: Settings   },
  ]

  return (
    <div className="min-h-screen bg-black text-white flex">

      {/* ── Mobile Top Header ─────────────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-[#0a0a0f] border-b border-white/[0.06] flex items-center justify-between px-4">
        <button
          onClick={() => setIsMobileMenuOpen(prev => !prev)}
          className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.1] transition-all"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
            <img src="/unicron-logo.png" alt="Unicron" className="w-full h-full object-cover" />
          </div>
          <span className="text-sm font-bold text-white tracking-tight">Unicron</span>
        </div>
      </header>

      {/* ── Mobile Sidebar Overlay ────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar (desktop always visible, mobile slide-in drawer) ──── */}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-[#0a0a0f] border-r border-white/[0.06] flex-col z-50 transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'flex translate-x-0' : 'hidden md:flex md:translate-x-0'}
      `}>

        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shadow-lg flex-shrink-0">
              <img src="/unicron-logo.png" alt="Unicron" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="text-base font-bold text-white leading-none tracking-tight">Unicron</div>
              <div className="text-xs text-blue-400/70 mt-0.5 font-medium">Stock Trades</div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.05] border border-transparent'
                }`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-white/40'}`} />
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* Sidebar footer — sync, market status, refresh, user */}
        <div className="px-3 py-4 border-t border-white/[0.06] space-y-2">

          {/* Sync status */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium"
            title={lastCloudSync ? `Last synced: ${formatDateTime(lastCloudSync)}` : 'Not synced yet'}
            style={{
              background: cloudSyncStatus === 'synced' ? 'rgba(52,211,153,0.06)' :
                          cloudSyncStatus === 'syncing' ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.03)',
              borderColor: cloudSyncStatus === 'synced' ? 'rgba(52,211,153,0.2)' :
                           cloudSyncStatus === 'syncing' ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.06)',
              color: cloudSyncStatus === 'synced' ? '#34d399' :
                     cloudSyncStatus === 'syncing' ? '#fbbf24' : 'rgba(255,255,255,0.3)',
            }}
          >
            {cloudSyncStatus === 'syncing' ? <RefreshCw className="h-3 w-3 animate-spin" /> :
             cloudSyncStatus === 'synced'  ? <Cloud className="h-3 w-3" /> :
                                             <CloudOff className="h-3 w-3" />}
            {cloudSyncStatus === 'synced' ? 'Synced' : cloudSyncStatus === 'syncing' ? 'Syncing…' : 'Offline'}
            {isUSTradingHours() && (
              <span className="ml-auto flex items-center gap-1 text-emerald-400">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse inline-block" />
                Live
              </span>
            )}
          </div>

          {/* Refresh prices */}
          <button
            onClick={() => handleGlobalPriceUpdate()}
            disabled={refreshingPrices}
            className="w-full flex items-center gap-2 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl text-xs font-medium text-white/50 hover:text-white transition-all disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshingPrices ? 'animate-spin' : ''}`} />
            {refreshingPrices ? 'Updating prices…' : 'Refresh Prices'}
          </button>

          {/* User + logout */}
          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-xs font-semibold text-blue-400">{user.username}</span>
            <button
              onClick={handleLogout}
              className="p-1.5 bg-white/[0.04] hover:bg-rose-500/15 border border-white/[0.06] hover:border-rose-500/20 text-white/40 hover:text-rose-400 rounded-lg transition-all"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <main className="flex-1 md:ml-64 min-h-screen pt-14 md:pt-0 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            researchData={researchData}
            setResearchData={setResearchData}
            tradeData={tradeData}
            setTradeData={setTradeData}
            stockData={stockData}
            settings={settings}
            onViewResearch={handleViewResearch}
            onGlobalRefresh={handleGlobalPriceUpdate}
            isRefreshing={refreshingPrices}
            strategyNotes={strategyNotes}
            onSaveStrategy={(notes) => {
              setStrategyNotes(notes)
              saveToLocalStorage(STORAGE_KEYS.STRATEGY_NOTES, notes)
              if (user) {
                saveToCloud(user.id || user.username, {
                  researchData, tradeData, settings, stockData,
                  strategyNotes: notes, chatHistory
                })
              }
            }}
          />
        )}
        {activeTab === 'performance' && (
          <Performance
            tradeData={tradeData}
            stockData={stockData}
            settings={settings}
            chatHistory={chatHistory}
            onUpdateHistory={(history) => {
              setChatHistory(history)
              saveToLocalStorage(STORAGE_KEYS.CHAT_HISTORY, history)
            }}
          />
        )}
        {activeTab === 'research' && (
          <CompanyResearch
            researchData={researchData}
            setResearchData={setResearchData}
            lastRefresh={lastRefresh}
            selectedResearch={selectedResearch}
            onViewResearch={setSelectedResearch}
            researchQueue={researchQueue}
            onAddToQueue={handleAddToResearchQueue}
            onClearQueue={handleClearResearchQueue}
          />
        )}
        {activeTab === 'trades' && (
          <TradeReview
            tradeData={tradeData}
            setTradeData={setTradeData}
            portfolioSettings={settings}
            researchData={researchData}
            lastRefresh={lastRefresh}
          />
        )}
        {activeTab === 'stocks' && (
          <StockPortfolio
            stockData={stockData}
            onUpdate={(newData) => {
              setStockData(newData)
              saveToLocalStorage(STORAGE_KEYS.STOCK_DATA, newData)
            }}
          />
        )}
        {activeTab === 'watchlist' && (
          <Watchlist researchData={researchData} />
        )}
        {activeTab === 'settings' && (
          <SettingsPanel
            settings={settings}
            onSettingsUpdate={handleSettingsUpdate}
            theme={theme}
            onThemeToggle={handleThemeToggle}
            onImportData={handleImportData}
            onExportData={handleExportData}
          />
        )}
      </div>
      </main>


    </div>
  )
}

export default App