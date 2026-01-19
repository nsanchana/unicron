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
    // Load theme preference
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

      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned an invalid response. Please check Vercel deployment logs.')
      }

      const data = await response.json()
      console.log('Login response:', { status: response.status, data })

      if (!response.ok) {
        // Show detailed error message from server
        const errorMsg = data.message || data.error || 'Authentication failed'
        const debugInfo = data.debug ? ` (Debug: ${JSON.stringify(data.debug)})` : ''
        throw new Error(errorMsg + debugInfo)
      }

      // Store user in localStorage and call parent callback
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
    <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 relative overflow-hidden ${theme === 'light'
        ? 'bg-gray-50'
        : 'bg-[#0f172a]'
      }`}>
      {/* Dynamic Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="w-full max-w-md relative z-10 px-4">
        {/* Logo and Title */}
        <div className="text-center mb-10">
          <div className="inline-block p-4 rounded-3xl bg-gray-800/40 backdrop-blur-2xl border border-gray-700/50 mb-6 shadow-2xl animate-float">
            <img src="/unicron-logo.png" alt="Unicron" className="h-16 w-16 object-contain" />
          </div>
          <h1 className="text-5xl font-black tracking-tight mb-3">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Unicron
            </span>
          </h1>
          <p className={`text-lg transition-colors duration-300 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'
            }`}>
            The Future of Options Analysis
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-10 border-white/10">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h2>
            <div className="h-1 w-12 bg-blue-500 mx-auto mt-2 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-300 ml-1">
                <User className="inline h-4 w-4 mr-2 text-blue-400" />
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="glass-input w-full py-3"
                required
                autoFocus
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-300 ml-1">
                <Lock className="inline h-4 w-4 mr-2 text-purple-400" />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="glass-input w-full py-3"
                required
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm animate-shake">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/25 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Securing Session...</span>
                </div>
              ) : (
                <span className="flex items-center justify-center">
                  Sign In to Terminal
                </span>
              )}
            </button>
          </form>

          {/* Info Message */}
          <div className="mt-8 p-4 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              Protected by military-grade encryption. Your session data is stored locally and never shared.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={`text-center mt-10 text-sm font-medium transition-colors duration-300 ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'
          }`}>
          <p>© 2026 Unicron Intelligence Systems</p>
        </div>
      </div>
    </div>
  )
}

export default Login
