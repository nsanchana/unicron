# Oracle On-Demand Conversation Memory

**Date:** 2026-04-10
**Status:** Approved

## Problem

The Oracle (frontend chat persona) stores sessions in browser localStorage only. Jarvis/OpenClaw has no access to prior chat history — it only sees the last 20 messages from the current session. This means:
- No cross-device continuity
- No ability to reference prior conversations
- No accumulated knowledge about user preferences or decisions

## Solution

Add an on-demand memory retrieval layer that stores Oracle sessions in Upstash KV (server-authoritative) and selectively retrieves prior context only when the user's message requires it.

## Architecture

### KV Storage Schema

```
user:{userId}:oracle:sessions              → SessionIndex[]
user:{userId}:oracle:session:{sessionId}    → Session
user:{userId}:oracle:summary:{sessionId}    → Summary
user:{userId}:oracle:facts                  → KeyFact[]
```

**Types:**

```
SessionIndex   = { id, title, createdAt, updatedAt, messageCount }
Session        = { id, title, messages: Message[], createdAt, updatedAt }
Message        = { role: 'user'|'assistant', content: string, id: string }
Summary        = { summary: string, updatedAt: string, messageCountAtUpdate: number }
KeyFact        = { fact: string, sessionId: string, createdAt: string, category: string }
```

- Session index is lightweight (no messages) — used for sidebar listing
- Full sessions stored separately to avoid loading all messages for sidebar render
- Summaries stored per session, updated every ~4 exchanges
- Key facts are global per user, capped at 50 entries
- Max 200 messages per session (older messages pruned from storage, preserved in summary)
- The existing `chatHistory` field in `api/user-data.js` is for older company research chat — left as-is, not related to Oracle sessions

### Module Structure

**New files:**

```
api/lib/oracle-memory.js    — all retrieval/storage/extraction logic
api/oracle-sessions.js      — CRUD endpoint for session sync
```

**Modified files:**

```
api/unicron-ai.js           — capture requireAuth return value as userId, add sessionId to destructured body,
                               add retrieval step before model call, memory update after via waitUntil()
src/components/TheOracle.jsx — sync sessions to/from KV, include sessionId in API calls
```

**Implementation note:** `unicron-ai.js` currently discards the `requireAuth()` return value. Must change to `const userId = requireAuth(req, res)` to pass userId into memory functions.

**Request body change:** `TheOracle.jsx` `send()` will add `sessionId` to the existing body shape:
```
{ message, history, userContext, sessionId }
```

### oracle-memory.js — Public API

```
saveSession(userId, session)                    → void
loadSession(userId, sessionId)                  → Session | null
loadSessionIndex(userId)                        → SessionIndex[]
deleteSession(userId, sessionId)                → void
needsRetrieval(message, sessionMessages)        → boolean
retrieveContext(userId, sessionId, message)      → string (context block)
updateMemoryArtifacts(userId, sessionId, msgs)   → void (fire-and-forget)
```

### oracle-sessions.js — REST Endpoint

```
GET  /api/oracle-sessions?userId=X                    → SessionIndex[]
GET  /api/oracle-sessions?userId=X&sessionId=Y        → Session
POST /api/oracle-sessions  { userId, session }         → { success: true }
DELETE /api/oracle-sessions?userId=X&sessionId=Y       → { success: true }
```

All endpoints require auth. userId must match authenticated user. Auth check must handle `req.query.userId` for GET/DELETE and `req.body.userId` for POST.

### Retrieval Decision

`needsRetrieval(message, sessionMessages)` returns true if:

1. **Pattern match:** Message contains phrases like "what did we decide", "earlier", "last time", "continue", "previous", "remember", "you said", "we discussed", references to prior plans/facts/numbers
2. **New session with history:** Current session has 0 messages but user has prior sessions (seed context)
3. **Default:** false — most messages don't need historical context

**Known limitation (v1):** This heuristic is intentionally conservative. It will miss implicit references like "what about that AAPL play?" (referring to a prior session) or "and the second position?" (continuing a cross-session thread). Acceptable tradeoff — false negatives cost a less-informed response, false positives cost unnecessary KV reads and context tokens. Can be improved with embeddings in a future version.

### Retrieval Flow

When `needsRetrieval()` returns true:

1. **Fetch key facts** — `user:{userId}:oracle:facts` — always included (small, high-value)
2. **Fetch current session summary** — if continuing a long conversation
3. **Score other session summaries** — keyword overlap between message and recent session summaries, include top 1-2
4. **Fetch raw snippets** — keyword match against recent sessions, return top 3-5 matching messages (last resort)

### Context Assembly

Retrieved context is injected as a block between the system prompt and conversation history:

```
═══════════════════════════════════
PRIOR CONTEXT (from memory)
═══════════════════════════════════
KEY FACTS:
- User prefers selling CSPs on AAPL at $150 strike
- Decided to avoid TSLA until after earnings

SESSION SUMMARY (current):
Discussion about rolling AAPL positions...

RELEVANT PRIOR EXCHANGES:
[2 Apr] User asked about NVDA exit strategy, Oracle recommended...
═══════════════════════════════════
```

**Budget:** ~1500 tokens max. Priority: facts > current summary > other summaries > raw snippets.

### Memory Artifact Updates

After generating the Oracle response, if the session has 4+ new messages since the last summary update:

1. Make a secondary model call with recent messages → produce updated summary + extract new key facts
2. Write summary and facts to KV
3. Use `waitUntil()` (Vercel runtime) to extend function lifetime for the background model call. Log failures but do not retry — next threshold crossing will trigger a fresh update.
4. Fact extraction prompt includes existing facts list with instruction "Do not repeat facts already known" for deduplication.

**Summary prompt:** "Summarize this conversation in 2-3 sentences. Focus on decisions, plans, and actionable conclusions."

**Fact extraction prompt:** "Extract key decisions, commitments, preferences, or plans from these messages. Return as a JSON array of short factual statements. Only include things worth remembering across sessions."

### Sync Strategy

- **Write path:** Frontend saves to localStorage immediately (instant UI), then POSTs to `/api/oracle-sessions` in background. If network fails, localStorage is still correct.
- **Read path:** On app load, fetch session index from KV. If KV unreachable, fall back to localStorage. On session open, fetch full session from KV, update localStorage.
- **Conflict resolution:** Last-write-wins. KV is authoritative. If localStorage has messages KV doesn't (offline), next save pushes them up.

### Edge Cases

- **Empty/new user:** No sessions, facts, or summaries. Retrieval returns nothing, context block omitted.
- **Long sessions:** Summary keeps context block small. Raw messages only fetched as snippets.
- **KV latency:** Session save is fire-and-forget. Retrieval adds one round-trip before model call — acceptable since model inference dominates latency.
- **Stale summaries:** Tracked by `messageCountAtUpdate`. Regenerated when session has grown. If extraction fails, stale summary used.
- **Max facts:** Capped at 50. Oldest pruned on insert.
- **Session index race:** Two tabs creating sessions simultaneously could lose an index entry (read-modify-write without locking). Low risk — single-user app, last-write-wins is acceptable.
- **Max messages per session:** Capped at 200. Older messages pruned from KV storage but preserved via rolling summary. Frontend can keep full history in localStorage for current session display.

### Logging

`api/unicron-ai.js` logs on each request:

```json
{
  "retrievalTriggered": true,
  "sourcesUsed": ["facts", "currentSummary", "priorSummary:oracle-123"],
  "contextTokensApprox": 820
}
```

Visible in Vercel function logs.

### Extensibility

`retrieveContext()` is the single retrieval entry point. Today it uses keyword/recency scoring. To add embeddings later:
- Add an embedding step in `updateMemoryArtifacts()` (embed summaries + messages)
- Swap the scoring logic inside `retrieveContext()` to use vector similarity
- No other modules change — same interface, same context budget

## What Does NOT Change

- TheOracle UI layout, session management UX, tone toggle, quick prompts
- Portfolio context building (`buildContext()`)
- `api/unicron-ai.js` response format
- Other chat endpoints (`api/chat.js`, `api/trade-chat.js`)
- Personality/identity system prompt logic

## Tuning Parameters

| Parameter | Default | Where |
|-----------|---------|-------|
| Context token budget | ~1500 | `oracle-memory.js` |
| Summary update interval | Every 4 exchanges | `oracle-memory.js` |
| Max key facts per user | 50 | `oracle-memory.js` |
| Max raw snippets returned | 5 | `oracle-memory.js` |
| Max messages per session (KV) | 200 | `oracle-memory.js` |
| Max sessions per user | 50 | `TheOracle.jsx` (unchanged) |
| History sent to model | Last 20 messages | `TheOracle.jsx` (unchanged) |
