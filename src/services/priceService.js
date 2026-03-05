/**
 * priceService.js
 * Fetches live prices via the /api/prices serverless proxy (no CORS issues).
 * Falls back to Yahoo Finance direct if the proxy is unavailable.
 */

/**
 * Fetch live prices for one or more symbols.
 * @param {string[]} symbols  e.g. ['AAPL', 'NVDA']
 * @returns {Object}          e.g. { AAPL: 213.45, NVDA: 875.20 }
 */
export async function fetchPrices(symbols) {
  if (!symbols || symbols.length === 0) return {}

  const unique = [...new Set(symbols.map(s => s.toUpperCase()))]

  // Primary: server-side proxy (Google Finance → Yahoo fallback)
  try {
    const res = await fetch('/api/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: unique }),
    })
    if (res.ok) {
      const data = await res.json()
      const map = data.prices || {}
      if (Object.keys(map).length > 0) {
        // Attach metadata so callers can inspect sources
        map.__sources      = data.sources      || {}
        map.__googleFailed = data.googleFailed || false
        return map
      }
    }
  } catch {
    // proxy unavailable — fall through to direct
  }

  // Fallback: direct Yahoo Finance (works server-side / local dev)
  try {
    const query = unique.join(',')
    const res = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(query)}&fields=regularMarketPrice,symbol&lang=en-US&region=US`
    )
    if (res.ok) {
      const json = await res.json()
      const result = json?.quoteResponse?.result || []
      const map = {}
      for (const q of result) {
        if (q.symbol && q.regularMarketPrice != null) {
          map[q.symbol.toUpperCase()] = q.regularMarketPrice
        }
      }
      return map
    }
  } catch {
    // both failed
  }

  return {}
}

/**
 * Fetch a single symbol's price.
 * @param {string} symbol
 * @returns {number|null}
 */
export async function fetchPrice(symbol) {
  const map = await fetchPrices([symbol])
  return map[symbol.toUpperCase()] ?? null
}
