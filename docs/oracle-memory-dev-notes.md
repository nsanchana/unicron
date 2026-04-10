# Oracle Memory — Developer Notes

## Storage Structure (Upstash KV)

| Key Pattern | Value | Purpose |
|---|---|---|
| `user:{uid}:oracle:sessions` | `SessionIndex[]` | Lightweight session list for sidebar |
| `user:{uid}:oracle:session:{sid}` | `Session` | Full session with messages (max 200) |
| `user:{uid}:oracle:summary:{sid}` | `string` | Rolling summary, updated every ~4 exchanges |
| `user:{uid}:oracle:summary:{sid}:lastCount` | `number` | Message count at last summary update |
| `user:{uid}:oracle:facts` | `string[]` | Cross-session decisions/preferences (max 50) |

## Retrieval Flow

1. User sends message to `/api/unicron-ai` with `sessionId`
2. `needsRetrieval()` checks for pattern matches or new-session condition
3. If triggered, `retrieveContext()` fetches in priority order:
   - Key facts (always included, small/high-value)
   - Current session summary
   - Top 2 scored prior session summaries (keyword overlap > 0.15)
   - Up to 5 raw message snippets (keyword overlap > 0.2)
4. Context block injected into system prompt (max ~1500 tokens)
5. After response, `updateMemoryArtifacts()` runs in background if threshold met (4+ new messages)

## Tuning

Edit constants at top of `api/lib/oracle-memory.js`:

| Constant | Default | Description |
|---|---|---|
| `CONTEXT_TOKEN_BUDGET` | 1500 | Max tokens for retrieved context |
| `SUMMARY_INTERVAL` | 4 | Messages between summary updates |
| `MAX_FACTS` | 50 | Max key facts per user |
| `MAX_SNIPPETS` | 5 | Max raw message snippets in context |
| `MAX_MESSAGES_KV` | 200 | Max messages stored per session in KV |

## Sync Strategy

- **Write path:** Frontend saves to localStorage immediately, then POSTs to `/api/oracle-sessions` in background (fire-and-forget)
- **Read path:** On mount, fetch session index from KV. Falls back to localStorage if KV unreachable. Sessions loaded on-demand when selected.
- **Conflict resolution:** Last-write-wins. KV is authoritative.

## Adding Embeddings Later

1. In `updateMemoryArtifacts()`, embed summaries + key messages via an embedding API
2. Store vectors alongside summaries in KV (or migrate to a vector DB)
3. In `retrieveContext()`, replace `scoreOverlap()` with vector similarity search
4. Same interface, same budget — no changes to `unicron-ai.js` or `TheOracle.jsx`

## Debugging

Check Vercel function logs for `[oracle-memory]` entries:
```json
{ "retrievalTriggered": true, "sourcesUsed": ["key_facts", "summary:oracle-123"], "contextTokensApprox": 820 }
```

Background update logs:
```
[oracle-memory] Artifacts updated { sessionId: "oracle-123", factsCount: 5, newFacts: 2 }
```

Failures are logged but never thrown (fire-and-forget pattern).
