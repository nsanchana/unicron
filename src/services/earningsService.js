/**
 * earningsService.js
 * Fetches next earnings dates for stock symbols via /api/earnings proxy.
 * Results are cached in memory for the session (no repeat fetches).
 */

const cache = {}  // symbol → unix timestamp or null
let fetchPromise = null
let pendingSymbols = []

/**
 * Fetch earnings dates for multiple symbols.
 * @param {string[]} symbols
 * @returns {Object} { AAPL: 1712345678, NVDA: null }
 */
export async function fetchEarningsDates(symbols) {
  if (!symbols || symbols.length === 0) return {}
  const unique = [...new Set(symbols.map(s => s.toUpperCase()))]
  const missing = unique.filter(s => !(s in cache))

  if (missing.length > 0) {
    try {
      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: missing, includeEarnings: true }),
      })
      if (res.ok) {
        const data = await res.json()
        Object.entries(data.earnings || {}).forEach(([s, ts]) => { cache[s] = ts })
      }
    } catch {
      missing.forEach(s => { cache[s] = null })
    }
  }

  const result = {}
  unique.forEach(s => { result[s] = cache[s] ?? null })
  return result
}

/**
 * Get urgency level for an earnings date.
 * @param {number|null} unixTs  Unix timestamp in seconds
 * @returns {"danger"|"caution"|"info"|"none"}
 */
export function getEarningsUrgency(unixTs) {
  if (!unixTs) return "none"
  const daysAway = (unixTs * 1000 - Date.now()) / (1000 * 60 * 60 * 24)
  if (daysAway < 0) return "none"           // already passed
  if (daysAway <= 7) return "danger"
  if (daysAway <= 30) return "caution"
  return "info"
}

/**
 * Format earnings date for display.
 * @param {number|null} unixTs
 * @returns {string}
 */
export function formatEarningsDate(unixTs) {
  if (!unixTs) return null
  const d = new Date(unixTs * 1000)
  const now = new Date()
  const daysAway = Math.ceil((d - now) / (1000 * 60 * 60 * 24))
  if (daysAway < 0) return null  // past
  if (daysAway === 0) return "Earnings TODAY"
  if (daysAway === 1) return "Earnings TOMORROW"
  if (daysAway <= 7) return `Earnings in ${daysAway}d`
  return `Earnings ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
}
