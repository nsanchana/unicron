/**
 * Shared auth helper for Unicron API routes.
 * Uses HMAC-SHA256 signed tokens — no external deps, no KV roundtrip.
 */
import crypto from 'crypto'

const SECRET       = process.env.SESSION_SECRET || 'fallback-dev-secret'
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000  // 30 days

const ALLOWED_ORIGINS = [
  'https://myunicron.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

// ── Token generation ──────────────────────────────────────────────────────────

export function generateToken(username) {
  const expiry  = Date.now() + TOKEN_TTL_MS
  const payload = `${username}:${expiry}`
  const sig     = crypto.createHmac('sha256', SECRET).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

// ── Token verification ────────────────────────────────────────────────────────

export function verifyToken(token) {
  try {
    const decoded  = Buffer.from(token, 'base64url').toString('utf8')
    const lastIdx  = decoded.lastIndexOf(':')
    const payload  = decoded.substring(0, lastIdx)
    const sig      = decoded.substring(lastIdx + 1)

    const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex')

    // Timing-safe compare
    if (sig.length !== expected.length) return null
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null

    const parts  = payload.split(':')
    const expiry = parseInt(parts[1], 10)
    if (Date.now() > expiry) return null

    return parts[0] // username
  } catch {
    return null
  }
}

// ── Middleware: require valid token, return username or null ──────────────────

export function requireAuth(req, res) {
  const header = req.headers['authorization'] || ''
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  const username = verifyToken(header.slice(7))
  if (!username) {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' })
    return null
  }
  return username
}

// ── CORS helper ───────────────────────────────────────────────────────────────

export function setCors(req, res) {
  const origin = req.headers.origin || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin',      allowed)
  res.setHeader('Access-Control-Allow-Methods',     'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers',     'Content-Type, Authorization')
}
