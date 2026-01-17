import axios from 'axios'
import * as cheerio from 'cheerio'
import Anthropic from '@anthropic-ai/sdk'

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
})

// Helper function to generate AI insights
async function generateAIInsight(symbol, dataType, scrapedData = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateFallbackInsight(symbol, dataType, scrapedData)
  }

  try {
    const prompts = {
      companyAnalysis: `Analyze this company data for ${symbol} and provide actionable insights for options trading:

Company Description: ${scrapedData.description || 'Not available'}
Sector: ${scrapedData.sector || 'Not available'}
Industry: ${scrapedData.industry || 'Not available'}
Market Cap: ${scrapedData.marketCap || 'Not available'}

Provide a 2-3 sentence analysis focused on:
1. Company's competitive position and business model strength
2. Key factors that would make this a good or poor candidate for selling options
3. Any sector-specific risks or opportunities

Be concise, actionable, and specific to options trading strategy.`,

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
  let scrapedInfo = { description: '', sector: '', industry: '', marketCap: '' }

  try {
    const saUrl = `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/`
    const saResponse = await axios.get(saUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })
    const $sa = cheerio.load(saResponse.data)
    scrapedInfo.description = $sa('meta[name="description"]').attr('content') || ''
    scrapedInfo.sector = $sa('[data-test="sector"]').text().trim()
    scrapedInfo.industry = $sa('[data-test="industry"]').text().trim()
    scrapedInfo.marketCap = $sa('[data-test="market-cap"]').text().trim()
  } catch (error) {
    console.log('StockAnalysis scraping failed, trying Yahoo Finance...')
  }

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
