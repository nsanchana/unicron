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
    <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
      theme === 'light'
        ? 'bg-gradient-to-br from-gray-50 via-white to-blue-50'
        : 'bg-gradient-to-br from-gray-900 via-gray-900 to-blue-900/20'
    }`}>
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Unicron
          </h1>
          <p className={`transition-colors duration-300 ${
            theme === 'light' ? 'text-gray-600' : 'text-gray-400'
          }`}>
            Options Trading Analysis Tool
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-white">Login</h2>
            <p className="text-sm text-gray-400 mt-1">Private Application</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                <User className="inline h-4 w-4 mr-1" />
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="input-primary w-full"
                required
                autoFocus
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                <Lock className="inline h-4 w-4 mr-1" />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input-primary w-full"
                required
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Logging In...</span>
                </div>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Info Message */}
          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-300">
              <strong>Welcome back!</strong> Sign in to access your portfolio and trading analysis.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={`text-center mt-6 text-sm transition-colors duration-300 ${
          theme === 'light' ? 'text-gray-600' : 'text-gray-400'
        }`}>
          <p>Your data is encrypted and stored securely.</p>
        </div>
      </div>
    </div>
  )
}

export default Login
