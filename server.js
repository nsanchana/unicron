import express from 'express'
import axios from 'axios'
import * as cheerio from 'cheerio'
import cors from 'cors'
import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'
import {
  requireAuth,
  getSessionConfig
} from './auth.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = 3001

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())
app.use(getSessionConfig(process.env.SESSION_SECRET))

// Rate limiting helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// User agent to avoid blocking
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Helper function to generate AI insights using Gemini
async function generateAIInsight(symbol, dataType, scrapedData = {}) {
  console.log(`Generating AI insight for ${symbol} - ${dataType}...`)

  // If no API key, fall back to template insights
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.log('Gemini API key not configured, using fallback insights.')
    return generateFallbackInsight(symbol, dataType, scrapedData)
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

    const prompts = {
      companyAnalysis: `Analyze this company data for ${symbol} and provide actionable insights for options trading:

Company Description: ${scrapedData.description || 'Not available'}
Sector: ${scrapedData.sector || 'Not available'}
Industry: ${scrapedData.industry || 'Not available'}
Market Cap: ${scrapedData.marketCap || 'Not available'}

Provide a 2-3 sentence analysis focused on:
1. Company's competitive position and business model strength
2. Key factors that would make this a good or poor candidate for selling options (cash-secured puts or covered calls)
3. Any sector-specific risks or opportunities

Be concise, actionable, and specific to options trading strategy.`,

      financialHealth: `Analyze this financial data for ${symbol} for options trading purposes:

${JSON.stringify(scrapedData.metrics || [], null, 2)}

Provide a 2-3 sentence analysis focused on:
1. Financial strength and stability for supporting options strategies
2. Revenue/profit trends that suggest bullish or bearish positioning
3. Specific recommendation on whether the financial health supports selling puts (betting on stability/growth) or covered calls (generating income on owned shares)

Be concise and actionable for options traders.`,

      technicalAnalysis: `Analyze this technical data for ${symbol}:

Current Price: ${scrapedData.currentPrice || 'Not available'}
Additional Metrics: ${JSON.stringify(scrapedData.metrics || [], null, 2)}

Provide a 2-3 sentence analysis focused on:
1. Current price momentum and trend direction
2. Whether current technical setup favors selling out-of-the-money puts (bullish/neutral) or covered calls (neutral/mildly bearish)
3. Suggested technical levels to watch for strike price selection

Be specific and actionable for options traders.`,

      optionsData: `Analyze this options market data for ${symbol}:

${JSON.stringify(scrapedData.metrics || [], null, 2)}

Provide a 2-3 sentence analysis focused on:
1. Implied volatility environment (high IV = better premiums for sellers)
2. Liquidity and open interest insights
3. Specific recommendation on optimal options strategy given current market conditions

Be actionable for options income traders.`,

      recentDevelopments: `Analyze recent news and sentiment for ${symbol}:

News Items: ${JSON.stringify(scrapedData.newsItems || [], null, 2)}
Sentiment Counts: ${JSON.stringify(scrapedData.sentimentCounts || {}, null, 2)}

Provide a 2-3 sentence analysis focused on:
1. Overall sentiment and how it impacts near-term stock movement
2. Specific news catalysts that could affect options positions
3. Recommendation on whether current news environment supports entering new options positions or staying on sidelines

Be concise and actionable.`
    }

    const prompt = prompts[dataType] || `Analyze ${dataType} for ${symbol} with data: ${JSON.stringify(scrapedData)}`

    console.log('Calling Gemini API...')
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    console.log('Gemini API call successful.')
    return text

  } catch (error) {
    console.error(`AI insight generation failed for ${symbol} (${dataType}):`, error.message)
    // If it's a safety block or other terminal error, fallback gracefully
    return generateFallbackInsight(symbol, dataType, scrapedData)
  }
}

// Fallback function for when AI is not available
function generateFallbackInsight(symbol, dataType, scrapedData = {}) {
  const insights = {
    companyAnalysis: `${symbol} is a publicly traded company${scrapedData.sector ? ` in the ${scrapedData.sector} sector` : ''}. ${scrapedData.description || 'This analysis examines the company\'s business model, competitive positioning, and strategic direction. Key factors to consider include market share, brand strength, management quality, and long-term growth potential.'}`,

    financialHealth: `Financial analysis for ${symbol} evaluates the company's profitability, liquidity, and solvency. Strong financials typically show consistent revenue growth, healthy profit margins, manageable debt levels, and positive cash flow. These metrics are essential for assessing the company's ability to sustain operations and return value to shareholders.`,

    technicalAnalysis: `Technical analysis of ${symbol} examines price trends, trading volume, and market momentum. ${scrapedData.currentPrice ? `Currently trading at ${scrapedData.currentPrice}.` : ''} Key indicators include support and resistance levels, moving averages, and relative strength. This helps identify potential entry and exit points for options strategies based on price action and market sentiment.`,

    optionsData: `Options market analysis for ${symbol} provides insights into market expectations for volatility and directional bias. Implied volatility levels, put/call ratios, and open interest patterns can reveal institutional sentiment and help identify optimal strike prices and expiration dates for options strategies.`,

    recentDevelopments: `Recent news and events significantly impact ${symbol}'s options pricing and trading opportunities. Important developments include earnings releases, product launches, regulatory changes, management decisions, and industry trends. Staying informed about company catalysts is crucial for timing options trades effectively.`
  }

  return insights[dataType] || `Analysis for ${symbol} - ${dataType}`
}

// Scraping functions (imported from webScraping.js logic)
async function scrapeCompanyAnalysis(symbol) {
  let scrapedInfo = {
    description: '',
    sector: '',
    industry: '',
    marketCap: '',
    employees: ''
  }

  try {
    // Try stockanalysis.com first
    const saUrl = `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/`
    const saResponse = await axios.get(saUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })
    const $sa = cheerio.load(saResponse.data)

    // Extract company info
    scrapedInfo.description = $sa('meta[name="description"]').attr('content') || ''
    scrapedInfo.sector = $sa('[data-test="sector"]').text().trim()
    scrapedInfo.industry = $sa('[data-test="industry"]').text().trim()
    scrapedInfo.marketCap = $sa('[data-test="market-cap"]').text().trim()
  } catch (error) {
    // Silent failure for alternatives
  }

  // Fallback to Yahoo Finance if needed
  if (!scrapedInfo.description || !scrapedInfo.sector) {
    try {
      const yahooUrl = `https://finance.yahoo.com/quote/${symbol}/profile`
      const yahooResponse = await axios.get(yahooUrl, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000
      })
      const $yahoo = cheerio.load(yahooResponse.data)

      if (!scrapedInfo.description) {
        scrapedInfo.description = $yahoo('p[class*="description"]').first().text().trim() ||
          $yahoo('section[data-test="description"]').text().trim()
      }
      if (!scrapedInfo.sector) scrapedInfo.sector = $yahoo('span:contains("Sector")').next().text().trim()
      if (!scrapedInfo.industry) scrapedInfo.industry = $yahoo('span:contains("Industry")').next().text().trim()
    } catch (error) {
      console.log('Yahoo Finance scraping also failed')
    }
  }

  // Calculate rating based on data completeness
  let rating = 5
  if (scrapedInfo.description && scrapedInfo.description.length > 100) rating += 2
  if (scrapedInfo.sector && scrapedInfo.industry) rating += 2
  if (scrapedInfo.marketCap) rating += 1

  const metrics = [
    { label: 'Sector', value: scrapedInfo.sector || 'Not Available' },
    { label: 'Industry', value: scrapedInfo.industry || 'Not Available' },
    { label: 'Market Cap', value: scrapedInfo.marketCap || 'Not Available' }
  ].filter(m => m.value !== 'Not Available')

  const signals = []
  if (scrapedInfo.sector) signals.push({ type: 'positive', message: `${scrapedInfo.sector} sector exposure` })
  if (!scrapedInfo.description) signals.push({ type: 'warning', message: 'Limited company information available' })

  return {
    rating: Math.min(rating, 10),
    analysis: await generateAIInsight(symbol, 'companyAnalysis', scrapedInfo),
    metrics: metrics.length > 0 ? metrics : [{ label: 'Symbol', value: symbol }],
    signals: signals.length > 0 ? signals : [{ type: 'info', message: 'Company analysis completed' }]
  }
}

async function scrapeFinancialHealth(symbol) {
  const metrics = []
  const signals = []
  let rating = 6

  try {
    // Try to fetch from stockanalysis.com for key metrics
    const saUrl = `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/financials/`
    const response = await axios.get(saUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })
    const $ = cheerio.load(response.data)

    // Look for key financial metrics
    $('table tr').each((_, row) => {
      const label = $(row).find('td').first().text().trim()
      const value = $(row).find('td').eq(1).text().trim()

      if (label && value && (
        label.toLowerCase().includes('revenue') ||
        label.toLowerCase().includes('income') ||
        label.toLowerCase().includes('profit') ||
        label.toLowerCase().includes('margin')
      )) {
        metrics.push({ label, value })
      }
    })

    if (metrics.length > 3) rating += 2
  } catch (error) {
    console.log('Financial scraping failed, using generated insights')
  }

  // Always provide value analysis
  const analysis = await generateAIInsight(symbol, 'financialHealth', { metrics })

  // Add default signals if none were scraped
  if (signals.length === 0) {
    signals.push({ type: 'info', message: 'Review key financial ratios and trends for comprehensive analysis' })
  }

  // Add sample metrics if none were found
  if (metrics.length === 0) {
    metrics.push(
      { label: 'Revenue Growth', value: 'Analyze YoY trends' },
      { label: 'Profit Margins', value: 'Compare to industry average' },
      { label: 'Debt Levels', value: 'Evaluate leverage ratio' }
    )
  }

  return {
    rating: Math.min(rating, 10),
    analysis,
    metrics,
    signals
  }
}

async function scrapeTechnicalAnalysis(symbol) {
  const metrics = []
  const signals = []
  let rating = 6
  let currentPrice = ''

  try {
    // Try to get current price
    const priceUrl = `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/`
    const response = await axios.get(priceUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })
    const $ = cheerio.load(response.data)

    currentPrice = $('[data-test="stock-price"]').first().text().trim() ||
      $('.text-3xl, .text-4xl').first().text().trim()

    if (currentPrice) {
      metrics.push({ label: 'Current Price', value: currentPrice })
      rating += 1
    }
  } catch (error) {
    console.log('Technical scraping failed, using generated insights')
  }

  // Always provide meaningful analysis
  const analysis = await generateAIInsight(symbol, 'technicalAnalysis', { currentPrice, metrics })

  // Add guidance metrics if we couldn't scrape
  if (metrics.length === 0) {
    metrics.push(
      { label: 'Price Trend', value: 'Monitor chart patterns' },
      { label: 'Moving Averages', value: 'Compare 50 & 200 day' },
      { label: 'Volume Analysis', value: 'Check accumulation/distribution' }
    )
  }

  signals.push({
    type: 'info',
    message: 'Use technical indicators to identify optimal entry and exit points'
  })

  return {
    rating: Math.min(rating, 10),
    analysis,
    metrics,
    signals
  }
}

async function scrapeOptionsData(symbol) {
  const metrics = []
  const signals = []
  let rating = 6

  try {
    // Try to get basic options info
    const url = `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/options/`
    const response = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })
    const $ = cheerio.load(response.data)

    // Look for IV or options-related data
    $('table tr').slice(0, 5).each((_, row) => {
      const label = $(row).find('td').first().text().trim()
      const value = $(row).find('td').eq(1).text().trim()
      if (label && value) {
        metrics.push({ label, value })
      }
    })

    if (metrics.length > 0) rating += 2
  } catch (error) {
    // console.log('Options scraping failed, using generated insights')
  }

  // Always provide meaningful analysis
  const analysis = await generateAIInsight(symbol, 'optionsData', { metrics })

  // Add guidance metrics if we couldn't scrape
  if (metrics.length === 0) {
    metrics.push(
      { label: 'Implied Volatility', value: 'Check IV percentile for timing' },
      { label: 'Put/Call Ratio', value: 'Gauge market sentiment' },
      { label: 'Open Interest', value: 'Identify liquid strikes' }
    )
  }

  signals.push({
    type: 'info',
    message: 'Higher IV offers better premiums for sellers but indicates uncertainty'
  })

  return {
    rating: Math.min(rating, 10),
    analysis,
    metrics,
    signals
  }
}

async function scrapeRecentDevelopments(symbol) {
  const metrics = []
  const signals = []
  let rating = 6
  const newsItems = []

  try {
    // Try to get recent news
    const newsUrl = `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/news/`
    const response = await axios.get(newsUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })

    const $ = cheerio.load(response.data)

    // Look for news headlines
    $('.news-item, article').slice(0, 5).each((_, item) => {
      const title = $(item).find('h2, h3, .title').first().text().trim()
      const time = $(item).find('time, .date').first().text().trim()

      if (title) {
        newsItems.push({ title, time: time || 'Recent' })
      }
    })

    if (newsItems.length > 0) {
      rating += 2
      metrics.push({ label: 'Recent News Items', value: newsItems.length.toString() })
    }

    // Simple sentiment analysis
    const positiveKeywords = ['growth', 'profit', 'beat', 'upgrade', 'bullish', 'gain']
    const negativeKeywords = ['loss', 'decline', 'downgrade', 'bearish', 'concern', 'warning']

    let positiveCount = 0
    let negativeCount = 0

    newsItems.forEach(item => {
      const text = item.title.toLowerCase()
      positiveKeywords.forEach(keyword => {
        if (text.includes(keyword)) positiveCount++
      })
      negativeKeywords.forEach(keyword => {
        if (text.includes(keyword)) negativeCount++
      })
    })

    if (positiveCount > negativeCount) {
      signals.push({ type: 'positive', message: 'Recent news shows positive sentiment' })
      rating += 1
    } else if (negativeCount > positiveCount) {
      signals.push({ type: 'warning', message: 'Recent news shows negative sentiment' })
    }
  } catch (error) {
    // console.log('News scraping failed, using generated insights')
  }

  // Always provide meaningful analysis
  const sentimentCounts = { positive: positiveCount, negative: negativeCount }
  const analysis = await generateAIInsight(symbol, 'recentDevelopments', { newsItems, sentimentCounts, metrics })

  // Add guidance metrics if we couldn't scrape
  if (metrics.length === 0) {
    metrics.push(
      { label: 'Earnings Date', value: 'Check upcoming earnings calendar' },
      { label: 'Company Events', value: 'Monitor for catalysts' },
      { label: 'Market Trends', value: 'Follow sector developments' }
    )
  }

  if (signals.length === 0) {
    signals.push({
      type: 'info',
      message: 'Stay updated on company news to identify options trading opportunities'
    })
  }

  return {
    rating: Math.min(rating, 10),
    analysis,
    metrics,
    signals
  }
}

// Credentials from environment variables
const AUTHORIZED_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'password123'
}

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
  res.status(403).json({
    error: 'Registration is disabled. This is a private application.',
    code: 'REGISTRATION_DISABLED'
  })
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }

    // Check against hardcoded credentials
    if (username === AUTHORIZED_CREDENTIALS.username && password === AUTHORIZED_CREDENTIALS.password) {
      // Set session
      req.session.userId = 1
      req.session.username = username

      res.json({
        success: true,
        user: {
          id: 1,
          username: username,
          email: null
        }
      })
    } else {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' })
    }
    res.json({ success: true })
  })
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  // Return hardcoded user info from session
  res.json({
    user: {
      id: 1,
      username: req.session.username || 'nsanchana',
      email: null
    }
  })
})

// Protected API Routes (require authentication)
app.post('/api/scrape', requireAuth, async (req, res) => {
  try {
    const { symbol, section } = req.body

    if (!symbol || !section) {
      return res.status(400).json({ error: 'Symbol and section are required' })
    }

    // console.log(`Scraping ${section} for ${symbol}...`)

    let result
    switch (section) {
      case 'companyAnalysis':
        result = await scrapeCompanyAnalysis(symbol)
        break
      case 'financialHealth':
        result = await scrapeFinancialHealth(symbol)
        break
      case 'technicalAnalysis':
        result = await scrapeTechnicalAnalysis(symbol)
        break
      case 'optionsData':
        result = await scrapeOptionsData(symbol)
        break
      case 'recentDevelopments':
        result = await scrapeRecentDevelopments(symbol)
        break
      default:
        return res.status(400).json({ error: 'Invalid section' })
    }

    // Rate limiting delay
    await delay(1000)

    res.json(result)
  } catch (error) {
    console.error('Scraping error:', error)
    res.status(500).json({
      error: 'Failed to scrape data',
      details: error.message
    })
  }
})

// Earnings and events endpoint
app.post('/api/scrape/earnings-events', requireAuth, async (req, res) => {
  try {
    const { symbol, expirationDate } = req.body

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' })
    }

    const earningsData = {
      nextEarningsDate: null,
      earningsConfidence: 'Low',
      source: null,
      upcomingEvents: [],
      marketSentiment: null,
      whatToWatch: []
    }

    // Helper function to parse and validate earnings date
    const parseEarningsDate = (dateStr) => {
      if (!dateStr) return null

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      try {
        // Try parsing different date formats
        let parsedDate = new Date(dateStr)

        // If the parsed date is invalid or in the past, return null
        if (isNaN(parsedDate.getTime()) || parsedDate < today) {
          return null
        }

        return dateStr
      } catch (error) {
        return null
      }
    }

    // Try to scrape earnings date from multiple sources
    let scrapedEarningsDate = null
    let earningsSource = null
    let isEstimate = false

    try {
      // Try Yahoo Finance earnings calendar
      const yahooUrl = `https://finance.yahoo.com/quote/${symbol}/`
      const yahooResponse = await axios.get(yahooUrl, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000
      })
      const $yahoo = cheerio.load(yahooResponse.data)

      // Look for earnings date
      let earningsDate = $yahoo('td:contains("Earnings Date")').next().text().trim() ||
        $yahoo('span:contains("Earnings Date")').parent().find('span').last().text().trim()

      // Check if it contains "Estimated" or similar keywords
      if (earningsDate && (earningsDate.toLowerCase().includes('estimate') || earningsDate.includes('*'))) {
        isEstimate = true
        earningsDate = earningsDate.replace(/estimate|estimated|\*/gi, '').trim()
      }

      const validDate = parseEarningsDate(earningsDate)
      if (validDate) {
        scrapedEarningsDate = validDate
        earningsSource = 'Yahoo Finance'
        earningsData.earningsConfidence = isEstimate ? 'Low (Estimate)' : 'Medium'
      }

      // Try to get earnings from stockanalysis.com if Yahoo didn't work
      if (!scrapedEarningsDate) {
        const saUrl = `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/`
        const saResponse = await axios.get(saUrl, {
          headers: { 'User-Agent': USER_AGENT },
          timeout: 10000
        })
        const $sa = cheerio.load(saResponse.data)

        earningsDate = $sa('[data-test="earnings-date"]').text().trim() ||
          $sa('td:contains("Next Earnings")').next().text().trim()

        if (earningsDate && (earningsDate.toLowerCase().includes('estimate') || earningsDate.includes('*'))) {
          isEstimate = true
          earningsDate = earningsDate.replace(/estimate|estimated|\*/gi, '').trim()
        }

        const validDate = parseEarningsDate(earningsDate)
        if (validDate) {
          scrapedEarningsDate = validDate
          earningsSource = 'Stock Analysis'
          earningsData.earningsConfidence = isEstimate ? 'Low (Estimate)' : 'Medium'
        }
      }
    } catch (error) {
      // console.log('Earnings date scraping failed:', error.message)
    }

    // Only set earnings data if we found a valid future date
    if (scrapedEarningsDate) {
      earningsData.nextEarningsDate = scrapedEarningsDate
      earningsData.source = earningsSource
      earningsData.isEstimate = isEstimate
    }

    // Calculate days to expiration
    let daysToExpiration = null
    if (expirationDate) {
      const today = new Date()
      const exp = new Date(expirationDate)
      daysToExpiration = Math.ceil((exp - today) / (1000 * 60 * 60 * 24))
    }

    // Generate upcoming events analysis
    earningsData.upcomingEvents = []

    if (earningsData.nextEarningsDate) {
      const estimateNote = earningsData.isEstimate ? ' (Estimated date - confirm with company IR)' : ''
      earningsData.upcomingEvents.push({
        type: 'Earnings Release',
        description: `Earnings call scheduled around ${earningsData.nextEarningsDate}${estimateNote}`,
        impact: 'High',
        note: 'Earnings releases typically cause significant price volatility. Historical earnings surprises can move stock prices 5-15% in either direction.'
      })
    } else {
      earningsData.upcomingEvents.push({
        type: 'Earnings Release',
        description: 'Unable to find confirmed earnings date. Check company investor relations page or financial calendars.',
        impact: 'High',
        note: 'Without a confirmed earnings date, monitor the company closely. If earnings fall within your option expiration window, expect elevated implied volatility and potential sharp price movements.'
      })
    }

    // Add general market events
    if (daysToExpiration && daysToExpiration <= 30) {
      earningsData.upcomingEvents.push({
        type: 'FOMC Meeting',
        description: 'Federal Reserve policy decisions can impact overall market sentiment',
        impact: 'Medium',
        note: 'Interest rate decisions and economic outlook statements affect all equities, particularly growth stocks.'
      })

      earningsData.upcomingEvents.push({
        type: 'Economic Data Releases',
        description: 'Key reports: CPI, Jobs Report, GDP, Consumer Confidence',
        impact: 'Medium',
        note: 'Economic indicators can trigger sector-wide movements and affect option pricing through volatility changes.'
      })
    }

    // Sector-specific events (basic categorization)
    const techSymbols = ['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD', 'NFLX']
    const retailSymbols = ['WMT', 'TGT', 'COST', 'HD', 'LOW', 'NKE', 'SBUX']
    const financeSymbols = ['JPM', 'BAC', 'GS', 'MS', 'WFC', 'C', 'USB']

    if (techSymbols.includes(symbol.toUpperCase())) {
      earningsData.upcomingEvents.push({
        type: 'Tech Sector Events',
        description: 'Product launches, regulatory hearings, semiconductor demand reports',
        impact: 'Medium-High',
        note: 'Tech stocks are sensitive to innovation cycles, chip supply chains, and regulatory scrutiny.'
      })
    } else if (retailSymbols.includes(symbol.toUpperCase())) {
      earningsData.upcomingEvents.push({
        type: 'Retail/Consumer Events',
        description: 'Holiday sales data, consumer spending reports, retail foot traffic',
        impact: 'High',
        note: 'Retail stocks react strongly to same-store sales, e-commerce growth, and seasonal trends.'
      })
    } else if (financeSymbols.includes(symbol.toUpperCase())) {
      earningsData.upcomingEvents.push({
        type: 'Financial Sector Events',
        description: 'Interest rate changes, banking regulations, loan default rates',
        impact: 'High',
        note: 'Financial stocks are highly sensitive to yield curve changes and credit market conditions.'
      })
    }

    // Market sentiment analysis
    earningsData.marketSentiment = {
      description: 'Market sentiment combines analyst ratings, institutional positioning, and recent price action.',
      factors: [
        'Check analyst price targets and recent upgrades/downgrades',
        'Monitor institutional ownership changes (13F filings)',
        'Review insider buying/selling activity',
        'Analyze options flow for unusual activity (large block trades)'
      ]
    }

    // What to watch
    earningsData.whatToWatch = [
      {
        category: 'Before Trade Entry',
        items: [
          'Confirm earnings date is not within your option expiration window',
          'Check implied volatility percentile - avoid selling premium when IV is extremely low',
          'Review recent price support/resistance levels relative to your strike price',
          'Verify adequate options liquidity (bid-ask spread should be tight)'
        ]
      },
      {
        category: 'During Trade',
        items: [
          'Monitor for material news (FDA approvals, product recalls, lawsuits, acquisitions)',
          'Watch for sudden volume spikes or unusual price movements',
          'Track broader market trends that could affect your position',
          'Set alerts for significant price moves (e.g., ±5% from entry)'
        ]
      },
      {
        category: 'Risk Management',
        items: [
          'Define exit strategy before entering trade (profit target and stop loss)',
          'Consider rolling options if thesis remains intact but timing is off',
          'Be prepared to take assignment if price moves against you',
          'Never allocate more than planned % of portfolio to single position'
        ]
      }
    ]

    res.json(earningsData)
  } catch (error) {
    console.error('Error fetching earnings/events:', error.message)
    res.status(500).json({
      error: 'Failed to fetch earnings and events data',
      details: error.message
    })
  }
})

// Stock price endpoint - scrapes from stockanalysis.com
app.post('/api/scrape/stock-price', requireAuth, async (req, res) => {
  try {
    const { symbol } = req.body

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' })
    }

    // Scrape stock price from stockanalysis.com
    const url = `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/`
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 10000
    })

    const $ = cheerio.load(response.data)

    // Try multiple selectors to find the price
    let price = null

    // Method 1: Look for price in specific div with data-test attribute
    price = $('[data-test="stock-price"]').first().text().trim()

    // Method 2: Look for price in the main price display area
    if (!price || price === '') {
      price = $('.text-3xl, .text-4xl').first().text().trim()
    }

    // Method 3: Look for any element with price-like text
    if (!price || price === '') {
      $('div, span').each((i, elem) => {
        const text = $(elem).text().trim()
        if (text.match(/^\$\d+\.\d{2}$/)) {
          price = text
          return false // break
        }
      })
    }

    // Clean up the price
    if (price) {
      price = price.replace('$', '').replace(',', '').trim()
      const priceNum = parseFloat(price)

      if (!isNaN(priceNum) && priceNum > 0) {
        return res.json({
          price: priceNum,
          symbol: symbol.toUpperCase(),
          source: 'stockanalysis.com'
        })
      }
    }

    // If we couldn't find the price, return error
    return res.status(404).json({
      error: 'Price not found',
      message: 'Unable to fetch stock price from stockanalysis.com'
    })

  } catch (error) {
    console.error('Error fetching stock price:', error.message)
    res.status(500).json({
      error: 'Failed to fetch stock price',
      details: error.message
    })
  }
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// Start server (only when not in Vercel serverless environment)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Options Trading AI Proxy Server running on port ${PORT}`)
    console.log(`Health check: http://localhost:${PORT}/health`)
  })
}

// Export for Vercel serverless
export default app