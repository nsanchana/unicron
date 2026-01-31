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

        // Build the system prompt using userContext
        // userContext expects: { portfolio, strategyNotes, recentTrades, researchSummary }
        let systemPrompt = `You are "Unicron AI", a highly advanced, intelligent trading assistant integrated into the user's Unicron financial dashboard.
Your goal is to provide insightful, data-driven financial advice, analysis, and strategic thinking based on the user's specific data AND your general knowledge of the financial markets.

PERSONALITY:
- Be confident, professional, yet slightly futuristic and "flashy" in your tone (matching the "Unicron" aesthetic).
- Use formatting (bullet points, bold text) to make responses easy to read.
- Be proactive: if you see a risky trade in the context, mention it.

CONTEXT AWARENESS:
You have access to the user's live data. Use it to personalize your answers.

DATA SUMMARY:
`

        if (userContext) {
            if (userContext.portfolio) {
                systemPrompt += `
[PORTFOLIO]
- Total Value: $${userContext.portfolio.totalValue?.toLocaleString() || 'N/A'}
- Allocated: $${userContext.portfolio.allocated?.toLocaleString() || 'N/A'}
- Cash: $${userContext.portfolio.cash?.toLocaleString() || 'N/A'}
- Active Trades: ${userContext.portfolio.activeTradesCount || 0}
`
            }

            if (userContext.strategyNotes) {
                systemPrompt += `
[STRATEGY NOTES]
The user has noted the following strategy:
"${userContext.strategyNotes.replace(/<[^>]*>/g, '')}" (raw HTML stripped)
`
            }

            if (userContext.recentTrades && userContext.recentTrades.length > 0) {
                systemPrompt += `
[RECENT TRADES]
${userContext.recentTrades.map(t => `- ${t.symbol} ${t.type} ${t.strike} exp ${t.expirationDate} (Premium: $${t.premium})`).join('\n')}
`
            }

            if (userContext.researchSummary && userContext.researchSummary.length > 0) {
                systemPrompt += `
[RESEARCH FOCUS]
User is researching: ${userContext.researchSummary.map(r => r.symbol).join(', ')}
`
            }
        }

        systemPrompt += `
INSTRUCTIONS:
- If the user asks "How is my portfolio?", analyze the metrics provided above.
- If the user asks about a specific stock, check if it's in their Research or Trades list first. If not, use your general knowledge to provide a comprehensive answer about that stock or topic.
- You are NOT restricted to the provided data. If the user asks about history, science, coding, or general market concepts, answer them fully and helpfuly.
- Always be helpful and encouraging, but realistic about risk.
`

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: systemPrompt
        })

        // Prepare chat history
        // filter out system messages if any, ensure roles are 'user' or 'model'
        const formattedHistory = (history || []).map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user', // Basic mapping, assume user if not assistant
            parts: [{ text: msg.content }]
        }))

        const chat = model.startChat({
            history: formattedHistory
        })

        const result = await chat.sendMessage(message)
        const response = await result.response
        const text = response.text()

        return res.status(200).json({
            response: text,
            model: 'gemini-2.5-flash'
        })

    } catch (error) {
        console.error('Unicron AI Chat error:', error)
        return res.status(500).json({
            error: 'Failed to generate response',
            details: error.message || error.toString()
        })
    }
}
