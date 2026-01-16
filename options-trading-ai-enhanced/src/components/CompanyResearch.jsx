import { useState } from 'react'
import { Search, Loader, ChevronDown, ChevronUp, Star, AlertTriangle, CheckCircle, Save, RefreshCw } from 'lucide-react'
import { scrapeCompanyData } from '../services/webScraping'
import { saveToLocalStorage } from '../utils/storage'

function CompanyResearch({ researchData, setResearchData, lastRefresh }) {
  const [symbol, setSymbol] = useState('')
  const [loading, setLoading] = useState(false)
  const [companyData, setCompanyData] = useState(null)
  const [error, setError] = useState('')
  const [expandedSections, setExpandedSections] = useState({
    companyAnalysis: true,
    financialHealth: true,
    technicalAnalysis: true,
    optionsData: true,
    recentDevelopments: true
  })

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!symbol.trim()) return

    setLoading(true)
    setError('')
    setCompanyData(null)

    try {
      // Scrape data in sections to avoid large requests
      const sections = [
        'companyAnalysis',
        'financialHealth',
        'technicalAnalysis',
        'optionsData',
        'recentDevelopments'
      ]

      const results = {}

      for (const section of sections) {
        console.log(`Scraping ${section} for ${symbol}...`)
        const sectionData = await scrapeCompanyData(symbol.toUpperCase(), section)
        results[section] = sectionData

        // Small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Calculate overall rating (equal weighting)
      const sectionRatings = [
        results.companyAnalysis?.rating || 0,
        results.financialHealth?.rating || 0,
        results.technicalAnalysis?.rating || 0,
        results.optionsData?.rating || 0,
        results.recentDevelopments?.rating || 0
      ].filter(rating => rating > 0)

      const overallRating = sectionRatings.length > 0
        ? Math.round(sectionRatings.reduce((sum, rating) => sum + rating, 0) / sectionRatings.length)
        : 0

      const researchEntry = {
        symbol: symbol.toUpperCase(),
        date: new Date().toISOString(),
        ...results,
        overallRating,
        lastRefresh: lastRefresh.toISOString(),
        saved: false // Mark as not saved initially
      }

      setCompanyData(researchEntry)
      // Don't add to researchData yet - only add when saved
    } catch (err) {
      setError('Failed to analyze company. Please check the symbol and try again.')
      console.error('Research error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveResearch = () => {
    if (!companyData) return

    // Mark as saved
    const savedResearch = { ...companyData, saved: true }

    // Add to research data array
    const updatedResearchData = [savedResearch, ...researchData]
    setResearchData(updatedResearchData)

    // Persist to localStorage
    saveToLocalStorage('researchData', updatedResearchData)

    // Update current display
    setCompanyData(savedResearch)

    // Show success message
    alert(`Research for ${companyData.symbol} saved successfully!`)
  }

  const handleViewResearch = (research) => {
    // Display the saved research
    setCompanyData(research)
    setSymbol(research.symbol)
    // Expand all sections when viewing saved research
    setExpandedSections({
      companyAnalysis: true,
      financialHealth: true,
      technicalAnalysis: true,
      optionsData: true,
      recentDevelopments: true
    })
    // Scroll to top to show the research
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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
        'optionsData',
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
        results.optionsData?.rating || 0,
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
        optionsData: true,
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
    if (rating >= 8) return 'text-green-400'
    if (rating >= 6) return 'text-yellow-400'
    if (rating >= 4) return 'text-orange-400'
    return 'text-red-400'
  }

  const getRatingIcon = (rating) => {
    if (rating >= 7) return <CheckCircle className="h-5 w-5 text-green-400" />
    if (rating >= 5) return <AlertTriangle className="h-5 w-5 text-yellow-400" />
    return <AlertTriangle className="h-5 w-5 text-red-400" />
  }

  const renderSection = (title, sectionKey, data, rating) => {
    const isExpanded = expandedSections[sectionKey]

    return (
      <div className="card">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <div className="flex items-center space-x-3">
            {getRatingIcon(rating)}
            <h3 className="text-lg font-semibold">{title}</h3>
            {rating && (
              <div className={`flex items-center space-x-1 ${getRatingColor(rating)}`}>
                <Star className="h-4 w-4 fill-current" />
                <span className="font-bold">{rating}/10</span>
              </div>
            )}
          </div>
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {isExpanded && data && (
          <div className="px-4 pb-4 space-y-3">
            {data.analysis && (
              <div>
                <h4 className="font-medium mb-2">Analysis</h4>
                <p className="text-gray-300 text-sm leading-relaxed">{data.analysis}</p>
              </div>
            )}

            {data.metrics && data.metrics.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Key Metrics</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {data.metrics.map((metric, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-400">{metric.label}:</span>
                      <span className="font-medium">{metric.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.signals && data.signals.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Signals</h4>
                <div className="space-y-1">
                  {data.signals.map((signal, index) => (
                    <div key={index} className={`text-sm p-2 rounded ${
                      signal.type === 'positive' ? 'bg-green-900 text-green-300' :
                      signal.type === 'negative' ? 'bg-red-900 text-red-300' :
                      'bg-yellow-900 text-yellow-300'
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
    <div className="space-y-6">
      {/* Search Form */}
      <div className="card">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="Enter stock symbol (e.g., AAPL, TSLA, NVDA)"
              className="input-primary w-full"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader className="h-5 w-5 animate-spin" />
            ) : (
              <Search className="h-5 w-5" />
            )}
            <span>{loading ? 'Analyzing...' : 'Analyze Company'}</span>
          </button>
        </form>

        {loading && (
          <div className="mt-4 p-4 bg-blue-900 border border-blue-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <Loader className="h-5 w-5 animate-spin text-blue-400" />
              <div>
                <p className="font-medium text-blue-400">Analyzing Company Data</p>
                <p className="text-sm text-blue-300">
                  Scraping multiple data sources... This may take a moment.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-900 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Analysis Results */}
      {companyData && (
        <div className="space-y-4">
          {/* Overall Rating Header */}
          <div className="card border-l-4 border-l-primary-500">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{companyData.symbol} Analysis</h2>
                <p className="text-gray-400">Comprehensive company research and rating</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <div className={`text-4xl font-bold ${getRatingColor(companyData.overallRating)}`}>
                    {companyData.overallRating}/10
                  </div>
                  <div className="text-sm text-gray-400">Overall Rating</div>
                </div>
                {!companyData.saved && (
                  <button
                    onClick={handleSaveResearch}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save Research</span>
                  </button>
                )}
                {companyData.saved && (
                  <div className="flex items-center space-x-2 text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Saved</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Analysis Sections */}
          {renderSection('Company Analysis', 'companyAnalysis', companyData.companyAnalysis, companyData.companyAnalysis?.rating)}
          {renderSection('Financial Health', 'financialHealth', companyData.financialHealth, companyData.financialHealth?.rating)}
          {renderSection('Technical Analysis', 'technicalAnalysis', companyData.technicalAnalysis, companyData.technicalAnalysis?.rating)}
          {renderSection('Options Market Data', 'optionsData', companyData.optionsData, companyData.optionsData?.rating)}
          {renderSection('Recent Developments', 'recentDevelopments', companyData.recentDevelopments, companyData.recentDevelopments?.rating)}
        </div>
      )}

      {/* Previous Research */}
      {researchData.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Research History</h3>
          <div className="space-y-4">
            {researchData.slice(0, 10).map((item, index) => (
              <div key={index} className="flex justify-between items-center p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                <div className="flex-1 cursor-pointer" onClick={() => handleViewResearch(item)}>
                  <h4 className="font-semibold">{item.symbol}</h4>
                  <p className="text-sm text-gray-400">
                    {new Date(item.date).toLocaleDateString()} • {new Date(item.lastRefresh).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${getRatingColor(item.overallRating)}`}>
                      {item.overallRating}/10
                    </div>
                    <p className="text-xs text-gray-400">Overall Rating</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRerunResearch(item.symbol)
                    }}
                    className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    title="Rerun research to get latest data"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default CompanyResearch