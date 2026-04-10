import { kv }                    from '@vercel/kv'
import { requireAuth, setCors }  from './_auth.js'
import { loadSessionIndex, loadSession, saveSession, deleteSession } from './lib/oracle-memory.js'

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── Auth gate ─────────────────────────────────────────────────────────────
  const authUsername = requireAuth(req, res)
  if (!authUsername) return // requireAuth already sent 401

  // ── Oracle sessions sub-route ─────────────────────────────────────────────
  if (req.query.type === 'oracle-sessions') {
    return handleOracleSessions(req, res, authUsername)
  }

  // userId must match the authenticated user — prevents accessing other users' data
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'User ID is required' })
  if (userId !== authUsername) return res.status(403).json({ error: 'Forbidden' })

  const userDataKey = `user:${userId}:data`

  try {
    if (req.method === 'GET') {
      const userData = await kv.get(userDataKey)
      if (!userData) {
        return res.status(200).json({
          researchData: [],
          tradeData:    [],
          stockData:    [],
          settings: {
            portfolioSize:         71000,
            weeklyPremiumTarget:   { min: 340, max: 410 },
            maxTradePercentage:    50
          },
          lastSynced:  null,
          chatHistory: []
        })
      }
      return res.status(200).json(userData)
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const { researchData, tradeData, settings, stockData, strategyNotes, chatHistory } = req.body
      const userData = {
        researchData:  researchData  || [],
        tradeData:     tradeData     || [],
        stockData:     stockData     || [],
        settings:      settings      || { portfolioSize: 71000, weeklyPremiumTarget: { min: 340, max: 410 }, maxTradePercentage: 50 },
        strategyNotes: strategyNotes || '',
        chatHistory:   chatHistory   || [],
        lastSynced:    new Date().toISOString()
      }
      await kv.set(userDataKey, userData)
      return res.status(200).json({ success: true, message: 'Data saved', lastSynced: userData.lastSynced })
    }

    if (req.method === 'DELETE') {
      await kv.del(userDataKey)
      return res.status(200).json({ success: true, message: 'Data cleared' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('User data error:', error)
    return res.status(500).json({ error: 'Failed to process user data', details: error.message })
  }
}

// ── Oracle sessions handler ───────────────────────────────────────────────────
async function handleOracleSessions(req, res, userId) {
  try {
    if (req.method === 'GET') {
      const { sessionId } = req.query
      if (sessionId) {
        const session = await loadSession(userId, sessionId)
        return res.status(200).json(session || { messages: [] })
      }
      return res.status(200).json(await loadSessionIndex(userId))
    }

    if (req.method === 'POST') {
      const { session } = req.body
      if (!session?.id) return res.status(400).json({ error: 'session.id required' })
      await saveSession(userId, session)
      return res.status(200).json({ success: true })
    }

    if (req.method === 'DELETE') {
      const { sessionId } = req.query
      if (!sessionId) return res.status(400).json({ error: 'sessionId required' })
      await deleteSession(userId, sessionId)
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Oracle sessions error:', error)
    return res.status(500).json({ error: 'Failed to process request', details: error.message })
  }
}
