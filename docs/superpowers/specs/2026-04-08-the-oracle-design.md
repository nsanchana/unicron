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

Two-panel design, dark theme with gold accents:

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
  - Tone toggle (Brief / Detailed)

### Session Management

Storage: localStorage key `oracle_sessions`

```json
{
  "sessions": [
    {
      "id": "uuid",
      "title": "First message truncated to 40 chars",
      "messages": [
        { "role": "user", "content": "..." },
        { "role": "assistant", "content": "..." }
      ],
      "createdAt": "ISO timestamp",
      "updatedAt": "ISO timestamp"
    }
  ],
  "activeSessionId": "uuid"
}
```

Behavior:
- Page load: restore last active session, or show empty state
- "New Chat": create session with empty messages, assign ID on first send
- Auto-title: first user message becomes session title (truncated to ~40 chars)
- Switching sessions: save current, load selected
- Delete: remove from storage, switch to most recent remaining or empty state

### Context Behavior

- Quick prompt buttons that need portfolio data call `buildContext()` (ported from PortfolioChat) and attach `userContext` to the API request
- Free-text messages send without portfolio context
- Context-requiring prompts: portfolio health, open positions, best symbols, worst trades, roll candidates, assignment risk, strategy insights, expiring soon
- API endpoint: `POST /api/unicron-ai` with `{ message, userContext (optional), history }`

### Props from App.jsx

TheOracle receives: `tradeData`, `stockData`, `settings` — used only by `buildContext()` when quick prompts are clicked.

## Navigation Changes

In `App.jsx`:
- Add `oracle` tab to the tab system
- Position in sidebar: just above Settings
- Icon: suitable Lucide icon (e.g., `Brain`, `Sparkles`, or `MessageCircle`)
- Label: "The Oracle"
- Add to mobile TabBar and hamburger menu

## Removals

1. **Dashboard.jsx**: Remove `DailyInsights` import and rendering
2. **Performance.jsx**: Remove `PortfolioChat` import and rendering
3. **Delete files**:
   - `src/components/UnicronAI.jsx` (unused)
   - `src/components/DailyInsights.jsx` (replaced by Oracle)
   - `src/components/PortfolioChat.jsx` (replaced by Oracle)

## Mobile Behavior

- Sidebar hidden by default, toggled via hamburger icon in the Oracle header
- Chat area takes full width
- Quick prompt buttons scroll horizontally
- Input bar fixed at bottom

## API

No API changes needed. The Oracle uses the existing `POST /api/unicron-ai` endpoint with the same request/response format.

## Dependencies

- `react-markdown` + `remark-gfm` (already in project)
- `lucide-react` icons (already in project)
- `uuid` or `crypto.randomUUID()` for session IDs

## Out of Scope

- Server-side session persistence (stays in localStorage)
- Streaming responses
- Voice input (can be added later)
