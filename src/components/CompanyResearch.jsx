import { useState, useRef, useEffect } from 'react'
import { Search, Loader, Loader2, ChevronDown, ChevronUp, Star, AlertTriangle, CheckCircle, Save, RefreshCw, MessageCircle, Send, Bot, User, Trash2 } from 'lucide-react'
import { scrapeCompanyData } from '../services/webScraping'
import { COMPANY_RESEARCH_VERSION } from '../config'
import { saveToLocalStorage, STORAGE_KEYS } from '../utils/storage'
import CompanyLogo from './CompanyLogo'

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
      <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5">
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
                <h4 className="font-medium mb-2">Executive Summary</h4>
                <p className="text-gray-300 text-sm leading-relaxed bg-white/[0.04] border border-white/[0.05] rounded-xl p-3">{data.analysis}</p>
              </div>
            )}

            {/* Key Metrics - Special rendering for Technical Analysis */}
            {data.metrics && data.metrics.length > 0 && isTechnicalAnalysis && (
              <div>
                <h4 className="font-medium mb-3">Key Metrics</h4>
                <h4 className="font-medium mb-3 text-white/85">Key Metrics</h4>
                {/* Current Price - Prominent Display */}
                {data.metrics.find(m => m.label === 'Current Price') && (
                  <div className="bg-gradient-to-r from-blue-900 to-blue-800 rounded-lg p-4 mb-4 border border-blue-600">
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
                  <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-4 mb-4 border border-blue-700/30">
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
                  <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5 border-l-4 border-green-500">
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
                  <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5 border-l-4 border-red-500">
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
      {/* Search Form */}
      <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5 shadow-blue-500/5">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-white/50 group-focus-within:text-blue-400 transition-colors" />
            </div>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="SEARCH ASSET (E.G. AAPL, TSLA, NVDA)"
              className="bg-white/[0.06] border border-white/[0.10] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all w-full pl-12 py-4 text-lg font-black tracking-widest placeholder:text-white/50"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest px-8 rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/25 active:scale-95 disabled:opacity-50 flex items-center space-x-3"
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

              <div className="mt-4 grid grid-cols-4 gap-2">
                {['Company', 'Financial', 'Technical', 'Events'].map((step, i) => {
                  const isCompleted = loadingProgress > (i * 25);
                  const isActive = loadingProgress > (i * 25) && loadingProgress <= ((i + 1) * 25);
                  return (
                    <div key={step} className="text-center">
                      <div className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${isCompleted ? 'text-blue-400' : 'text-gray-600'}`}>
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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Overall Rating Header */}
          <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5 bg-gradient-to-r from-blue-600/10 to-transparent border-blue-500/20">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black tracking-tight flex items-baseline gap-3">
                  {companyData.symbol} Analysis
                  <span className="text-xs text-gray-600 font-medium opacity-50">{COMPANY_RESEARCH_VERSION}</span>
                </h2>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-1">Deep Intelligence Report</p>
              </div>
              <div className="flex items-center space-x-8">
                <div className="text-center">
                  <div className={`text-5xl font-black ${getRatingColor(companyData.overallRating)} text-shadow-glow`}>
                    {companyData.overallRating}
                    <span className="text-xl opacity-50 font-medium lowercase ml-1">/100</span>
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
          <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5">
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <MessageCircle className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-semibold">Ask Questions About {companyData.symbol}</h3>
              </div>
              {chatOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>

            {chatOpen && (
              <div className="px-4 pb-4">
                {/* Chat Messages */}
                <div className="bg-white/[0.02]0 backdrop-blur-md rounded-xl border border-white/5 p-4 h-[500px] overflow-y-auto mb-4 pr-2 custom-scrollbar">
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

      {/* Previous Research */}
      {researchData.length > 0 && (
        <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Research History</h3>
            <div className="flex items-center space-x-1 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => handleSort('date')}
                className={`flex-none px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'date' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                Date {sortBy === 'date' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => handleSort('rating')}
                className={`flex-none px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'rating' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                Rating {sortBy === 'rating' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => handleSort('currentPrice')}
                className={`flex-none px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'currentPrice' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                Price {sortBy === 'currentPrice' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => handleSort('targetPrice')}
                className={`flex-none px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'targetPrice' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                Target {sortBy === 'targetPrice' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => handleSort('symbol')}
                className={`flex-none px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'symbol' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                Symbol {sortBy === 'symbol' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4 bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={selectedSymbols.size === researchData.slice(0, 10).length && researchData.length > 0}
                onChange={() => {
                  if (selectedSymbols.size === researchData.slice(0, 10).length) {
                    setSelectedSymbols(new Set())
                  } else {
                    setSelectedSymbols(new Set(researchData.slice(0, 10).map(r => r.symbol)))
                  }
                }}
                className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500/20"
              />
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                {selectedSymbols.size} Selected
              </span>
            </div>

            <button
              onClick={() => {
                onAddToQueue([...selectedSymbols])
                setSelectedSymbols(new Set())
              }}
              disabled={selectedSymbols.size === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-gray-700 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center space-x-2"
            >
              <RefreshCw className={`h-3 w-3 ${researchQueue.some(t => t.status === 'processing' || t.status === 'queued') ? 'animate-spin' : ''}`} />
              <span>Update Selected</span>
            </button>
          </div>

          {researchQueue.length > 0 && (
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Research Queue</span>
                  <span className="text-[10px] font-bold text-gray-500">{researchQueue.filter(t => t.status === 'completed').length} / {researchQueue.length} Done</span>
                </div>
                <button
                  onClick={onClearQueue}
                  className="text-[10px] font-bold text-gray-500 hover:text-white transition-colors flex items-center space-x-1"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Clear</span>
                </button>
              </div>
              <div className="space-y-2">
                {researchQueue.map((task, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] text-gray-400">
                    <div className="flex items-center space-x-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${task.status === 'processing' ? 'bg-blue-400 animate-pulse' : task.status === 'queued' ? 'bg-gray-600' : 'bg-green-400'}`}></div>
                      <span className="font-bold text-white w-12">{task.symbol}</span>
                      <span className="opacity-60">{task.section || 'In Queue'}</span>
                    </div>
                    {task.status === 'processing' && <span>{task.progress}%</span>}
                    {task.status === 'completed' && <CheckCircle className="h-3 w-3 text-green-400" />}
                    {task.status === 'error' && <AlertTriangle className="h-3 w-3 text-red-400" />}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Table Headers */}
          <div className="hidden md:grid grid-cols-[40px_1fr_60px_80px_80px_80px_80px_80px_100px_90px_60px] gap-4 px-4 py-2 mb-2 border-b border-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">
            <div></div>
            <div>Company</div>
            <div className="text-center">Rating</div>
            <div className="text-right">Current</div>
            <div className="text-right">Support</div>
            <div className="text-right">Resistance</div>
            <div className="text-right">Target</div>
            <div className="text-center">Potential</div>
            <div className="text-center">Earnings</div>
            <div className="text-center">Date</div>
            <div className="text-right">Actions</div>
          </div>

          <div className="space-y-1">
            {sortedResearchData.slice(0, 10).map((item) => {
              const itemKey = `${item.symbol}-${item.date}`
              let currentPrice = item.technicalAnalysis?.currentPrice ||
                item.technicalAnalysis?.metrics?.find(m => m.label === 'Current Price')?.value
              let targetPrice = item.technicalAnalysis?.targetPrice ||
                item.technicalAnalysis?.metrics?.find(m => m.label === 'Target Price')?.value

              if (currentPrice) currentPrice = currentPrice.replace(/,\s*$/, '').trim()
              if (targetPrice) targetPrice = targetPrice.replace(/,\s*$/, '').trim()

              let upsidePercent = null
              if (currentPrice && targetPrice) {
                const current = parseFloat(currentPrice.replace(/[$,]/g, ''))
                const target = parseFloat(targetPrice.replace(/[$,]/g, ''))
                if (!isNaN(current) && !isNaN(target) && current > 0) {
                  upsidePercent = ((target - current) / current * 100).toFixed(1)
                }
              }

              const supportLevel = item.technicalAnalysis?.detailedTechnical?.supportResistance?.support?.[0]?.split(' - ')[0] ||
                item.technicalAnalysis?.metrics?.find(m => m.label.includes('Support'))?.value || '-'
              const resistanceLevel = item.technicalAnalysis?.detailedTechnical?.supportResistance?.resistance?.[0]?.split(' - ')[0] ||
                item.technicalAnalysis?.metrics?.find(m => m.label.includes('Resistance'))?.value || '-'
              const earningsDate = item.recentDevelopments?.detailedDevelopments?.nextEarningsCall?.date ||
                item.recentDevelopments?.metrics?.find(m => m.label === 'Next Earnings' || m.label === 'Earnings Date')?.value || '-'

              return (
                <div
                  key={itemKey}
                  className="grid grid-cols-2 md:grid-cols-[40px_1fr_60px_80px_80px_80px_80px_80px_100px_90px_60px] gap-2 md:gap-4 items-center p-3 md:p-2 bg-white/[0.05] border border-white/[0.06] rounded-xl hover:bg-white/5 border border-white/5 hover:border-white/10 transition-all cursor-pointer group"
                  onClick={() => handleViewResearch(item)}
                >
                  {/* Checkbox (Desktop only) */}
                  <div className="hidden md:flex justify-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedSymbols.has(item.symbol)}
                      onChange={() => {
                        const next = new Set(selectedSymbols)
                        if (next.has(item.symbol)) next.delete(item.symbol)
                        else next.add(item.symbol)
                        setSelectedSymbols(next)
                      }}
                      className="w-4 h-4 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-blue-500/20 transition-all cursor-pointer"
                    />
                  </div>

                  {/* Company */}
                  <div className="flex items-center space-x-3">
                    <CompanyLogo symbol={item.symbol} className="w-8 h-8 md:w-6 md:h-6" textSize="text-[10px]" />
                    <span className="font-black text-sm tracking-tight text-white/85">{item.symbol}</span>
                  </div>

                  {/* Rating */}
                  <div className="flex md:justify-center">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${item.overallRating >= 70 ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400' :
                      item.overallRating >= 50 ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                        'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                      }`}>
                      {item.overallRating}
                    </span>
                  </div>

                  {/* Prices */}
                  <div className="hidden md:block text-right font-mono text-xs text-white/50">
                    {currentPrice ? (currentPrice.startsWith('$') ? currentPrice : `$${currentPrice}`) : '-'}
                  </div>

                  {/* Support/Resistance [NEW] */}
                  <div className="hidden md:block text-right font-mono text-xs text-orange-300/80">
                    {supportLevel}
                  </div>
                  <div className="hidden md:block text-right font-mono text-xs text-purple-300/80">
                    {resistanceLevel}
                  </div>

                  <div className="hidden md:block text-right font-mono text-xs text-blue-300">
                    {targetPrice ? (targetPrice.startsWith('$') ? targetPrice : `$${targetPrice}`) : '-'}
                  </div>

                  {/* Potential */}
                  <div className={`text-right md:text-center font-bold text-xs ${parseFloat(upsidePercent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {upsidePercent !== null ? `${parseFloat(upsidePercent) >= 0 ? '+' : ''}${upsidePercent}%` : '-'}
                  </div>

                  {/* Earnings [NEW] */}
                  <div className="hidden md:block text-center text-[10px] font-bold text-yellow-400/80 uppercase tracking-tighter">
                    {earningsDate}
                  </div>

                  {/* Date */}
                  <div className="hidden md:block text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {formatDateDDMMYYYY(item.date)}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end space-x-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRerunResearch(item.symbol); }}
                      className="p-1 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 rounded transition-all"
                      title="Rerun"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); const originalIndex = researchData.findIndex(r => r.symbol === item.symbol && r.date === item.date); handleDeleteResearch(originalIndex); }}
                      className="p-1 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded transition-all"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
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