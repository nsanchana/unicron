import { generateToken, setCors } from '../_auth.js'

export default async function handler(req, res) {
  setCors(req, res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  res.setHeader('Content-Type', 'application/json')

  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }

    // Read credentials from environment (never hardcode)
    const validUsername = process.env.ADMIN_USERNAME
    const validPassword = process.env.ADMIN_PASSWORD

    if (!validUsername || !validPassword) {
      return res.status(500).json({ error: 'Server credentials not configured' })
    }

    if (username !== validUsername || password !== validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Generate signed token (30-day TTL)
    const token = generateToken(username)

    return res.status(200).json({
      success: true,
      token,
      user: {
        id:       1,
        username: username,
        email:    null
      }
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
