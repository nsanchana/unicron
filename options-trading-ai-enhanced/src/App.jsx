import { useState, useEffect } from 'react'
import { TrendingUp, BarChart3, Settings, Download, Save, RefreshCw } from 'lucide-react'
import CompanyResearch from './components/CompanyResearch'
import TradeReview from './components/TradeReview'
import Dashboard from './components/Dashboard'
import SettingsPanel from './components/SettingsPanel'
import { saveToLocalStorage, loadFromLocalStorage, exportToCSV } from './utils/storage'

function App() {
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
    // Load saved data on component mount
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
  }, [])

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

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'research', label: 'Company Research', icon: BarChart3 },
    { id: 'trades', label: 'Trade Review', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-primary-400">Options Trading Analysis Tool</h1>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                Last refresh: {lastRefresh.toLocaleTimeString()}
              </div>
              <button
                onClick={() => setLastRefresh(new Date())}
                className="p-2 rounded-lg hover:bg-gray-700"
                title="Refresh data"
              >
                <RefreshCw className="h-5 w-5" />
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
      <nav className="border-b border-gray-700 bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
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