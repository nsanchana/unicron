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

// Simple in-memory cache
const cache = {
  data: new Map(),
  get(key) {
    const item = this.data.get(key)
    if (!item) return null
    if (Date.now() > item.expiry) {
      this.data.delete(key)
      return null
    }
    return item.value
  },
  set(key, value, ttl = 300000) { // Default 5 mins
    this.data.set(key, {
      value,
      expiry: Date.now() + ttl
    })
  }
}

// Helper to extract JSON from markdown or raw text
function extractJson(text) {
  try {
    // Try to find JSON block first (most common for Gemini)
    const jsonMatch = text.match(/```json\s*(\{[\s\S]*\})\s*```/) || text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      try {
        return JSON.parse(jsonStr)
      } catch (parseError) {
        // If it fails, try cleaning it (e.g., removing trailing commas)
        const cleanedStr = jsonStr.replace(/,\s*([\]}])/g, '$1')
        return JSON.parse(cleanedStr)
      }
    }
    // Fallback to direct parse
    return JSON.parse(text)
  } catch (e) {
    console.error('JSON Extraction failed:', e.message)
    throw new Error('No valid JSON found in response')
  }
}

// Helper function to generate comprehensive company analysis using AI
async function generateComprehensiveCompanyAnalysis(symbol, scrapedData = {}) {
  const apiKey = process.env.GEMINI_API_KEY
  const cacheKey = `companyAnalysis_${symbol}`

  const cachedResult = cache.get(cacheKey)
  if (cachedResult) {
    console.log(`[Cache] Returning cached company analysis for ${symbol}`)
    return cachedResult
  }

  console.log(`[CompanyAnalysis] Starting analysis for ${symbol}`)

  // Diagnostic logging for API key
  if (!apiKey) {
    console.warn(`[CompanyAnalysis] GEMINI_API_KEY is completely missing in environment variables.`)
  } else {
    const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4)
    console.log(`[CompanyAnalysis] Found API Key: ${maskedKey} (length: ${apiKey.length})`)
  }

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    console.warn(`[CompanyAnalysis] No Gemini API key found for ${symbol}, using fallback data`)
    const fallback = generateFallbackCompanyAnalysis(symbol, scrapedData)
    return { ...fallback, isFallback: true }
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    })

    const prompt = `You are a senior equity research analyst. Provide a comprehensive analysis of ${symbol} (${scrapedData.companyName || symbol}).

Available Data:
- Company Description: ${scrapedData.description || 'Not available'}
- Sector: ${scrapedData.sector || 'Not available'}
- Industry: ${scrapedData.industry || 'Not available'}
- Market Cap: ${scrapedData.marketCap || 'Not available'}
- Employees: ${scrapedData.employees || 'Not available'}
- Revenue: ${scrapedData.revenue || 'Not available'}
- Net Income: ${scrapedData.netIncome || 'Not available'}
- PE Ratio: ${scrapedData.peRatio || 'Not available'}

Provide a detailed analysis in the following JSON format. For each category, provide substantive analysis (3-5 sentences minimum) and a rating from 0-10:

{
  "marketPosition": {
    "analysis": "Detailed analysis of the company's position in the market, competitive advantages, industry dynamics, and market share...",
    "rating": 7
  },
  "businessModel": {
    "analysis": "Detailed evaluation of how the company generates revenue, key revenue streams, business model sustainability, and recurring revenue potential...",
    "rating": 7
  },
  "industryTrends": {
    "analysis": "Analysis of industry trends, external factors impacting performance, regulatory environment, technological disruption, and macroeconomic influences...",
    "rating": 7
  },
  "customerBase": {
    "analysis": "Assessment of customer base composition, concentration risks, customer retention, geographic diversification, and dependency on key customers...",
    "rating": 7
  },
  "growthStrategy": {
    "analysis": "Investigation of future growth plans, product development pipeline, expansion strategies, M&A activity, and long-term market success potential...",
    "rating": 7
  },
  "economicMoat": {
    "analysis": "Economic moat analysis covering brand loyalty, barriers to entry, switching costs, network effects, economies of scale, patents/IP, and cost advantages...",
    "rating": 7
  },
  "overallRating": 7,
  "summary": "2-3 sentence executive summary of the overall investment thesis..."
}

Be specific, factual, and thorough. Use your knowledge of ${symbol} to provide meaningful insights. Return ONLY valid JSON.`

    console.log('[CompanyAnalysis] Calling Gemini API...')

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    console.log('[CompanyAnalysis] Received response from Gemini')

    let analysis = extractJson(responseText)

    // Calculate overallRating as average of category ratings if not provided or valid
    const categories = ['marketPosition', 'businessModel', 'industryTrends', 'customerBase', 'growthStrategy', 'economicMoat']
    const ratings = categories.map(cat => analysis[cat]?.rating).filter(r => typeof r === 'number')
    if (ratings.length > 0) {
      analysis.overallRating = Math.round(ratings.reduce((sum, r) => sum + r, 0) / ratings.length)
    }

    cache.set(cacheKey, analysis)
    return analysis

  } catch (error) {
    console.error(`[CompanyAnalysis] Gemini API call failed for ${symbol}:`, error.message)
    console.error(`[CompanyAnalysis] Full error stack:`, error.stack)
    const fallback = generateFallbackCompanyAnalysis(symbol, scrapedData)
    return { ...fallback, isFallback: true, error: error.message }
  }
}

function generateFallbackCompanyAnalysis(symbol, scrapedData = {}) {
  return {
    marketPosition: {
      analysis: `${symbol} operates in the ${scrapedData.sector || 'broader'} sector within the ${scrapedData.industry || 'industry'}. Further research is needed to assess the company's competitive position, market share, and industry dynamics. Consider analyzing peer comparisons and market trends.`,
      rating: 5
    },
    businessModel: {
      analysis: `${symbol}'s business model and revenue generation strategy requires deeper analysis. Key factors to evaluate include revenue diversification, recurring revenue streams, and business sustainability. Review annual reports for detailed segment breakdowns.`,
      rating: 5
    },
    industryTrends: {
      analysis: `The ${scrapedData.industry || 'industry'} sector is subject to various external factors including regulatory changes, technological disruption, and macroeconomic conditions. Monitor industry reports and analyst coverage for trend analysis.`,
      rating: 5
    },
    customerBase: {
      analysis: `Customer concentration and diversification analysis for ${symbol} requires review of revenue breakdown by customer segment. Key risks include dependency on major customers and geographic concentration. Check 10-K filings for customer details.`,
      rating: 5
    },
    growthStrategy: {
      analysis: `${symbol}'s growth strategy and expansion plans should be evaluated through management guidance, investor presentations, and strategic initiatives. Consider product pipeline, market expansion, and M&A activity.`,
      rating: 5
    },
    economicMoat: {
      analysis: `Economic moat analysis for ${symbol} should consider brand strength, barriers to entry, switching costs, network effects, and scale advantages. Competitive advantages vary by business segment and require detailed evaluation.`,
      rating: 5
    },
    overallRating: 5,
    summary: `${symbol} is a ${scrapedData.marketCap || ''} company in the ${scrapedData.sector || 'market'}. A comprehensive analysis requires reviewing financial statements, competitive positioning, and growth prospects.`
  }
}

// Helper function to generate AI insights using Gemini
async function generateAIInsight(symbol, dataType, scrapedData = {}) {
  const apiKey = process.env.GEMINI_API_KEY
  const cacheKey = `${dataType}_${symbol}`

  const cachedResult = cache.get(cacheKey)
  if (cachedResult) {
    console.log(`[Cache] Returning cached insight for ${dataType} - ${symbol}`)
    return cachedResult
  }

  console.log(`Generating AI insight for ${symbol} - ${dataType}...`)

  // If no API key, fall back to template insights
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    console.warn(`[AIInsight] Gemini API key not configured for ${dataType} - ${symbol}, using fallback.`)
    const fallback = generateFallbackInsight(symbol, dataType, scrapedData)
    return typeof fallback === 'string' ? `${fallback} (Note: This is an automated fallback insight)` : fallback
  }

  try {
    // For specific JSON structures in technical/recent developments, use JSON mode
    // For others (simple text), use default text mode
    const isJsonExpected = dataType === 'technicalAnalysis' || dataType === 'recentDevelopments'

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: isJsonExpected ? { responseMimeType: "application/json" } : undefined
    })

    const prompts = {
      financialHealth: `Analyze this financial data for ${symbol} for options trading purposes:

${JSON.stringify(scrapedData.metrics || [], null, 2)}

Provide a 2-3 sentence analysis focused on:
1. Financial strength and stability for supporting options strategies
2. Revenue/profit trends that suggest bullish or bearish positioning
3. Specific recommendation on whether the financial health supports selling puts or covered calls

Be concise and actionable for options traders.`,

      technicalAnalysis: `You are a technical analyst. Provide a detailed technical analysis for ${symbol}.

Current Price: ${scrapedData.currentPrice || 'Not available'}
Target Price: ${scrapedData.targetPrice || 'Not available'}

Provide your analysis in the following JSON format:
{
  "summary": "2-3 sentence overview of current technical setup and momentum",
  "supportLevels": ["$XXX - description", "$XXX - description"],
  "resistanceLevels": ["$XXX - description", "$XXX - description"],
  "trend30to60Days": "Detailed outlook for the next 30-60 days based on technical patterns, momentum indicators, and historical price action. Include specific price targets if the trend continues.",
  "targetPriceAnalysis": "Analysis of the analyst target price - what it implies for upside/downside potential and how it aligns with technical levels",
  "optionsStrategy": "Specific recommendation on whether to sell puts or covered calls based on the technical setup, with suggested strike price levels",
  "rating": 7
}

Use your knowledge of ${symbol}'s recent price history, chart patterns, moving averages (50-day, 200-day), RSI, MACD, and volume trends. Be specific with price levels. Return ONLY valid JSON.`,

      optionsData: `Analyze this options market data for ${symbol}:

${JSON.stringify(scrapedData.metrics || [], null, 2)}

Provide a 2-3 sentence analysis focused on:
1. Implied volatility environment
2. Liquidity and open interest insights
3. Specific recommendation on optimal options strategy given current market conditions

Be actionable for options income traders.`,

      recentDevelopments: `You are a financial analyst tracking ${symbol}. Provide analysis of recent developments and upcoming events.

Provide your analysis in the following JSON format:
{
  "summary": "2-3 sentence overview of current news sentiment and key developments",
  "nextEarningsCall": {
    "date": "Expected date of next earnings call (e.g., 'January 30, 2025' or 'Q1 2025 - exact date TBD')",
    "expectation": "Brief analysis of what to expect from the earnings report"
  },
  "majorEvents": [
    {
      "event": "Description of upcoming event or recent major news",
      "expectedImpact": "How this could impact the stock price",
      "date": "When this is happening or happened"
    }
  ],
  "catalysts": "Key upcoming catalysts that options traders should be aware of (product launches, regulatory decisions, macro events, etc.)",
  "optionsImplication": "Whether current news environment favors selling premium or staying on sidelines",
  "rating": 7
}

Use your knowledge of ${symbol}'s recent news, earnings schedule, product announcements, and market events. Be specific and current. Return ONLY valid JSON.`
    }

    const prompt = prompts[dataType] || `Analyze ${dataType} for ${symbol} with data: ${JSON.stringify(scrapedData)}`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    cache.set(cacheKey, responseText)
    return responseText

  } catch (error) {
    console.error(`[AIInsight] Gemini API call failed for ${dataType} - ${symbol}:`, error.message)
    const fallback = generateFallbackInsight(symbol, dataType, scrapedData)
    return typeof fallback === 'string' ? `${fallback} (Error: ${error.message})` : fallback
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

// Scraping functions
async function scrapeCompanyAnalysis(symbol) {
  let scrapedInfo = {
    description: '',
    sector: '',
    industry: '',
    marketCap: '',
    companyName: symbol,
    employees: '',
    revenue: '',
    netIncome: '',
    peRatio: ''
  }

  // Scrape from StockAnalysis
  try {
    const saUrl = `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/`
    const saResponse = await axios.get(saUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 15000
    })
    const $sa = cheerio.load(saResponse.data)
    scrapedInfo.description = $sa('meta[name="description"]').attr('content') || ''
    scrapedInfo.companyName = $sa('h1').first().text().trim() || symbol
    scrapedInfo.sector = $sa('[data-test="sector"]').text().trim()
    scrapedInfo.industry = $sa('[data-test="industry"]').text().trim()
    scrapedInfo.marketCap = $sa('[data-test="market-cap"]').text().trim()
    scrapedInfo.peRatio = $sa('[data-test="pe-ratio"]').text().trim()
    scrapedInfo.employees = $sa('[data-test="employees"]').text().trim()
  } catch (error) {
    console.log('StockAnalysis scraping failed, trying Yahoo Finance...')
  }

  // Fallback to Yahoo Finance
  if (!scrapedInfo.description || !scrapedInfo.sector) {
    try {
      const yahooUrl = `https://finance.yahoo.com/quote/${symbol}/profile`
      const yahooResponse = await axios.get(yahooUrl, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 15000
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

  // Try to get financial data for context
  try {
    const financialsUrl = `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/financials/`
    const finResponse = await axios.get(financialsUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })
    const $fin = cheerio.load(finResponse.data)
    $fin('table tr').each((_, row) => {
      const label = $fin(row).find('td').first().text().trim().toLowerCase()
      const value = $fin(row).find('td').eq(1).text().trim()
      if (label.includes('revenue') && !scrapedInfo.revenue) scrapedInfo.revenue = value
      if (label.includes('net income') && !scrapedInfo.netIncome) scrapedInfo.netIncome = value
    })
  } catch (error) {
    console.log('Financial data scraping failed')
  }

  // Generate comprehensive AI analysis
  const comprehensiveAnalysis = await generateComprehensiveCompanyAnalysis(symbol, scrapedInfo)

  // Build metrics from scraped data
  const metrics = [
    { label: 'Company', value: scrapedInfo.companyName || symbol },
    { label: 'Sector', value: scrapedInfo.sector || 'Not Available' },
    { label: 'Industry', value: scrapedInfo.industry || 'Not Available' },
    { label: 'Market Cap', value: scrapedInfo.marketCap || 'Not Available' },
    { label: 'P/E Ratio', value: scrapedInfo.peRatio || 'Not Available' },
    { label: 'Employees', value: scrapedInfo.employees || 'Not Available' }
  ].filter(m => m.value !== 'Not Available' && m.value !== '')

  // Build signals based on analysis
  const signals = []
  if (comprehensiveAnalysis.overallRating >= 7) {
    signals.push({ type: 'positive', message: 'Strong overall company fundamentals' })
  } else if (comprehensiveAnalysis.overallRating <= 4) {
    signals.push({ type: 'negative', message: 'Weak company fundamentals - exercise caution' })
  }
  if (comprehensiveAnalysis.economicMoat?.rating >= 7) {
    signals.push({ type: 'positive', message: 'Strong economic moat identified' })
  }
  if (comprehensiveAnalysis.growthStrategy?.rating >= 7) {
    signals.push({ type: 'positive', message: 'Solid growth strategy in place' })
  }
  if (comprehensiveAnalysis.customerBase?.rating <= 4) {
    signals.push({ type: 'warning', message: 'Customer concentration risk detected' })
  }

  // Return comprehensive analysis structure
  return {
    rating: comprehensiveAnalysis.overallRating || 5,
    analysis: comprehensiveAnalysis.summary || `Analysis for ${symbol}`,
    metrics,
    signals: signals.length > 0 ? signals : [{ type: 'info', message: 'Company analysis completed' }],
    // Detailed analysis sections
    detailedAnalysis: {
      marketPosition: {
        title: 'Market Position & Competitive Advantage',
        content: comprehensiveAnalysis.marketPosition?.analysis || 'Analysis not available',
        rating: comprehensiveAnalysis.marketPosition?.rating || 5
      },
      businessModel: {
        title: 'Business Model & Revenue Generation',
        content: comprehensiveAnalysis.businessModel?.analysis || 'Analysis not available',
        rating: comprehensiveAnalysis.businessModel?.rating || 5
      },
      industryTrends: {
        title: 'Industry Trends & External Factors',
        content: comprehensiveAnalysis.industryTrends?.analysis || 'Analysis not available',
        rating: comprehensiveAnalysis.industryTrends?.rating || 5
      },
      customerBase: {
        title: 'Customer Base & Concentration Risk',
        content: comprehensiveAnalysis.customerBase?.analysis || 'Analysis not available',
        rating: comprehensiveAnalysis.customerBase?.rating || 5
      },
      growthStrategy: {
        title: 'Growth Strategy & Future Outlook',
        content: comprehensiveAnalysis.growthStrategy?.analysis || 'Analysis not available',
        rating: comprehensiveAnalysis.growthStrategy?.rating || 5
      },
      economicMoat: {
        title: 'Economic Moat Analysis',
        content: comprehensiveAnalysis.economicMoat?.analysis || 'Analysis not available',
        rating: comprehensiveAnalysis.economicMoat?.rating || 5
      }
    }
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
  let targetPrice = ''

  // Scrape current price and target price from StockAnalysis
  try {
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
    }
  } catch (error) {
    console.log('Technical scraping failed')
  }

  // Scrape target price from StockAnalysis forecast page
  try {
    const forecastUrl = `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/forecast/`
    const forecastResponse = await axios.get(forecastUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })
    const $forecast = cheerio.load(forecastResponse.data)

    // Look for analyst price target
    targetPrice = $forecast('[data-test="target-price"]').first().text().trim() ||
      $forecast('td:contains("Price Target")').next().text().trim() ||
      $forecast('.text-2xl:contains("$")').first().text().trim()

    // Try alternative selectors
    if (!targetPrice) {
      $forecast('div, span').each((_, el) => {
        const text = $forecast(el).text().trim()
        if (text.includes('Price Target') || text.includes('Analyst Target')) {
          const match = text.match(/\$[\d,.]+/)
          if (match) {
            targetPrice = match[0]
            return false // break
          }
        }
      })
    }

    if (targetPrice) {
      metrics.push({ label: 'Target Price', value: targetPrice })
    }
  } catch (error) {
    console.log('Target price scraping failed')
  }

  // Get comprehensive AI analysis
  const aiResponse = await generateAIInsight(symbol, 'technicalAnalysis', { currentPrice, targetPrice, metrics })

  // Try to parse JSON response from AI
  let technicalData = null
  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      technicalData = JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.log('Could not parse technical analysis JSON')
  }

  if (technicalData) {
    rating = technicalData.rating || 6

    // Add support levels to metrics
    if (technicalData.supportLevels && technicalData.supportLevels.length > 0) {
      technicalData.supportLevels.forEach((level, i) => {
        metrics.push({ label: `Support Level ${i + 1}`, value: level })
      })
    }

    // Add resistance levels to metrics
    if (technicalData.resistanceLevels && technicalData.resistanceLevels.length > 0) {
      technicalData.resistanceLevels.forEach((level, i) => {
        metrics.push({ label: `Resistance Level ${i + 1}`, value: level })
      })
    }

    // Add signals based on analysis
    if (technicalData.optionsStrategy) {
      signals.push({ type: 'info', message: technicalData.optionsStrategy })
    }

    return {
      rating: Math.min(rating, 10),
      analysis: technicalData.summary || 'Technical analysis completed',
      metrics,
      signals: signals.length > 0 ? signals : [{ type: 'info', message: 'Technical analysis completed' }],
      currentPrice: currentPrice || null,
      targetPrice: targetPrice || null,
      // Detailed technical data for UI
      detailedTechnical: {
        trend30to60Days: {
          title: '30-60 Day Trend Outlook',
          content: technicalData.trend30to60Days || 'Analysis not available'
        },
        supportResistance: {
          title: 'Support & Resistance Levels',
          support: technicalData.supportLevels || [],
          resistance: technicalData.resistanceLevels || []
        },
        targetPriceAnalysis: {
          title: 'Target Price Analysis',
          content: technicalData.targetPriceAnalysis || 'Analysis not available',
          targetPrice: targetPrice || null
        },
        optionsStrategy: {
          title: 'Options Strategy Recommendation',
          content: technicalData.optionsStrategy || 'Analysis not available'
        }
      }
    }
  }

  // Fallback if AI parsing failed
  return {
    rating: Math.min(rating, 10),
    analysis: typeof aiResponse === 'string' ? aiResponse : 'Technical analysis requires review of chart patterns and indicators.',
    metrics: metrics.length > 0 ? metrics : [
      { label: 'Price Trend', value: 'Monitor chart patterns' },
      { label: 'Moving Averages', value: 'Compare 50 & 200 day' },
      { label: 'Volume Analysis', value: 'Check accumulation/distribution' }
    ],
    signals: [{ type: 'info', message: 'Use technical indicators to identify optimal entry and exit points' }],
    currentPrice: currentPrice || null,
    targetPrice: targetPrice || null
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

  // Get comprehensive AI analysis for recent developments
  const aiResponse = await generateAIInsight(symbol, 'recentDevelopments', {})

  // Try to parse JSON response from AI
  let developmentsData = null
  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      developmentsData = JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.log('Could not parse recent developments JSON')
  }

  if (developmentsData) {
    rating = developmentsData.rating || 6

    // Add earnings info to metrics
    if (developmentsData.nextEarningsCall) {
      metrics.push({ label: 'Next Earnings', value: developmentsData.nextEarningsCall.date || 'TBD' })
    }

    // Add major events count
    if (developmentsData.majorEvents && developmentsData.majorEvents.length > 0) {
      metrics.push({ label: 'Upcoming Events', value: developmentsData.majorEvents.length.toString() })
    }

    // Add signals based on options implication
    if (developmentsData.optionsImplication) {
      signals.push({ type: 'info', message: developmentsData.optionsImplication })
    }

    return {
      rating: Math.min(rating, 10),
      analysis: developmentsData.summary || 'Recent developments analysis completed',
      metrics,
      signals: signals.length > 0 ? signals : [{ type: 'info', message: 'Monitor upcoming events for trading opportunities' }],
      // Detailed developments data for UI
      detailedDevelopments: {
        nextEarningsCall: {
          title: 'Next Earnings Call',
          date: developmentsData.nextEarningsCall?.date || 'Date not available',
          expectation: developmentsData.nextEarningsCall?.expectation || 'Analysis not available'
        },
        majorEvents: {
          title: 'Major Events & News',
          events: developmentsData.majorEvents || []
        },
        catalysts: {
          title: 'Upcoming Catalysts',
          content: developmentsData.catalysts || 'No major catalysts identified'
        },
        optionsImplication: {
          title: 'Options Trading Implication',
          content: developmentsData.optionsImplication || 'Analysis not available'
        }
      }
    }
  }

  // Fallback if AI parsing failed
  return {
    rating: Math.min(rating, 10),
    analysis: typeof aiResponse === 'string' ? aiResponse : 'Recent developments analysis requires monitoring news and events.',
    metrics: [
      { label: 'Earnings Date', value: 'Check upcoming earnings calendar' },
      { label: 'Company Events', value: 'Monitor for catalysts' },
      { label: 'Market Trends', value: 'Follow sector developments' }
    ],
    signals: [{ type: 'info', message: 'Stay updated on company news to identify options trading opportunities' }]
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