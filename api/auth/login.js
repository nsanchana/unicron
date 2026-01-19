export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(200).end()
  }

  // Set CORS headers for actual request
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }

    // Hardcoded credentials
    if (username === 'nsanchana' && password === 'Ns998923++') {
      return res.status(200).json({
        success: true,
        user: {
          id: 1,
          username: 'nsanchana',
          email: null
        }
      })
    }

    return res.status(401).json({ error: 'Invalid credentials' })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
