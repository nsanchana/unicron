import { useState, useRef, useEffect } from 'react'
import { Send, Loader, User } from 'lucide-react'
import BottomSheet from './ui/BottomSheet'
import { authHeaders } from '../utils/auth.js'

export default function ChatSheet({ open, onClose, companyData, chatMessages, setChatMessages }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    const userMessage = input.trim()
    setInput('')
    const newMessages = [...chatMessages, { role: 'user', content: userMessage }]
    setChatMessages(newMessages)
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          companyData,
          chatHistory: newMessages.slice(-10)
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.details || data.error || 'Failed to get response')
      setChatMessages([...newMessages, { role: 'assistant', content: data.response }])
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={`Ask about ${companyData?.symbol || ''}`} maxHeight="70vh">
      <div className="flex flex-col h-full">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ maxHeight: 'calc(70vh - 140px)' }}>
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex items-start gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                  <img src="/unicron-logo.png" alt="" className="h-5 w-5 object-contain rounded-full" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-500/20 border border-blue-500/20 text-white rounded-br-sm'
                  : 'surface-1 text-secondary rounded-bl-sm'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-white/60" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                <img src="/unicron-logo.png" alt="" className="h-5 w-5 object-contain rounded-full" />
              </div>
              <div className="surface-1 rounded-2xl px-3.5 py-2.5 rounded-bl-sm">
                <Loader className="h-4 w-4 animate-spin text-blue-400" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="flex gap-2 px-4 py-3 border-t border-white/[0.06] pb-safe">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this company..."
            className="flex-1 bg-white/[0.06] border border-white/[0.10] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-disabled focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl px-4 py-2.5 transition-spring disabled:opacity-40 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </BottomSheet>
  )
}
