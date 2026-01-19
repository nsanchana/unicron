import { useState, useEffect, useCallback, useRef } from 'react'
import { TrendingUp, BarChart3, Settings, Download, RefreshCw, LogOut, Cloud, CloudOff } from 'lucide-react'
import CompanyResearch from './components/CompanyResearch'
import TradeReview from './components/TradeReview'
import Dashboard from './components/Dashboard'
import SettingsPanel from './components/SettingsPanel'
import Login from './components/Login'
import { saveToLocalStorage, loadFromLocalStorage, exportToCSV } from './utils/storage'
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

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [researchData, setResearchData] = useState([])
  const [tradeData, setTradeData] = useState([])
  const [settings, setSettings] = useState({
    portfolioSize: 71000,
    weeklyPremiumTarget: { min: 340, max: 410 },
    maxTradePercentage: 50
  })
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [theme, setTheme] = useState('dark')
  const [cloudSyncStatus, setCloudSyncStatus] = useState('idle') // 'idle', 'syncing', 'synced', 'error'
  const [lastCloudSync, setLastCloudSync] = useState(null)
  const saveTimeoutRef = useRef(null)

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

      // Use cloud data if it exists, otherwise keep local data
      if (cloudData.researchData?.length > 0) {
        setResearchData(cloudData.researchData)
        saveToLocalStorage('researchData', cloudData.researchData)
      }
      if (cloudData.tradeData?.length > 0) {
        setTradeData(cloudData.tradeData)
        saveToLocalStorage('tradeData', cloudData.tradeData)
      }
      if (cloudData.settings) {
        setSettings(cloudData.settings)
        saveToLocalStorage('settings', cloudData.settings)
      }

      setLastCloudSync(cloudData.lastSynced ? new Date(cloudData.lastSynced) : null)
      setCloudSyncStatus('synced')
      return true
    } catch (error) {
      console.error('Failed to load from cloud:', error)
      setCloudSyncStatus('error')
      return false
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
    const savedResearch = loadFromLocalStorage('researchData')
    const savedTrades = loadFromLocalStorage('tradeData')
    const savedSettings = loadFromLocalStorage('settings')

    if (savedResearch) setResearchData(savedResearch)
    if (savedTrades) setTradeData(savedTrades)
    if (savedSettings) setSettings(savedSettings)

    // Then sync from cloud (will override local data if cloud has data)
    loadFromCloud(user.id || user.username)

    // Auto-refresh every 10 minutes
    const refreshInterval = setInterval(() => {
      setLastRefresh(new Date())
    }, 10 * 60 * 1000) // 10 minutes

    return () => clearInterval(refreshInterval)
  }, [user, loadFromCloud])

  // Auto-save to cloud when data changes
  useEffect(() => {
    if (!user) return

    // Don't save on initial load
    const hasData = researchData.length > 0 || tradeData.length > 0

    if (hasData) {
      debouncedSaveToCloud(user.id || user.username, {
        researchData,
        tradeData,
        settings
      })
    }

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [user, researchData, tradeData, settings, debouncedSaveToCloud])

  const handleExportResearch = () => {
    exportToCSV(researchData, 'company-research')
  }

  const handleExportTrades = () => {
    exportToCSV(tradeData, 'trade-analysis')
  }

  const handleSettingsUpdate = (newSettings) => {
    setSettings(newSettings)
    saveToLocalStorage('settings', newSettings)
  }

  const handleThemeToggle = (newTheme) => {
    setTheme(newTheme)
    localStorage.setItem('unicron_theme', newTheme)
    document.documentElement.classList.toggle('light-mode', newTheme === 'light')
  }

  const handleLoginSuccess = (userData) => {
    setUser(userData)
    // Store user in localStorage
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
  }

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-blue-900/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login if not authenticated
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'research', label: 'Company Research', icon: BarChart3 },
    { id: 'trades', label: 'Trades', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  return (
    <div className={`min-h-screen bg-gradient-to-br text-white transition-colors duration-300 relative ${theme === 'light'
        ? 'from-gray-50 via-white to-blue-50'
        : 'from-[#0f172a] via-[#1e293b] to-[#0f172a]'
      }`}>
      {/* Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px]"></div>
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-50 border-b backdrop-blur-2xl transition-all duration-300 ${theme === 'light'
          ? 'border-gray-200 bg-white/70'
          : 'border-white/5 bg-gray-900/60'
        }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-gray-800/50 rounded-xl border border-white/10 shadow-xl animate-float">
                <img
                  src="/unicron-logo.png"
                  alt="Unicron Logo"
                  className="h-10 w-10 object-contain"
                />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Unicron
                </h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">Intelligence Terminal</p>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              {/* Cloud Sync Status */}
              <div className="hidden md:flex items-center space-x-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/5" title={lastCloudSync ? `Last synced: ${formatDateTime(lastCloudSync)}` : 'Not synced yet'}>
                {cloudSyncStatus === 'syncing' ? (
                  <div className="flex items-center space-x-2 text-yellow-400">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-wider">Syncing</span>
                  </div>
                ) : cloudSyncStatus === 'synced' ? (
                  <div className="flex items-center space-x-2 text-emerald-400">
                    <Cloud className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Securely Synced</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-gray-500">
                    <CloudOff className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Offline</span>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-black text-blue-400 uppercase tracking-wider">{user.username}</div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Active Session</div>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition-all active:scale-95"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className={`sticky top-20 z-40 border-b backdrop-blur-xl transition-all duration-300 ${theme === 'light'
          ? 'border-gray-200 bg-gray-50/50'
          : 'border-white/5 bg-gray-900/40'
        }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center space-x-2 py-5 px-6 font-bold text-sm transition-all duration-300 ${isActive
                      ? 'text-blue-400'
                      : 'text-gray-500 hover:text-gray-300'
                    }`}
                >
                  <Icon className={`h-5 w-5 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} />
                  <span className="uppercase tracking-widest">{tab.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && (
          <Dashboard
            researchData={researchData}
            tradeData={tradeData}
            setTradeData={setTradeData}
            settings={settings}
          />
        )}
        {activeTab === 'research' && (
          <CompanyResearch
            researchData={researchData}
            setResearchData={setResearchData}
            lastRefresh={lastRefresh}
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
        {activeTab === 'settings' && (
          <SettingsPanel
            settings={settings}
            onSettingsUpdate={handleSettingsUpdate}
            theme={theme}
            onThemeToggle={handleThemeToggle}
          />
        )}
      </main>
    </div>
  )
}

export default App