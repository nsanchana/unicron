import Anthropic from '@anthropic-ai/sdk'

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

  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  try {
    const { message, tradeData, chatHistory } = req.body

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const anthropic = new Anthropic({
      apiKey: apiKey
    })

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

    // Build messages array with chat history
    const messages = []

    if (chatHistory && chatHistory.length > 0) {
      chatHistory.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        })
      })
    }

    messages.push({
      role: 'user',
      content: message
    })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages
    })

    return res.status(200).json({
      response: response.content[0].text,
      model: response.model
    })
  } catch (error) {
    console.error('Trade chat error:', error.message)
    return res.status(500).json({
      error: 'Failed to generate response',
      details: error.message
    })
  }
}
