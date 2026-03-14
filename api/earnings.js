import https from "https"

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"

function httpsGet(hostname, path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: "GET",
        headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9",
          "Accept": "application/json" },
        timeout: 8000 },
      (res) => {
        let body = ""
        res.on("data", d => body += d)
        res.on("end", () => resolve({ status: res.statusCode, body }))
      }
    )
    req.on("error", reject)
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")) })
    req.end()
  })
}

async function fetchEarningsDate(symbol) {
  try {
    const path = `/v10/finance/quoteSummary/${symbol}?modules=calendarEvents`
    const { status, body } = await httpsGet("query1.finance.yahoo.com", path)
    if (status !== 200) return null
    const json = JSON.parse(body)
    const dates = json?.quoteSummary?.result?.[0]?.calendarEvents?.earnings?.earningsDate
    if (!dates || dates.length === 0) return null
    // Return the next future date (raw = unix timestamp in seconds)
    const now = Math.floor(Date.now() / 1000)
    const future = dates.filter(d => d.raw > now)
    return future.length > 0 ? future[0].raw : dates[dates.length - 1].raw
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  if (req.method === "OPTIONS") { res.status(204).end(); return }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return }

  const { symbols = [] } = req.body || {}
  if (!symbols.length) { res.status(400).json({ error: "symbols required" }); return }

  const unique = [...new Set(symbols.map(s => s.toUpperCase()))]
  const results = await Promise.allSettled(unique.map(s => fetchEarningsDate(s)))
  const earnings = {}
  unique.forEach((s, i) => {
    earnings[s] = results[i].status === "fulfilled" ? results[i].value : null
  })

  res.status(200).json({ earnings, timestamp: Date.now() })
}
