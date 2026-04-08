# The Oracle — Design Spec

## Summary

Replace the scattered AI chat surfaces (PortfolioChat on Performance, DailyInsights on Dashboard, unused UnicronAI component) with a single dedicated page called "The Oracle." ChatGPT-style session management, Warren Buffett personality, portfolio context fetched on-demand only.

## Motivation

- AI chat is buried at the bottom of the Performance page
- Dashboard insights are a separate, disconnected surface
- No way to revisit past conversations
- Consolidating into one page makes the AI a first-class feature

## Architecture

### Single component: `src/components/TheOracle.jsx`

Self-contained page component following existing codebase patterns. Owns layout, session management, message rendering, and API calls.

### Layout

Two-panel design, dark theme with gold accents. TheOracle renders outside the normal `max-w-[1200px]` main wrapper — it gets its own full-width container so the two-panel layout isn't constrained.

**Left panel (~280px) — Session sidebar:**
- "New Chat" button at top (gold accent)
- Session list sorted by most recent
- Each entry: title (truncated ~40 chars) + relative timestamp
- Active session highlighted with gold border/background
- Delete button (X) on hover per session
- Collapses to drawer on mobile

**Right panel (flex) — Chat area:**
- Header: "The Oracle" branding with Warren Buffett-themed tagline
- Scrollable message area:
  - User messages: right-aligned, dark background
  - Oracle responses: left-aligned, rendered with ReactMarkdown + GFM
- Quick prompt buttons row (above input):
  - Portfolio health, Open positions, Best symbols, Worst trades
  - Roll candidates, Assignment risk, Strategy insights, Expiring soon
- Input bar at bottom:
  - Text input with send button
  - Tone toggle (Brief / Detailed) next to the send button

**Empty state (no sessions or new chat):**
- Centered "The Oracle" branding with Buffett-themed welcome message
- Quick prompt buttons displayed prominently as conversation starters
- Brief description: "Your personal Warren Buffett-style trading advisor"

### Personality

The frontend prepends a personality instruction to the system prompt context. When sending messages, TheOracle includes a `personality` field in `userContext`:

```js
userContext: {
  personality: 'oracle', // signals Buffett mode
  tone: 'brief' | 'detailed',
  // ...portfolio fields when context-requiring prompts are used
}
```

The API (`api/unicron-ai.js`) checks for `userContext.personality === 'oracle'` and swaps the system prompt personality block from "Unicron AI — confident, professional, slightly futuristic" to:

> "You are The Oracle — a wise, patient trading advisor channeling Warren Buffett's investment philosophy. You speak with folksy wisdom, use memorable analogies, and always emphasize long-term value, margin of safety, and disciplined risk management. You occasionally quote Buffett and Munger. You are direct but warm, and you never rush to action — you'd rather do nothing than do something foolish."

This is a small, backward-compatible API change — existing callers without `personality: 'oracle'` get the current Unicron AI persona unchanged.

### Session Management

Storage: localStorage key `oracle_sessions`

```json
{
  "sessions": [
    {
      "id": "oracle-1712345678901",
      "title": "First message truncated to 40 chars",
      "messages": [
        { "role": "user", "content": "..." },
        { "role": "assistant", "content": "..." }
      ],
      "createdAt": "ISO timestamp",
      "updatedAt": "ISO timestamp"
    }
  ],
  "activeSessionId": "oracle-1712345678901"
}
```

Session IDs use `oracle-${Date.now()}` pattern, consistent with existing `pc-${Date.now()}` pattern in the codebase. No new dependencies needed.

Behavior:
- Page load: restore last active session, or show empty state
- "New Chat": create session with empty messages, assign ID on first send
- Auto-title: first user message becomes session title (truncated to ~40 chars)
- Switching sessions: save current, load selected
- Delete: remove from storage, switch to most recent remaining or empty state
- Max 50 sessions stored. When exceeding, oldest session is pruned automatically.

### Context Behavior

- Quick prompt buttons that need portfolio data call `buildContext()` (ported from PortfolioChat) and attach `userContext` to the API request
- Free-text messages send without portfolio context
- Context-requiring prompts: portfolio health, open positions, best symbols, worst trades, roll candidates, assignment risk, strategy insights, expiring soon
- API endpoint: `POST /api/unicron-ai` with `{ message, userContext (optional), history }`

### Props from App.jsx

TheOracle receives: `tradeData`, `stockData`, `settings` — used only by `buildContext()` when quick prompts are clicked.

## Navigation Changes

In `App.jsx`:
- Add `oracle` tab to `overflowTabs` array, positioned between `stocks` and `settings`
- Icon: `Brain` from Lucide React
- Label: "The Oracle"
- Add to mobile hamburger menu drawer
- Do NOT add to mobile bottom TabBar (full-page layout doesn't suit the small tab bar)

## Removals

1. **Dashboard.jsx**: Remove `DailyInsights` import and rendering
2. **Performance.jsx**: Remove `PortfolioChat` import and rendering
3. **App.jsx**: Remove `chatHistory` state, `handleUpdateChatHistory`, and related `saveToCloud` calls for chat history (TheOracle manages its own sessions in localStorage)
4. **Delete files**:
   - `src/components/UnicronAI.jsx` (unused)
   - `src/components/DailyInsights.jsx` (replaced by Oracle)
   - `src/components/PortfolioChat.jsx` (replaced by Oracle)

## Mobile Behavior

- Sidebar hidden by default, toggled via hamburger icon in the Oracle header
- Chat area takes full width
- Quick prompt buttons scroll horizontally
- Input bar fixed at bottom

## API Changes

Small backward-compatible change to `api/unicron-ai.js`:
- Check `userContext.personality === 'oracle'` in the main chat handler
- If true, replace the personality section of the system prompt with the Buffett persona
- Default behavior (no personality field) remains unchanged for any other callers

Server-side cleanup (optional, low priority):
- The `mode: 'daily-insights'` handler in `api/unicron-ai.js` becomes dead code after removing DailyInsights. Can be removed or left for later.

## Dependencies

- `react-markdown` + `remark-gfm` (already in project)
- `lucide-react` icons (already in project)
- No new dependencies needed

## Out of Scope

- Server-side session persistence (stays in localStorage)
- Streaming responses
- Voice input (can be added later)
- Cloud sync of Oracle sessions (existing cloud sync for old chatHistory will be removed)
