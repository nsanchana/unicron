import { useState } from 'react'
import { LogIn, UserPlus, Lock, User } from 'lucide-react'
import { API_BASE_URL } from '../config'

function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login'
      const body = isRegister
        ? { username, password, email }
        : { username, password }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed')
      }

      // Call parent callback on success
      onLoginSuccess(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-900 to-blue-900/20">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Unicron
          </h1>
          <p className="text-gray-400">Options Trading Analysis Tool</p>
        </div>

        {/* Login/Register Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="inline-flex rounded-lg bg-gray-700 p-1">
              <button
                onClick={() => {
                  setIsRegister(false)
                  setError('')
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  !isRegister
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <LogIn className="inline h-4 w-4 mr-2" />
                Login
              </button>
              <button
                onClick={() => {
                  setIsRegister(true)
                  setError('')
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isRegister
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <UserPlus className="inline h-4 w-4 mr-2" />
                Register
              </button>
            </div>
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

            {/* Email (only for registration) */}
            {isRegister && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="input-primary w-full"
                />
              </div>
            )}

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
                minLength={6}
              />
              {isRegister && (
                <p className="text-xs text-gray-400 mt-1">
                  Minimum 6 characters
                </p>
              )}
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
                  <span>{isRegister ? 'Creating Account...' : 'Logging In...'}</span>
                </div>
              ) : (
                <span>
                  {isRegister ? 'Create Account' : 'Sign In'}
                </span>
              )}
            </button>
          </form>

          {/* Info Messages */}
          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-300">
              {isRegister ? (
                <>
                  <strong>First time here?</strong> Create an account to securely save your research, trades, and settings.
                </>
              ) : (
                <>
                  <strong>Welcome back!</strong> Sign in to access your portfolio and trading analysis.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-gray-400 text-sm">
          <p>Your data is encrypted and stored securely.</p>
        </div>
      </div>
    </div>
  )
}

export default Login
