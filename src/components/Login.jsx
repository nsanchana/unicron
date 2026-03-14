import { useState, useEffect } from 'react'
import { Lock, User } from 'lucide-react'
import { API_BASE_URL } from '../config'

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    const savedTheme = localStorage.getItem('unicron_theme') || 'dark'
    setTheme(savedTheme)
    document.documentElement.classList.toggle('light-mode', savedTheme === 'light')
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      })

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned an invalid response. Please check Vercel deployment logs.')
      }

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.message || data.error || 'Authentication failed'
        const debugInfo = data.debug ? ` (Debug: ${JSON.stringify(data.debug)})` : ''
        throw new Error(errorMsg + debugInfo)
      }

      if (data.token) localStorage.setItem('unicron_token', data.token)
      localStorage.setItem('unicron_user', JSON.stringify(data.user))
      onLoginSuccess(data.user)
    } catch (err) {
      console.error('Login error details:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">

        {/* Logo + title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[22px] bg-white/[0.06] border border-white/[0.10] mb-5 animate-float">
            <img src="/unicron-logo.png" alt="Unicron" className="h-11 w-11 object-cover rounded-xl border-0 outline-none" />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight mb-1">Unicron</h1>
          <p className="text-sm text-white/40 font-medium">Options Intelligence Terminal</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[28px] p-8 space-y-5">
          <div className="space-y-1.5 mb-2">
            <h2 className="text-lg font-semibold text-white">Sign in</h2>
            <p className="text-sm text-white/40">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50 flex items-center gap-1.5">
                <User className="h-3 w-3" /> Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all"
                required
                autoFocus
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50 flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all"
                required
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm animate-shake">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 rounded-full text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-[11px] text-white/25 text-center pt-1 leading-relaxed">
            Your session data is stored locally and never shared.
          </p>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">© 2026 Unicron Intelligence Systems</p>
      </div>
    </div>
  )
}

export default Login
