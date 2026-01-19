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
        return res.status(200).json({
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
    return res.status(500).json({
      error: 'Failed to fetch stock price',
      details: error.message
    })
  }
}
