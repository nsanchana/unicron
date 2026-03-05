import { GoogleGenerativeAI } from '@google/generative-ai'

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

    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        return res.status(500).json({ error: 'API key not configured' })
    }

    try {
        const { message, userContext, history } = req.body

        const genAI = new GoogleGenerativeAI(apiKey)

        // Build rich system prompt from the structured context sent by PortfolioChat
        const ctx = userContext || {}
        const toneInstruction = ctx.tone === 'detailed'
            ? 'TONE: Detailed mode — provide comprehensive analysis with full reasoning, tables where useful, and thorough explanations.'
            : 'TONE: Brief mode — be concise and direct. Lead with the key insight or recommendation. Use bullet points. Keep responses under 200 words unless the question demands more.'

        let systemPrompt = `You are Unicron AI — a sharp, data-driven trading assistant embedded in the user's personal options trading dashboard.
You trade the Wheel strategy: Cash Secured Puts (CSP) to acquire stocks, then Covered Calls (CC) to generate income or exit.

${toneInstruction}

PERSONALITY:
- Confident, professional, slightly futuristic. Direct answers, no fluff.
- Always cite the user's actual data when making a point (e.g. "Your LULU win rate is 80% across 20 trades").
- Proactively flag risks you spot in the data — don't wait to be asked.
- Use Markdown: bold key figures, tables for comparisons, bullets for lists.

═══════════════════════════════════
PORTFOLIO SNAPSHOT (live data)
═══════════════════════════════════
Total Value:      $${ctx.portfolio?.total?.toLocaleString() || 'N/A'}
Cash Deposited:   $${ctx.portfolio?.deposited?.toLocaleString() || 'N/A'}
Available Cash:   $${ctx.portfolio?.availableCash?.toLocaleString() || 'N/A'}
Stock Holdings:   $${ctx.portfolio?.stockValue?.toLocaleString() || 'N/A'}
Total Return:     ${ctx.portfolio?.totalReturn ?? 'N/A'}% on deposited capital

OPTIONS PERFORMANCE
Total Net Premium Collected: $${ctx.totalNetPremium?.toLocaleString() || '0'}
Closed Trades:    ${ctx.closedCount || 0}
Win Rate:         ${ctx.winRate || 0}% (expired worthless = win)
Assignment Rate:  ${ctx.assignmentRate || 0}%
Avg Days Held:    ${ctx.avgDaysHeld || 0} days

${ctx.openPositions?.length > 0 ? `OPEN POSITIONS (${ctx.openPositions.length})
${ctx.openPositions.map(p => `  ${p.symbol} ${p.type === 'cashSecuredPut' ? 'CSP' : 'CC'} $${p.strike} exp ${p.expiry} (${p.daysLeft}d left) | Premium $${p.premium}/sh | Net $${p.netPremium}`).join('\n')}` : 'OPEN POSITIONS: None currently.'}

${ctx.heldStocks?.length > 0 ? `STOCK HOLDINGS
${ctx.heldStocks.map(s => `  ${s.symbol} ${s.shares}sh @ $${s.assignedAt} | Current: $${s.current} | Unrealised P&L: $${s.unrealisedPnL}`).join('\n')}` : ''}

P&L BY SYMBOL (top performers first)
${(ctx.symbolStats || []).slice(0, 15).map(s => `  ${s.sym}: ${s.trades} trades | Net $${s.net.toLocaleString()} | Win rate ${s.winRate}%`).join('\n') || 'No closed trades yet.'}

RISK GUARDRAILS
Max trade risk: ${ctx.settings?.maxTradePercentage || 'N/A'}% of portfolio per position
Portfolio size setting: $${ctx.settings?.portfolioSize?.toLocaleString() || 'N/A'}

═══════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════
- When asked about positions, ALWAYS reference the actual data above (symbol, strike, DTE, premium).
- When asked about patterns, draw from the P&L by symbol data and trade history above.
- For questions about current stock prices, news, or macro — use Google Search for live data.
- If you spot a risk in the open positions (assignment risk, near expiry, concentrated position), flag it unprompted.
- When the user asks "should I roll/close/hold", give a specific recommendation with reasoning based on the data.
- Charts: if asked for a technical chart, embed: ![Chart](https://charts2.finviz.com/chart.ashx?t=SYMBOL&ty=c&ta=1&p=d&s=l)
`

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            tools: [{ googleSearch: {} }],
            systemInstruction: systemPrompt
        })

        // Prepare chat history
        // filter out system messages if any, ensure roles are 'user' or 'model'
        const formattedHistory = (history || [])
            .map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }))
            .filter((msg, index, array) => {
                // Gemini requires history to start with 'user'
                if (index === 0 && msg.role === 'model') return false;
                return true;
            })

        const chat = model.startChat({
            history: formattedHistory
        })

        const result = await chat.sendMessage(message)
        const response = await result.response
        const text = response.text()

        return res.status(200).json({
            response: text,
            model: 'gemini-2.0-flash'
        })

    } catch (error) {
        console.error('Unicron AI Chat error:', error)
        return res.status(500).json({
            error: 'Failed to generate response',
            details: error.message || error.toString()
        })
    }
}
