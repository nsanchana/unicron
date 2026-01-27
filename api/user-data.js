import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Get user ID from request (from auth)
  const { userId } = req.query

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' })
  }

  const userDataKey = `user:${userId}:data`

  try {
    // GET - Load user data from cloud
    if (req.method === 'GET') {
      const userData = await kv.get(userDataKey)

      if (!userData) {
        // Return empty data structure if no data exists
        return res.status(200).json({
          researchData: [],
          tradeData: [],
          stockData: [],
          settings: {
            portfolioSize: 71000,
            weeklyPremiumTarget: { min: 340, max: 410 },
            maxTradePercentage: 50
          },
          lastSynced: null
        })
      }

      return res.status(200).json(userData)
    }

    // POST/PUT - Save user data to cloud
    if (req.method === 'POST' || req.method === 'PUT') {
      const { researchData, tradeData, settings, stockData } = req.body

      const userData = {
        researchData: researchData || [],
        tradeData: tradeData || [],
        stockData: stockData || [],
        settings: settings || {
          portfolioSize: 71000,
          weeklyPremiumTarget: { min: 340, max: 410 },
          maxTradePercentage: 50
        },
        lastSynced: new Date().toISOString()
      }

      // Store in Vercel KV (data persists indefinitely)
      await kv.set(userDataKey, userData)

      return res.status(200).json({
        success: true,
        message: 'Data saved to cloud',
        lastSynced: userData.lastSynced
      })
    }

    // DELETE - Clear user data from cloud
    if (req.method === 'DELETE') {
      await kv.del(userDataKey)
      return res.status(200).json({
        success: true,
        message: 'Data cleared from cloud'
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('User data error:', error)
    return res.status(500).json({
      error: 'Failed to process user data',
      details: error.message
    })
  }
}
