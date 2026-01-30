import axios from 'axios'
import * as cheerio from 'cheerio'
import { GoogleGenerativeAI } from '@google/generative-ai'

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Fallback AICache model if not importable
let AICache;
try {
  const auth = await import('../../auth.js');
  AICache = auth.AICache;
} catch (e) {
  // If we can't import (e.g. in some serverless env), we'll define a dummy or use a different approach
  // But since we are in the same repo, it should work.
}

// Simple in-memory cache with SQLite persistence
const cache = {
  async get(key) {
    if (!AICache) return null;
    try {
      const item = await AICache.findOne({ where: { key } })
      if (!item) return null
      if (new Date() > new Date(item.expiry)) {
        await AICache.destroy({ where: { key } })
        return null
      }
      return JSON.parse(item.value)
    } catch (e) {
      console.error('Cache get failed:', e.message)
      return null
    }
  },
  async set(key, value, ttl = 86400000) { // Default 24 hours
    if (!AICache) return;
    try {
      const expiry = new Date(Date.now() + ttl)
      const valStr = JSON.stringify(value)

      const existing = await AICache.findOne({ where: { key } })
      if (existing) {
        await existing.update({ value: valStr, expiry })
      } else {
        await AICache.create({ key, value: valStr, expiry })
      }
    } catch (e) {
      console.error('Cache set failed:', e.message)
    }
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

  const cachedResult = await cache.get(cacheKey)
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
      model: 'gemini-2.5-flash',
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

Provide a detailed analysis in the following JSON format. For each category, provide substantive analysis (3-5 sentences minimum) and a rating from 0-10 based on the following rubric:
- 0-3: Extremely Weak / Significant Distress / High Risk
- 4-5: Average / Neutral / Fair
- 6-8: Strong / Solid Competitive Position / Growth
- 9-10: Exceptional / Dominant Market Leader / Pristine Fundamentals

{
  "marketPosition": {
    "analysis": "Detailed analysis of the company's position in the market...",
    "rating": [use rubric]
  },
  "businessModel": {
    "analysis": "Detailed evaluation of how the company generates revenue...",
    "rating": [use rubric]
  },
  "industryTrends": {
    "analysis": "Analysis of industry trends...",
    "rating": [use rubric]
  },
  "customerBase": {
    "analysis": "Assessment of customer base composition...",
    "rating": [use rubric]
  },
  "growthStrategy": {
    "analysis": "Investigation of future growth plans...",
    "rating": [use rubric]
  },
  "economicMoat": {
    "analysis": "Economic moat analysis...",
    "rating": [use rubric]
  },
  "overallRating": [average of ratings above],
  "summary": "2-3 sentence executive summary..."
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

    await cache.set(cacheKey, analysis)
    return analysis

  } catch (error) {
    console.error(`[CompanyAnalysis] Gemini API call failed for ${symbol}:`, error.message)
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

// Helper function to generate AI insights for other sections
async function generateAIInsight(symbol, dataType, scrapedData = {}) {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    console.warn(`[AIInsight] Gemini API key not configured for ${dataType} - ${symbol}, using fallback.`)
    const fallback = generateFallbackInsight(symbol, dataType, scrapedData)
    return typeof fallback === 'string' ? `${fallback} (Note: This is an automated fallback insight)` : fallback
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    // For specific JSON structures in technical/recent developments, use JSON mode
    // For others (simple text), use default text mode
    const isJsonExpected = dataType === 'technicalAnalysis' || dataType === 'recentDevelopments'
    const cacheKey = `${dataType}_${symbol}`

    const cachedResult = await cache.get(cacheKey)
    if (cachedResult) {
      console.log(`[Cache] Returning cached insight for ${dataType} - ${symbol}`)
      return cachedResult
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: isJsonExpected ? { responseMimeType: "application/json" } : undefined
    })

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    const prompts = {
      financialHealth: `Analyze this financial data for ${symbol} for options trading purposes:

${JSON.stringify(scrapedData.metrics || [], null, 2)}

Today's Date: ${currentDate}

Provide a 2-3 sentence analysis focused on:
1. Financial strength and stability for supporting options strategies
2. Revenue/profit trends that suggest bullish or bearish positioning
3. Specific recommendation on whether the financial health supports selling puts or covered calls

Be concise and actionable for options traders.`,

      technicalAnalysis: `You are a technical analyst. Provide a detailed technical analysis for ${symbol}.

Today's Date: ${currentDate}
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

Today's Date: ${currentDate}

Provide a 2-3 sentence analysis focused on:
1. Implied volatility environment
2. Liquidity and open interest insights
3. Specific recommendation on optimal options strategy given current market conditions

Be actionable for options income traders.`,

      recentDevelopments: `You are a financial analyst tracking ${symbol}. Provide analysis of recent developments and upcoming events.

Today's Date: ${currentDate}
Scraped Data Context: ${JSON.stringify(scrapedData)}

Provide your analysis in the following JSON format:
{
  "summary": "2-3 sentence overview of current news sentiment and key developments",
  "nextEarningsCall": {
    "date": "Expected date of next earnings call. MUST be in the future (after ${currentDate}). Format: 'Month DD, YYYY'",
    "expectation": "Brief analysis of what to expect from the upcoming earnings report"
  },
  "majorEvents": [
    {
      "event": "Description of upcoming event or VERY RECENT major news (from late 2025 or 2026)",
      "expectedImpact": "How this could impact the stock price",
      "date": "When this is happening or happened"
    }
  ],
  "catalysts": "Key upcoming catalysts that options traders should be aware of in 2026 (product launches, regulatory decisions, macro events, etc.)",
  "optionsImplication": "Whether current news environment favors selling premium or staying on sidelines",
  "rating": 7
}

CRITICAL: The 'Next Earnings Call' MUST be a future date relative to ${currentDate}. If unsure, provide an estimate based on typical cycles (e.g., 'Late March 2026'). Do NOT use dates from 2024.
Return ONLY valid JSON.`
    }

    const prompt = prompts[dataType] || `Analyze ${dataType} for ${symbol} with data: ${JSON.stringify(scrapedData)}`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()
    await cache.set(cacheKey, responseText)
    return responseText

  } catch (error) {
    console.error(`[AIInsight] Gemini API call failed for ${dataType} - ${symbol}:`, error.message)
    const fallback = generateFallbackInsight(symbol, dataType, scrapedData)
    return typeof fallback === 'string' ? `${fallback} (Error: ${error.message})` : fallback
  }
}

function generateFallbackInsight(symbol, dataType, scrapedData = {}) {
  const insights = {
    companyAnalysis: `${symbol} is a publicly traded company${scrapedData.sector ? ` in the ${scrapedData.sector} sector` : ''}. ${scrapedData.description || 'This analysis examines the company\'s business model, competitive positioning, and strategic direction.'}`,
    financialHealth: `Financial analysis for ${symbol} evaluates the company's profitability, liquidity, and solvency. Strong financials typically show consistent revenue growth, healthy profit margins, and manageable debt levels.`,
    technicalAnalysis: `Technical analysis of ${symbol} examines price trends, trading volume, and market momentum. ${scrapedData.currentPrice ? `Currently trading at ${scrapedData.currentPrice}.` : ''} Key indicators include support and resistance levels and moving averages.`,
    optionsData: `Options market analysis for ${symbol} provides insights into market expectations for volatility and directional bias. Implied volatility levels and open interest patterns can reveal institutional sentiment.`,
    recentDevelopments: `Recent news and events significantly impact ${symbol}'s options pricing and trading opportunities. Staying informed about company catalysts is crucial for timing options trades effectively.`
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
    rating: typeof comprehensiveAnalysis.overallRating === 'number' ? comprehensiveAnalysis.overallRating : 5,
    analysis: comprehensiveAnalysis.summary || `Analysis for ${symbol}`,
    isFallback: comprehensiveAnalysis.isFallback || false,
    error: comprehensiveAnalysis.error || null,
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
    const saUrl = `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/financials/`
    const response = await axios.get(saUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })
    const $ = cheerio.load(response.data)

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

    // Dynamic rating based on metric quality (basic heuristic)
    const margins = metrics.filter(m => m.label.toLowerCase().includes('margin'))
    const positiveMargins = margins.filter(m => parseFloat(m.value) > 0).length
    const growth = metrics.filter(m => m.label.toLowerCase().includes('growth'))
    const positiveGrowth = growth.filter(m => parseFloat(m.value) > 0).length

    if (metrics.length > 0) {
      rating = 5 // Start at neutral
      if (positiveMargins > 0) rating += 1
      if (positiveGrowth > 0) rating += 1
      if (metrics.length > 5) rating += 1
      // Cap at 9 for purely scraped data without AI deeper context
      rating = Math.min(rating, 9)
    } else {
      rating = 4 // Underperforming/No Data
    }
  } catch (error) {
    console.log('Financial scraping failed')
  }

  // Use scraped data only - no AI call to save API quota
  const analysis = metrics.length > 0
    ? `Financial analysis based on recent data. Key metrics include revenue trends, profitability, and debt levels. Review the metrics below for detailed insights.`
    : `Financial data for ${symbol} requires review of key ratios and trends. Analyze revenue growth, profit margins, and debt levels for comprehensive assessment.`

  if (signals.length === 0) {
    signals.push({ type: 'info', message: 'Review key financial ratios and trends for comprehensive analysis' })
  }

  if (metrics.length === 0) {
    metrics.push(
      { label: 'Revenue Growth', value: 'Analyze YoY trends' },
      { label: 'Profit Margins', value: 'Compare to industry average' },
      { label: 'Debt Levels', value: 'Evaluate leverage ratio' }
    )
  }

  return { rating: Math.min(rating, 10), analysis, metrics, signals }
}

async function scrapeTechnicalAnalysis(symbol) {
  const metrics = []
  const signals = []
  let rating = 6
  let currentPrice = ''
  let targetPrice = ''
  let supportLevels = []
  let resistanceLevels = []

  // Scrape current price from StockAnalysis
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

    // Try to extract 52-week high/low as resistance/support
    const fiftyTwoWeekHigh = $('[data-test="52-week-high"]').text().trim() ||
      $('td:contains("52-Week High")').next().text().trim()
    const fiftyTwoWeekLow = $('[data-test="52-week-low"]').text().trim() ||
      $('td:contains("52-Week Low")').next().text().trim()

    if (fiftyTwoWeekHigh) {
      resistanceLevels.push(`${fiftyTwoWeekHigh} - 52-Week High`)
    }
    if (fiftyTwoWeekLow) {
      supportLevels.push(`${fiftyTwoWeekLow} - 52-Week Low (StockAnalysis)`)
    }
  } catch (error) {
    console.log('Technical scraping failed:', error.message)
  }

  // Scrape from GuruFocus for S/R and Analyst Target
  try {
    const gfUrl = `https://www.gurufocus.com/stock/${symbol.toUpperCase()}/summary`
    const gfResponse = await axios.get(gfUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })
    const $gf = cheerio.load(gfResponse.data)

    const gfTarget = $gf('td:contains("Analyst Price Target")').next().text().trim() ||
      $gf('.stock-indicator-value:contains("$")').first().text().trim()

    if (gfTarget && gfTarget.includes('$')) {
      metrics.push({ label: 'Analyst Target (GuruFocus)', value: gfTarget })
      if (!targetPrice) targetPrice = gfTarget
    }

    const sma50 = $gf('td:contains("SMA50")').next().text().trim()
    const sma200 = $gf('td:contains("SMA200")').next().text().trim()

    if (sma50) supportLevels.push(`${sma50} - SMA50 (GuruFocus)`)
    if (sma200) resistanceLevels.push(`${sma200} - SMA200 (GuruFocus)`)
  } catch (error) {
    console.log('GuruFocus scraping failed:', error.message)
  }

  // Scrape from Finviz for S/R
  try {
    const fvUrl = `https://finviz.com/quote.ashx?t=${symbol.toUpperCase()}`
    const fvResponse = await axios.get(fvUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })
    const $fv = cheerio.load(fvResponse.data)

    const fvTarget = $fv('td:contains("Target Price")').next().find('b').text().trim()
    if (fvTarget && !isNaN(parseFloat(fvTarget))) {
      metrics.push({ label: 'Target Price (Finviz)', value: `$${fvTarget}` })
    }

    const low52W = $fv('td:contains("52W Range")').next().text().split('-')[0].trim()
    const high52W = $fv('td:contains("52W Range")').next().text().split('-')[1].trim()

    if (low52W) supportLevels.push(`${low52W} - 52W Low (Finviz)`)
    if (high52W) resistanceLevels.push(`${high52W} - 52W High (Finviz)`)
  } catch (error) {
    console.log('Finviz scraping failed:', error.message)
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
      metrics.push({ label: 'Target Price (StockAnalysis)', value: targetPrice })
    }
  } catch (error) {
    console.log('Target price scraping failed')
  }

  // Calculate price delta if both prices are available
  let priceDelta = null
  if (currentPrice && targetPrice) {
    try {
      const current = parseFloat(currentPrice.replace(/[$,]/g, ''))
      const target = parseFloat(targetPrice.replace(/[$,]/g, ''))
      if (!isNaN(current) && !isNaN(target)) {
        const absoluteDelta = target - current
        const percentageDelta = ((absoluteDelta / current) * 100).toFixed(2)
        const direction = absoluteDelta >= 0 ? 'upside' : 'downside'

        priceDelta = {
          absolute: `$${Math.abs(absoluteDelta).toFixed(2)}`,
          percentage: `${Math.abs(parseFloat(percentageDelta)).toFixed(2)}%`,
          direction: direction,
          raw: absoluteDelta
        }

        // Add delta to metrics
        const deltaLabel = direction === 'upside' ? 'Upside to Target' : 'Downside to Target'
        metrics.push({
          label: deltaLabel,
          value: `${priceDelta.absolute} (${priceDelta.percentage})`
        })
      }
    } catch (e) {
      console.log('Price delta calculation failed:', e.message)
    }
  }

  // Get comprehensive AI analysis with enhanced context
  const aiResponse = await generateAIInsight(symbol, 'technicalAnalysis', {
    currentPrice,
    targetPrice,
    priceDelta,
    supportLevels,
    resistanceLevels,
    metrics
  })

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

    // Merge AI-generated levels with scraped levels
    const allSupportLevels = [...supportLevels]
    const allResistanceLevels = [...resistanceLevels]

    if (technicalData.supportLevels && technicalData.supportLevels.length > 0) {
      allSupportLevels.push(...technicalData.supportLevels)
    }
    if (technicalData.resistanceLevels && technicalData.resistanceLevels.length > 0) {
      allResistanceLevels.push(...technicalData.resistanceLevels)
    }

    // Add support levels to metrics (limit to top 3)
    allSupportLevels.slice(0, 3).forEach((level, i) => {
      metrics.push({ label: `Support Level ${i + 1}`, value: level })
    })

    // Add resistance levels to metrics (limit to top 3)
    allResistanceLevels.slice(0, 3).forEach((level, i) => {
      metrics.push({ label: `Resistance Level ${i + 1}`, value: level })
    })

    // Add signals based on analysis
    if (technicalData.optionsStrategy) {
      signals.push({ type: 'info', message: technicalData.optionsStrategy })
    }

    // Add signal based on price delta
    if (priceDelta) {
      const deltaPercent = parseFloat(priceDelta.percentage)
      if (priceDelta.direction === 'upside' && deltaPercent > 15) {
        signals.push({ type: 'positive', message: `Significant upside potential: ${priceDelta.percentage} to analyst target` })
      } else if (priceDelta.direction === 'downside' && deltaPercent > 10) {
        signals.push({ type: 'warning', message: `Trading above analyst target by ${priceDelta.percentage}` })
      }
    }

    return {
      rating: Math.min(rating, 10),
      analysis: technicalData.summary || 'Technical analysis completed',
      metrics,
      signals: signals.length > 0 ? signals : [{ type: 'info', message: 'Technical analysis completed' }],
      currentPrice: currentPrice || null,
      targetPrice: targetPrice || null,
      priceDelta: priceDelta,
      // Detailed technical data for UI
      detailedTechnical: {
        trend30to60Days: {
          title: '30-60 Day Trend Outlook',
          content: technicalData.trend30to60Days || 'Analysis not available'
        },
        supportResistance: {
          title: 'Support & Resistance Levels',
          support: allSupportLevels,
          resistance: allResistanceLevels
        },
        targetPriceAnalysis: {
          title: 'Target Price Analysis',
          content: technicalData.targetPriceAnalysis || 'Analysis not available',
          targetPrice: targetPrice || null,
          currentPrice: currentPrice || null,
          delta: priceDelta
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
    const url = `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/options/`
    const response = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })
    const $ = cheerio.load(response.data)

    $('table tr').slice(0, 5).each((_, row) => {
      const label = $(row).find('td').first().text().trim()
      const value = $(row).find('td').eq(1).text().trim()
      if (label && value) {
        metrics.push({ label, value })
      }
    })

    if (metrics.length > 0) {
      // Dynamic rating for options: higher liquidity/volume = better rating for analysis tool
      const volume = metrics.find(m => m.label.toLowerCase().includes('volume'))
      const openInt = metrics.find(m => m.label.toLowerCase().includes('open interest'))

      rating = 5 // Start neutral
      if (volume && parseInt(volume.value.replace(/,/g, '')) > 1000) rating += 1
      if (openInt && parseInt(openInt.value.replace(/,/g, '')) > 5000) rating += 1
      if (metrics.length >= 5) rating += 1
    } else {
      rating = 4
    }
  } catch (error) {
    console.log('Options scraping failed')
  }

  // Use scraped data only - no AI call to save API quota
  const analysis = metrics.length > 0
    ? `Options market data for ${symbol}. Higher implied volatility offers better premiums for sellers but indicates uncertainty. Review open interest and liquidity for optimal strike selection.`
    : `Options analysis for ${symbol} focuses on implied volatility, put/call ratios, and open interest patterns to identify optimal strategies for income generation.`

  if (metrics.length === 0) {
    metrics.push(
      { label: 'Implied Volatility', value: 'Check IV percentile for timing' },
      { label: 'Put/Call Ratio', value: 'Gauge market sentiment' },
      { label: 'Open Interest', value: 'Identify liquid strikes' }
    )
  }

  signals.push({ type: 'info', message: 'Higher IV offers better premiums for sellers but indicates uncertainty' })

  return { rating: Math.min(rating, 10), analysis, metrics, signals }
}

async function scrapeRecentDevelopments(symbol) {
  const metrics = []
  const signals = []
  let rating = 6

  let scrapedNews = []
  let nextEarningsDate = null

  // Try to scrape actual next earnings from Yahoo Finance or StockAnalysis
  try {
    const yahooUrl = `https://finance.yahoo.com/quote/${symbol}/`
    const response = await axios.get(yahooUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })
    const $ = cheerio.load(response.data)

    // Yahoo often has earnings date in a <td> after "Earnings Date"
    nextEarningsDate = $('td[data-test="EARNINGS_DATE-value"]').text().trim() ||
      $('span:contains("Earnings Date")').next().text().trim()

    // Simple news scraping from the page if possible
    $('h3 a').each((i, el) => {
      if (i < 3) scrapedNews.push($(el).text().trim())
    })
  } catch (error) {
    console.log('Yahoo news/earnings scraping failed')
  }

  // Get comprehensive AI analysis for recent developments with context
  const aiResponse = await generateAIInsight(symbol, 'recentDevelopments', {
    scrapedNews,
    scrapedEarningsDate: nextEarningsDate,
    currentDate: new Date().toLocaleDateString()
  })

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

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { symbol, section } = req.body

    if (!symbol || !section) {
      return res.status(400).json({ error: 'Symbol and section are required' })
    }

    console.log(`Scraping ${section} for ${symbol}...`)

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

    return res.status(200).json(result)
  } catch (error) {
    console.error('Scraping error:', error)
    return res.status(500).json({ error: 'Failed to scrape data', details: error.message })
  }
}
