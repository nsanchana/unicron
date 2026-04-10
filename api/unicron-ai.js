import { requireAuth, setCors } from './_auth.js'
import { needsRetrieval, retrieveContext, updateMemoryArtifacts } from '../lib/oracle-memory.js'

const MODEL = 'openclaw/unicron'

async function chatRequest(messages) {
    const resp = await fetch(process.env.JARVIS_BASE_URL + '/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + process.env.JARVIS_AUTH_TOKEN
        },
        body: JSON.stringify({
            model: MODEL,
            messages
        })
    })

    if (!resp.ok) {
        const errText = await resp.text()
        throw new Error(`API error ${resp.status}: ${errText}`)
    }

    const data = await resp.json()
    const text = data.choices?.[0]?.message?.content || ''
    return text
}

export default async function handler(req, res) {
    setCors(req, res)

    if (req.method === 'OPTIONS') return res.status(200).end()

    const userId = requireAuth(req, res)
    if (!userId) return

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    if (!process.env.JARVIS_AUTH_TOKEN) {
        return res.status(500).json({ error: 'API key not configured' })
    }

    try {
        const { mode } = req.body

        // Daily Insights mode — structured JSON portfolio analysis
        if (mode === 'daily-insights') {
            return handleDailyInsights(req, res)
        }

        const { message, userContext, history, sessionId } = req.body

        // Build rich system prompt from the structured context sent by PortfolioChat
        const ctx = userContext || {}
        const toneInstruction = ctx.tone === 'detailed'
            ? 'TONE: Detailed mode — provide comprehensive analysis with full reasoning, tables where useful, and thorough explanations.'
            : 'TONE: Brief mode — be concise and direct. Lead with the key insight or recommendation. Use bullet points. Keep responses under 200 words unless the question demands more.'

        const isOracle = ctx.personality === 'oracle'

        const identityBlock = isOracle
            ? `You are The Oracle — a wise, patient trading advisor channeling Warren Buffett's investment philosophy.
You speak with folksy wisdom, use memorable analogies, and always emphasize long-term value, margin of safety, and disciplined risk management.
You occasionally quote Buffett and Munger. You are direct but warm, and you never rush to action — you'd rather do nothing than do something foolish.
You trade the Wheel strategy: Cash Secured Puts (CSP) to acquire stocks, then Covered Calls (CC) to generate income or exit.`
            : `You are Unicron AI — a sharp, data-driven trading assistant embedded in the user's personal options trading dashboard.
You trade the Wheel strategy: Cash Secured Puts (CSP) to acquire stocks, then Covered Calls (CC) to generate income or exit.`

        const personalityBlock = isOracle
            ? `PERSONALITY:
- Wise, folksy, and patient like Warren Buffett. Use homespun analogies and occasional Buffett/Munger quotes.
- Always cite the user's actual data when making a point.
- Proactively flag risks — but frame them as "margin of safety" concerns.
- Use Markdown: bold key figures, tables for comparisons, bullets for lists.`
            : `PERSONALITY:
- Confident, professional, slightly futuristic. Direct answers, no fluff.
- Always cite the user's actual data when making a point (e.g. "Your LULU win rate is 80% across 20 trades").
- Proactively flag risks you spot in the data — don't wait to be asked.
- Use Markdown: bold key figures, tables for comparisons, bullets for lists.`

        let systemPrompt = `${identityBlock}

${toneInstruction}

${personalityBlock}

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

        // ── On-demand memory retrieval ──────────────────────────────────
        // isOracle is already declared above — reuse it
        let memoryLog = { retrievalTriggered: false, sourcesUsed: [], contextTokensApprox: 0 }

        if (isOracle && sessionId) {
            const reason = needsRetrieval(message, (history || []).length)
            if (reason) {
                memoryLog.retrievalTriggered = true
                const { context: priorContext, sources, tokenEstimate } = await retrieveContext(userId, sessionId, message)
                memoryLog.sourcesUsed = sources
                memoryLog.contextTokensApprox = tokenEstimate
                if (priorContext) {
                    systemPrompt += '\n\n' + priorContext
                }
            }
        }
        console.log('[oracle-memory]', memoryLog)

        // Build messages array with system prompt, history, and current message
        const messages = [{ role: 'system', content: systemPrompt }]

        const formattedHistory = (history || [])
            .map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            }))
            .filter((msg, index) => {
                if (index === 0 && msg.role === 'assistant') return false
                return true
            })

        messages.push(...formattedHistory)
        messages.push({ role: 'user', content: message })

        const text = await chatRequest(messages)

        // Send response first — don't block user on memory work
        res.status(200).json({
            response: text,
            model: MODEL
        })

        // ── Background memory update (runs after response is sent) ──────
        // Vercel keeps the function alive briefly after res.json().
        // updateMemoryArtifacts checks the threshold internally and skips
        // if not enough new messages. If the function terminates early,
        // the next threshold crossing will catch up.
        if (isOracle && sessionId) {
            const allMessages = [
                ...(history || []),
                { role: 'user', content: message },
                { role: 'assistant', content: text },
            ]
            try {
                await updateMemoryArtifacts(userId, sessionId, allMessages, chatRequest)
            } catch (err) {
                console.error('[oracle-memory] background update failed:', err.message)
            }
        }

        return

    } catch (error) {
        console.error('Unicron AI Chat error:', error)
        return res.status(500).json({
            error: 'Failed to generate response',
            details: error.message || error.toString()
        })
    }
}

async function handleDailyInsights(req, res) {
    const { trades, stocks, symbolHistory, settings, portfolio, weeklyPremium, weeklyTarget } = req.body

    const tradesBlock = (trades || []).length > 0
        ? trades.map(t => {
            let line = `  ${t.symbol} ${t.tradeType === 'cashSecuredPut' ? 'CSP' : 'CC'} $${t.strikePrice} strike`
            line += ` | Premium $${t.premium}/sh | Net $${t.netPremium || t.premium}`
            line += ` | DTE: ${t.dte}d | Theta: ${t.thetaProgress}% through`
            line += ` | Current: $${t.currentMarketPrice || 'N/A'}`
            if (t.strikeProximityPct) line += ` | Strike proximity: ${t.strikeProximityPct}%`
            if (t.buybackCost) line += ` | Buyback: $${t.buybackCost}`
            if (t.symbolHistory) line += ` | History: ${t.symbolHistory.trades} trades, ${t.symbolHistory.winRate}% win, $${t.symbolHistory.totalNet} net`
            return line
        }).join('\n')
        : 'None'

    const stocksBlock = (stocks || []).length > 0
        ? stocks.map(s => {
            let line = `  ${s.symbol} ${s.shares}sh @ $${s.assignedPrice}`
            line += ` | Current: $${s.currentPrice || 'N/A'}`
            line += ` | P&L: $${s.unrealizedPnL} (${s.unrealizedPnLPct}%)`
            if (s.daysHeld) line += ` | Held: ${s.daysHeld}d`
            if (s.symbolHistory) line += ` | History: ${s.symbolHistory.trades} trades, ${s.symbolHistory.winRate}% win, $${s.symbolHistory.totalNet} net`
            return line
        }).join('\n')
        : 'None'

    const historyBlock = (symbolHistory || []).length > 0
        ? symbolHistory.map(s => `  ${s.symbol}: ${s.trades} closed trades | ${s.winRate}% win rate | $${s.totalNet} total net | avg ${s.avgDTE}d DTE`).join('\n')
        : 'No closed trade history'

    const systemPrompt = `You are Unicron AI — an expert options trading analyst. The user trades the Wheel strategy (Cash Secured Puts → assignment → Covered Calls).

Analyze the user's positions with DEPTH and SPECIFICITY. Every recommendation must reference actual numbers from the data. Do not give generic advice.

═══════════════════════════════════
ACTIVE TRADES (${(trades || []).length}):
${tradesBlock}

HELD STOCKS (${(stocks || []).length}):
${stocksBlock}

TRADE HISTORY BY SYMBOL:
${historyBlock}

PORTFOLIO STATE:
  Size: $${settings?.portfolioSize?.toLocaleString() || 'N/A'}
  Available cash: $${portfolio?.availableCash?.toLocaleString() || 'N/A'}
  Allocated to CSPs: $${portfolio?.totalAllocated?.toLocaleString() || 'N/A'} (${portfolio?.allocationPct?.toFixed(1) || 0}%)
  Stock holdings value: $${portfolio?.currentStockValue?.toLocaleString() || 'N/A'}
  Total invested in stocks: $${portfolio?.totalInvested?.toLocaleString() || 'N/A'}
  Year-to-date premium: $${portfolio?.yearlyPremium?.toLocaleString() || '0'}
  Annualized projection: $${portfolio?.yearlyProjection?.toLocaleString() || '0'}

SETTINGS:
  Risk tolerance: ${settings?.riskTolerance || 'moderate'}
  CSP max DTE: ${settings?.tradingRules?.cashSecuredPut?.maxDays || 30} days
  CC max DTE: ${settings?.tradingRules?.coveredCall?.maxDays || 5} days
  Max allocation per trade: ${settings?.maxTradePercentage || 50}%

WEEKLY PROGRESS:
  Premium this week: $${weeklyPremium || 0}
  Target: $${weeklyTarget?.min || 0} - $${weeklyTarget?.max || 0}
═══════════════════════════════════

ANALYSIS FRAMEWORK — apply these lenses to every position:

1. THETA DECAY: Positions >70% through their DTE have captured most premium. Quantify how much premium has been captured vs. remaining risk exposure. Recommend closing early if >80% captured.

2. STRIKE PROXIMITY: For CSPs, if current price is within 3% of strike, flag assignment risk. For CCs, if price is above strike, flag early assignment. Use the strikeProximityPct field.

3. COVERED CALL OPPORTUNITIES: For every held stock, evaluate whether a CC should be sold. Suggest a specific strike (above cost basis) and DTE range based on the user's CC max DTE setting. Factor in the stock's trade history.

4. ROLL DECISIONS: If a trade is near expiry and the strike is being tested, recommend rolling with a specific direction (out and down for CSPs, out and up for CCs). Explain the net credit/debit.

5. WEEKLY TARGET PROGRESS: Compare premium earned this week to the target. If behind, recommend specific actions to catch up. If ahead, recommend whether to take remaining risk off.

6. CAPITAL EFFICIENCY: Flag if available cash is sitting idle (opportunity cost). Flag if allocation is too concentrated. Reference the actual allocation percentage.

7. SYMBOL TRACK RECORD: Use the trade history to contextualize recommendations. "You've traded AAPL 12 times with 85% win rate — high confidence symbol" vs. "First time trading XYZ — smaller position warranted."

INSTRUCTIONS:
- Return ONLY valid JSON (no markdown fences, no extra text)
- Generate 1 insight per position PLUS 1 portfolio-level insight
- Every insight MUST reference specific numbers from the data above
- The "reasoning" field should be 2-3 sentences with concrete data points
- The "suggestedAction" field should be a specific, executable recommendation (e.g. "Sell $150 CC expiring Apr 4 for ~$1.20 premium")
- The "risk" field should state what happens if the user does NOT act
- The "timeframe" field indicates urgency

Return this exact JSON structure:
{
  "insights": [
    {
      "type": "roll" | "close" | "sell_call" | "warning" | "opportunity",
      "priority": "high" | "medium" | "low",
      "symbol": "TICKER",
      "title": "Short action-oriented title",
      "reasoning": "2-3 sentences with specific numbers from the data. Reference DTE, premium captured, strike proximity, P&L, and trade history.",
      "metric": "Key number — e.g. '$42 premium captured' or '2 DTE remaining' or '3.2% from strike'",
      "suggestedAction": "Specific executable action — e.g. 'Buy back for $0.05 to close, locking in $94.50 net profit' or 'Sell $145 CC exp Apr 4'",
      "risk": "What happens if no action — e.g. 'Assignment risk at $140 would tie up $14,000 in capital' or 'Remaining $5 premium not worth 8 days of risk'",
      "timeframe": "today" | "this_week" | "monitor"
    }
  ],
  "summary": "N high-priority actions, M positions reviewed, capital X% deployed"
}`

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate today\'s daily insights for my portfolio. Be specific and data-driven.' }
    ]

    const text = await chatRequest(messages)

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

    // Validate all insight fields are strings (Gemini can return objects)
    const validated = (parsed.insights || []).map(i => ({
        type: String(i.type || 'opportunity'),
        priority: String(i.priority || 'low'),
        symbol: String(i.symbol || ''),
        title: String(i.title || ''),
        reasoning: String(i.reasoning || ''),
        metric: String(i.metric || ''),
        suggestedAction: String(i.suggestedAction || ''),
        risk: String(i.risk || ''),
        timeframe: String(i.timeframe || 'monitor'),
    }))

    return res.status(200).json({
        insights: validated,
        summary: String(parsed.summary || `${validated.length} insights generated`)
    })
}
