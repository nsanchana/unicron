import { authHeaders } from '../utils/auth.js'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Send, Sparkles, Trash2, MessageSquare, Plus, Brain, ChevronLeft, AlignLeft, Menu } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ── KV sync helpers ──────────────────────────────────────────────────────────
async function kvFetchIndex() {
  try {
    const resp = await fetch('/api/oracle-sessions', { headers: authHeaders() })
    if (!resp.ok) return null
    return await resp.json()
  } catch { return null }
}

async function kvFetchSession(sessionId) {
  try {
    const resp = await fetch(`/api/oracle-sessions?sessionId=${sessionId}`, { headers: authHeaders() })
    if (!resp.ok) return null
    return await resp.json()
  } catch { return null }
}

async function kvSaveSession(session) {
  try {
    await fetch('/api/oracle-sessions', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ session }),
    })
  } catch { /* fire-and-forget */ }
}

async function kvDeleteSession(sessionId) {
  try {
    await fetch(`/api/oracle-sessions?sessionId=${sessionId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
  } catch { /* fire-and-forget */ }
}

// ── Quick prompts ──────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { emoji: '📊', label: 'Portfolio health',  prompt: 'Give me a full health check of my current portfolio — allocation, risk exposure, cash position, and any red flags.', needsContext: true },
  { emoji: '🎯', label: 'Open positions',    prompt: 'Review all my open positions. For each, tell me: days to expiry, distance from strike, and whether I should hold, roll, or close.', needsContext: true },
  { emoji: '🏆', label: 'Best symbols',      prompt: 'Which symbols have been the most profitable for me historically? Show win rate, total net premium, and avg return per trade.', needsContext: true },
  { emoji: '📉', label: 'Worst trades',      prompt: 'What are my worst-performing trades or symbols? What patterns do you see that I should avoid?', needsContext: true },
  { emoji: '🔄', label: 'Roll candidates',   prompt: 'Which of my open positions are good candidates to roll? Consider DTE remaining, premium collected vs risk, and current trend.', needsContext: true },
  { emoji: '⚠️', label: 'Assignment risk',   prompt: 'Which open positions are most at risk of assignment? Show how close each strike is to current estimated price.', needsContext: true },
  { emoji: '💡', label: 'Strategy insights', prompt: 'Based on my full trade history, what patterns do you see in my strategy? What is working well and what should I change?', needsContext: true },
  { emoji: '📅', label: 'Expiring soon',     prompt: 'List all positions expiring in the next 14 days with their details and recommended action.', needsContext: true },
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
        blockquote: ({ children }) => <blockquote className="border-l-2 border-amber-500/50 pl-3 my-2 text-white/60 italic">{children}</blockquote>,
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
    personality: 'oracle',
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

// ── Session helpers ────────────────────────────────────────────────────────
const STORAGE_KEY = 'oracle_sessions'
const MAX_SESSIONS = 50

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { sessions: [], activeSessionId: null }
    return JSON.parse(raw)
  } catch { return { sessions: [], activeSessionId: null } }
}

function saveSessions(data) {
  if (data.sessions.length > MAX_SESSIONS) {
    data.sessions = data.sessions
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, MAX_SESSIONS)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// ── Time ago helper ────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

// ── Main component ─────────────────────────────────────────────────────────
export default function TheOracle({ tradeData = [], stockData = [], settings = {} }) {
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tone, setTone] = useState('brief')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const context = useMemo(() => buildContext(tradeData, stockData, settings, tone), [tradeData, stockData, settings, tone])

  // ── Load sessions on mount ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function init() {
      const kvIndex = await kvFetchIndex()
      if (cancelled) return

      if (kvIndex && kvIndex.length > 0) {
        const kvSessions = kvIndex.map(s => ({
          id: s.id, title: s.title, messages: [],
          updatedAt: s.updatedAt, createdAt: s.createdAt, _kvLoaded: false,
        }))
        setSessions(kvSessions)

        const localData = loadSessions()
        if (localData.activeSessionId) {
          const match = kvSessions.find(s => s.id === localData.activeSessionId)
          if (match) {
            const full = await kvFetchSession(match.id)
            if (cancelled) return
            if (full?.messages) {
              match.messages = full.messages
              match._kvLoaded = true
              setActiveSessionId(match.id)
              setMessages(full.messages)
              setSessions([...kvSessions])
            }
          }
        }
      } else {
        const data = loadSessions()
        setSessions(data.sessions)
        if (data.activeSessionId) {
          const found = data.sessions.find(s => s.id === data.activeSessionId)
          if (found) {
            setActiveSessionId(found.id)
            setMessages(found.messages || [])
          }
        }
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // ── Save sessions when messages change ─────────────────────────────────
  useEffect(() => {
    if (!activeSessionId) return
    const updated = sessions.map(s =>
      s.id === activeSessionId
        ? { ...s, messages, updatedAt: new Date().toISOString() }
        : s
    )
    setSessions(updated)
    saveSessions({ sessions: updated, activeSessionId })

    // Sync to KV in background
    const current = updated.find(s => s.id === activeSessionId)
    if (current && messages.length > 0) {
      kvSaveSession(current)
    }
  }, [messages])

  // ── Auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Start new chat ─────────────────────────────────────────────────────
  const startNewChat = useCallback(() => {
    setActiveSessionId(null)
    setMessages([])
    setInput('')
  }, [])

  // ── Switch session ─────────────────────────────────────────────────────
  const switchSession = useCallback(async (id) => {
    const found = sessions.find(s => s.id === id)
    if (!found) return
    setActiveSessionId(id)

    if (!found._kvLoaded && found.messages.length === 0) {
      const full = await kvFetchSession(id)
      if (full?.messages) {
        found.messages = full.messages
        found._kvLoaded = true
        setMessages(full.messages)
        setSessions([...sessions])
      } else {
        setMessages(found.messages || [])
      }
    } else {
      setMessages(found.messages || [])
    }

    if (window.innerWidth < 768) setSidebarOpen(false)
  }, [sessions])

  // ── Delete session ─────────────────────────────────────────────────────
  const deleteSession = useCallback((id, e) => {
    e.stopPropagation()
    const remaining = sessions.filter(s => s.id !== id)
    setSessions(remaining)
    if (id === activeSessionId) {
      if (remaining.length > 0) {
        const next = remaining[0]
        setActiveSessionId(next.id)
        setMessages(next.messages || [])
      } else {
        setActiveSessionId(null)
        setMessages([])
      }
    }
    saveSessions({ sessions: remaining, activeSessionId: id === activeSessionId ? (remaining[0]?.id || null) : activeSessionId })
    kvDeleteSession(id)
  }, [sessions, activeSessionId])

  // ── Send message ───────────────────────────────────────────────────────
  const send = useCallback(async (text, withContext = false) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')

    let currentSessionId = activeSessionId
    let currentSessions = sessions

    // Create session if needed
    if (!currentSessionId) {
      currentSessionId = `oracle-${Date.now()}`
      const title = msg.length > 35 ? msg.slice(0, 35) + '...' : msg
      const newSession = { id: currentSessionId, title, messages: [], updatedAt: new Date().toISOString() }
      currentSessions = [newSession, ...sessions]
      setSessions(currentSessions)
      setActiveSessionId(currentSessionId)
    }

    const userMsg = { id: Date.now().toString(), role: 'user', content: msg }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setLoading(true)

    try {
      const body = {
        message: msg,
        sessionId: currentSessionId,
        history: messages.slice(-20).map(m => ({ role: m.role, content: m.content })),
        userContext: withContext
          ? buildContext(tradeData, stockData, settings, tone)
          : { personality: 'oracle', tone },
      }

      const resp = await fetch('/api/unicron-ai', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.details || data.error || 'Request failed')

      const aiMsg = { id: `ai-${Date.now()}`, role: 'assistant', content: data.response }
      setMessages([...updated, aiMsg])
    } catch (err) {
      const errMsg = { id: `err-${Date.now()}`, role: 'assistant', content: `**Error**: ${err.message}` }
      setMessages([...updated, errMsg])
    } finally {
      setLoading(false)
    }
  }, [input, loading, activeSessionId, sessions, messages, tradeData, stockData, settings, tone])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(null, false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#0a0a0f] overflow-hidden">

      {/* ── Left sidebar ──────────────────────────────────────────────── */}
      <div className={`${sidebarOpen ? 'w-[280px] min-w-[280px]' : 'w-0 min-w-0'} transition-all duration-300 bg-black/40 border-r border-white/[0.06] flex flex-col overflow-hidden`}>
        {/* New Chat button */}
        <div className="p-3 border-b border-white/[0.06]">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-amber-400 text-sm font-medium transition-all"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {[...sessions].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(session => (
            <button
              key={session.id}
              onClick={() => switchSession(session.id)}
              className={`w-full group flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                session.id === activeSessionId
                  ? 'bg-amber-500/10 border border-amber-500/20 text-white'
                  : 'hover:bg-white/[0.05] border border-transparent text-white/60 hover:text-white/80'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{session.title || 'Untitled'}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{timeAgo(session.updatedAt)}</p>
              </div>
              <button
                onClick={(e) => deleteSession(session.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-500/20 rounded-lg transition-all"
              >
                <Trash2 className="h-3 w-3 text-rose-400" />
              </button>
            </button>
          ))}

          {sessions.length === 0 && (
            <div className="text-center py-8 text-white/20 text-xs">
              No conversations yet
            </div>
          )}
        </div>
      </div>

      {/* ── Right chat panel ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] bg-black/20">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/70 transition-all"
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <Brain className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">The Oracle</h3>
            <p className="text-[10px] text-white/35">Patience is the key to profit</p>
          </div>

          {/* Tone toggle */}
          <div className="flex bg-white/[0.06] border border-white/[0.08] rounded-full p-0.5 gap-0.5">
            <button onClick={() => setTone('brief')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${tone === 'brief' ? 'bg-amber-500 text-white' : 'text-white/40 hover:text-white/70'}`}>
              <Sparkles className="h-3 w-3" /> Brief
            </button>
            <button onClick={() => setTone('detailed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${tone === 'detailed' ? 'bg-amber-500 text-white' : 'text-white/40 hover:text-white/70'}`}>
              <AlignLeft className="h-3 w-3" /> Detailed
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 && !loading ? (
            /* ── Empty state ──────────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto px-4">
              <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 mb-4">
                <Brain className="h-10 w-10 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">The Oracle</h2>
              <p className="text-sm text-white/40 mb-8">Patience is the key to profit</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
                {QUICK_PROMPTS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => send(q.prompt, q.needsContext)}
                    disabled={loading}
                    className="flex flex-col items-start gap-1.5 p-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-amber-500/20 rounded-xl text-left transition-all disabled:opacity-40 group"
                  >
                    <span className="text-lg">{q.emoji}</span>
                    <span className="text-xs text-white/60 group-hover:text-white/80 font-medium leading-snug">{q.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Messages ─────────────────────────────────────────────── */
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Brain className="h-3.5 w-3.5 text-amber-400" />
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
                  <div className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Brain className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                  </div>
                  <div className="bg-white/[0.05] border border-white/[0.07] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <span className="text-[11px] text-white/40">The Oracle is thinking</span>
                    <span className="flex gap-1">
                      {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 bg-amber-400/60 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Quick prompts bar (when messages exist) */}
        {messages.length > 0 && (
          <div className="px-4 py-2 border-t border-white/[0.04] flex gap-2 overflow-x-auto scrollbar-none">
            {QUICK_PROMPTS.map((q, i) => (
              <button key={i} onClick={() => send(q.prompt, q.needsContext)} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] rounded-full text-[11px] text-white/60 hover:text-white font-medium transition-all whitespace-nowrap disabled:opacity-40 flex-shrink-0">
                <span>{q.emoji}</span> {q.label}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div className="px-4 pb-4 pt-2 border-t border-white/[0.04]">
          <div className="max-w-3xl mx-auto flex items-end gap-2 bg-white/[0.06] border border-white/[0.10] focus-within:border-amber-500/30 rounded-2xl px-4 py-3 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask The Oracle anything about your portfolio or strategy..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 resize-none focus:outline-none leading-relaxed max-h-32"
              style={{ overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
            />
            <button onClick={() => send(null, false)} disabled={!input.trim() || loading}
              className="p-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95">
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[10px] text-white/20 text-center mt-2">
            Enter to send &middot; Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
