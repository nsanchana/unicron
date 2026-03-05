import { useState, useEffect, useRef, useMemo } from 'react'
import { Send, Mic, MicOff, Sparkles, Trash2, RefreshCw, MessageSquare, ChevronDown, ChevronUp, Zap, AlignLeft } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ── Quick prompts ──────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { emoji: '📊', label: 'Portfolio health',  prompt: 'Give me a full health check of my current portfolio — allocation, risk exposure, cash position, and any red flags.' },
  { emoji: '🎯', label: 'Open positions',    prompt: 'Review all my open positions. For each, tell me: days to expiry, distance from strike, and whether I should hold, roll, or close.' },
  { emoji: '🏆', label: 'Best symbols',      prompt: 'Which symbols have been the most profitable for me historically? Show win rate, total net premium, and avg return per trade.' },
  { emoji: '📉', label: 'Worst trades',      prompt: 'What are my worst-performing trades or symbols? What patterns do you see that I should avoid?' },
  { emoji: '🔄', label: 'Roll candidates',   prompt: 'Which of my open positions are good candidates to roll? Consider DTE remaining, premium collected vs risk, and current trend.' },
  { emoji: '⚠️', label: 'Assignment risk',   prompt: 'Which open positions are most at risk of assignment? Show how close each strike is to current estimated price.' },
  { emoji: '💡', label: 'Strategy insights', prompt: 'Based on my full trade history, what patterns do you see in my strategy? What is working well and what should I change?' },
  { emoji: '📅', label: 'Expiring soon',     prompt: 'List all positions expiring in the next 14 days with their details and recommended action.' },
]

// ── Markdown renderer ──────────────────────────────────────────────────────
function ChatMarkdown({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p:      ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
        em:     ({ children }) => <em className="italic text-white/70">{children}</em>,
        ul:     ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2 pl-1">{children}</ul>,
        ol:     ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2 pl-1">{children}</ol>,
        li:     ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
        h1:     ({ children }) => <h1 className="text-base font-bold text-white mt-3 mb-1">{children}</h1>,
        h2:     ({ children }) => <h2 className="text-sm font-bold text-white/90 mt-3 mb-1">{children}</h2>,
        h3:     ({ children }) => <h3 className="text-sm font-semibold text-white/80 mt-2 mb-1">{children}</h3>,
        code:   ({ inline, children }) => inline
          ? <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-300">{children}</code>
          : <pre className="bg-black/30 border border-white/10 rounded-xl p-3 overflow-x-auto my-2"><code className="text-xs font-mono text-emerald-300">{children}</code></pre>,
        table:  ({ children }) => <div className="overflow-x-auto my-2"><table className="w-full text-xs border-collapse">{children}</table></div>,
        thead:  ({ children }) => <thead className="bg-white/10">{children}</thead>,
        th:     ({ children }) => <th className="px-3 py-2 text-left font-semibold text-white/70 border border-white/10">{children}</th>,
        td:     ({ children }) => <td className="px-3 py-2 text-white/80 border border-white/[0.06]">{children}</td>,
        tr:     ({ children }) => <tr className="even:bg-white/[0.02]">{children}</tr>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-blue-500/50 pl-3 my-2 text-white/60 italic">{children}</blockquote>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

// ── Build rich context payload ─────────────────────────────────────────────
function buildContext(tradeData, stockData, settings, tone) {
  const now = new Date()

  // Closed trades
  const closed = tradeData.filter(t => t.executed && t.closed)

  // Open trades (executed, not closed, not expired)
  const open = tradeData.filter(t => {
    if (!t.executed || t.closed) return false
    const daysLeft = Math.ceil((new Date(t.expirationDate) - now) / 86400000)
    return daysLeft >= -1
  }).map(t => {
    const daysLeft = Math.ceil((new Date(t.expirationDate) - now) / 86400000)
    const net = t.netPremium ?? (t.premium * (t.quantity || 1) * 100)
    return { symbol: t.symbol, type: t.tradeType, strike: t.strikePrice, expiry: t.expirationDate, daysLeft, premium: t.premium, netPremium: net, quantity: t.quantity || 1 }
  })

  // P&L by symbol
  const bySymbol = {}
  closed.forEach(t => {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { trades: 0, net: 0, wins: 0, denom: 0 }
    const net = t.netPremium ?? (t.premium * (t.quantity || 1) * 100)
    bySymbol[t.symbol].trades++
    bySymbol[t.symbol].net += net
    if (t.result !== 'rolled') bySymbol[t.symbol].denom++
    if (t.result === 'worthless') bySymbol[t.symbol].wins++
  })
  const symbolStats = Object.entries(bySymbol)
    .map(([sym, d]) => ({ sym, trades: d.trades, net: parseFloat(d.net.toFixed(2)), winRate: d.denom > 0 ? parseFloat((d.wins / d.denom * 100).toFixed(1)) : 0 }))
    .sort((a, b) => b.net - a.net)

  // Overall stats
  const wins = closed.filter(t => t.result === 'worthless').length
  const rolled = closed.filter(t => t.result === 'rolled').length
  const assigned = closed.filter(t => t.result === 'assigned').length
  const winDenom = closed.length - rolled
  const totalNet = closed.reduce((s, t) => s + (t.netPremium ?? (t.premium * (t.quantity || 1) * 100)), 0)
  const avgDaysHeld = closed.filter(t => t.daysHeld).reduce((s, t, _, a) => s + t.daysHeld / a.length, 0)

  // Held stocks
  const held = (stockData || []).filter(s => !s.dateSold)
  const stockValue = held.reduce((s, h) => s + ((parseFloat(h.currentPrice) || parseFloat(h.assignedPrice)) * h.shares), 0)
  const stockCost  = held.reduce((s, h) => s + (parseFloat(h.assignedPrice) * h.shares), 0)

  const deposited = settings?.totalDeposited || settings?.portfolioSize || 0
  const availCash = (settings?.portfolioSize || 0) - stockCost + totalNet
  const portfolioTotal = stockValue + availCash

  return {
    tone,
    openPositions: open,
    closedCount: closed.length,
    winRate: winDenom > 0 ? parseFloat((wins / winDenom * 100).toFixed(1)) : 0,
    assignmentRate: closed.length > 0 ? parseFloat((assigned / closed.length * 100).toFixed(1)) : 0,
    totalNetPremium: parseFloat(totalNet.toFixed(2)),
    avgDaysHeld: parseFloat(avgDaysHeld.toFixed(1)),
    symbolStats,
    heldStocks: held.map(s => ({ symbol: s.symbol, shares: s.shares, assignedAt: s.assignedPrice, current: s.currentPrice, unrealisedPnL: ((parseFloat(s.currentPrice) - parseFloat(s.assignedPrice)) * s.shares).toFixed(2) })),
    portfolio: { deposited, total: parseFloat(portfolioTotal.toFixed(2)), availableCash: parseFloat(availCash.toFixed(2)), stockValue: parseFloat(stockValue.toFixed(2)), totalReturn: deposited > 0 ? parseFloat(((portfolioTotal - deposited) / deposited * 100).toFixed(2)) : 0 },
    settings: { portfolioSize: settings?.portfolioSize, maxTradePercentage: settings?.maxTradePercentage },
  }
}

// ── Main component ─────────────────────────────────────────────────────────
export default function PortfolioChat({ tradeData = [], stockData = [], settings = {}, chatHistory = [], onUpdateHistory }) {
  const [messages, setMessages]           = useState([])
  const [sessionId, setSessionId]         = useState(null)
  const [input, setInput]                 = useState('')
  const [loading, setLoading]             = useState(false)
  const [isListening, setIsListening]     = useState(false)
  const [tone, setTone]                   = useState('brief')   // 'brief' | 'detailed'
  const [contextRefreshed, setContextRefreshed] = useState(false)
  const [collapsed, setCollapsed]         = useState(false)

  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)
  const inputRef       = useRef(null)

  // ── context (memoised) ──────────────────────────────────────────────────
  const context = useMemo(() => buildContext(tradeData, stockData, settings, tone), [tradeData, stockData, settings, tone])

  // ── restore / start session ─────────────────────────────────────────────
  useEffect(() => {
    if (chatHistory?.length > 0 && !sessionId) {
      const last = [...chatHistory].sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))[0]
      setSessionId(last.id)
      // Strip any old stored welcome messages — we render welcome live now
      setMessages((last.messages || []).filter(m => m.id !== 'welcome'))
    } else if (!sessionId) {
      startNewSession(true)
    }
  }, [chatHistory])

  const startNewSession = (silent = false) => {
    const id = `pc-${Date.now()}`
    setSessionId(id)
    setMessages([])
    if (!silent) {
      const newHistory = [{ id, title: 'New Chat', messages: [], lastModified: new Date().toISOString() }, ...(chatHistory || [])]
      onUpdateHistory?.(newHistory)
    }
  }

  // ── voice recognition ───────────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    const rec = new SpeechRecognition()
    rec.continuous    = false
    rec.interimResults = false
    rec.lang          = 'en-US'
    rec.onresult = e => {
      const transcript = e.results[0][0].transcript
      setInput(prev => prev ? `${prev} ${transcript}` : transcript)
      setIsListening(false)
      inputRef.current?.focus()
    }
    rec.onerror = () => setIsListening(false)
    rec.onend   = () => setIsListening(false)
    recognitionRef.current = rec
  }, [])

  const toggleVoice = () => {
    if (!recognitionRef.current) return
    if (isListening) { recognitionRef.current.stop() }
    else { setIsListening(true); recognitionRef.current.start() }
  }

  // ── auto-scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages])

  // ── send message ────────────────────────────────────────────────────────
  const send = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')

    const userMsg = { id: Date.now().toString(), role: 'user', content: msg }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setLoading(true)

    try {
      const resp = await fetch('/api/unicron-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          userContext: context,
          history: messages.filter(m => m.id !== 'welcome').map(m => ({ role: m.role, content: m.content }))
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.details || data.error || 'Request failed')

      const aiMsg = { id: `ai-${Date.now()}`, role: 'assistant', content: data.response }
      const final = [...updated, aiMsg]
      setMessages(final)
      persistSession(final, msg)
    } catch (err) {
      const errMsg = { id: `err-${Date.now()}`, role: 'assistant', content: `❌ **Error**: ${err.message}` }
      const final = [...updated, errMsg]
      setMessages(final)
      persistSession(final, msg)
    } finally {
      setLoading(false)
    }
  }

  const persistSession = (msgs, firstUserMsg) => {
    const title = firstUserMsg?.length > 35 ? firstUserMsg.slice(0, 35) + '…' : (firstUserMsg || 'Chat')
    const session = { id: sessionId, title, messages: msgs, lastModified: new Date().toISOString() }
    const existing = (chatHistory || []).filter(s => s.id !== sessionId)
    onUpdateHistory?.([session, ...existing])
  }

  const handleContextRefresh = () => {
    setContextRefreshed(true)
    const notice = { id: `ctx-${Date.now()}`, role: 'assistant', content: `🔄 **Context refreshed.** I now have your latest data:\n- **${context.openPositions.length}** open positions · **$${context.portfolio.availableCash.toLocaleString()}** available cash · **$${context.totalNetPremium.toLocaleString()}** total premium collected.` }
    const updated = [...messages, notice]
    setMessages(updated)
    persistSession(updated, null)
    setTimeout(() => setContextRefreshed(false), 2000)
  }

  const handleClear = () => {
    if (!confirm('Clear this conversation?')) return
    startNewSession()
  }

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
          <Sparkles className="h-4 w-4 text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">Unicron AI</h3>
          <p className="text-[10px] text-white/35">
            {context.openPositions.length} open · {context.closedCount} closed · {context.winRate}% win rate
          </p>
        </div>

        {/* Tone toggle */}
        <div className="flex bg-white/[0.06] border border-white/[0.08] rounded-full p-0.5 gap-0.5">
          <button onClick={() => setTone('brief')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${tone === 'brief' ? 'bg-blue-500 text-white' : 'text-white/40 hover:text-white/70'}`}>
            <Zap className="h-3 w-3" /> Brief
          </button>
          <button onClick={() => setTone('detailed')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${tone === 'detailed' ? 'bg-blue-500 text-white' : 'text-white/40 hover:text-white/70'}`}>
            <AlignLeft className="h-3 w-3" /> Detailed
          </button>
        </div>

        {/* Controls */}
        <button onClick={handleContextRefresh} title="Refresh context"
          className={`p-2 rounded-xl border transition-all ${contextRefreshed ? 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400' : 'bg-white/[0.04] border-white/[0.06] text-white/30 hover:text-white/70 hover:bg-white/[0.08]'}`}>
          <RefreshCw className={`h-3.5 w-3.5 ${contextRefreshed ? 'animate-spin' : ''}`} />
        </button>
        <button onClick={handleClear} title="Clear conversation"
          className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setCollapsed(c => !c)}
          className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/30 hover:text-white/70 transition-all">
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>

      {!collapsed && <>
        {/* Quick prompts */}
        <div className="px-4 py-3 border-b border-white/[0.04] flex gap-2 overflow-x-auto scrollbar-none">
          {QUICK_PROMPTS.map((q, i) => (
            <button key={i} onClick={() => send(q.prompt)} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] rounded-full text-[11px] text-white/60 hover:text-white font-medium transition-all whitespace-nowrap disabled:opacity-40 flex-shrink-0">
              <span>{q.emoji}</span> {q.label}
            </button>
          ))}
        </div>

        {/* Message thread */}
        <div className="h-96 overflow-y-auto px-4 py-4 space-y-4">

          {/* Live welcome banner — shown when no messages yet, always reflects current data */}
          {messages.length === 0 && !loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <div className="bg-white/[0.05] border border-white/[0.07] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/85 max-w-[85%]">
                {context.closedCount > 0 ? (
                  <p className="leading-relaxed">
                    Portfolio loaded — <strong className="text-white">{context.openPositions.length} open position{context.openPositions.length !== 1 ? 's' : ''}</strong>, <strong className="text-white">{context.closedCount} closed trades</strong>, <strong className="text-emerald-400">{context.winRate}% win rate</strong>, and <strong className="text-emerald-400">${context.totalNetPremium.toLocaleString()} net premium</strong> collected. Ask me anything.
                  </p>
                ) : (
                  <p className="leading-relaxed text-white/60">
                    Ready to help. Add some trades and I&apos;ll have full context on your portfolio, patterns, and positions.
                  </p>
                )}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                </div>
              )}
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-500/20 border border-blue-500/20 text-white rounded-tr-sm'
                  : 'bg-white/[0.05] border border-white/[0.07] text-white/85 rounded-tl-sm'
              }`}>
                {msg.role === 'assistant'
                  ? <ChatMarkdown content={msg.content} />
                  : <p className="leading-relaxed">{msg.content}</p>
                }
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
              </div>
              <div className="bg-white/[0.05] border border-white/[0.07] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <span className="text-[11px] text-white/40">Analysing your portfolio</span>
                <span className="flex gap-1">
                  {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 bg-blue-400/60 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="px-4 pb-4 pt-2 border-t border-white/[0.04]">
          <div className={`flex items-end gap-2 bg-white/[0.06] border rounded-2xl px-4 py-3 transition-all ${isListening ? 'border-rose-500/40 bg-rose-500/5' : 'border-white/[0.10] focus-within:border-blue-500/30'}`}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={isListening ? '🎙️ Listening…' : 'Ask about your positions, patterns, or strategy…'}
              rows={1}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 resize-none focus:outline-none leading-relaxed max-h-32"
              style={{ overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
            />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={toggleVoice} title={isListening ? 'Stop recording' : 'Voice input'}
                className={`p-2 rounded-xl transition-all ${
                  isListening
                    ? 'bg-rose-500/20 border border-rose-500/30 text-rose-400 animate-pulse'
                    : recognitionRef.current
                      ? 'text-white/30 hover:text-white/70 hover:bg-white/[0.08]'
                      : 'text-white/15 cursor-not-allowed'
                }`}
                disabled={!recognitionRef.current}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button onClick={() => send()} disabled={!input.trim() || loading}
                className="p-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-white/20 text-center mt-2">
            Enter to send · Shift+Enter for new line · {recognitionRef.current ? 'Mic button for voice' : 'Voice not supported in this browser'}
          </p>
        </div>
      </>}
    </div>
  )
}
