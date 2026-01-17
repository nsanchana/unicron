import axios from 'axios'
import * as cheerio from 'cheerio'

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'

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
        let parsedDate = new Date(dateStr)
        if (isNaN(parsedDate.getTime()) || parsedDate < today) {
          return null
        }
        return dateStr
      } catch (error) {
        return null
      }
    }

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

      let earningsDate = $yahoo('td:contains("Earnings Date")').next().text().trim() ||
                        $yahoo('span:contains("Earnings Date")').parent().find('span').last().text().trim()

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

      // Try stockanalysis.com if Yahoo didn't work
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
      console.log('Earnings date scraping failed:', error.message)
    }

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
        note: 'Earnings releases typically cause significant price volatility.'
      })
    } else {
      earningsData.upcomingEvents.push({
        type: 'Earnings Release',
        description: 'Unable to find confirmed earnings date. Check company investor relations page.',
        impact: 'High',
        note: 'Without a confirmed earnings date, monitor the company closely.'
      })
    }

    if (daysToExpiration && daysToExpiration <= 30) {
      earningsData.upcomingEvents.push({
        type: 'FOMC Meeting',
        description: 'Federal Reserve policy decisions can impact overall market sentiment',
        impact: 'Medium',
        note: 'Interest rate decisions affect all equities, particularly growth stocks.'
      })

      earningsData.upcomingEvents.push({
        type: 'Economic Data Releases',
        description: 'Key reports: CPI, Jobs Report, GDP, Consumer Confidence',
        impact: 'Medium',
        note: 'Economic indicators can trigger sector-wide movements.'
      })
    }

    // Sector-specific events
    const techSymbols = ['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD', 'NFLX']
    const retailSymbols = ['WMT', 'TGT', 'COST', 'HD', 'LOW', 'NKE', 'SBUX']
    const financeSymbols = ['JPM', 'BAC', 'GS', 'MS', 'WFC', 'C', 'USB']

    if (techSymbols.includes(symbol.toUpperCase())) {
      earningsData.upcomingEvents.push({
        type: 'Tech Sector Events',
        description: 'Product launches, regulatory hearings, semiconductor demand reports',
        impact: 'Medium-High',
        note: 'Tech stocks are sensitive to innovation cycles and regulatory scrutiny.'
      })
    } else if (retailSymbols.includes(symbol.toUpperCase())) {
      earningsData.upcomingEvents.push({
        type: 'Retail/Consumer Events',
        description: 'Holiday sales data, consumer spending reports, retail foot traffic',
        impact: 'High',
        note: 'Retail stocks react strongly to same-store sales and seasonal trends.'
      })
    } else if (financeSymbols.includes(symbol.toUpperCase())) {
      earningsData.upcomingEvents.push({
        type: 'Financial Sector Events',
        description: 'Interest rate changes, banking regulations, loan default rates',
        impact: 'High',
        note: 'Financial stocks are sensitive to yield curve changes.'
      })
    }

    // Market sentiment analysis
    earningsData.marketSentiment = {
      description: 'Market sentiment combines analyst ratings, institutional positioning, and recent price action.',
      factors: [
        'Check analyst price targets and recent upgrades/downgrades',
        'Monitor institutional ownership changes (13F filings)',
        'Review insider buying/selling activity',
        'Analyze options flow for unusual activity'
      ]
    }

    // What to watch
    earningsData.whatToWatch = [
      {
        category: 'Before Trade Entry',
        items: [
          'Confirm earnings date is not within your option expiration window',
          'Check implied volatility percentile',
          'Review recent price support/resistance levels',
          'Verify adequate options liquidity'
        ]
      },
      {
        category: 'During Trade',
        items: [
          'Monitor for material news',
          'Watch for sudden volume spikes',
          'Track broader market trends',
          'Set alerts for significant price moves'
        ]
      },
      {
        category: 'Risk Management',
        items: [
          'Define exit strategy before entering trade',
          'Consider rolling options if thesis remains intact',
          'Be prepared to take assignment',
          'Never allocate more than planned % of portfolio'
        ]
      }
    ]

    return res.status(200).json(earningsData)
  } catch (error) {
    console.error('Error fetching earnings/events:', error.message)
    return res.status(500).json({
      error: 'Failed to fetch earnings and events data',
      details: error.message
    })
  }
}
