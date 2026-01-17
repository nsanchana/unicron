import axios from 'axios'
import * as cheerio from 'cheerio'
import Anthropic from '@anthropic-ai/sdk'

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'

// Helper function to generate comprehensive company analysis using AI
async function generateComprehensiveCompanyAnalysis(symbol, scrapedData = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  console.log(`[CompanyAnalysis] Starting analysis for ${symbol}`)
  console.log(`[CompanyAnalysis] API Key present: ${!!apiKey}`)
  console.log(`[CompanyAnalysis] API Key length: ${apiKey ? apiKey.length : 0}`)

  if (!apiKey || apiKey.trim() === '') {
    console.log('[CompanyAnalysis] No API key found, using fallback')
    return generateFallbackCompanyAnalysis(symbol, scrapedData)
  }

  try {
    const anthropic = new Anthropic({
      apiKey: apiKey
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

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].text
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    throw new Error('Could not parse AI response')
  } catch (error) {
    console.error('AI company analysis failed:', error.message)
    return generateFallbackCompanyAnalysis(symbol, scrapedData)
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
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey || apiKey.trim() === '') {
    return generateFallbackInsight(symbol, dataType, scrapedData)
  }

  try {
    const anthropic = new Anthropic({
      apiKey: apiKey
    })

    const prompts = {

      financialHealth: `Analyze this financial data for ${symbol} for options trading purposes:

${JSON.stringify(scrapedData.metrics || [], null, 2)}

Provide a 2-3 sentence analysis focused on:
1. Financial strength and stability for supporting options strategies
2. Revenue/profit trends that suggest bullish or bearish positioning
3. Specific recommendation on whether the financial health supports selling puts or covered calls

Be concise and actionable for options traders.`,

      technicalAnalysis: `Analyze this technical data for ${symbol}:

Current Price: ${scrapedData.currentPrice || 'Not available'}
Additional Metrics: ${JSON.stringify(scrapedData.metrics || [], null, 2)}

Provide a 2-3 sentence analysis focused on:
1. Current price momentum and trend direction
2. Whether current technical setup favors selling out-of-the-money puts or covered calls
3. Suggested technical levels to watch for strike price selection

Be specific and actionable for options traders.`,

      optionsData: `Analyze this options market data for ${symbol}:

${JSON.stringify(scrapedData.metrics || [], null, 2)}

Provide a 2-3 sentence analysis focused on:
1. Implied volatility environment
2. Liquidity and open interest insights
3. Specific recommendation on optimal options strategy given current market conditions

Be actionable for options income traders.`,

      recentDevelopments: `Analyze recent news and sentiment for ${symbol}:

News Items: ${JSON.stringify(scrapedData.newsItems || [], null, 2)}
Sentiment Counts: ${JSON.stringify(scrapedData.sentimentCounts || {}, null, 2)}

Provide a 2-3 sentence analysis focused on:
1. Overall sentiment and how it impacts near-term stock movement
2. Specific news catalysts that could affect options positions
3. Recommendation on whether current news environment supports entering new options positions

Be concise and actionable.`
    }

    const prompt = prompts[dataType] || `Analyze ${dataType} for ${symbol} with data: ${JSON.stringify(scrapedData)}`

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    })

    return message.content[0].text
  } catch (error) {
    console.error('AI insight generation failed:', error.message)
    return generateFallbackInsight(symbol, dataType, scrapedData)
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
      timeout: 10000
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
    if (metrics.length > 3) rating += 2
  } catch (error) {
    console.log('Financial scraping failed')
  }

  const analysis = await generateAIInsight(symbol, 'financialHealth', { metrics })

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
      rating += 1
    }
  } catch (error) {
    console.log('Technical scraping failed')
  }

  const analysis = await generateAIInsight(symbol, 'technicalAnalysis', { currentPrice, metrics })

  if (metrics.length === 0) {
    metrics.push(
      { label: 'Price Trend', value: 'Monitor chart patterns' },
      { label: 'Moving Averages', value: 'Compare 50 & 200 day' },
      { label: 'Volume Analysis', value: 'Check accumulation/distribution' }
    )
  }

  signals.push({ type: 'info', message: 'Use technical indicators to identify optimal entry and exit points' })

  return { rating: Math.min(rating, 10), analysis, metrics, signals }
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
    if (metrics.length > 0) rating += 2
  } catch (error) {
    console.log('Options scraping failed')
  }

  const analysis = await generateAIInsight(symbol, 'optionsData', { metrics })

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
  const newsItems = []
  let positiveCount = 0
  let negativeCount = 0

  try {
    const newsUrl = `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/news/`
    const response = await axios.get(newsUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })
    const $ = cheerio.load(response.data)

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

    const positiveKeywords = ['growth', 'profit', 'beat', 'upgrade', 'bullish', 'gain']
    const negativeKeywords = ['loss', 'decline', 'downgrade', 'bearish', 'concern', 'warning']

    newsItems.forEach(item => {
      const text = item.title.toLowerCase()
      positiveKeywords.forEach(keyword => { if (text.includes(keyword)) positiveCount++ })
      negativeKeywords.forEach(keyword => { if (text.includes(keyword)) negativeCount++ })
    })

    if (positiveCount > negativeCount) {
      signals.push({ type: 'positive', message: 'Recent news shows positive sentiment' })
      rating += 1
    } else if (negativeCount > positiveCount) {
      signals.push({ type: 'warning', message: 'Recent news shows negative sentiment' })
    }
  } catch (error) {
    console.log('News scraping failed')
  }

  const sentimentCounts = { positive: positiveCount, negative: negativeCount }
  const analysis = await generateAIInsight(symbol, 'recentDevelopments', { newsItems, sentimentCounts, metrics })

  if (metrics.length === 0) {
    metrics.push(
      { label: 'Earnings Date', value: 'Check upcoming earnings calendar' },
      { label: 'Company Events', value: 'Monitor for catalysts' },
      { label: 'Market Trends', value: 'Follow sector developments' }
    )
  }

  if (signals.length === 0) {
    signals.push({ type: 'info', message: 'Stay updated on company news to identify options trading opportunities' })
  }

  return { rating: Math.min(rating, 10), analysis, metrics, signals }
}

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
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
