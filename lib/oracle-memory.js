import { kv } from '@vercel/kv'

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_FACTS            = 50
export const MAX_MESSAGES_KV      = 200
export const MAX_SNIPPETS         = 5
export const SUMMARY_INTERVAL     = 4
export const CONTEXT_TOKEN_BUDGET = 1500

// ─── KV key helpers ───────────────────────────────────────────────────────────

const keys = {
    sessionIndex: (uid)       => `user:${uid}:oracle:sessions`,
    session:      (uid, sid)  => `user:${uid}:oracle:session:${sid}`,
    summary:      (uid, sid)  => `user:${uid}:oracle:summary:${sid}`,
    facts:        (uid)       => `user:${uid}:oracle:facts`,
}

// ─── Session CRUD ─────────────────────────────────────────────────────────────

/**
 * Load the session index for a user.
 * @param {string} userId
 * @returns {Promise<Array>} SessionIndex[]
 */
export async function loadSessionIndex(userId) {
    const index = await kv.get(keys.sessionIndex(userId))
    return Array.isArray(index) ? index : []
}

/**
 * Save a session to KV and update the session index.
 * Prunes messages to MAX_MESSAGES_KV and limits index to 50 sessions.
 * @param {string} userId
 * @param {{ id: string, title?: string, createdAt?: string|number, updatedAt?: string|number, messages: Array }} session
 */
export async function saveSession(userId, session) {
    // Prune messages
    const pruned = {
        ...session,
        messages: (session.messages || []).slice(-MAX_MESSAGES_KV),
    }

    await kv.set(keys.session(userId, session.id), pruned)

    // Update index
    let index = await loadSessionIndex(userId)

    const meta = {
        id:        session.id,
        title:     session.title || 'Untitled Session',
        createdAt: session.createdAt || Date.now(),
        updatedAt: Date.now(),
        messageCount: pruned.messages.length,
    }

    const existingIdx = index.findIndex(s => s.id === session.id)
    if (existingIdx >= 0) {
        index[existingIdx] = meta
    } else {
        index.unshift(meta)
        // Cap at 50 sessions — drop oldest
        if (index.length > 50) {
            index = index.slice(0, 50)
        }
    }

    // Keep newest sessions first
    index.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))

    await kv.set(keys.sessionIndex(userId), index)
}

/**
 * Load a single full session from KV.
 * @param {string} userId
 * @param {string} sessionId
 * @returns {Promise<object|null>}
 */
export async function loadSession(userId, sessionId) {
    const session = await kv.get(keys.session(userId, sessionId))
    return session || null
}

/**
 * Delete a session and its summary from KV, and update the index.
 * @param {string} userId
 * @param {string} sessionId
 */
export async function deleteSession(userId, sessionId) {
    await Promise.all([
        kv.del(keys.session(userId, sessionId)),
        kv.del(keys.summary(userId, sessionId)),
    ])

    const index = await loadSessionIndex(userId)
    const updated = index.filter(s => s.id !== sessionId)
    await kv.set(keys.sessionIndex(userId), updated)
}

// ─── Retrieval decision ───────────────────────────────────────────────────────

const RETRIEVAL_PATTERNS = [
    /\bearlier\b/i,
    /\blast time\b/i,
    /\bremember\b/i,
    /\byou said\b/i,
    /\bwe decided\b/i,
    /\bcontinue\b/i,
    /\bprevious (chat|session|conversation|discussion)\b/i,
    /\bbefore\b/i,
    /\bwe talked\b/i,
    /\bwe discussed\b/i,
    /\byou mentioned\b/i,
    /\blast (session|chat|time|week)\b/i,
    /\bpick up where\b/i,
    /\bfollow.?up\b/i,
    /\bwhat did (we|you|i)\b/i,
    /\bdo you recall\b/i,
    /\bif i recall\b/i,
    /\bas we (discussed|agreed|said)\b/i,
]

/**
 * Decide if cross-session retrieval is needed.
 * @param {string} message
 * @param {number} sessionMessageCount
 * @returns {'new_session' | 'pattern_match' | false}
 */
export function needsRetrieval(message, sessionMessageCount) {
    // New session hint — retrieveContext handles empty KV gracefully (returns null)
    if (sessionMessageCount === 0) return 'new_session'

    for (const pattern of RETRIEVAL_PATTERNS) {
        if (pattern.test(message)) return 'pattern_match'
    }

    return false
}

// ─── Keyword scoring helpers (private) ────────────────────────────────────────

const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'can', 'shall', 'not', 'no', 'nor', 'so', 'yet', 'both', 'either',
    'neither', 'each', 'more', 'most', 'other', 'some', 'such', 'than',
    'too', 'very', 'just', 'as', 'if', 'then', 'that', 'this', 'these',
    'those', 'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your',
    'he', 'she', 'they', 'them', 'their', 'what', 'which', 'who', 'whom',
    'how', 'when', 'where', 'why', 'all', 'any', 'few', 'also', 'get',
    'got', 'get', 'like', 'know', 'think', 'want', 'need', 'make', 'made',
])

/**
 * Extract meaningful keywords from text.
 * @param {string} text
 * @returns {string[]}
 */
function extractKeywords(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

/**
 * Score keyword overlap ratio against a body of text.
 * @param {string[]} keywords
 * @param {string} text
 * @returns {number} ratio 0–1
 */
function scoreOverlap(keywords, text) {
    if (!keywords.length || !text) return 0
    const lower = text.toLowerCase()
    const hits = keywords.filter(kw => lower.includes(kw)).length
    return hits / keywords.length
}

/**
 * Rough token estimate: 1 token ≈ 4 characters.
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
    return Math.ceil((text || '').length / 4)
}

// ─── Raw snippet retrieval (private) ─────────────────────────────────────────

/**
 * Scan recent sessions for raw message snippets matching the query keywords.
 * Checks the last 30 messages of up to 5 recent sessions (excluding current).
 * @param {string} userId
 * @param {string} currentSessionId
 * @param {string[]} keywords
 * @returns {Promise<Array<{text: string, sessionId: string, role: string}>>}
 */
async function findRelevantSnippets(userId, currentSessionId, keywords) {
    const index = await loadSessionIndex(userId)
    const otherSessions = index.filter(s => s.id !== currentSessionId).slice(0, 5)

    const results = []

    for (const meta of otherSessions) {
        const session = await loadSession(userId, meta.id)
        if (!session || !Array.isArray(session.messages)) continue

        const recentMessages = session.messages.slice(-30)

        for (const msg of recentMessages) {
            if (!msg.content || msg.role === 'system') continue
            const score = scoreOverlap(keywords, msg.content)
            if (score >= 0.2) {
                results.push({
                    text:      msg.content.slice(0, 400), // keep snippets concise
                    sessionId: meta.id,
                    role:      msg.role,
                    score,
                })
            }
        }
    }

    // Return top MAX_SNIPPETS by score
    return results
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_SNIPPETS)
}

// ─── Context retrieval ────────────────────────────────────────────────────────

/**
 * Retrieve relevant context for the given message from KV memory.
 * Priority: key facts → current session summary → other session summaries → raw snippets
 * @param {string} userId
 * @param {string} sessionId
 * @param {string} message
 * @returns {Promise<{ context: string|null, sources: string[], tokenEstimate: number }>}
 */
export async function retrieveContext(userId, sessionId, message) {
    const keywords = extractKeywords(message)
    const sections = []
    const sources  = []
    let tokensUsed = 0

    // 1. Key facts
    const facts = await kv.get(keys.facts(userId))
    if (Array.isArray(facts) && facts.length > 0) {
        const factsText = facts.join('\n')
        const t = estimateTokens(factsText)
        if (tokensUsed + t <= CONTEXT_TOKEN_BUDGET) {
            sections.push(`KEY FACTS ABOUT YOU\n${factsText}`)
            sources.push('key_facts')
            tokensUsed += t
        }
    }

    // 2. Current session summary
    const currentSummary = await kv.get(keys.summary(userId, sessionId))
    if (currentSummary) {
        const t = estimateTokens(currentSummary)
        if (tokensUsed + t <= CONTEXT_TOKEN_BUDGET) {
            sections.push(`CURRENT SESSION SUMMARY\n${currentSummary}`)
            sources.push(`summary:${sessionId}`)
            tokensUsed += t
        }
    }

    // 3. Other session summaries (scored, top 2)
    const index = await loadSessionIndex(userId)
    const otherSessions = index.filter(s => s.id !== sessionId).slice(0, 10)

    const scoredSummaries = []
    for (const meta of otherSessions) {
        const summary = await kv.get(keys.summary(userId, meta.id))
        if (!summary) continue
        const score = scoreOverlap(keywords, summary)
        if (score >= 0.15) {
            scoredSummaries.push({ summary, sessionId: meta.id, score, title: meta.title })
        }
    }
    scoredSummaries.sort((a, b) => b.score - a.score)

    for (const item of scoredSummaries.slice(0, 2)) {
        const label   = `PAST SESSION: "${item.title}"`
        const content = `${label}\n${item.summary}`
        const t       = estimateTokens(content)
        if (tokensUsed + t > CONTEXT_TOKEN_BUDGET) break
        sections.push(content)
        sources.push(`summary:${item.sessionId}`)
        tokensUsed += t
    }

    // 4. Raw message snippets (if budget remains)
    if (tokensUsed < CONTEXT_TOKEN_BUDGET && keywords.length > 0) {
        const snippets = await findRelevantSnippets(userId, sessionId, keywords)
        if (snippets.length > 0) {
            const snippetLines = snippets.map(s =>
                `[${s.role === 'assistant' ? 'Oracle' : 'You'}]: ${s.text}`
            )
            const content = `RELEVANT PAST MESSAGES\n${snippetLines.join('\n\n')}`
            const t = estimateTokens(content)
            if (tokensUsed + t <= CONTEXT_TOKEN_BUDGET) {
                sections.push(content)
                sources.push('snippets')
                tokensUsed += t
            }
        }
    }

    if (sections.length === 0) {
        return { context: null, sources: [], tokenEstimate: 0 }
    }

    const context = [
        '═══════════════════════════════════',
        'ORACLE MEMORY (from past sessions)',
        '═══════════════════════════════════',
        sections.join('\n\n───────────────────────────────────\n\n'),
        '═══════════════════════════════════',
    ].join('\n')

    return { context, sources, tokenEstimate: tokensUsed }
}

// ─── Memory artifact updates ──────────────────────────────────────────────────

/**
 * Fire-and-forget: generate/update a session summary and extract key facts.
 * Only runs when enough new messages have accumulated (SUMMARY_INTERVAL).
 * @param {string} userId
 * @param {string} sessionId
 * @param {Array<{role: string, content: string}>} messages
 * @param {function(Array): Promise<string>} chatRequestFn  — same signature as chatRequest() in unicron-ai.js
 */
export async function updateMemoryArtifacts(userId, sessionId, messages, chatRequestFn) {
    try {
        // Determine when we last ran an update
        const existing = await kv.get(keys.summary(userId, sessionId))
        // Store the message count at last update inside the summary object if we wrap it,
        // but to keep it simple we track via a lightweight metadata key embedded in the summary sentinel.
        // We use a side-channel key for the count.
        const countKey  = `${keys.summary(userId, sessionId)}:lastCount`
        const lastCount = (await kv.get(countKey)) || 0

        if (messages.length - lastCount < SUMMARY_INTERVAL) return

        // Build a summarisation prompt
        const conversationText = messages
            .filter(m => m.role !== 'system')
            .slice(-20) // limit to recent messages to avoid exceeding model context
            .map(m => `${m.role === 'assistant' ? 'Oracle' : 'User'}: ${m.content}`)
            .join('\n\n')

        const existingFacts = (await kv.get(keys.facts(userId))) || []

        const prompt = [
            {
                role: 'system',
                content: `You are a memory extraction assistant for an AI trading advisor called The Oracle.
Your job is to read a conversation and return a JSON object with two fields:

1. "summary" — a concise 3–6 sentence summary of the key topics, decisions, and insights from the conversation.
2. "newFacts" — an array of short, standalone fact strings about the user's trading habits, preferences, portfolio, or goals that are worth remembering long-term. Each fact must be unique vs. the existing facts list below. Limit to 10 new facts maximum. Return an empty array if nothing new stands out.

EXISTING FACTS (do not duplicate these):
${existingFacts.length > 0 ? existingFacts.join('\n') : '(none yet)'}

Return ONLY valid JSON — no markdown fences, no extra commentary.
Example: {"summary": "...", "newFacts": ["User prefers 30-DTE CSPs", "User avoids earnings plays"]}`,
            },
            {
                role: 'user',
                content: `Here is the conversation to summarise:\n\n${conversationText}`,
            },
        ]

        const raw = await chatRequestFn(prompt)

        let parsed
        try {
            const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
            parsed = JSON.parse(cleaned)
        } catch {
            console.error('[oracle-memory] Failed to parse memory artifact JSON:', raw)
            return
        }

        const { summary, newFacts } = parsed

        // Save summary
        if (summary && typeof summary === 'string') {
            await kv.set(keys.summary(userId, sessionId), summary)
        }

        // Merge and deduplicate facts
        if (Array.isArray(newFacts) && newFacts.length > 0) {
            const merged = [...existingFacts]
            for (const fact of newFacts) {
                const factStr = String(fact).trim()
                if (!factStr) continue
                // Simple dedup: skip if a very similar fact already exists
                const isDuplicate = merged.some(
                    existing => scoreOverlap(extractKeywords(factStr), existing) > 0.6
                )
                if (!isDuplicate) {
                    merged.push(factStr)
                }
            }
            // Cap at MAX_FACTS
            const capped = merged.slice(-MAX_FACTS)
            await kv.set(keys.facts(userId), capped)
        }

        // Record the message count at this update
        await kv.set(countKey, messages.length)

    } catch (err) {
        console.error('[oracle-memory] updateMemoryArtifacts error:', err)
        // Never throw — this is fire-and-forget
    }
}
