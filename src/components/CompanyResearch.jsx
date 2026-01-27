import { useState, useRef, useEffect } from 'react'
import { Search, Loader, Loader2, ChevronDown, ChevronUp, Star, AlertTriangle, CheckCircle, Save, RefreshCw, MessageCircle, Send, Bot, User, Trash2 } from 'lucide-react'
import { scrapeCompanyData } from '../services/webScraping'
import { saveToLocalStorage, STORAGE_KEYS } from '../utils/storage'

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

function CompanyResearch({ researchData, setResearchData, lastRefresh }) {
  const [symbol, setSymbol] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [currentLoadingSection, setCurrentLoadingSection] = useState('')
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

  // Sorting state for research history
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')

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

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!symbol.trim()) return

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
        symbol: symbol.toUpperCase(),
        date: lastRefresh.toISOString(),
        lastRefresh: lastRefresh.toISOString(),
        overallRating: 0,
        loading: true
      })

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i]
        setCurrentLoadingSection(section.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()))
        console.log(`Scraping ${section} for ${symbol}...`)

        let sectionData = null
        let attempts = 0
        const maxAttempts = 3

        while (attempts < maxAttempts && !sectionData) {
          try {
            sectionData = await scrapeCompanyData(symbol.toUpperCase(), section)
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
            updated.overallRating = Math.round((allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length) * 10)
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
    } else {
      updatedResearchData = [savedResearch, ...researchData]
    }

    setResearchData(updatedResearchData)

    // Persist to localStorage
    saveToLocalStorage(STORAGE_KEYS.RESEARCH_DATA, updatedResearchData)

    // Update current display
    setCompanyData(savedResearch)

    // Show success message
    alert(`Research for ${companyData.symbol} saved successfully with chat history!`)
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
      saveToLocalStorage(STORAGE_KEYS.RESEARCH_DATA, updatedResearchData)

      // If the deleted item was being viewed, clear the display
      if (companyData && companyData.symbol === itemToDelete.symbol && companyData.date === itemToDelete.date) {
        setCompanyData(null)
      }
    }
  }

  // Sorting function for research history
  const handleSort = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(newSortBy)
      setSortOrder('desc')
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
      default:
        return 0
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
    }
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
    const r = rating > 10 ? rating / 10 : rating
    if (r >= 8) return 'text-green-400'
    if (r >= 6) return 'text-yellow-400'
    if (r >= 4) return 'text-orange-400'
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
      <div className="glass-card mb-3">
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
      <div className="glass-card">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-lg transition-colors"
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
                <p className="text-gray-300 text-sm leading-relaxed glass-item">{data.analysis}</p>
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

                {/* Target Price Analysis - Moved Here */}
                {data.detailedTechnical?.targetPriceAnalysis && (
                  <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-4 mb-4 border border-blue-700/30">
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

                {/* Support & Resistance Visual Display */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Support Levels */}
                  <div className="glass-card border-l-4 border-green-500">
                    <h5 className="text-green-400 font-semibold mb-3 flex items-center">
                      <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                      Support Levels
                    </h5>
                    <div className="space-y-2">
                      {data.metrics
                        .filter(m => m.label.includes('Support'))
                        .map((metric, i) => (
                          <div key={i} className="glass-item">
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
                  <div className="glass-card border-l-4 border-red-500">
                    <h5 className="text-red-400 font-semibold mb-3 flex items-center">
                      <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                      Resistance Levels
                    </h5>
                    <div className="space-y-2">
                      {data.metrics
                        .filter(m => m.label.includes('Resistance'))
                        .map((metric, i) => (
                          <div key={i} className="glass-item">
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
                    <div key={index} className="flex justify-between text-sm glass-item p-2">
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
                  <div className="glass-card mb-3">
                    <h5 className="font-semibold text-primary-400 mb-2">{data.detailedTechnical.trend30to60Days.title}</h5>
                    <p className="text-gray-300 text-sm leading-relaxed">{data.detailedTechnical.trend30to60Days.content}</p>
                  </div>
                )}



                {/* Options Strategy */}
                {data.detailedTechnical.optionsStrategy && (
                  <div className="glass-card mb-3">
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
                  <div className="glass-card mb-3">
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
                  <div className="glass-card mb-3">
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
                  <div className="glass-card mb-3">
                    <h5 className="font-semibold text-primary-400 mb-2">{data.detailedDevelopments.catalysts.title}</h5>
                    <p className="text-gray-300 text-sm leading-relaxed">{data.detailedDevelopments.catalysts.content}</p>
                  </div>
                )}

                {/* Options Implication */}
                {data.detailedDevelopments.optionsImplication && (
                  <div className="glass-card mb-3">
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
                    <div key={index} className={`text-sm p-2 rounded ${signal.type === 'positive' ? 'bg-green-900 text-green-300' :
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
    <div className="space-y-8 pb-12">
      {/* Search Form */}
      <div className="glass-card shadow-blue-500/5">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
            </div>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="SEARCH ASSET (E.G. AAPL, TSLA, NVDA)"
              className="glass-input w-full pl-12 py-4 text-lg font-black tracking-widest placeholder:text-gray-700"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest px-8 rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/25 active:scale-95 disabled:opacity-50 flex items-center space-x-3"
          >
            {loading ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <Search className="h-5 w-5" />
            )}
            <span>{loading ? 'Analyzing' : 'Research'}</span>
          </button>
        </form>

        {/* Progress Bar when loading */}
        {loading && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="glass-card p-6 border-primary-500/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary-500/20 rounded-lg">
                    <Loader2 className="h-5 w-5 text-primary-400 animate-spin" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Analyzing {symbol.toUpperCase()}</h3>
                    <p className="text-sm text-gray-400">Current step: <span className="text-primary-400 font-medium">{currentLoadingSection || 'Initializing...'}</span></p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-primary-400">{loadingProgress}%</span>
              </div>

              <div className="w-full h-3 bg-gray-800/50 rounded-full overflow-hidden border border-white/5 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-primary-600 via-primary-400 to-accent-400 rounded-full transition-all duration-700 ease-out shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {['Company', 'Financial', 'Technical', 'Events'].map((step, i) => {
                  const isCompleted = loadingProgress > (i * 25);
                  const isActive = loadingProgress > (i * 25) && loadingProgress <= ((i + 1) * 25);
                  return (
                    <div key={step} className="text-center">
                      <div className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${isCompleted ? 'text-primary-400' : 'text-gray-600'}`}>
                        {step}
                      </div>
                      <div className={`h-1.5 rounded-full transition-colors duration-500 ${isCompleted ? 'bg-primary-500/50' : 'bg-gray-800'}`}>
                        {isActive && <div className="h-full bg-primary-400 rounded-full animate-pulse" style={{ width: '100%' }}></div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-8 p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-200 flex items-start space-x-3 animate-in fade-in slide-in-from-top-4">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}
      </div>

      {companyData && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Overall Rating Header */}
          <div className="glass-card bg-gradient-to-r from-blue-600/10 to-transparent border-blue-500/20">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black tracking-tight">{companyData.symbol} Analysis</h2>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-1">Deep Intelligence Report</p>
              </div>
              <div className="flex items-center space-x-8">
                <div className="text-center">
                  <div className={`text-5xl font-black ${getRatingColor(companyData.overallRating)} text-shadow-glow`}>
                    {companyData.overallRating}
                  </div>
                  <div className="text-[10px] text-gray-500 font-black uppercase tracking-tighter mt-1">Global Score</div>
                </div>
                {!companyData.saved ? (
                  <button
                    onClick={handleSaveResearch}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-6 py-3 rounded-xl font-bold uppercase tracking-widest transition-all active:scale-95 flex items-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save Report</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2 text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-black uppercase tracking-widest">Secured</span>
                  </div>
                )}
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
          <div className="glass-card">
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-lg transition-colors"
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
                <div className="bg-gray-900/50 backdrop-blur-md rounded-xl border border-white/5 p-4 h-[500px] overflow-y-auto mb-4 pr-2 custom-scrollbar">
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
                          ? 'bg-primary-600 text-white'
                          : 'glass-item text-gray-200'
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
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Research History</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => handleSort('date')}
                className={`px-3 py-1 rounded text-sm ${sortBy === 'date' ? 'bg-blue-600 text-white' : 'glass-button text-gray-300'}`}
              >
                Date {sortBy === 'date' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => handleSort('rating')}
                className={`px-3 py-1 rounded text-sm ${sortBy === 'rating' ? 'bg-blue-600 text-white' : 'glass-button text-gray-300'}`}
              >
                Rating {sortBy === 'rating' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => handleSort('currentPrice')}
                className={`px-3 py-1 rounded text-sm ${sortBy === 'currentPrice' ? 'bg-blue-600 text-white' : 'glass-button text-gray-300'}`}
              >
                Current Price {sortBy === 'currentPrice' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => handleSort('targetPrice')}
                className={`px-3 py-1 rounded text-sm ${sortBy === 'targetPrice' ? 'bg-blue-600 text-white' : 'glass-button text-gray-300'}`}
              >
                Target Price {sortBy === 'targetPrice' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
            </div>
          </div>
          <div className="space-y-4">
            {sortedResearchData.slice(0, 10).map((item) => {
              const itemKey = `${item.symbol}-${item.date}`
              // Extract current price and target price from technical analysis
              let currentPrice = item.technicalAnalysis?.currentPrice ||
                item.technicalAnalysis?.metrics?.find(m => m.label === 'Current Price')?.value
              let targetPrice = item.technicalAnalysis?.targetPrice ||
                item.technicalAnalysis?.metrics?.find(m => m.label === 'Target Price')?.value

              // Sanitize prices (remove trailing commas/spaces)
              if (currentPrice) currentPrice = currentPrice.replace(/,\s*$/, '').trim()
              if (targetPrice) targetPrice = targetPrice.replace(/,\s*$/, '').trim()

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
                <div key={itemKey} className="glass-item p-5 hover:bg-white/5 transition-all duration-300 border border-white/5 hover:border-white/10 group relative overflow-hidden cursor-pointer" onClick={() => handleViewResearch(item)}>
                  {/* Background Glow Effect */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity opacity-50 group-hover:opacity-100"></div>

                  {/* Header Row */}
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="flex items-center space-x-4">
                      {/* Gradient Initials Icon */}
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 p-[1px] shadow-lg shadow-blue-500/20">
                        <div className="w-full h-full rounded-2xl bg-gray-900/90 backdrop-blur-xl flex items-center justify-center">
                          <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400">
                            {item.symbol.slice(0, 2)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-2xl font-black tracking-tight text-white mb-0.5">{item.symbol}</h4>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Research Report</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end space-y-2">
                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{formatDateDDMMYYYY(item.date)}</span>
                        {/* Action Buttons */}
                        <div className="flex items-center space-x-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRerunResearch(item.symbol); }}
                            className="p-1.5 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 rounded-lg transition-all"
                            title="Rerun research"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); const originalIndex = researchData.findIndex(r => r.symbol === item.symbol && r.date === item.date); handleDeleteResearch(originalIndex); }}
                            className="p-1.5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-all"
                            title="Delete research"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className={`px-3 py-1 rounded-lg border ${item.overallRating >= 70 ? 'bg-green-500/10 border-green-500/20 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.1)]' :
                        item.overallRating >= 50 ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.1)]' :
                          'bg-red-500/10 border-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
                        }`}>
                        <span className="text-[10px] font-black uppercase tracking-widest mr-2 opacity-70">Rating:</span>
                        <span className="text-sm font-bold">{item.overallRating}/100</span>
                      </div>
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
                    {/* Current Price Box */}
                    <div className="bg-[#0f172a]/80 rounded-xl p-3 border border-white/5 shadow-inner">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Current</div>
                      <div className="text-xl font-bold text-white">
                        {currentPrice ? (currentPrice.startsWith('$') ? currentPrice : `$${currentPrice}`) : 'N/A'}
                      </div>
                    </div>

                    {/* Target Price Box */}
                    <div className="bg-[#1e293b]/50 rounded-xl p-3 border border-blue-500/10 shadow-inner group-hover:border-blue-500/20 transition-colors">
                      <div className="text-[10px] font-bold text-blue-400/70 uppercase tracking-widest mb-1">Target</div>
                      <div className="text-xl font-bold text-blue-100">
                        {targetPrice ? (targetPrice.startsWith('$') ? targetPrice : `$${targetPrice}`) : 'N/A'}
                      </div>
                    </div>

                    {/* Potential Box */}
                    <div className={`rounded-xl p-3 border shadow-inner transition-colors ${parseFloat(upsidePercent) >= 0
                      ? 'bg-green-900/10 border-green-500/10 group-hover:border-green-500/20'
                      : 'bg-red-900/10 border-red-500/10 group-hover:border-red-500/20'
                      }`}>
                      <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${parseFloat(upsidePercent) >= 0 ? 'text-green-400/70' : 'text-red-400/70'
                        }`}>Potential</div>
                      <div className={`text-xl font-bold ${parseFloat(upsidePercent) >= 0 ? 'text-green-100' : 'text-red-100'
                        }`}>
                        {upsidePercent !== null ? (
                          <>
                            {parseFloat(upsidePercent) >= 0 ? '+' : ''}{upsidePercent}%
                          </>
                        ) : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Ratings & Earnings */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 border-t border-white/5 pt-4">
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Company</div>
                      <div className={`text-sm font-bold ${(item.companyAnalysis?.rating || 0) >= 7 ? 'text-green-400' :
                        (item.companyAnalysis?.rating || 0) >= 5 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                        {item.companyAnalysis?.rating || '-'}/10
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Technical</div>
                      <div className={`text-sm font-bold ${(item.technicalAnalysis?.rating || 0) >= 7 ? 'text-green-400' :
                        (item.technicalAnalysis?.rating || 0) >= 5 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                        {item.technicalAnalysis?.rating || '-'}/10
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Developments</div>
                      <div className={`text-sm font-bold ${(item.recentDevelopments?.rating || 0) >= 7 ? 'text-green-400' :
                        (item.recentDevelopments?.rating || 0) >= 5 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                        {item.recentDevelopments?.rating || '-'}/10
                      </div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-center flex flex-col justify-center">
                      <div className="text-[9px] text-blue-400/70 uppercase font-bold tracking-widest mb-1">Next Earnings</div>
                      <div className="text-xs font-bold text-blue-100">
                        {item.recentDevelopments?.detailedDevelopments?.nextEarningsCall?.date || item.recentDevelopments?.nextEarningsDate || 'N/A'}
                      </div>
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