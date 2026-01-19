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
    const { message, companyData, chatHistory } = req.body

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const anthropic = new Anthropic({
      apiKey: apiKey
    })

    // Build context from company data
    let systemPrompt = `You are a helpful financial analyst assistant specializing in equity research and options trading strategies. You provide clear, actionable insights based on company analysis data.`

    if (companyData) {
      systemPrompt += `

You are discussing ${companyData.symbol}. Here is the analysis data you have access to:

Company: ${companyData.symbol}
Overall Rating: ${companyData.overallRating}/100

Company Analysis:
${companyData.companyAnalysis?.analysis || 'Not available'}

${companyData.companyAnalysis?.detailedAnalysis ? `
Detailed Analysis Sections:
- Market Position (${companyData.companyAnalysis.detailedAnalysis.marketPosition?.rating}/10): ${companyData.companyAnalysis.detailedAnalysis.marketPosition?.content || 'N/A'}
- Business Model (${companyData.companyAnalysis.detailedAnalysis.businessModel?.rating}/10): ${companyData.companyAnalysis.detailedAnalysis.businessModel?.content || 'N/A'}
- Industry Trends (${companyData.companyAnalysis.detailedAnalysis.industryTrends?.rating}/10): ${companyData.companyAnalysis.detailedAnalysis.industryTrends?.content || 'N/A'}
- Customer Base (${companyData.companyAnalysis.detailedAnalysis.customerBase?.rating}/10): ${companyData.companyAnalysis.detailedAnalysis.customerBase?.content || 'N/A'}
- Growth Strategy (${companyData.companyAnalysis.detailedAnalysis.growthStrategy?.rating}/10): ${companyData.companyAnalysis.detailedAnalysis.growthStrategy?.content || 'N/A'}
- Economic Moat (${companyData.companyAnalysis.detailedAnalysis.economicMoat?.rating}/10): ${companyData.companyAnalysis.detailedAnalysis.economicMoat?.content || 'N/A'}
` : ''}

Financial Health:
${companyData.financialHealth?.analysis || 'Not available'}

Technical Analysis:
${companyData.technicalAnalysis?.analysis || 'Not available'}

Options Data:
${companyData.optionsData?.analysis || 'Not available'}

Recent Developments:
${companyData.recentDevelopments?.analysis || 'Not available'}

Use this information to answer questions about ${companyData.symbol}. Be specific, reference the analysis data when relevant, and provide actionable insights for options trading strategies when appropriate. Keep responses concise but informative.`
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
    console.error('Chat error:', error.message)
    return res.status(500).json({
      error: 'Failed to generate response',
      details: error.message
    })
  }
}
