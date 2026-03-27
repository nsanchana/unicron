import { GoogleGenerativeAI } from '@google/generative-ai'
import { requireAuth, setCors } from './_auth.js'

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return res.status(500).json({ error: 'API key not configured' })
  }

  try {
    const { trades, stocks, settings, weeklyPremium, weeklyTarget } = req.body

    const now = new Date()
    const tradesWithDTE = (trades || []).map(t => {
      const exp = new Date(t.expirationDate)
      const dte = Math.ceil((exp - now) / (1000 * 60 * 60 * 24))
      return { ...t, dte }
    })

    const stocksWithPnL = (stocks || []).map(s => {
      const pnl = s.currentPrice && s.assignedPrice
        ? ((s.currentPrice - s.assignedPrice) * s.shares).toFixed(2)
        : 'N/A'
      const pnlPct = s.currentPrice && s.assignedPrice
        ? (((s.currentPrice - s.assignedPrice) / s.assignedPrice) * 100).toFixed(1)
        : 'N/A'
      return { ...s, unrealizedPnL: pnl, unrealizedPnLPct: pnlPct }
    })

    const tradesBlock = tradesWithDTE.length > 0
      ? tradesWithDTE.map(t =>
          `  ${t.symbol} ${t.tradeType === 'cashSecuredPut' ? 'CSP' : 'CC'} $${t.strikePrice} strike | Premium $${t.premium}/sh | Net $${t.netPremium || t.premium} | DTE: ${t.dte}d | Current: $${t.currentMarketPrice || 'N/A'}${t.buybackCost ? ` | Buyback: $${t.buybackCost}` : ''}`
        ).join('\n')
      : 'None'

    const stocksBlock = stocksWithPnL.length > 0
      ? stocksWithPnL.map(s =>
          `  ${s.symbol} ${s.shares}sh @ $${s.assignedPrice} | Current: $${s.currentPrice || 'N/A'} | P&L: $${s.unrealizedPnL} (${s.unrealizedPnLPct}%)`
        ).join('\n')
      : 'None'

    const systemPrompt = `You are Unicron AI — a sharp options trading analyst. The user trades the Wheel strategy (Cash Secured Puts → assignment → Covered Calls).

Review the user's current positions and provide DAILY ACTIONABLE INSIGHTS.

ACTIVE TRADES (${tradesWithDTE.length}):
${tradesBlock}

HELD STOCKS (${stocksWithPnL.length}):
${stocksBlock}

PORTFOLIO SETTINGS:
  Size: $${settings?.portfolioSize?.toLocaleString() || 'N/A'}
  Risk tolerance: ${settings?.riskTolerance || 'moderate'}
  CSP max DTE: ${settings?.tradingRules?.cashSecuredPut?.maxDays || 30} days
  CC max DTE: ${settings?.tradingRules?.coveredCall?.maxDays || 5} days
  Max allocation per trade: ${settings?.maxTradePercentage || 50}%

WEEKLY PROGRESS:
  Premium this week: $${weeklyPremium || 0}
  Target: $${weeklyTarget?.min || 0} - $${weeklyTarget?.max || 0}

INSTRUCTIONS:
- Return ONLY valid JSON (no markdown fences, no extra text)
- Analyze each position and identify actionable insights
- Prioritize: expiring trades, theta decay opportunities, covered call opportunities on held stocks, risk warnings
- For each insight, explain WHY concisely

Return this exact JSON structure:
{
  "insights": [
    {
      "type": "roll" | "close" | "sell_call" | "warning" | "opportunity",
      "priority": "high" | "medium" | "low",
      "symbol": "TICKER",
      "title": "Short action-oriented title",
      "reasoning": "1-2 sentence explanation with specific numbers from the data",
      "metric": "Key number like '$42 premium captured' or '2 DTE remaining'"
    }
  ],
  "summary": "N actions suggested across M active positions"
}`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt
    })

    const result = await model.generateContent('Generate today\'s daily insights for my portfolio.')
    const text = result.response.text()

    let parsed
    try {
      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON:', text)
      return res.status(200).json({
        insights: [],
        summary: 'Unable to parse AI response',
        error: true,
        raw: text
      })
    }

    return res.status(200).json({
      insights: parsed.insights || [],
      summary: parsed.summary || `${(parsed.insights || []).length} insights generated`
    })

  } catch (error) {
    console.error('Daily insights error:', error)
    return res.status(500).json({
      error: 'Failed to generate insights',
      details: error.message || error.toString()
    })
  }
}
