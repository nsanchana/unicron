import { GoogleGenerativeAI }    from '@google/generative-ai'
import { requireAuth, setCors } from './_auth.js'

export default async function handler(req, res) {
  setCors(req, res)

  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!requireAuth(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return res.status(500).json({ error: 'API key not configured' })
  }

  try {
    const { message, tradeData, chatHistory } = req.body

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const genAI = new GoogleGenerativeAI(apiKey)

    // Build context from trade analysis data
    let systemPrompt = `You are a helpful financial analyst assistant specializing in options trading strategies. You provide clear, actionable insights based on trade analysis data.`

    if (tradeData) {
      const tradeTypeLabel = tradeData.tradeType === 'cashSecuredPut' ? 'Cash-Secured Put' : 'Covered Call'

      systemPrompt += `

You are discussing a ${tradeTypeLabel} trade for ${tradeData.symbol}. Here is the trade analysis data:

Trade Details:
- Symbol: ${tradeData.symbol}
- Trade Type: ${tradeTypeLabel}
- Option Type: ${tradeData.optionType}
- Current Stock Price: $${tradeData.stockPrice}
- Strike Price: $${tradeData.strikePrice}
- Premium: $${tradeData.premium} per share ($${(tradeData.premium * 100).toFixed(2)} per contract)
- Expiration Date: ${tradeData.expirationDate}
- Days to Expiration: ${Math.ceil((new Date(tradeData.expirationDate) - new Date()) / (1000 * 60 * 60 * 24))}

Risk Assessment:
- Overall Risk: ${tradeData.riskAssessment?.overallRisk || 'N/A'}
- Maximum Loss: $${tradeData.riskAssessment?.maxLoss?.toFixed(2) || 'N/A'}
${tradeData.riskAssessment?.factors?.map(f => `- ${f.message}${f.detail ? ': ' + f.detail : ''}`).join('\n') || ''}

Recommendation:
- Action: ${tradeData.recommendation?.action || 'N/A'}
- Confidence: ${tradeData.recommendation?.confidence || 'N/A'}%
- Rating: ${tradeData.recommendation?.rating || 'N/A'}/10
- Expected Return: $${tradeData.recommendation?.expectedReturn?.toFixed(2) || 'N/A'}
- Rationale: ${tradeData.recommendation?.rationale || 'N/A'}

${tradeData.earningsAndEvents ? `
Earnings & Events Data:
${tradeData.earningsAndEvents.marketSentiment ? `Market Sentiment: ${tradeData.earningsAndEvents.marketSentiment.description}` : ''}
${tradeData.earningsAndEvents.whatToWatch ? `Key Factors to Watch: ${tradeData.earningsAndEvents.whatToWatch.map(w => w.category + ': ' + w.items.join(', ')).join('; ')}` : ''}
` : ''}

Use this information to answer questions about this trade. Be specific, reference the analysis data when relevant, and provide actionable insights. Consider risk management, optimal entry/exit points, adjustment strategies, and alternative trades when appropriate. Keep responses concise but informative.`
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt
    })

    // Transform chat history to Gemini format (user/model)
    const history = []
    if (chatHistory && chatHistory.length > 0) {
      chatHistory.forEach(msg => {
        const role = msg.role === 'assistant' ? 'model' : msg.role
        if (role !== 'system') {
          history.push({
            role: role,
            parts: [{ text: msg.content }]
          })
        }
      })
    }

    const chat = model.startChat({
      history: history
    })

    const result = await chat.sendMessage(message)
    const response = await result.response
    const text = response.text()

    return res.status(200).json({
      response: text,
      model: 'gemini-2.5-flash'
    })
  } catch (error) {
    console.error('Trade chat error:', error.message)
    return res.status(500).json({
      error: 'Failed to generate response',
      details: error.message
    })
  }
}
