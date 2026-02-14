import axios from 'axios'
import * as cheerio from 'cheerio'

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'

// Helper to scrape Google Finance for real-time prices
async function scrapeGoogleFinance(symbol) {
    try {
        // Try primary US exchanges
        const exchanges = ['NASDAQ', 'NYSE']
        let price = null

        for (const exchange of exchanges) {
            try {
                const url = `https://www.google.com/finance/quote/${symbol.toUpperCase()}:${exchange}`
                const response = await axios.get(url, {
                    headers: { 'User-Agent': USER_AGENT },
                    timeout: 5000
                })
                const $ = cheerio.load(response.data)

                // Google Finance uses specific classes for price info
                // The main price is usually in a div with class that contains 'YMlKec' and 'fxKbKc'
                const priceText = $('.YMlKec.fxKbKc').first().text().trim()

                if (priceText && priceText.includes('$')) {
                    price = parseFloat(priceText.replace('$', '').replace(',', ''))
                    if (!isNaN(price) && price > 0) break
                }
            } catch (e) {
                continue
            }
        }

        if (price) return price

        // Fallback search
        const searchUrl = `https://www.google.com/search?q=stock+price+${symbol}`
        const searchResponse = await axios.get(searchUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000
        })
        const $search = cheerio.load(searchResponse.data)

        // Look for price in Google search results (often in specific span)
        const spanPrice = $search('span[jsname="vW7973"], span.I66fCc').first().text().trim()
        if (spanPrice) {
            const p = parseFloat(spanPrice.replace(',', ''))
            if (!isNaN(p) && p > 0) return p
        }

        return null
    } catch (error) {
        console.error(`Google Finance scrape failed for ${symbol}:`, error.message)
        return null
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
        const { symbols } = req.body

        if (!symbols || !Array.isArray(symbols)) {
            return res.status(400).json({ error: 'Array of symbols is required' })
        }

        const priceMap = {}
        const results = await Promise.all(symbols.map(async (symbol) => {
            // 1. Try Google Finance (Primary)
            let price = await scrapeGoogleFinance(symbol)
            let source = 'google_finance'

            // 2. Try StockAnalysis (Fallback)
            if (!price) {
                try {
                    const url = `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/`
                    const response = await axios.get(url, {
                        headers: { 'User-Agent': USER_AGENT },
                        timeout: 5000
                    })
                    const $ = cheerio.load(response.data)
                    const saPrice = $('[data-test="stock-price"]').first().text().trim() ||
                        $('.text-3xl, .text-4xl').first().text().trim()

                    if (saPrice) {
                        price = parseFloat(saPrice.replace('$', '').replace(',', '').trim())
                        source = 'stockanalysis.com'
                    }
                } catch (e) {
                    // Both failed
                }
            }

            if (price) {
                priceMap[symbol.toUpperCase()] = { price, source }
            }
            return { symbol, price }
        }))

        res.json({
            timestamp: new Date().toISOString(),
            prices: priceMap
        })
    } catch (error) {
        console.error('Batch price update failed:', error.message)
        res.status(500).json({ error: 'Failed to fetch batch prices' })
    }
}
