import axios from 'axios'
import * as cheerio from 'cheerio'

// Base URL for proxy server
const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3001'
const PROXY_BASE_URL = `${API_BASE_URL}/api/scrape`

// Rate limiting helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// User agent to avoid blocking
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'

export async function scrapeCompanyData(symbol, section) {
  try {
    const response = await axios.post(`${PROXY_BASE_URL}`, {
      symbol,
      section,
      userAgent: USER_AGENT
    }, {
      timeout: 30000 // 30 second timeout
    })

    return response.data
  } catch (error) {
    console.error(`Error scraping ${section} for ${symbol}:`, error)
    throw new Error(`Failed to scrape ${section} data`)
  }
}

// Individual scraping functions for different sections
export async function scrapeCompanyAnalysis(symbol) {
  try {
    // Yahoo Finance company profile
    const yahooUrl = `https://finance.yahoo.com/quote/${symbol}/profile`
    const yahooResponse = await axios.get(yahooUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })

    const $yahoo = cheerio.load(yahooResponse.data)

    // Extract company description
    const description = $yahoo('.quote-sub-section .description').text().trim() ||
                       $yahoo('.business-summary').text().trim()

    // Extract sector and industry
    const sector = $yahoo('.quote-sub-section .sector').text().trim()
    const industry = $yahoo('.quote-sub-section .industry').text().trim()

    // Extract key executives
    const executives = []
    $yahoo('.quote-sub-section .executives tr').each((i, row) => {
      if (i > 0) { // Skip header
        const cols = $yahoo(row).find('td')
        if (cols.length >= 3) {
          executives.push({
            name: $yahoo(cols[0]).text().trim(),
            title: $yahoo(cols[1]).text().trim(),
            pay: $yahoo(cols[2]).text().trim()
          })
        }
      }
    })

    // Calculate rating based on available data
    let rating = 5 // Base rating
    if (description.length > 100) rating += 1
    if (sector && industry) rating += 1
    if (executives.length > 0) rating += 1

    return {
      rating: Math.min(rating, 10),
      analysis: description || 'Company description not available',
      metrics: [
        { label: 'Sector', value: sector || 'N/A' },
        { label: 'Industry', value: industry || 'N/A' },
        { label: 'Key Executives', value: executives.length > 0 ? executives.length : 'N/A' }
      ],
      signals: executives.length > 0 ? [{ type: 'positive', message: 'Executive team information available' }] : []
    }
  } catch (error) {
    console.error('Error scraping company analysis:', error)
    return {
      rating: 3,
      analysis: 'Unable to retrieve company analysis data',
      metrics: [],
      signals: [{ type: 'negative', message: 'Data retrieval failed' }]
    }
  }
}

export async function scrapeFinancialHealth(symbol) {
  try {
    // Yahoo Finance financials
    const financialsUrl = `https://finance.yahoo.com/quote/${symbol}/financials`
    const response = await axios.get(financialsUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })

    const $ = cheerio.load(response.data)

    // Extract key financial metrics
    const metrics = []
    const signals = []

    // Look for revenue, net income, etc.
    $('.financials-table tr').each((i, row) => {
      const cols = $(row).find('td, th')
      if (cols.length >= 2) {
        const label = $(cols[0]).text().trim()
        const value = $(cols[1]).text().trim()

        if (label.toLowerCase().includes('total revenue') ||
            label.toLowerCase().includes('net income') ||
            label.toLowerCase().includes('operating income')) {
          metrics.push({ label, value })
        }
      }
    })

    // Get balance sheet data
    const balanceUrl = `https://finance.yahoo.com/quote/${symbol}/balance-sheet`
    const balanceResponse = await axios.get(balanceUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })

    const $balance = cheerio.load(balanceResponse.data)
    $balance('.financials-table tr').each((i, row) => {
      const cols = $balance(row).find('td, th')
      if (cols.length >= 2) {
        const label = $balance(cols[0]).text().trim()
        const value = $balance(cols[1]).text().trim()

        if (label.toLowerCase().includes('total assets') ||
            label.toLowerCase().includes('total liabilities') ||
            label.toLowerCase().includes('cash')) {
          metrics.push({ label, value })
        }
      }
    })

    // Calculate rating based on data completeness
    let rating = 4
    if (metrics.length >= 3) rating += 2
    if (metrics.some(m => m.label.toLowerCase().includes('net income'))) rating += 1
    if (metrics.some(m => m.label.toLowerCase().includes('cash'))) rating += 1

    // Generate signals based on data
    if (metrics.some(m => m.label.toLowerCase().includes('net income'))) {
      signals.push({ type: 'positive', message: 'Profitability data available' })
    }

    return {
      rating: Math.min(rating, 10),
      analysis: `Financial health analysis for ${symbol}. ${metrics.length} key metrics retrieved.`,
      metrics,
      signals
    }
  } catch (error) {
    console.error('Error scraping financial health:', error)
    return {
      rating: 2,
      analysis: 'Unable to retrieve financial health data',
      metrics: [],
      signals: [{ type: 'negative', message: 'Financial data retrieval failed' }]
    }
  }
}

export async function scrapeTechnicalAnalysis(symbol) {
  try {
    // Yahoo Finance chart data (technical indicators)
    const chartUrl = `https://finance.yahoo.com/quote/${symbol}/chart`
    const response = await axios.get(chartUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })

    const $ = cheerio.load(response.data)

    // Extract current price and basic technical data
    const currentPrice = $('.price-section .price').text().trim() ||
                        $('.quote-header-info .price').text().trim()

    // Look for technical indicators in the page
    const technicalData = []
    const signals = []

    // Extract moving averages if available
    const ma50 = $('.technical-indicators .ma50').text().trim() ||
                 $('[data-test="MA50"]').text().trim()
    const ma200 = $('.technical-indicators .ma200').text().trim() ||
                  $('[data-test="MA200"]').text().trim()

    if (ma50) technicalData.push({ label: '50-Day MA', value: ma50 })
    if (ma200) technicalData.push({ label: '200-Day MA', value: ma200 })

    // Extract RSI if available
    const rsi = $('.technical-indicators .rsi').text().trim() ||
                $('[data-test="RSI"]').text().trim()
    if (rsi) technicalData.push({ label: 'RSI', value: rsi })

    // Generate signals based on technical data
    if (rsi) {
      const rsiValue = parseFloat(rsi)
      if (rsiValue > 70) signals.push({ type: 'negative', message: 'RSI indicates overbought conditions' })
      else if (rsiValue < 30) signals.push({ type: 'positive', message: 'RSI indicates oversold conditions' })
      else signals.push({ type: 'neutral', message: 'RSI in neutral range' })
    }

    // Calculate rating
    let rating = 5
    if (currentPrice) rating += 1
    if (technicalData.length >= 2) rating += 2
    if (signals.length > 0) rating += 1

    return {
      rating: Math.min(rating, 10),
      analysis: `Technical analysis for ${symbol}. Current price: ${currentPrice || 'N/A'}`,
      metrics: [
        { label: 'Current Price', value: currentPrice || 'N/A' },
        ...technicalData
      ],
      signals
    }
  } catch (error) {
    console.error('Error scraping technical analysis:', error)
    return {
      rating: 3,
      analysis: 'Unable to retrieve technical analysis data',
      metrics: [],
      signals: [{ type: 'negative', message: 'Technical data retrieval failed' }]
    }
  }
}

export async function scrapeOptionsData(symbol) {
  try {
    // Yahoo Finance options chain
    const optionsUrl = `https://finance.yahoo.com/quote/${symbol}/options`
    const response = await axios.get(optionsUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })

    const $ = cheerio.load(response.data)

    // Extract options data
    const optionsData = []
    const signals = []

    // Get current stock price
    const stockPrice = $('.quote-header-info .price').text().trim() ||
                       $('.price-section .price').text().trim()

    // Extract calls and puts data
    $('.calls-table tr, .puts-table tr').each((i, row) => {
      if (i === 0) return // Skip header

      const cols = $(row).find('td')
      if (cols.length >= 8) {
        const strike = $(cols[2]).text().trim()
        const bid = $(cols[3]).text().trim()
        const ask = $(cols[4]).text().trim()
        const volume = $(cols[5]).text().trim()
        const openInterest = $(cols[6]).text().trim()

        if (strike && bid && ask) {
          optionsData.push({
            strike: parseFloat(strike),
            bid: parseFloat(bid),
            ask: parseFloat(ask),
            volume: parseInt(volume) || 0,
            openInterest: parseInt(openInterest) || 0
          })
        }
      }
    })

    // Calculate implied volatility and other metrics
    let avgVolume = 0
    let totalOI = 0
    if (optionsData.length > 0) {
      avgVolume = optionsData.reduce((sum, opt) => sum + opt.volume, 0) / optionsData.length
      totalOI = optionsData.reduce((sum, opt) => sum + opt.openInterest, 0)
    }

    // Generate signals
    if (avgVolume > 1000) signals.push({ type: 'positive', message: 'High options volume indicates active trading' })
    if (totalOI > 10000) signals.push({ type: 'positive', message: 'Significant open interest suggests market interest' })

    // Calculate rating
    let rating = 4
    if (stockPrice) rating += 1
    if (optionsData.length > 0) rating += 2
    if (avgVolume > 500) rating += 1
    if (totalOI > 5000) rating += 1

    return {
      rating: Math.min(rating, 10),
      analysis: `Options market data for ${symbol}. Stock price: ${stockPrice || 'N/A'}. ${optionsData.length} options contracts analyzed.`,
      metrics: [
        { label: 'Stock Price', value: stockPrice || 'N/A' },
        { label: 'Options Available', value: optionsData.length },
        { label: 'Avg Daily Volume', value: Math.round(avgVolume) },
        { label: 'Total Open Interest', value: totalOI.toLocaleString() }
      ],
      signals
    }
  } catch (error) {
    console.error('Error scraping options data:', error)
    return {
      rating: 2,
      analysis: 'Unable to retrieve options market data',
      metrics: [],
      signals: [{ type: 'negative', message: 'Options data retrieval failed' }]
    }
  }
}

export async function scrapeRecentDevelopments(symbol) {
  try {
    // Yahoo Finance news
    const newsUrl = `https://finance.yahoo.com/quote/${symbol}/news`
    const response = await axios.get(newsUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })

    const $ = cheerio.load(response.data)

    // Extract recent news headlines
    const newsItems = []
    $('.news-item, .js-stream-content').each((i, item) => {
      if (i >= 5) return // Limit to 5 news items

      const title = $(item).find('h3, .title').text().trim()
      const summary = $(item).find('.summary, p').text().trim()
      const time = $(item).find('.time, .date').text().trim()

      if (title) {
        newsItems.push({
          title,
          summary: summary || 'No summary available',
          time: time || 'Recent'
        })
      }
    })

    // Analyze news sentiment (basic keyword analysis)
    const positiveKeywords = ['rise', 'gain', 'profit', 'growth', 'success', 'beat', 'upgrade', 'bullish']
    const negativeKeywords = ['fall', 'loss', 'decline', 'drop', 'downgrade', 'bearish', 'concern', 'warning']

    let positiveCount = 0
    let negativeCount = 0

    newsItems.forEach(item => {
      const text = (item.title + ' ' + item.summary).toLowerCase()
      positiveKeywords.forEach(keyword => {
        if (text.includes(keyword)) positiveCount++
      })
      negativeKeywords.forEach(keyword => {
        if (text.includes(keyword)) negativeCount++
      })
    })

    const signals = []
    if (positiveCount > negativeCount) {
      signals.push({ type: 'positive', message: 'Recent news shows positive sentiment' })
    } else if (negativeCount > positiveCount) {
      signals.push({ type: 'negative', message: 'Recent news shows negative sentiment' })
    } else {
      signals.push({ type: 'neutral', message: 'Recent news sentiment is mixed' })
    }

    // Calculate rating
    let rating = 5
    if (newsItems.length >= 3) rating += 2
    if (positiveCount > negativeCount) rating += 1
    else if (negativeCount > positiveCount) rating -= 1

    return {
      rating: Math.max(1, Math.min(rating, 10)),
      analysis: `Recent developments for ${symbol}. ${newsItems.length} news items analyzed.`,
      metrics: [
        { label: 'News Items', value: newsItems.length },
        { label: 'Positive Sentiment', value: positiveCount },
        { label: 'Negative Sentiment', value: negativeCount }
      ],
      signals,
      newsItems // Include full news data for display
    }
  } catch (error) {
    console.error('Error scraping recent developments:', error)
    return {
      rating: 3,
      analysis: 'Unable to retrieve recent developments data',
      metrics: [],
      signals: [{ type: 'negative', message: 'News data retrieval failed' }]
    }
  }
}