import { requireAuth, setCors }                                   from './_auth.js'
import { loadSession, loadSessionIndex, saveSession, deleteSession } from './lib/oracle-memory.js'

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── Auth gate ─────────────────────────────────────────────────────────────
  const userId = requireAuth(req, res)
  if (!userId) return // requireAuth already sent 401

  try {
    // ── GET /api/oracle-sessions?sessionId=X — load full session
    if (req.method === 'GET') {
      const { sessionId } = req.query

      if (sessionId) {
        // Load single session
        const session = await loadSession(userId, sessionId)
        if (!session) {
          return res.status(404).json({ error: 'Session not found' })
        }
        return res.status(200).json(session)
      }

      // Load session index
      const index = await loadSessionIndex(userId)
      return res.status(200).json(index)
    }

    // ── POST /api/oracle-sessions — save session
    if (req.method === 'POST') {
      const { session } = req.body

      if (!session || !session.id) {
        return res.status(400).json({ error: 'Session object with id field is required' })
      }

      await saveSession(userId, session)
      return res.status(200).json({ success: true, message: 'Session saved', sessionId: session.id })
    }

    // ── DELETE /api/oracle-sessions?sessionId=X — delete session
    if (req.method === 'DELETE') {
      const { sessionId } = req.query

      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' })
      }

      await deleteSession(userId, sessionId)
      return res.status(200).json({ success: true, message: 'Session deleted' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Oracle sessions error:', error)
    return res.status(500).json({ error: 'Failed to process oracle session', details: error.message })
  }
}
