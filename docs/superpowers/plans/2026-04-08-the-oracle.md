# The Oracle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a dedicated "The Oracle" page with ChatGPT-style session management, replacing the scattered AI chat surfaces (PortfolioChat, DailyInsights, UnicronAI).

**Architecture:** Single self-contained component `TheOracle.jsx` with two-panel layout (session sidebar + chat area). Sessions stored in localStorage. Portfolio context fetched on-demand via quick prompts. Warren Buffett personality injected via `userContext.personality` field, handled by a small backward-compatible API change.

**Tech Stack:** React 18, Tailwind CSS, ReactMarkdown + remark-gfm, Lucide React icons, localStorage

**Spec:** `docs/superpowers/specs/2026-04-08-the-oracle-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/TheOracle.jsx` | Full Oracle page: sidebar, chat, sessions, quick prompts |
| Modify | `src/App.jsx` | Add oracle tab, render TheOracle, remove chatHistory state |
| Modify | `api/unicron-ai.js` | Add Oracle personality to system prompt |
| Modify | `src/components/Dashboard.jsx` | Remove DailyInsights import and rendering |
| Modify | `src/components/Performance.jsx` | Remove PortfolioChat import and rendering |
| Delete | `src/components/UnicronAI.jsx` | Unused, replaced by Oracle |
| Delete | `src/components/DailyInsights.jsx` | Replaced by Oracle |
| Delete | `src/components/PortfolioChat.jsx` | Replaced by Oracle |

---

### Task 1: Add Oracle personality to API

**Files:**
- Modify: `api/unicron-ai.js:55-68`

- [ ] **Step 1: Add personality check before system prompt construction**

In `api/unicron-ai.js`, after the `toneInstruction` block (line 57), add a personality check. Replace ONLY the identity and personality blocks (lines 59-68) while **preserving the rest of the template literal** (lines 69-108: PORTFOLIO SNAPSHOT, OPTIONS PERFORMANCE, INSTRUCTIONS, etc.). The template literal continues after the personality block with `${ctx.portfolio}` data sections.

```javascript
        const isOracle = ctx.personality === 'oracle'

        const identityBlock = isOracle
            ? `You are The Oracle — a wise, patient trading advisor channeling Warren Buffett's investment philosophy.
You speak with folksy wisdom, use memorable analogies, and always emphasize long-term value, margin of safety, and disciplined risk management.
You occasionally quote Buffett and Munger. You are direct but warm, and you never rush to action — you'd rather do nothing than do something foolish.
You trade the Wheel strategy: Cash Secured Puts (CSP) to acquire stocks, then Covered Calls (CC) to generate income or exit.`
            : `You are Unicron AI — a sharp, data-driven trading assistant embedded in the user's personal options trading dashboard.
You trade the Wheel strategy: Cash Secured Puts (CSP) to acquire stocks, then Covered Calls (CC) to generate income or exit.`

        const personalityBlock = isOracle
            ? `PERSONALITY:
- Wise, folksy, and patient like Warren Buffett. Use homespun analogies and occasional Buffett/Munger quotes.
- Always cite the user's actual data when making a point.
- Proactively flag risks — but frame them as "margin of safety" concerns.
- Use Markdown: bold key figures, tables for comparisons, bullets for lists.`
            : `PERSONALITY:
- Confident, professional, slightly futuristic. Direct answers, no fluff.
- Always cite the user's actual data when making a point (e.g. "Your LULU win rate is 80% across 20 trades").
- Proactively flag risks you spot in the data — don't wait to be asked.
- Use Markdown: bold key figures, tables for comparisons, bullets for lists.`

        let systemPrompt = `${identityBlock}

${toneInstruction}

${personalityBlock}

═══════════════════════════════════
PORTFOLIO SNAPSHOT (live data)
...KEEP ALL EXISTING LINES 70-108 UNCHANGED...
`
```

**IMPORTANT:** The existing template literal from line 69 onward (PORTFOLIO SNAPSHOT, OPTIONS PERFORMANCE, open positions, held stocks, P&L by symbol, RISK GUARDRAILS, INSTRUCTIONS) must remain intact. Only the first 10 lines (identity + personality) are being replaced with the conditional blocks above. The rest of the template literal continues exactly as-is.

- [ ] **Step 2: Verify existing callers are unaffected**

The change is backward-compatible. When `ctx.personality` is undefined (all existing callers), the original Unicron AI persona is used. Only when `personality === 'oracle'` does the Buffett persona activate.

- [ ] **Step 3: Commit**

```bash
git add api/unicron-ai.js
git commit -m "feat: add Oracle personality mode to unicron-ai endpoint"
```

---

### Task 2: Create TheOracle.jsx component

**Files:**
- Create: `src/components/TheOracle.jsx`

This is the largest task. The component includes: session sidebar, chat area, quick prompts, message rendering, and session management. Port `buildContext` and `ChatMarkdown` from `PortfolioChat.jsx`.

- [ ] **Step 1: Create the component file with all sections**

Create `src/components/TheOracle.jsx` with the following structure. Key things to get right:

**Imports and constants:**
```jsx
import { authHeaders } from '../utils/auth.js'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Send, Sparkles, Trash2, MessageSquare, Plus, Brain, ChevronLeft, AlignLeft, Menu } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
```

**QUICK_PROMPTS array** — based on `PortfolioChat.jsx` lines 8-17, with `needsContext: true` ADDED to each entry (this field does not exist in the original — it controls whether `buildContext()` is called):
```jsx
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
```

**ChatMarkdown component** — copy exactly from `PortfolioChat.jsx` lines 20-48.

**buildContext function** — copy exactly from `PortfolioChat.jsx` lines 51-112. Add `personality: 'oracle'` to the returned object:
```jsx
return {
  personality: 'oracle',
  tone,
  openPositions: open,
  // ... rest unchanged
}
```

**Session helpers:**
```jsx
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
  // Prune to max sessions
  if (data.sessions.length > MAX_SESSIONS) {
    data.sessions = data.sessions
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, MAX_SESSIONS)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
```

**Main component signature:**
```jsx
export default function TheOracle({ tradeData = [], stockData = [], settings = {} }) {
```

**State:**
```jsx
const [sessions, setSessions] = useState([])
const [activeSessionId, setActiveSessionId] = useState(null)
const [messages, setMessages] = useState([])
const [input, setInput] = useState('')
const [loading, setLoading] = useState(false)
const [tone, setTone] = useState('brief')
const [sidebarOpen, setSidebarOpen] = useState(true) // false on mobile
const messagesEndRef = useRef(null)
const inputRef = useRef(null)
```

**useEffect to load sessions on mount:**
```jsx
useEffect(() => {
  const data = loadSessions()
  setSessions(data.sessions)
  if (data.activeSessionId) {
    const session = data.sessions.find(s => s.id === data.activeSessionId)
    if (session) {
      setActiveSessionId(session.id)
      setMessages(session.messages)
      return
    }
  }
  // No active session — show empty state
}, [])
```

**Save sessions whenever messages or sessions change:**
```jsx
useEffect(() => {
  if (!activeSessionId) return
  const updated = sessions.map(s =>
    s.id === activeSessionId ? { ...s, messages, updatedAt: new Date().toISOString() } : s
  )
  setSessions(updated)
  saveSessions({ sessions: updated, activeSessionId })
}, [messages])
```

**startNewChat function:**
```jsx
const startNewChat = useCallback(() => {
  setActiveSessionId(null)
  setMessages([])
  setInput('')
  inputRef.current?.focus()
}, [])
```

**switchSession function:**
```jsx
const switchSession = useCallback((id) => {
  const session = sessions.find(s => s.id === id)
  if (session) {
    setActiveSessionId(id)
    setMessages(session.messages)
    // On mobile, close sidebar after switching
    if (window.innerWidth < 1024) setSidebarOpen(false)
  }
}, [sessions])
```

**deleteSession function:**
```jsx
const deleteSession = useCallback((id, e) => {
  e.stopPropagation()
  const filtered = sessions.filter(s => s.id !== id)
  setSessions(filtered)
  if (activeSessionId === id) {
    if (filtered.length > 0) {
      setActiveSessionId(filtered[0].id)
      setMessages(filtered[0].messages)
    } else {
      setActiveSessionId(null)
      setMessages([])
    }
  }
  saveSessions({ sessions: filtered, activeSessionId: activeSessionId === id ? (filtered[0]?.id || null) : activeSessionId })
}, [sessions, activeSessionId])
```

**send function:**
```jsx
const send = useCallback(async (text, withContext = false) => {
  const msg = text || input.trim()
  if (!msg || loading) return

  setInput('')
  const userMsg = { role: 'user', content: msg, id: `u-${Date.now()}` }
  const newMessages = [...messages, userMsg]
  setMessages(newMessages)

  // Create session if first message
  let currentSessionId = activeSessionId
  if (!currentSessionId) {
    currentSessionId = `oracle-${Date.now()}`
    const newSession = {
      id: currentSessionId,
      title: msg.substring(0, 40),
      messages: newMessages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const updatedSessions = [newSession, ...sessions]
    setSessions(updatedSessions)
    setActiveSessionId(currentSessionId)
    saveSessions({ sessions: updatedSessions, activeSessionId: currentSessionId })
  }

  setLoading(true)

  try {
    const body = {
      message: msg,
      history: newMessages.slice(-20).map(m => ({ role: m.role, content: m.content })),
    }

    if (withContext) {
      body.userContext = buildContext(tradeData, stockData, settings, tone)
    } else {
      body.userContext = { personality: 'oracle', tone }
    }

    const res = await fetch('/api/unicron-ai', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body)
    })
    const data = await res.json()
    const aiMsg = { role: 'assistant', content: data.response || data.error || 'No response', id: `a-${Date.now()}` }
    setMessages(prev => [...prev, aiMsg])
  } catch (err) {
    setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, id: `e-${Date.now()}` }])
  } finally {
    setLoading(false)
  }
}, [input, messages, loading, activeSessionId, sessions, tradeData, stockData, settings, tone])
```

**Relative time helper:**
```jsx
const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
```

**JSX layout:**

The component returns a two-panel layout. Important: this renders full-width (no max-w constraint), the App.jsx will handle this by rendering TheOracle outside the normal `<div className="max-w-[1200px]">` wrapper.

```jsx
return (
  <div className="flex h-[calc(100vh-0px)] lg:h-screen bg-black">
    {/* ── Session Sidebar ── */}
    <div className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-200 border-r border-white/[0.06] bg-[#0a0a0f] flex-shrink-0 overflow-hidden flex flex-col`}>
      <div className="p-3 border-b border-white/[0.06]">
        <button onClick={startNewChat}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors">
          <Plus className="h-4 w-4" /> New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {[...sessions].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(s => (
          <button key={s.id} onClick={() => switchSession(s.id)}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors group flex items-center gap-2 ${
              activeSessionId === s.id
                ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
                : 'text-white/50 hover:text-white/80 hover:bg-white/[0.05] border border-transparent'
            }`}>
            <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="truncate">{s.title || 'New Chat'}</div>
              <div className="text-xs text-white/30 mt-0.5">{timeAgo(s.updatedAt)}</div>
            </div>
            <button onClick={(e) => deleteSession(s.id, e)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity">
              <Trash2 className="h-3 w-3" />
            </button>
          </button>
        ))}
      </div>
    </div>

    {/* ── Chat Area ── */}
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3">
        <button onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded-lg hover:bg-white/[0.05] text-white/50 hover:text-white/80 transition-colors">
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        <Brain className="h-5 w-5 text-amber-400" />
        <div>
          <div className="text-sm font-bold text-white">The Oracle</div>
          <div className="text-xs text-amber-400/60">Patience is the key to profit</div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setTone(t => t === 'brief' ? 'detailed' : 'brief')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              tone === 'detailed'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-white/[0.05] text-white/40 border border-white/[0.06] hover:text-white/60'
            }`}>
            <AlignLeft className="h-3 w-3 inline mr-1" />
            {tone === 'brief' ? 'Brief' : 'Detailed'}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Brain className="h-12 w-12 text-amber-400/40 mb-4" />
            <h2 className="text-lg font-bold text-white/80 mb-1">The Oracle</h2>
            <p className="text-sm text-white/40 mb-6 max-w-md">
              Your personal Warren Buffett-style trading advisor. Ask me anything about your portfolio, strategy, or the markets.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {QUICK_PROMPTS.map((qp, i) => (
                <button key={i} onClick={() => send(qp.prompt, qp.needsContext)}
                  className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white/60 hover:text-amber-300 hover:border-amber-500/30 hover:bg-amber-500/5 transition-colors">
                  {qp.emoji} {qp.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-500/15 border border-blue-500/20 text-white/90'
                    : 'bg-white/[0.04] border border-white/[0.08] text-white/80'
                }`}>
                  {msg.role === 'assistant' ? <ChatMarkdown content={msg.content} /> : msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm text-white/40">
                  <Sparkles className="h-4 w-4 animate-pulse inline mr-2" />The Oracle is thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Quick prompts (when messages exist) + Input */}
      <div className="border-t border-white/[0.06] px-4 py-3 space-y-3">
        {messages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {QUICK_PROMPTS.map((qp, i) => (
              <button key={i} onClick={() => send(qp.prompt, qp.needsContext)}
                className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/50 hover:text-amber-300 hover:border-amber-500/30 transition-colors">
                {qp.emoji} {qp.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask The Oracle..."
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/20"
            disabled={loading}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
)
```

- [ ] **Step 2: Auto-scroll to bottom on new messages**

```jsx
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages, loading])
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TheOracle.jsx
git commit -m "feat: create TheOracle component with chat sessions and Buffett personality"
```

---

### Task 3: Wire TheOracle into App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add import**

At line 2, add `Brain` to the lucide-react import. Add TheOracle import after line 11:

```jsx
import TheOracle from './components/TheOracle'
```

- [ ] **Step 2: Add oracle to overflowTabs**

At `src/App.jsx:640-643`, insert the oracle tab between stocks and settings:

```jsx
const overflowTabs = [
  { id: 'stocks',      label: 'Stock Portfolio', icon: Briefcase  },
  { id: 'oracle',      label: 'The Oracle',      icon: Brain      },
  { id: 'settings',    label: 'Settings',        icon: Settings   },
]
```

- [ ] **Step 3: Render TheOracle outside the max-w wrapper**

In the main content area (around line 841), TheOracle needs its own rendering path outside the `max-w-[1200px]` div. Replace the main content block:

```jsx
<main className="flex-1 min-h-screen lg:pl-72 overflow-x-hidden">
  {activeTab === 'oracle' ? (
    <TheOracle
      tradeData={tradeData}
      stockData={stockData}
      settings={settings}
    />
  ) : (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-8 py-6 lg:pt-6 pt-16">
      {activeTab === 'dashboard' && (
        <Dashboard ... />
      )}
      {/* ... rest of tabs unchanged ... */}
    </div>
  )}
</main>
```

- [ ] **Step 4: Remove chatHistory state and related code**

Remove or clean up these lines in `src/App.jsx`:
- Line 77: `const [chatHistory, setChatHistory] = useState([])` — delete
- **DO NOT delete line 168** (`chatHistory: []` inside `newResearch` object) — this is a research data property, not chat state
- Line 272, 304, 524: remove `chatHistory` from `saveToCloud` calls
- Lines 382-386: remove `chatHistory` cloud load block
- Line 476: remove `migrateChatHistory` localStorage load
- Line 514: remove `chatHistory` length check from hasData
- Line 534: remove `chatHistory` from useEffect dependency array
- Line 548: remove `chatHistory` from `handleImportData`
- Line 558: remove `chatHistory` from importedData save
- Line 861: remove `chatHistory` from strategyNotes save callback
- Lines 872-876: remove `chatHistory` and `onUpdateHistory` props from Performance
- Also clean up `handleExportData` if it references `chatHistory`

Also remove the `migrateChatHistory` function (around line 318) and its related `STORAGE_KEYS.CHAT_HISTORY` usage if no longer referenced.

**Note:** The mobile hamburger drawer is populated from `allTabs` (which includes `overflowTabs`), so adding `oracle` to `overflowTabs` automatically includes it in the mobile drawer. No additional mobile work needed.

**Note:** The `mode: 'daily-insights'` handler in `api/unicron-ai.js` becomes dead code after this change. It can be cleaned up later — not blocking.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire TheOracle into navigation and remove chatHistory state"
```

---

### Task 4: Remove DailyInsights from Dashboard

**Files:**
- Modify: `src/components/Dashboard.jsx:14,758-764`

- [ ] **Step 1: Remove import and rendering**

In `src/components/Dashboard.jsx`:
- Delete line 14: `import DailyInsights from './DailyInsights'`
- Delete lines 758-764 (the `{/* AI Daily Insights */}` block and `<DailyInsights ... />`)

- [ ] **Step 2: Commit**

```bash
git add src/components/Dashboard.jsx
git commit -m "feat: remove DailyInsights from Dashboard"
```

---

### Task 5: Remove PortfolioChat from Performance

**Files:**
- Modify: `src/components/Performance.jsx:3,465-472`

- [ ] **Step 1: Remove import and rendering**

In `src/components/Performance.jsx`:
- Delete line 3: `import PortfolioChat from './PortfolioChat'`
- Delete lines 465-472 (the `{/* Unicron AI Chat */}` block and `<PortfolioChat ... />`)
- Remove `chatHistory` and `onUpdateHistory` from the component's props destructuring (check the function signature)

- [ ] **Step 2: Commit**

```bash
git add src/components/Performance.jsx
git commit -m "feat: remove PortfolioChat from Performance page"
```

---

### Task 6: Delete old components

**Files:**
- Delete: `src/components/UnicronAI.jsx`
- Delete: `src/components/DailyInsights.jsx`
- Delete: `src/components/PortfolioChat.jsx`

- [ ] **Step 1: Delete the files**

```bash
rm src/components/UnicronAI.jsx
rm src/components/DailyInsights.jsx
rm src/components/PortfolioChat.jsx
```

- [ ] **Step 2: Verify no remaining imports**

Search for any lingering imports of these components:
```bash
grep -r "UnicronAI\|DailyInsights\|PortfolioChat" src/
```
Should return nothing.

- [ ] **Step 3: Commit**

```bash
git add -u src/components/UnicronAI.jsx src/components/DailyInsights.jsx src/components/PortfolioChat.jsx
git commit -m "chore: delete replaced AI chat components"
```

---

### Task 7: Build verification and deploy

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: Build succeeds with no errors. Warnings about chunk size are acceptable.

- [ ] **Step 2: Manual smoke test**

Start dev server and verify:
- Oracle appears in sidebar navigation above Settings
- Clicking Oracle shows two-panel layout
- Empty state shows with quick prompts
- New Chat button creates a session
- Quick prompts send messages with portfolio context
- Free-text messages work without context
- Session sidebar shows chat history
- Switching between sessions works
- Deleting sessions works
- Dashboard no longer shows DailyInsights
- Performance page no longer shows PortfolioChat

- [ ] **Step 3: Deploy**

```bash
vercel --prod --force
```

- [ ] **Step 4: Commit any fixes**

If any issues found during smoke testing, fix and commit.
