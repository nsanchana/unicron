import { useState, useRef, useEffect } from 'react'
import { Search, Loader, ChevronDown, ChevronUp, Star, AlertTriangle, CheckCircle, Save, RefreshCw, MessageCircle, Send, Bot, User, Trash2 } from 'lucide-react'
import { scrapeCompanyData } from '../services/webScraping'
import { saveToLocalStorage } from '../utils/storage'

// Helper function to format dates as DD/MM/YYYY
const formatDateDDMMYYYY = (dateString) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

// Helper function to format time as HH:MM:SS
const formatTime = (dateString) => {
  const date = new Date(dateString)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

function CompanyResearch({ researchData, setResearchData, lastRefresh }) {
  const [symbol, setSymbol] = useState('')
  const [loading, setLoading] = useState(false)
  const [companyData, setCompanyData] = useState(null)
  const [error, setError] = useState('')
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

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages])

  // Reset chat when company changes
  useEffect(() => {
    if (companyData) {
      setChatMessages([{
        role: 'assistant',
        content: `I've analyzed ${companyData.symbol} for you. Feel free to ask me any questions about the company's market position, business model, financials, growth strategy, or options trading opportunities.`
      }])
    }
  }, [companyData?.symbol])

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

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch (err) {
      console.error('Chat error:', err)
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
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
      saveToLocalStorage('researchData', updatedResearchData)

      // If the deleted item was being viewed, clear the display
      if (companyData && companyData.symbol === itemToDelete.symbol && companyData.date === itemToDelete.date) {
        setCompanyData(null)
      }
    }
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

  // Render a detailed analysis subsection with rating
  const renderDetailedSubsection = (subsection) => {
    if (!subsection) return null
    return (
      <div className="bg-gray-700 rounded-lg p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <h5 className="font-semibold text-primary-400">{subsection.title}</h5>
          <div className={`flex items-center space-x-1 ${getRatingColor(subsection.rating)}`}>
            <Star className="h-4 w-4 fill-current" />
            <span className="font-bold text-sm">{subsection.rating}/10</span>
          </div>
        </div>
        <p className="text-gray-300 text-sm leading-relaxed">{subsection.content}</p>
      </div>
    )
  }

  const renderSection = (title, sectionKey, data, rating) => {
    const isExpanded = expandedSections[sectionKey]
    const isCompanyAnalysis = sectionKey === 'companyAnalysis'
    const isTechnicalAnalysis = sectionKey === 'technicalAnalysis'
    const isRecentDevelopments = sectionKey === 'recentDevelopments'

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
            {/* Summary Analysis */}
            {data.analysis && (
              <div>
                <h4 className="font-medium mb-2">Executive Summary</h4>
                <p className="text-gray-300 text-sm leading-relaxed bg-gray-800 p-3 rounded-lg">{data.analysis}</p>
              </div>
            )}

            {/* Key Metrics - Special rendering for Technical Analysis */}
            {data.metrics && data.metrics.length > 0 && isTechnicalAnalysis && (
              <div>
                <h4 className="font-medium mb-3">Key Metrics</h4>
                {/* Current Price - Prominent Display */}
                {data.metrics.find(m => m.label === 'Current Price') && (
                  <div className="bg-gradient-to-r from-primary-900 to-primary-800 rounded-lg p-4 mb-4 border border-primary-600">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm">Current Price</span>
                      <span className="text-3xl font-bold text-white">
                        ${data.metrics.find(m => m.label === 'Current Price')?.value}
                      </span>
                    </div>
                  </div>
                )}

                {/* Support & Resistance Visual Display */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Support Levels */}
                  <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-green-500">
                    <h5 className="text-green-400 font-semibold mb-3 flex items-center">
                      <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                      Support Levels
                    </h5>
                    <div className="space-y-2">
                      {data.metrics
                        .filter(m => m.label.includes('Support'))
                        .map((metric, i) => (
                          <div key={i} className="bg-gray-700 rounded p-3">
                            <div className="text-green-300 font-medium text-lg">
                              {metric.value.split(' - ')[0]}
                            </div>
                            <div className="text-gray-400 text-sm mt-1">
                              {metric.value.split(' - ').slice(1).join(' - ')}
                            </div>
                          </div>
                        ))}
                      {data.metrics.filter(m => m.label.includes('Support')).length === 0 && (
                        <p className="text-gray-500 text-sm">No support levels identified</p>
                      )}
                    </div>
                  </div>

                  {/* Resistance Levels */}
                  <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-red-500">
                    <h5 className="text-red-400 font-semibold mb-3 flex items-center">
                      <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                      Resistance Levels
                    </h5>
                    <div className="space-y-2">
                      {data.metrics
                        .filter(m => m.label.includes('Resistance'))
                        .map((metric, i) => (
                          <div key={i} className="bg-gray-700 rounded p-3">
                            <div className="text-red-300 font-medium text-lg">
                              {metric.value.split(' - ')[0]}
                            </div>
                            <div className="text-gray-400 text-sm mt-1">
                              {metric.value.split(' - ').slice(1).join(' - ')}
                            </div>
                          </div>
                        ))}
                      {data.metrics.filter(m => m.label.includes('Resistance')).length === 0 && (
                        <p className="text-gray-500 text-sm">No resistance levels identified</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Key Metrics - Standard rendering for other sections */}
            {data.metrics && data.metrics.length > 0 && !isTechnicalAnalysis && (
              <div>
                <h4 className="font-medium mb-2">Key Metrics</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {data.metrics.map((metric, index) => (
                    <div key={index} className="flex justify-between text-sm bg-gray-800 p-2 rounded">
                      <span className="text-gray-400">{metric.label}:</span>
                      <span className="font-medium">{metric.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Analysis Sections - Only for Company Analysis */}
            {isCompanyAnalysis && data.detailedAnalysis && (
              <div>
                <h4 className="font-medium mb-3 mt-4 text-lg border-b border-gray-600 pb-2">Detailed Analysis</h4>
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
                <h4 className="font-medium mb-3 mt-4 text-lg border-b border-gray-600 pb-2">Technical Details</h4>

                {/* 30-60 Day Trend Outlook */}
                {data.detailedTechnical.trend30to60Days && (
                  <div className="bg-gray-700 rounded-lg p-4 mb-3">
                    <h5 className="font-semibold text-primary-400 mb-2">{data.detailedTechnical.trend30to60Days.title}</h5>
                    <p className="text-gray-300 text-sm leading-relaxed">{data.detailedTechnical.trend30to60Days.content}</p>
                  </div>
                )}

                {/* Support & Resistance Levels */}
                {data.detailedTechnical.supportResistance && (
                  <div className="bg-gray-700 rounded-lg p-4 mb-3">
                    <h5 className="font-semibold text-primary-400 mb-2">{data.detailedTechnical.supportResistance.title}</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h6 className="text-green-400 font-medium mb-2">Support Levels</h6>
                        {data.detailedTechnical.supportResistance.support?.length > 0 ? (
                          <ul className="space-y-1">
                            {data.detailedTechnical.supportResistance.support.map((level, i) => (
                              <li key={i} className="text-sm text-gray-300 flex items-center">
                                <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                                {level}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-400">No support levels identified</p>
                        )}
                      </div>
                      <div>
                        <h6 className="text-red-400 font-medium mb-2">Resistance Levels</h6>
                        {data.detailedTechnical.supportResistance.resistance?.length > 0 ? (
                          <ul className="space-y-1">
                            {data.detailedTechnical.supportResistance.resistance.map((level, i) => (
                              <li key={i} className="text-sm text-gray-300 flex items-center">
                                <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                                {level}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-400">No resistance levels identified</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Target Price Analysis */}
                {data.detailedTechnical.targetPriceAnalysis && (
                  <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-4 mb-3 border border-blue-700/30">
                    <h5 className="font-semibold text-blue-400 mb-2">{data.detailedTechnical.targetPriceAnalysis.title}</h5>
                    {data.detailedTechnical.targetPriceAnalysis.targetPrice && (
                      <div className="flex items-center mb-3">
                        <span className="text-gray-400 text-sm mr-2">Analyst Target:</span>
                        <span className="text-2xl font-bold text-blue-300">{data.detailedTechnical.targetPriceAnalysis.targetPrice}</span>
                      </div>
                    )}
                    <p className="text-gray-300 text-sm leading-relaxed">{data.detailedTechnical.targetPriceAnalysis.content}</p>
                  </div>
                )}

                {/* Options Strategy */}
                {data.detailedTechnical.optionsStrategy && (
                  <div className="bg-gray-700 rounded-lg p-4 mb-3">
                    <h5 className="font-semibold text-primary-400 mb-2">{data.detailedTechnical.optionsStrategy.title}</h5>
                    <p className="text-gray-300 text-sm leading-relaxed">{data.detailedTechnical.optionsStrategy.content}</p>
                  </div>
                )}
              </div>
            )}

            {/* Detailed Recent Developments */}
            {isRecentDevelopments && data.detailedDevelopments && (
              <div>
                <h4 className="font-medium mb-3 mt-4 text-lg border-b border-gray-600 pb-2">Event Details</h4>

                {/* Next Earnings Call */}
                {data.detailedDevelopments.nextEarningsCall && (
                  <div className="bg-gray-700 rounded-lg p-4 mb-3">
                    <h5 className="font-semibold text-primary-400 mb-2">{data.detailedDevelopments.nextEarningsCall.title}</h5>
                    <div className="flex items-center mb-2">
                      <span className="text-yellow-400 font-medium mr-2">Date:</span>
                      <span className="text-gray-200">{data.detailedDevelopments.nextEarningsCall.date}</span>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed">{data.detailedDevelopments.nextEarningsCall.expectation}</p>
                  </div>
                )}

                {/* Major Events */}
                {data.detailedDevelopments.majorEvents && data.detailedDevelopments.majorEvents.events?.length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-4 mb-3">
                    <h5 className="font-semibold text-primary-400 mb-2">{data.detailedDevelopments.majorEvents.title}</h5>
                    <div className="space-y-3">
                      {data.detailedDevelopments.majorEvents.events.map((event, i) => (
                        <div key={i} className="border-l-2 border-primary-500 pl-3">
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-gray-200">{event.event}</span>
                            {event.date && <span className="text-xs text-gray-400 ml-2">{event.date}</span>}
                          </div>
                          {event.expectedImpact && (
                            <p className="text-sm text-gray-400 mt-1">{event.expectedImpact}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upcoming Catalysts */}
                {data.detailedDevelopments.catalysts && (
                  <div className="bg-gray-700 rounded-lg p-4 mb-3">
                    <h5 className="font-semibold text-primary-400 mb-2">{data.detailedDevelopments.catalysts.title}</h5>
                    <p className="text-gray-300 text-sm leading-relaxed">{data.detailedDevelopments.catalysts.content}</p>
                  </div>
                )}

                {/* Options Implication */}
                {data.detailedDevelopments.optionsImplication && (
                  <div className="bg-gray-700 rounded-lg p-4 mb-3">
                    <h5 className="font-semibold text-primary-400 mb-2">{data.detailedDevelopments.optionsImplication.title}</h5>
                    <p className="text-gray-300 text-sm leading-relaxed">{data.detailedDevelopments.optionsImplication.content}</p>
                  </div>
                )}
              </div>
            )}

            {/* Signals */}
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
          {renderSection('Recent Developments', 'recentDevelopments', companyData.recentDevelopments, companyData.recentDevelopments?.rating)}

          {/* Chat Interface */}
          <div className="card">
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <MessageCircle className="h-5 w-5 text-primary-400" />
                <h3 className="text-lg font-semibold">Ask Questions About {companyData.symbol}</h3>
              </div>
              {chatOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>

            {chatOpen && (
              <div className="px-4 pb-4">
                {/* Chat Messages */}
                <div className="bg-gray-800 rounded-lg p-4 h-80 overflow-y-auto mb-4">
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
                    placeholder="Ask about market position, growth strategy, options trading..."
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

      {/* Previous Research */}
      {researchData.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Research History</h3>
          <div className="space-y-4">
            {researchData.slice(0, 10).map((item, index) => {
              // Extract current price and target price from technical analysis
              const currentPrice = item.technicalAnalysis?.currentPrice ||
                item.technicalAnalysis?.metrics?.find(m => m.label === 'Current Price')?.value
              const targetPrice = item.technicalAnalysis?.targetPrice ||
                item.technicalAnalysis?.metrics?.find(m => m.label === 'Target Price')?.value

              // Calculate upside percentage
              let upsidePercent = null
              if (currentPrice && targetPrice) {
                const current = parseFloat(currentPrice.replace(/[$,]/g, ''))
                const target = parseFloat(targetPrice.replace(/[$,]/g, ''))
                if (!isNaN(current) && !isNaN(target) && current > 0) {
                  upsidePercent = ((target - current) / current * 100).toFixed(1)
                }
              }

              return (
                <div key={index} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer" onClick={() => handleViewResearch(item)}>
                  {/* Single Row: Symbol, Price Boxes, Date, Rating, Actions */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <h4 className="font-semibold text-lg">{item.symbol}</h4>
                      {currentPrice && (
                        <div className="bg-gray-800 rounded px-2 py-1 flex items-center space-x-1">
                          <span className="text-xs text-gray-400">Current:</span>
                          <span className="text-white font-medium">{currentPrice.startsWith('$') ? currentPrice : `$${currentPrice}`}</span>
                        </div>
                      )}
                      {targetPrice && (
                        <div className="bg-blue-900/40 border border-blue-700/50 rounded px-2 py-1 flex items-center space-x-1">
                          <span className="text-xs text-blue-300">Target:</span>
                          <span className="text-blue-400 font-medium">{targetPrice.startsWith('$') ? targetPrice : `$${targetPrice}`}</span>
                        </div>
                      )}
                      {upsidePercent !== null && (
                        <div className={`rounded px-2 py-1 font-medium text-sm ${parseFloat(upsidePercent) >= 0 ? 'bg-green-900/40 border border-green-700/50 text-green-400' : 'bg-red-900/40 border border-red-700/50 text-red-400'}`}>
                          {parseFloat(upsidePercent) >= 0 ? '+' : ''}{upsidePercent}%
                        </div>
                      )}
                      <span className="text-sm text-gray-400">
                        {formatDateDDMMYYYY(item.date)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`text-lg font-bold ${getRatingColor(item.overallRating)}`}>
                        {item.overallRating}/10
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRerunResearch(item.symbol)
                        }}
                        className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                        title="Rerun research"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteResearch(index)
                        }}
                        className="p-2 hover:bg-red-900/50 rounded-lg transition-colors"
                        title="Delete research"
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default CompanyResearch