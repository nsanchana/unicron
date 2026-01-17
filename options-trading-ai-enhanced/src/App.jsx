import { useState, useEffect } from 'react'
import { TrendingUp, BarChart3, Settings, Download, RefreshCw, LogOut } from 'lucide-react'
import CompanyResearch from './components/CompanyResearch'
import TradeReview from './components/TradeReview'
import Dashboard from './components/Dashboard'
import SettingsPanel from './components/SettingsPanel'
import UnicronIcon from './components/UnicronIcon'
import Login from './components/Login'
import { saveToLocalStorage, loadFromLocalStorage, exportToCSV } from './utils/storage'
import { API_BASE_URL } from './config'

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

  useEffect(() => {
    // Check authentication status on mount
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          credentials: 'include'
        })

        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  useEffect(() => {
    // Load saved data only when authenticated
    if (!user) return

    const savedResearch = loadFromLocalStorage('researchData')
    const savedTrades = loadFromLocalStorage('tradeData')
    const savedSettings = loadFromLocalStorage('settings')

    if (savedResearch) setResearchData(savedResearch)
    if (savedTrades) setTradeData(savedTrades)
    if (savedSettings) setSettings(savedSettings)

    // Auto-refresh every 10 minutes
    const refreshInterval = setInterval(() => {
      setLastRefresh(new Date())
    }, 10 * 60 * 1000) // 10 minutes

    return () => clearInterval(refreshInterval)
  }, [user])

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

  const handleLoginSuccess = (userData) => {
    setUser(userData)
  }

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      })
      setUser(null)
      // Clear local data
      setResearchData([])
      setTradeData([])
    } catch (error) {
      console.error('Logout failed:', error)
    }
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-blue-900/20 text-white">
      {/* Header */}
      <header className="border-b border-gray-700/50 bg-gray-800/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <UnicronIcon className="h-10 w-10" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Unicron
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                <span className="text-blue-400 font-medium">{user.username}</span> • Last refresh: {lastRefresh.toLocaleTimeString()}
              </div>
              <button
                onClick={() => setLastRefresh(new Date())}
                className="p-2 rounded-lg hover:bg-gray-700/50 transition-all duration-200"
                title="Refresh data"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
              {activeTab === 'research' && researchData.length > 0 && (
                <button
                  onClick={handleExportResearch}
                  className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <Download className="h-4 w-4" />
                  <span>Export Research</span>
                </button>
              )}
              {activeTab === 'trades' && tradeData.length > 0 && (
                <button
                  onClick={handleExportTrades}
                  className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <Download className="h-4 w-4" />
                  <span>Export Trades</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-gray-700/50 bg-gray-800/50 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
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
          />
        )}
      </main>
    </div>
  )
}

export default App