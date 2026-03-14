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
    const { message, companyData, chatHistory } = req.body

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const genAI = new GoogleGenerativeAI(apiKey)

    // Build context from company data
    let systemPrompt = `You are a helpful financial analyst assistant specializing in equity research and options trading strategies. 
You provide clear, actionable insights. Use the provided analysis data as your primary context, but feel free to supplement with your general knowledge of the markets, company history, and financial concepts to answer any questions the user may have.

If the user asks a question not covered by the data, use your training data to provide the best possible answer while noting if it's based on general knowledge rather than the specific recent analysis.`

    if (companyData) {
      systemPrompt += `

You are currently discussing ${companyData.symbol}. Here is the most recent analysis data for context:

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

Always prioritize providing value to the trader. If they ask about recent price drops (like in the last 2 days), use your knowledge of recent market events or suggest likely causes if specific data isn't in the context.`
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt
    })

    // Transform chat history to Gemini format (user/model)
    const history = []
    if (chatHistory && chatHistory.length > 0) {
      chatHistory.forEach(msg => {
        // Map 'assistant' role to 'model' for Gemini
        const role = msg.role === 'assistant' ? 'model' : msg.role
        // Gemini doesn't support system messages in history (handled via systemInstruction)
        if (role !== 'system') {
          history.push({
            role: role,
            parts: [{ text: msg.content }]
          })
        }
      })
    }

    // validate history: first message must be 'user'
    if (history.length > 0 && history[0].role === 'model') {
      history.unshift({
        role: 'user',
        parts: [{ text: 'Please analyze this company based on the provided data.' }]
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
    console.error('Chat error:', error.message)
    return res.status(500).json({
      error: 'Failed to generate response',
      details: error.message
    })
  }
}
