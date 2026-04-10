# Oracle On-Demand Conversation Memory — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add on-demand memory retrieval so Oracle sessions persist in Upstash KV, work cross-device, and selectively inject prior context into model calls.

**Architecture:** New `api/lib/oracle-memory.js` module handles all KV storage/retrieval logic. New `api/oracle-sessions.js` endpoint exposes CRUD for frontend sync. `api/unicron-ai.js` gets a retrieval step before model invocation and a background memory update after. `TheOracle.jsx` syncs sessions to/from KV instead of relying solely on localStorage.

**Tech Stack:** @vercel/kv (Upstash Redis), Vercel serverless functions, React 18, OpenAI-compatible API (Jarvis/OpenClaw)

**Spec:** `docs/superpowers/specs/2026-04-10-oracle-memory-design.md`

---

### Task 1: oracle-memory.js — KV storage utilities

**Files:**
- Create: `api/lib/oracle-memory.js`

This is the core module. We build the KV read/write functions first, then retrieval logic on top.

- [ ] **Step 1: Create `api/lib/` directory and `oracle-memory.js` with constants and KV key helpers**

```js
import { kv } from '@vercel/kv'

// ── Tuning constants ────────────────────────────────────────────────────────
export const MAX_FACTS           = 50
export const MAX_MESSAGES_KV     = 200
export const MAX_SNIPPETS        = 5
export const SUMMARY_INTERVAL    = 4   // update summary every N new exchanges (2 user + 2 assistant = 4 msgs)
export const CONTEXT_TOKEN_BUDGET = 1500

// ── KV key builders ─────────────────────────────────────────────────────────
const keys = {
  sessionIndex: (uid) => `user:${uid}:oracle:sessions`,
  session:      (uid, sid) => `user:${uid}:oracle:session:${sid}`,
  summary:      (uid, sid) => `user:${uid}:oracle:summary:${sid}`,
  facts:        (uid) => `user:${uid}:oracle:facts`,
}
```

- [ ] **Step 2: Implement `loadSessionIndex` and `saveSession`**

```js
export async function loadSessionIndex(userId) {
  const index = await kv.get(keys.sessionIndex(userId))
  return index || []
}

export async function saveSession(userId, session) {
  // Prune messages for KV storage (keep last MAX_MESSAGES_KV)
  const stored = {
    ...session,
    messages: session.messages.slice(-MAX_MESSAGES_KV),
  }
  await kv.set(keys.session(userId, session.id), stored)

  // Update index
  const index = await loadSessionIndex(userId)
  const entry = {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt || new Date().toISOString(),
    updatedAt: session.updatedAt || new Date().toISOString(),
    messageCount: session.messages.length,
  }
  const filtered = index.filter(s => s.id !== session.id)
  const updated = [entry, ...filtered].slice(0, 50) // MAX_SESSIONS
  await kv.set(keys.sessionIndex(userId), updated)
}
```

- [ ] **Step 3: Implement `loadSession` and `deleteSession`**

```js
export async function loadSession(userId, sessionId) {
  return await kv.get(keys.session(userId, sessionId)) || null
}

export async function deleteSession(userId, sessionId) {
  await Promise.all([
    kv.del(keys.session(userId, sessionId)),
    kv.del(keys.summary(userId, sessionId)),
  ])
  const index = await loadSessionIndex(userId)
  const updated = index.filter(s => s.id !== sessionId)
  await kv.set(keys.sessionIndex(userId), updated)
}
```

- [ ] **Step 4: Commit**

```bash
git add api/lib/oracle-memory.js
git commit -m "feat(oracle-memory): add KV storage utilities for sessions"
```

---

### Task 2: oracle-memory.js — Retrieval decision and context assembly

**Files:**
- Modify: `api/lib/oracle-memory.js`

- [ ] **Step 1: Implement `needsRetrieval` heuristic**

```js
const RETRIEVAL_PATTERNS = [
  /\b(earlier|previously|before|last time|prior|past)\b/i,
  /\b(remember|recall|you said|you told|you mentioned|we discussed|we decided|we agreed)\b/i,
  /\b(continue|pick up|where were we|carry on)\b/i,
  /\b(what was|what did|what were)\b.*\b(plan|decision|conclusion|idea|strategy)\b/i,
  /\b(previous (chat|session|conversation|discussion))\b/i,
]

export function needsRetrieval(message, sessionMessageCount) {
  // New session but user has history — caller checks if prior sessions exist
  if (sessionMessageCount === 0) return 'new_session'

  const lower = message.toLowerCase()
  for (const pattern of RETRIEVAL_PATTERNS) {
    if (pattern.test(lower)) return 'pattern_match'
  }
  return false
}
```

- [ ] **Step 2: Implement keyword scoring helpers**

```js
// Extract meaningful keywords from a message (stop-word removal)
const STOP_WORDS = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','shall','should','may','might','must','can','could','i','me','my','we','our','you','your','it','its','he','she','they','them','this','that','what','which','who','whom','how','when','where','why','not','no','but','and','or','if','then','so','as','at','by','for','in','of','on','to','with','from','about','into','through','during','after','before','above','below','between','out','up','down','off','over','under','again','further','once'])

function extractKeywords(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

function scoreOverlap(keywords, text) {
  const textWords = new Set(extractKeywords(text))
  let hits = 0
  for (const kw of keywords) {
    if (textWords.has(kw)) hits++
  }
  return keywords.length > 0 ? hits / keywords.length : 0
}
```

- [ ] **Step 3: Implement `retrieveContext` — the main retrieval entry point**

```js
export async function retrieveContext(userId, sessionId, message) {
  const sources = []
  const sections = []
  let tokenEstimate = 0

  const msgKeywords = extractKeywords(message)

  // 1. Key facts (always include — small, high-value)
  const facts = await kv.get(keys.facts(userId))
  if (facts && facts.length > 0) {
    const factsBlock = facts.map(f => `- ${f.fact}`).join('\n')
    const factsText = `KEY FACTS:\n${factsBlock}`
    const tokens = estimateTokens(factsText)
    if (tokenEstimate + tokens <= CONTEXT_TOKEN_BUDGET) {
      sections.push(factsText)
      tokenEstimate += tokens
      sources.push('facts')
    }
  }

  // 2. Current session summary
  if (sessionId) {
    const summary = await kv.get(keys.summary(userId, sessionId))
    if (summary?.summary) {
      const sumText = `SESSION SUMMARY (current):\n${summary.summary}`
      const tokens = estimateTokens(sumText)
      if (tokenEstimate + tokens <= CONTEXT_TOKEN_BUDGET) {
        sections.push(sumText)
        tokenEstimate += tokens
        sources.push('currentSummary')
      }
    }
  }

  // 3. Score other session summaries for relevance
  const index = await loadSessionIndex(userId)
  const otherSessions = index.filter(s => s.id !== sessionId).slice(0, 10) // recent 10
  const scored = []
  for (const s of otherSessions) {
    const sum = await kv.get(keys.summary(userId, s.id))
    if (sum?.summary) {
      const score = scoreOverlap(msgKeywords, sum.summary)
      if (score > 0.15) scored.push({ ...s, summary: sum.summary, score })
    }
  }
  scored.sort((a, b) => b.score - a.score)

  for (const s of scored.slice(0, 2)) {
    const priorText = `PRIOR SESSION "${s.title}":\n${s.summary}`
    const tokens = estimateTokens(priorText)
    if (tokenEstimate + tokens <= CONTEXT_TOKEN_BUDGET) {
      sections.push(priorText)
      tokenEstimate += tokens
      sources.push(`priorSummary:${s.id}`)
    }
  }

  // 4. Raw snippets — keyword match against recent session messages
  if (tokenEstimate < CONTEXT_TOKEN_BUDGET - 200) {
    const snippets = await findRelevantSnippets(userId, index.slice(0, 5), msgKeywords, CONTEXT_TOKEN_BUDGET - tokenEstimate)
    if (snippets.length > 0) {
      const snipText = `RELEVANT PRIOR EXCHANGES:\n${snippets.join('\n')}`
      sections.push(snipText)
      tokenEstimate += estimateTokens(snipText)
      sources.push('snippets')
    }
  }

  if (sections.length === 0) return { context: null, sources, tokenEstimate: 0 }

  const context = `═══════════════════════════════════
PRIOR CONTEXT (from memory)
═══════════════════════════════════
${sections.join('\n\n')}
═══════════════════════════════════`

  return { context, sources, tokenEstimate }
}

async function findRelevantSnippets(userId, sessionEntries, keywords, budgetRemaining) {
  const snippets = []
  let used = 0

  for (const entry of sessionEntries) {
    const session = await kv.get(keys.session(userId, entry.id))
    if (!session?.messages) continue

    for (const msg of session.messages.slice(-30)) { // scan last 30 msgs per session
      const score = scoreOverlap(keywords, msg.content)
      if (score > 0.2) {
        const dateStr = entry.updatedAt?.slice(0, 10) || ''
        const prefix = msg.role === 'user' ? 'User' : 'Oracle'
        const snippet = `[${dateStr}] ${prefix}: ${msg.content.slice(0, 200)}`
        const tokens = estimateTokens(snippet)
        if (used + tokens > budgetRemaining) break
        snippets.push(snippet)
        used += tokens
        if (snippets.length >= MAX_SNIPPETS) break
      }
    }
    if (snippets.length >= MAX_SNIPPETS) break
  }
  return snippets
}

// Rough token estimate: ~4 chars per token
function estimateTokens(text) {
  return Math.ceil(text.length / 4)
}
```

- [ ] **Step 4: Commit**

```bash
git add api/lib/oracle-memory.js
git commit -m "feat(oracle-memory): add retrieval decision and context assembly"
```

---

### Task 3: oracle-memory.js — Memory artifact updates (summary + facts extraction)

**Files:**
- Modify: `api/lib/oracle-memory.js`

- [ ] **Step 1: Implement `updateMemoryArtifacts`**

This function makes a model call to generate/update the rolling summary and extract key facts. It's called as a background task after the main response.

```js
export async function updateMemoryArtifacts(userId, sessionId, messages, chatRequestFn) {
  try {
    const currentSummary = await kv.get(keys.summary(userId, sessionId))
    const msgsSinceUpdate = currentSummary
      ? messages.length - (currentSummary.messageCountAtUpdate || 0)
      : messages.length

    // Only update if enough new messages (SUMMARY_INTERVAL)
    if (msgsSinceUpdate < SUMMARY_INTERVAL && currentSummary) return

    // Take recent messages for summarization (last 20)
    const recent = messages.slice(-20).map(m => `${m.role}: ${m.content}`).join('\n')

    const existingFacts = await kv.get(keys.facts(userId)) || []
    const existingFactsList = existingFacts.map(f => f.fact).join('\n')

    const prompt = `Analyze this conversation and return JSON with two fields:

1. "summary": A 2-3 sentence summary of the conversation. Focus on decisions made, plans discussed, and actionable conclusions.
2. "newFacts": An array of short factual statements about key decisions, commitments, preferences, or plans worth remembering across sessions. Only include genuinely important, durable facts.

EXISTING KNOWN FACTS (do NOT repeat these):
${existingFactsList || '(none)'}

CONVERSATION:
${recent}

Return ONLY valid JSON: {"summary": "...", "newFacts": ["...", "..."]}`

    const response = await chatRequestFn([
      { role: 'system', content: 'You are a concise summarizer. Return only valid JSON, no markdown fences.' },
      { role: 'user', content: prompt },
    ])

    const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned)

    // Save summary
    if (parsed.summary) {
      await kv.set(keys.summary(userId, sessionId), {
        summary: parsed.summary,
        updatedAt: new Date().toISOString(),
        messageCountAtUpdate: messages.length,
      })
    }

    // Merge new facts
    if (parsed.newFacts && parsed.newFacts.length > 0) {
      const newEntries = parsed.newFacts.map(fact => ({
        fact,
        sessionId,
        createdAt: new Date().toISOString(),
        category: 'auto',
      }))
      const merged = [...newEntries, ...existingFacts].slice(0, MAX_FACTS)
      await kv.set(keys.facts(userId), merged)
    }

    console.log('[oracle-memory] Artifacts updated', { sessionId, factsCount: existingFacts.length, newFacts: parsed.newFacts?.length || 0 })
  } catch (err) {
    console.error('[oracle-memory] Failed to update artifacts:', err.message)
    // Don't retry — next threshold crossing will trigger a fresh update
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add api/lib/oracle-memory.js
git commit -m "feat(oracle-memory): add summary and fact extraction via model call"
```

---

### Task 4: oracle-sessions.js — CRUD endpoint for frontend sync

**Files:**
- Create: `api/oracle-sessions.js`

- [ ] **Step 1: Create the endpoint**

Follow the same pattern as `api/user-data.js` — import `kv`, `requireAuth`, `setCors`, handle GET/POST/DELETE.

```js
import { requireAuth, setCors } from './_auth.js'
import {
  loadSessionIndex,
  loadSession,
  saveSession,
  deleteSession,
} from './lib/oracle-memory.js'

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const userId = requireAuth(req, res)
  if (!userId) return

  try {
    if (req.method === 'GET') {
      const { sessionId } = req.query
      // If sessionId provided, return full session; otherwise return index
      if (sessionId) {
        const session = await loadSession(userId, sessionId)
        return res.status(200).json(session || { messages: [] })
      }
      const index = await loadSessionIndex(userId)
      return res.status(200).json(index)
    }

    if (req.method === 'POST') {
      const { session } = req.body
      if (!session?.id) return res.status(400).json({ error: 'session.id required' })
      await saveSession(userId, session)
      return res.status(200).json({ success: true })
    }

    if (req.method === 'DELETE') {
      const { sessionId } = req.query
      if (!sessionId) return res.status(400).json({ error: 'sessionId required' })
      await deleteSession(userId, sessionId)
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Oracle sessions error:', error)
    return res.status(500).json({ error: 'Failed to process request', details: error.message })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add api/oracle-sessions.js
git commit -m "feat: add oracle-sessions CRUD endpoint for KV sync"
```

---

### Task 5: Modify unicron-ai.js — Add retrieval and background memory update

**Files:**
- Modify: `api/unicron-ai.js:28-34` (auth capture), `api/unicron-ai.js:51` (destructure sessionId), `api/unicron-ai.js:127-148` (inject retrieval + background update)

- [ ] **Step 1: Capture userId from requireAuth**

In `api/unicron-ai.js`, change line 33:

```js
// Before:
if (!requireAuth(req, res)) return

// After:
const userId = requireAuth(req, res)
if (!userId) return
```

- [ ] **Step 2: Add sessionId to destructuring and import memory module**

At the top of the file, add import:
```js
import { needsRetrieval, retrieveContext, updateMemoryArtifacts } from './lib/oracle-memory.js'
```

Change line 51 from:
```js
const { message, userContext, history } = req.body
```
to:
```js
const { message, userContext, history, sessionId } = req.body
```

- [ ] **Step 3: Add retrieval step before messages assembly**

Insert after line 126 (after `systemPrompt` is fully built), before the messages array construction:

```js
// ── On-demand memory retrieval ──────────────────────────────────
// Note: `isOracle` is already declared at line 59 — reuse it, do NOT redeclare
let memoryLog = { retrievalTriggered: false, sourcesUsed: [], contextTokensApprox: 0 }

if (isOracle && sessionId) {
  const reason = needsRetrieval(message, (history || []).length)
  if (reason) {
    memoryLog.retrievalTriggered = true
    const { context: priorContext, sources, tokenEstimate } = await retrieveContext(userId, sessionId, message)
    memoryLog.sourcesUsed = sources
    memoryLog.contextTokensApprox = tokenEstimate
    if (priorContext) {
      systemPrompt += '\n\n' + priorContext
    }
  }
}
console.log('[oracle-memory]', memoryLog)
```

- [ ] **Step 4: Add background memory artifact update after response**

After the `chatRequest` call and before `return res.status(200).json(...)`, add:

```js
// ── Background memory update ────────────────────────────────────
if (isOracle && sessionId) {
  const allMessages = [
    ...(history || []),
    { role: 'user', content: message },
    { role: 'assistant', content: text },
  ]
  // Use waitUntil if available (Vercel runtime), otherwise fire-and-forget
  const memoryWork = updateMemoryArtifacts(userId, sessionId, allMessages, chatRequest)
    .catch(err => console.error('[oracle-memory] background update failed:', err.message))
  if (typeof globalThis.waitUntil === 'function') {
    globalThis.waitUntil(memoryWork)
  }
}
```

Note: We pass `chatRequest` as the model call function so `updateMemoryArtifacts` can reuse the same API client. `waitUntil()` extends the Vercel function lifetime so the background model call completes after the response is sent. Falls back to fire-and-forget in non-Vercel environments.

- [ ] **Step 5: Commit**

```bash
git add api/unicron-ai.js
git commit -m "feat: wire oracle-memory retrieval and background updates into chat endpoint"
```

---

### Task 6: Modify TheOracle.jsx — KV sync + sessionId in requests

**Files:**
- Modify: `src/components/TheOracle.jsx`

This is the largest frontend change. We add KV sync while keeping localStorage as the fast cache.

- [ ] **Step 1: Add KV sync helper functions at the top of the file (after imports)**

```js
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
```

- [ ] **Step 2: Modify the mount effect to load from KV first, fall back to localStorage**

Replace the existing `useEffect` on mount (lines 164-174):

```js
// ── Load sessions on mount: KV first, localStorage fallback ───────────
useEffect(() => {
  let cancelled = false
  async function init() {
    // Try KV first
    const kvIndex = await kvFetchIndex()
    if (cancelled) return

    if (kvIndex && kvIndex.length > 0) {
      // KV has data — use it as source of truth
      // Build lightweight session objects (messages loaded on select)
      const kvSessions = kvIndex.map(s => ({
        id: s.id,
        title: s.title,
        messages: [], // loaded on demand
        updatedAt: s.updatedAt,
        createdAt: s.createdAt,
        _kvLoaded: false, // flag: messages not yet fetched
      }))
      setSessions(kvSessions)

      // If there was an active session, load its messages
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
      // Fall back to localStorage
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
```

- [ ] **Step 3: Modify `switchSession` to load full session from KV on demand**

Replace the existing `switchSession` callback (lines 201-208):

```js
const switchSession = useCallback(async (id) => {
  const found = sessions.find(s => s.id === id)
  if (!found) return

  setActiveSessionId(id)

  // If messages not loaded from KV yet, fetch them
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
```

- [ ] **Step 4: Modify the messages-save effect to also sync to KV**

Replace the existing save effect (lines 177-186):

```js
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
```

- [ ] **Step 5: Modify `deleteSession` to also delete from KV**

In the existing `deleteSession` callback (line 211-226), add KV delete. After the `saveSessions(...)` call at line 225, add:

```js
kvDeleteSession(id)
```

- [ ] **Step 6: Add `sessionId` to the API request body in `send()`**

In the `send` callback (line 253), modify the body construction to include `sessionId`:

```js
const body = {
  message: msg,
  sessionId: currentSessionId,
  history: messages.slice(-20).map(m => ({ role: m.role, content: m.content })),
  userContext: withContext
    ? buildContext(tradeData, stockData, settings, tone)
    : { personality: 'oracle', tone },
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/TheOracle.jsx
git commit -m "feat: sync Oracle sessions to KV and include sessionId in API calls"
```

---

### Task 7: Add local dev server routes for oracle-sessions

**Files:**
- Modify: `server.js` (add routes near line 1741, before server listen)

The local dev server needs matching routes so the frontend proxy works during development. These don't need KV — they can use a simple in-memory map or just proxy to the same localStorage pattern. But since the local server already uses Gemini instead of Jarvis, and KV requires Upstash credentials, the simplest approach is to add pass-through routes that work with the `.env` KV credentials.

- [ ] **Step 1: Add import at the top of server.js**

Add this import alongside the other imports at the top of `server.js` (after line 12):

```js
import { loadSessionIndex, loadSession, saveSession, deleteSession as delSession } from './api/lib/oracle-memory.js'
```

Note: `oracle-memory.js` imports `@vercel/kv` which reads `KV_REST_API_URL` and `KV_REST_API_TOKEN` from env. If these are not set in `.env`, the KV calls will fail. The routes below handle this gracefully with try/catch fallbacks.

- [ ] **Step 2: Add oracle-sessions routes to server.js**

Insert before the `app.listen()` block (before line 1743):

```js
// ── Oracle session sync (dev server) ────────────────────────────────────────
app.get('/api/oracle-sessions', requireAuth, async (req, res) => {
  try {
    const userId = req.session?.userId?.toString() || 'dev'
    const { sessionId } = req.query
    if (sessionId) {
      const session = await loadSession(userId, sessionId)
      return res.json(session || { messages: [] })
    }
    const index = await loadSessionIndex(userId)
    return res.json(index)
  } catch (err) {
    console.error('Oracle sessions GET error:', err)
    res.json([]) // graceful fallback — frontend uses localStorage
  }
})

app.post('/api/oracle-sessions', requireAuth, async (req, res) => {
  try {
    const userId = req.session?.userId?.toString() || 'dev'
    const { session } = req.body
    if (!session?.id) return res.status(400).json({ error: 'session.id required' })
    await saveSession(userId, session)
    res.json({ success: true })
  } catch (err) {
    console.error('Oracle sessions POST error:', err)
    res.json({ success: false }) // non-fatal — localStorage is primary in dev
  }
})

app.delete('/api/oracle-sessions', requireAuth, async (req, res) => {
  try {
    const userId = req.session?.userId?.toString() || 'dev'
    const { sessionId } = req.query
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' })
    await delSession(userId, sessionId)
    res.json({ success: true })
  } catch (err) {
    console.error('Oracle sessions DELETE error:', err)
    res.json({ success: false })
  }
})
```

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add oracle-sessions dev server routes"
```

---

### Task 8: Dev notes document

**Files:**
- Create: `docs/oracle-memory-dev-notes.md`

- [ ] **Step 1: Write the dev notes**

```markdown
# Oracle Memory — Developer Notes

## Storage Structure (Upstash KV)

| Key Pattern | Value | Purpose |
|---|---|---|
| `user:{uid}:oracle:sessions` | `SessionIndex[]` | Lightweight session list for sidebar |
| `user:{uid}:oracle:session:{sid}` | `Session` | Full session with messages (max 200) |
| `user:{uid}:oracle:summary:{sid}` | `Summary` | Rolling summary, updated every ~4 exchanges |
| `user:{uid}:oracle:facts` | `KeyFact[]` | Cross-session decisions/preferences (max 50) |

## Retrieval Flow

1. User sends message to `/api/unicron-ai` with `sessionId`
2. `needsRetrieval()` checks for pattern matches or new-session condition
3. If triggered, `retrieveContext()` fetches facts > summary > prior summaries > snippets
4. Context block injected into system prompt (max ~1500 tokens)
5. After response, `updateMemoryArtifacts()` runs in background if threshold met

## Tuning

Edit constants at top of `api/lib/oracle-memory.js`:
- `CONTEXT_TOKEN_BUDGET` (default 1500) — max tokens for retrieved context
- `SUMMARY_INTERVAL` (default 4) — messages between summary updates
- `MAX_FACTS` (default 50) — max key facts per user
- `MAX_SNIPPETS` (default 5) — max raw message snippets in context
- `MAX_MESSAGES_KV` (default 200) — max messages stored per session in KV

## Adding Embeddings Later

1. In `updateMemoryArtifacts()`, embed summaries + key messages via an embedding API
2. Store vectors alongside summaries in KV (or migrate to a vector DB)
3. In `retrieveContext()`, replace `scoreOverlap()` with vector similarity search
4. Same interface, same budget — no changes to `unicron-ai.js` or `TheOracle.jsx`

## Debugging

Check Vercel function logs for:
```json
{ "retrievalTriggered": true, "sourcesUsed": ["facts", "currentSummary"], "contextTokensApprox": 820 }
```

Each request logs whether retrieval was triggered, what sources were used, and approximate context size.
```

- [ ] **Step 2: Commit**

```bash
git add docs/oracle-memory-dev-notes.md
git commit -m "docs: add oracle memory developer notes"
```

---

### Task 9: End-to-end smoke test

**Files:** None (manual verification)

- [ ] **Step 1: Start the dev server**

```bash
npm start
```

- [ ] **Step 2: Verify basic chat still works**

Open the app, send a message to The Oracle. Confirm response comes back normally. Check browser console for no errors. Check server logs for `[oracle-memory]` log line.

- [ ] **Step 3: Verify KV sync**

Send a few messages, then check that sessions are being saved. Open a new incognito window, log in, verify sessions load from KV (not localStorage).

- [ ] **Step 4: Verify retrieval triggers**

In a new session, type "what did we discuss last time?" — check server logs to confirm retrieval was triggered and sources were used.

- [ ] **Step 5: Verify memory artifacts**

After 4+ messages in a session, check Vercel logs or KV directly to confirm summary and facts were generated.
