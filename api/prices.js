/**
 * /api/prices — Vercel serverless function
 * Primary:  Google Finance (real-time, same source as Google Sheets GOOGLEFINANCE())
 * Fallback: Yahoo Finance V7 batch (15-min delayed)
 *
 * POST { symbols: ['AAPL','NVDA'] }
 * → { prices: { AAPL: 263.75, NVDA: 180.05 },
 *     sources: { AAPL: 'google', NVDA: 'yahoo' },
 *     googleFailed: false,
 *     timestamp: 1234567890 }
 */
import https from 'https'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function httpsGet(hostname, path, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: 'GET',
        headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', ...extraHeaders },
        timeout: 8000 },
      (res) => {
        let body = ''
        res.on('data', d => body += d)
        res.on('end', () => resolve({ status: res.statusCode, body }))
      }
    )
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.end()
  })
}

// ─── Google Finance ───────────────────────────────────────────────────────────
// Price lives in: <div class="YMlKec fxKbKc">$263.75</div>
// or inside a <span class="IsqQVc NprOob YMlKec">
const GF_PATTERNS = [
  /class="YMlKec fxKbKc"[^>]*>\$?([\d,]+\.?\d*)/,
  /class="[^"]*YMlKec[^"]*fxKbKc[^"]*"[^>]*>\$?([\d,]+\.?\d*)/,
  /"price"\s*:\s*"?\$?([\d,]+\.?\d*)"?/,
]

function parseGooglePrice(html) {
  for (const re of GF_PATTERNS) {
    const m = html.match(re)
    if (m) {
      const p = parseFloat(m[1].replace(/,/g, ''))
      if (!isNaN(p) && p > 0) return p
    }
  }
  return null
}

async function fetchGooglePrice(symbol) {
  const sym = symbol.toUpperCase()
  for (const exchange of ['NASDAQ', 'NYSE', 'NYSEARCA', 'BATS']) {
    try {
      const { status, body } = await httpsGet(
        'www.google.com',
        `/finance/quote/${sym}:${exchange}`,
        { 'Accept': 'text/html', 'Referer': 'https://www.google.com/finance' }
      )
      if (status !== 200) continue
      // Skip redirect pages (wrong exchange)
      if (body.includes('did not match any') || body.includes('No results')) continue
      const price = parseGooglePrice(body)
      if (price) return price
    } catch { continue }
  }
  return null
}

// ─── Yahoo Finance (V7 batch — fallback) ─────────────────────────────────────
async function fetchYahooBatch(symbols) {
  const query = symbols.map(s => encodeURIComponent(s.toUpperCase())).join('%2C')
  const path = `/v7/finance/quote?symbols=${query}&fields=regularMarketPrice%2Csymbol&lang=en-US&region=US&corsDomain=finance.yahoo.com`
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const { status, body } = await httpsGet(host, path, { 'Referer': 'https://finance.yahoo.com' })
      if (status !== 200) continue
      const json = JSON.parse(body)
      const result = json?.quoteResponse?.result || []
      if (!result.length) continue
      const map = {}
      for (const q of result) {
        if (q.symbol && q.regularMarketPrice != null)
          map[q.symbol.toUpperCase()] = q.regularMarketPrice
      }
      if (Object.keys(map).length) return map
    } catch { continue }
  }
  // V8 chart per-symbol last resort
  const map = {}
  for (const sym of symbols) {
    try {
      const { status, body } = await httpsGet(
        'query1.finance.yahoo.com',
        `/v8/finance/chart/${encodeURIComponent(sym.toUpperCase())}?interval=1d&range=1d`,
        { 'Referer': 'https://finance.yahoo.com' }
      )
      if (status !== 200) continue
      const json = JSON.parse(body)
      const meta = json?.chart?.result?.[0]?.meta
      const price = meta?.regularMarketPrice ?? meta?.previousClose
      if (price != null) map[sym.toUpperCase()] = price
    } catch { continue }
  }
  return map
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  let symbols = []
  if (req.method === 'POST') symbols = req.body?.symbols || []
  else symbols = (req.query?.symbols || '').split(',').filter(Boolean)

  if (!symbols.length) return res.status(400).json({ error: 'symbols required' })

  const unique = [...new Set(symbols.map(s => s.toUpperCase()))]
  const prices  = {}
  const sources = {}

  // Step 1: Google Finance — fetch all in parallel
  const googleResults = await Promise.all(unique.map(async (sym) => {
    const price = await fetchGooglePrice(sym)
    return { sym, price }
  }))

  const googleMissed = []
  for (const { sym, price } of googleResults) {
    if (price != null) {
      prices[sym]  = price
      sources[sym] = 'google'
    } else {
      googleMissed.push(sym)
    }
  }

  const googleFailed = googleMissed.length === unique.length  // all failed = Google is down

  // Step 2: Yahoo fallback for anything Google missed
  if (googleMissed.length > 0) {
    console.log(`[prices] Google missed: ${googleMissed.join(', ')} — using Yahoo fallback`)
    const yahooMap = await fetchYahooBatch(googleMissed)
    for (const [sym, price] of Object.entries(yahooMap)) {
      prices[sym]  = price
      sources[sym] = 'yahoo'
    }
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({
    prices,
    sources,
    googleFailed,
    timestamp: Date.now(),
  })
}
