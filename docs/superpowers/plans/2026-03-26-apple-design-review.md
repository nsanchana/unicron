# Unicron Apple Design Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Unicron's web and mobile experience to meet Apple HIG standards with adaptive navigation, redesigned Research screen, and a unified design system across all screens.

**Architecture:** Phase 1 builds shared UI primitives (Toast, BottomSheet, SegmentedControl, LargeTitle, SwipeableRow, TabBar). Phase 2 rewrites App.jsx navigation to use a bottom tab bar on mobile and refined sidebar on desktop. Phase 3 splits CompanyResearch into a two-state browsing/reading architecture. Phases 4-6 progressively apply the design system to remaining screens.

**Tech Stack:** React 18, Tailwind CSS 3.4, Vite 5, Lucide React icons. No test framework — verification is `npm run build` + visual inspection.

**Spec:** `docs/superpowers/specs/2026-03-26-apple-design-review-design.md`

---

## Phase 1: Design System Foundation

### Task 1: Tailwind Design Tokens

**Files:**
- Modify: `tailwind.config.js`
- Modify: `src/index.css`

- [ ] **Step 1: Add typography utilities to tailwind.config.js**

Add a `fontSize` extension with the Apple type scale. Replace the current `extend` block's content with:

```js
// Inside theme.extend:
fontSize: {
  'large-title': ['28px', { lineHeight: '34px', fontWeight: '700', letterSpacing: '-0.5px' }],
  'title-1': ['20px', { lineHeight: '25px', fontWeight: '600', letterSpacing: '-0.3px' }],
  'title-2': ['16px', { lineHeight: '21px', fontWeight: '600' }],
  'body': ['14px', { lineHeight: '20px', fontWeight: '400' }],
  'callout': ['13px', { lineHeight: '18px', fontWeight: '500' }],
  'footnote': ['12px', { lineHeight: '16px', fontWeight: '500' }],
  'overline': ['10px', { lineHeight: '14px', fontWeight: '600', letterSpacing: '0.15em' }],
},
```

Keep existing `colors`, `animation`, and `keyframes` blocks intact.

- [ ] **Step 2: Add transition timing to tailwind.config.js**

```js
// Inside theme.extend:
transitionTimingFunction: {
  'spring': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
},
transitionDuration: {
  'enter': '300ms',
  'exit': '200ms',
},
```

- [ ] **Step 3: Add surface utility classes to index.css**

Append after the existing Recharts overrides at the end of `src/index.css`:

```css
/* ─── Surface System ────────────────────────────────────────────────── */
.surface-1 {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
}
.surface-2 {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  -webkit-backdrop-filter: blur(24px);
  backdrop-filter: blur(24px);
}
.surface-3 {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  -webkit-backdrop-filter: blur(40px);
  backdrop-filter: blur(40px);
}

/* ─── Text Opacity Helpers ──────────────────────────────────────────── */
.text-primary   { color: rgba(255,255,255,0.9); }
.text-secondary { color: rgba(255,255,255,0.6); }
.text-tertiary  { color: rgba(255,255,255,0.35); }
.text-disabled  { color: rgba(255,255,255,0.2); }

/* ─── Overline ──────────────────────────────────────────────────────── */
.overline {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: rgba(255,255,255,0.35);
}

/* ─── Safe Area ─────────────────────────────────────────────────────── */
.pb-safe { padding-bottom: env(safe-area-inset-bottom, 0px); }
.pt-safe { padding-top: env(safe-area-inset-top, 0px); }

/* ─── Spring Transition ─────────────────────────────────────────────── */
.transition-spring {
  transition-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
  transition-duration: 300ms;
}
```

- [ ] **Step 4: Verify build**

Run: `cd /c/Projects/unicron && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js src/index.css
git commit -m "feat: add design system tokens — typography scale, surfaces, transitions"
```

---

### Task 2: Toast Notification Component

**Files:**
- Create: `src/components/ui/Toast.jsx`

- [ ] **Step 1: Create the ui directory**

```bash
mkdir -p src/components/ui
```

- [ ] **Step 2: Write Toast.jsx**

```jsx
import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { CheckCircle, AlertTriangle, X, Info } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertTriangle,
  info: Info,
}

const COLORS = {
  success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  error: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
}

function ToastItem({ toast, onDismiss }) {
  const Icon = ICONS[toast.type] || Info

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 3000)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div
      className={`surface-3 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-black/20 animate-slide-in-up ${COLORS[toast.type] || COLORS.info}`}
      style={{ minWidth: 280, maxWidth: 400 }}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="text-sm font-medium flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded-lg hover:bg-white/[0.1] transition-colors flex-shrink-0"
      >
        <X className="h-3.5 w-3.5 opacity-50" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type, duration }])
    if (navigator.vibrate) navigator.vibrate(10)
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const addToast = useContext(ToastContext)
  if (!addToast) throw new Error('useToast must be used within ToastProvider')
  return addToast
}
```

- [ ] **Step 3: Verify build**

Run: `cd /c/Projects/unicron && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Toast.jsx
git commit -m "feat: add Toast notification component with provider and hook"
```

---

### Task 3: BottomSheet Component

**Files:**
- Create: `src/components/ui/BottomSheet.jsx`

- [ ] **Step 1: Write BottomSheet.jsx**

```jsx
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function BottomSheet({ open, onClose, title, children, maxHeight = '85vh' }) {
  const sheetRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative w-full max-w-lg surface-3 rounded-t-2xl animate-slide-in-up pb-safe"
        style={{ maxHeight }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
            <h3 className="text-title-2 text-white">{title}</h3>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/[0.1] transition-colors"
            >
              <X className="h-4 w-4 text-white/40" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: `calc(${maxHeight} - 80px)` }}>
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd /c/Projects/unicron && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/BottomSheet.jsx
git commit -m "feat: add BottomSheet component with backdrop, handle bar, and escape close"
```

---

### Task 4: ConfirmSheet Component

**Files:**
- Create: `src/components/ui/ConfirmSheet.jsx`

- [ ] **Step 1: Write ConfirmSheet.jsx**

```jsx
import BottomSheet from './BottomSheet'

export default function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
}) {
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="40vh">
      <div className="px-6 py-5 space-y-4">
        <div>
          <h3 className="text-title-2 text-white">{title}</h3>
          {message && <p className="text-callout text-secondary mt-1">{message}</p>}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 surface-2 rounded-xl text-sm font-semibold text-secondary hover:text-primary transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${
              destructive
                ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/20'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
```

- [ ] **Step 2: Verify build and commit**

```bash
cd /c/Projects/unicron && npm run build
git add src/components/ui/ConfirmSheet.jsx
git commit -m "feat: add ConfirmSheet component built on BottomSheet"
```

---

### Task 5: SegmentedControl Component

**Files:**
- Create: `src/components/ui/SegmentedControl.jsx`

- [ ] **Step 1: Write SegmentedControl.jsx**

```jsx
import { useRef, useState, useEffect } from 'react'

export default function SegmentedControl({ segments, activeIndex, onChange }) {
  const containerRef = useRef(null)
  const [indicatorStyle, setIndicatorStyle] = useState({})

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const buttons = container.querySelectorAll('[data-segment]')
    const active = buttons[activeIndex]
    if (!active) return

    setIndicatorStyle({
      left: active.offsetLeft,
      width: active.offsetWidth,
    })
  }, [activeIndex])

  return (
    <div
      ref={containerRef}
      className="relative bg-white/[0.06] rounded-xl p-1 flex"
    >
      {/* Sliding indicator */}
      <div
        className="absolute top-1 bottom-1 bg-white/[0.1] rounded-lg transition-spring"
        style={indicatorStyle}
      />

      {segments.map((segment, i) => (
        <button
          key={segment.key || i}
          data-segment
          onClick={() => onChange(i)}
          className={`relative z-10 flex-1 py-2 px-3 text-sm font-semibold text-center transition-colors min-h-[44px] ${
            i === activeIndex ? 'text-white' : 'text-white/35 hover:text-white/60'
          }`}
        >
          {segment.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify build and commit**

```bash
cd /c/Projects/unicron && npm run build
git add src/components/ui/SegmentedControl.jsx
git commit -m "feat: add SegmentedControl with animated sliding indicator"
```

---

### Task 6: LargeTitle Component

**Files:**
- Create: `src/components/ui/LargeTitle.jsx`

- [ ] **Step 1: Write LargeTitle.jsx**

A collapsible large title that shrinks into a compact header on scroll. Uses IntersectionObserver to detect when the large title leaves the viewport.

```jsx
import { useRef, useState, useEffect } from 'react'

export default function LargeTitle({ title, subtitle, children }) {
  const sentinelRef = useRef(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      {/* Compact header bar — appears when large title scrolls out */}
      <div
        className={`sticky top-0 z-30 transition-all duration-exit ease-out ${
          collapsed
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="surface-3 rounded-2xl px-5 py-3 mb-4">
          <h2 className="text-title-2 text-white">{title}</h2>
        </div>
      </div>

      {/* Sentinel element for intersection detection */}
      <div ref={sentinelRef} className="h-0" />

      {/* Large title */}
      <div className="mb-8">
        <h1 className="text-large-title text-white">{title}</h1>
        {subtitle && (
          <p className="text-callout text-secondary mt-1">{subtitle}</p>
        )}
        {children}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify build and commit**

```bash
cd /c/Projects/unicron && npm run build
git add src/components/ui/LargeTitle.jsx
git commit -m "feat: add LargeTitle with scroll-collapse via IntersectionObserver"
```

---

### Task 7: SwipeableRow Component

**Files:**
- Create: `src/components/ui/SwipeableRow.jsx`

- [ ] **Step 1: Write SwipeableRow.jsx**

Touch-enabled swipe-to-reveal actions for list items. Falls back to visible buttons on desktop.

```jsx
import { useRef, useState } from 'react'

export default function SwipeableRow({ children, actions = [], className = '' }) {
  const rowRef = useRef(null)
  const startX = useRef(0)
  const currentX = useRef(0)
  const [offset, setOffset] = useState(0)
  const [swiping, setSwiping] = useState(false)

  const actionWidth = actions.length * 72 // 72px per action button

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX
    currentX.current = startX.current
    setSwiping(true)
  }

  const handleTouchMove = (e) => {
    if (!swiping) return
    currentX.current = e.touches[0].clientX
    const diff = startX.current - currentX.current
    const clamped = Math.max(0, Math.min(diff, actionWidth))
    setOffset(clamped)
  }

  const handleTouchEnd = () => {
    setSwiping(false)
    // Snap open if dragged past halfway, otherwise snap closed
    if (offset > actionWidth / 2) {
      setOffset(actionWidth)
    } else {
      setOffset(0)
    }
  }

  const close = () => setOffset(0)

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Action buttons (behind the row) */}
      <div className="absolute right-0 top-0 bottom-0 flex items-stretch">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => { action.onPress(); close() }}
            className={`w-[72px] flex items-center justify-center text-xs font-semibold ${action.className || 'bg-rose-500 text-white'}`}
          >
            {action.icon && <action.icon className="h-4 w-4" />}
            {!action.icon && action.label}
          </button>
        ))}
      </div>

      {/* Main content (slides left) */}
      <div
        ref={rowRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative z-10 transition-transform"
        style={{
          transform: `translateX(-${offset}px)`,
          transitionDuration: swiping ? '0ms' : '300ms',
          transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build and commit**

```bash
cd /c/Projects/unicron && npm run build
git add src/components/ui/SwipeableRow.jsx
git commit -m "feat: add SwipeableRow with touch swipe-to-reveal actions"
```

---

### Task 8: TabBar Component

**Files:**
- Create: `src/components/ui/TabBar.jsx`

- [ ] **Step 1: Write TabBar.jsx**

iOS-style bottom tab bar with frosted glass, safe area padding, and 44px touch targets.

```jsx
export default function TabBar({ tabs, activeTab, onTabChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="surface-3 border-t border-white/[0.06] flex justify-around items-center px-2 pt-2 pb-safe"
        style={{ minHeight: 56 }}
      >
        {tabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => {
                onTabChange(tab.id)
                if (navigator.vibrate) navigator.vibrate(10)
              }}
              className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] px-2 transition-colors"
            >
              <Icon
                className={`h-[22px] w-[22px] transition-colors ${
                  isActive ? 'text-blue-500' : 'text-white/35'
                }`}
                fill={isActive ? 'currentColor' : 'none'}
                strokeWidth={isActive ? 1.5 : 2}
              />
              <span className={`text-[10px] font-medium ${
                isActive ? 'text-blue-500' : 'text-white/35'
              }`}>
                {tab.shortLabel || tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Verify build and commit**

```bash
cd /c/Projects/unicron && npm run build
git add src/components/ui/TabBar.jsx
git commit -m "feat: add TabBar component — iOS-style bottom tab navigation"
```

---

## ⬛ CHECKPOINT: Phase 1 Complete

Run `npm run build` and `npm run dev`. Open in browser and verify:
- Build succeeds with no errors
- App loads normally (no regressions — new components are not yet integrated)
- New files exist in `src/components/ui/`

---

## Phase 2: Navigation Overhaul

### Task 9: Rewrite App.jsx Navigation

**Files:**
- Modify: `src/App.jsx`

This is the largest single modification. The current App.jsx uses a hamburger sidebar on mobile and a fixed sidebar on desktop. We need to:
1. Replace the hamburger + sidebar with a bottom TabBar on mobile (<768px)
2. Refine the desktop sidebar styling
3. Add a "More" tab that opens a BottomSheet with overflow items (Stocks, Settings)
4. Add content area padding for the tab bar on mobile

- [ ] **Step 1: Update the tabs array**

In `src/App.jsx`, replace the existing `tabs` array (around line 621) with:

```jsx
const primaryTabs = [
  { id: 'dashboard',   label: 'Dashboard',   shortLabel: 'Home',     icon: BarChart3  },
  { id: 'trades',      label: 'Trades',      shortLabel: 'Trades',   icon: TrendingUp },
  { id: 'research',    label: 'Research',     shortLabel: 'Research', icon: Search     },
  { id: 'performance', label: 'Performance',  shortLabel: 'Perf',     icon: TrendingUp },
]

const overflowTabs = [
  { id: 'stocks',      label: 'Stock Portfolio', icon: Briefcase  },
  { id: 'settings',    label: 'Settings',        icon: Settings   },
]

const allTabs = [...primaryTabs, ...overflowTabs]
```

Add `Search` to the lucide-react import at the top of App.jsx.

- [ ] **Step 2: Add "More" tab and BottomSheet state**

Add a `MoreCircle` or `Ellipsis` icon import from lucide-react. Add state:

```jsx
import { MoreHorizontal } from 'lucide-react'
const [moreSheetOpen, setMoreSheetOpen] = useState(false)
```

Create the tab bar tabs with "More":

```jsx
const tabBarTabs = [
  ...primaryTabs,
  { id: '__more', label: 'More', shortLabel: 'More', icon: MoreHorizontal },
]
```

- [ ] **Step 3: Replace the mobile header and sidebar overlay**

Remove: The entire `<header className="md:hidden fixed top-0 ...">` block (mobile top header with hamburger).

Remove: The `{isMobileMenuOpen && <div className="md:hidden fixed inset-0 z-40 ...">` overlay block.

Remove: The `isMobileMenuOpen` state variable and its usage.

- [ ] **Step 4: Add TabBar and BottomSheet imports**

```jsx
import TabBar from './components/ui/TabBar'
import BottomSheet from './components/ui/BottomSheet'
```

- [ ] **Step 5: Rewrite the return JSX layout**

Replace the entire return block. Key structural changes:

```jsx
return (
  <div className="min-h-screen bg-black text-white flex">

    {/* ── Desktop Sidebar (>768px) ──────────────────────────────── */}
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-[#0a0a0f] border-r border-white/[0.06] flex-col z-50">
      {/* Logo — keep existing logo block */}
      {/* Nav items — use allTabs instead of tabs */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {allTabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-spring min-h-[44px] ${
                isActive
                  ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                  : 'text-white/35 hover:text-white/60 hover:bg-white/[0.05] border border-transparent'
              }`}
            >
              <Icon className={`h-4.5 w-4.5 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-white/35'}`} />
              {tab.label}
            </button>
          )
        })}
      </nav>
      {/* Sidebar footer — keep existing sync/refresh/user blocks */}
    </aside>

    {/* ── Mobile Tab Bar (<768px) ───────────────────────────────── */}
    <TabBar
      tabs={tabBarTabs}
      activeTab={overflowTabs.some(t => t.id === activeTab) ? '__more' : activeTab}
      onTabChange={(id) => {
        if (id === '__more') {
          setMoreSheetOpen(true)
        } else {
          handleTabChange(id)
        }
      }}
    />

    {/* ── More Sheet ────────────────────────────────────────────── */}
    <BottomSheet open={moreSheetOpen} onClose={() => setMoreSheetOpen(false)} title="More">
      <div className="px-4 py-2 space-y-1">
        {overflowTabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => { handleTabChange(tab.id); setMoreSheetOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.05] transition-colors min-h-[44px]"
            >
              <Icon className="h-5 w-5 text-white/35" />
              {tab.label}
            </button>
          )
        })}
      </div>
    </BottomSheet>

    {/* ── Main Content ──────────────────────────────────────────── */}
    <main className="flex-1 md:ml-64 min-h-screen">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-8 pb-24 md:pb-8">
        {/* Render active tab content — keep existing conditional rendering */}
        {activeTab === 'dashboard' && ( /* ... existing Dashboard render ... */ )}
        {/* ... remaining tabs ... */}
      </div>
    </main>
  </div>
)
```

The key differences from current:
- Mobile top header removed — TabBar replaces it
- `pb-24` on main content (mobile) to account for tab bar height
- `md:ml-64` pushes content right on desktop for sidebar
- `max-w-[1200px]` constrains content width on large screens
- No more `isMobileMenuOpen` state or hamburger toggle

**iPad Landscape (768-1024px) — Collapsible Rail:**

The desktop sidebar should collapse to a 56px icon-only rail on medium screens (768-1024px) and expand on hover. Update the sidebar `<aside>` to handle this:

```jsx
<aside className="hidden md:flex fixed left-0 top-0 h-full bg-[#0a0a0f] border-r border-white/[0.06] flex-col z-50 transition-all duration-enter ease-spring group/sidebar
  w-[56px] lg:w-64 hover:w-64"
>
```

For nav labels, hide them on the rail and show on expand:
```jsx
<span className="hidden lg:inline group-hover/sidebar:inline transition-opacity">{tab.label}</span>
```

For the logo section, show only the icon on the rail:
```jsx
<div className="w-10 h-10 lg:w-16 lg:h-16 group-hover/sidebar:w-16 group-hover/sidebar:h-16 rounded-2xl overflow-hidden ...">
```

- [ ] **Step 6: Verify build**

Run: `cd /c/Projects/unicron && npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Manual test — desktop**

Run: `npm run dev`, open http://localhost:3000 in a wide browser window (>1024px).
Verify: Sidebar visible on left, all 6 tabs listed, clicking switches content, no visual regressions.

- [ ] **Step 8: Manual test — mobile**

Open browser DevTools, toggle device toolbar, select iPhone 14 Pro.
Verify: Bottom tab bar visible, 5 items (Home, Trades, Research, Perf, More), "More" opens sheet with Stocks and Settings.

- [ ] **Step 9: Commit**

```bash
git add src/App.jsx
git commit -m "feat: replace hamburger navigation with iOS tab bar on mobile + refined sidebar on desktop"
```

---

## ⬛ CHECKPOINT: Phase 2 Complete

Test across iPhone, iPad (768px), and desktop (1024px+) viewports:
- Tab bar appears only on mobile (<768px)
- Sidebar appears only on desktop (>768px)
- "More" sheet opens with overflow items
- All tab content renders correctly
- No horizontal overflow or layout breaks

---

## Phase 3: Company Research Redesign

### Task 10: ResearchCard Component

**Files:**
- Create: `src/components/ResearchCard.jsx`

- [ ] **Step 1: Write ResearchCard.jsx**

Extract the card from CompanyResearch.jsx into its own component. This renders a single tracked company card with adaptive layout (list on mobile, card on desktop).

```jsx
import { ExternalLink, RefreshCw, Search, Star, AlertTriangle, Trash2 } from 'lucide-react'
import CompanyLogo from './CompanyLogo'
import SwipeableRow from './ui/SwipeableRow'

const getSentiment = (rating) => {
  if (rating >= 75) return { label: 'Bullish', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' }
  if (rating >= 50) return { label: 'Neutral', bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' }
  return { label: 'Bearish', bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400' }
}

const formatRelativeDate = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return '1d ago'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

export default function ResearchCard({
  symbol, research, livePrice, storedPrice, priceSource,
  onView, onRerun, onDelete, onRunResearch
}) {
  const sentiment = research ? getSentiment(research.overallRating) : null
  const researchAge = research ? formatRelativeDate(research.date) : null
  const isStale = research ? Math.floor((new Date() - new Date(research.date)) / (1000 * 60 * 60 * 24)) > 14 : false

  let targetPrice = research?.technicalAnalysis?.targetPrice ||
    research?.technicalAnalysis?.metrics?.find(m => m.label === 'Target Price')?.value
  if (targetPrice) targetPrice = targetPrice.replace(/,\s*$/, '').trim()

  const fmtPrice = (p) => !p ? null : (p.startsWith('$') ? p : `$${p}`)
  const fmtTarget = fmtPrice(targetPrice)

  let upsidePercent = null
  if (livePrice && targetPrice) {
    const target = parseFloat(targetPrice.replace(/[$,]/g, ''))
    if (!isNaN(target) && livePrice > 0) {
      upsidePercent = ((target - livePrice) / livePrice * 100).toFixed(1)
    }
  }

  const earningsDate = research?.recentDevelopments?.detailedDevelopments?.nextEarningsCall?.date ||
    research?.recentDevelopments?.metrics?.find(m => m.label === 'Next Earnings' || m.label === 'Earnings Date')?.value

  const swipeActions = [
    ...(research ? [{ label: '↻', className: 'bg-blue-500 text-white', onPress: () => onRerun(symbol) }] : []),
    { icon: Trash2, className: 'bg-rose-500 text-white', onPress: () => onDelete(symbol) },
  ]

  const cardContent = (
    <div className={`surface-2 rounded-2xl p-4 flex flex-col gap-3 hover:border-white/[0.14] transition-spring ${
      sentiment ? sentiment.border : 'border-white/[0.08]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CompanyLogo symbol={symbol} className="w-10 h-10" />
          <div>
            <span className="text-title-2 text-primary">{symbol}</span>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {sentiment ? (
                <span className={`text-overline px-1.5 py-0.5 rounded-lg ${sentiment.bg} ${sentiment.border} ${sentiment.text}`}>
                  {sentiment.label}
                </span>
              ) : (
                <span className="text-overline px-1.5 py-0.5 rounded-lg surface-1 text-disabled">No Research</span>
              )}
              {researchAge && (
                <span className={`text-footnote flex items-center gap-0.5 ${isStale ? 'text-amber-400' : 'text-tertiary'}`}>
                  {isStale && <AlertTriangle className="h-2.5 w-2.5" />}
                  {researchAge}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Price */}
        <div className="text-right">
          <div className={`text-xl font-bold font-mono ${livePrice ? 'text-primary' : 'text-tertiary'}`}>
            {livePrice ? `$${parseFloat(livePrice).toFixed(2)}` : storedPrice ? `$${parseFloat(storedPrice.replace(/[$,]/g, '')).toFixed(2)}` : '—'}
          </div>
          {research && (
            <div className={`text-footnote font-bold font-mono ${sentiment?.text || 'text-tertiary'}`}>
              {research.overallRating}<span className="text-disabled">/100</span>
            </div>
          )}
        </div>
      </div>

      {/* Section scores */}
      {research && (
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: 'Company',   score: research.companyAnalysis?.rating },
            { label: 'Financial', score: research.financialHealth?.rating },
            { label: 'Technical', score: research.technicalAnalysis?.rating },
            { label: 'Events',    score: research.recentDevelopments?.rating },
          ].map(({ label, score }) => (
            <div key={label} className="flex flex-col items-center p-1.5 surface-1 rounded-lg">
              <div className="text-overline mb-0.5">{label}</div>
              <div className={`text-footnote font-semibold ${!score ? 'text-disabled' : score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                {score || '—'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Target + Upside */}
      {fmtTarget && (
        <div className="flex items-center justify-between px-3 py-2 surface-1 rounded-xl">
          <div>
            <div className="text-overline mb-0.5">Analyst Target</div>
            <div className="text-sm font-semibold font-mono text-blue-400">{fmtTarget}</div>
          </div>
          {upsidePercent !== null && (
            <div className={`text-sm font-bold ${parseFloat(upsidePercent) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {parseFloat(upsidePercent) >= 0 ? '+' : ''}{upsidePercent}%
            </div>
          )}
        </div>
      )}

      {/* Earnings */}
      {earningsDate && (
        <div className="text-footnote text-amber-400/80 flex items-center gap-1">
          <Star className="h-3 w-3" /> Next earnings: {earningsDate}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        {research ? (
          <>
            <button onClick={() => onView(research)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 surface-1 rounded-xl text-footnote font-semibold text-secondary hover:text-primary transition-spring min-h-[44px]">
              <ExternalLink className="h-3.5 w-3.5" /> View Report
            </button>
            <button onClick={() => onRerun(symbol)}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-xl text-footnote font-semibold transition-spring min-h-[44px]"
              title="Re-run Research">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button onClick={() => onRunResearch(symbol)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-footnote font-semibold transition-spring min-h-[44px]">
            <Search className="h-3.5 w-3.5" /> Run Research
          </button>
        )}
      </div>
    </div>
  )

  return (
    <SwipeableRow actions={swipeActions}>
      {cardContent}
    </SwipeableRow>
  )
}
```

- [ ] **Step 2: Verify build and commit**

```bash
cd /c/Projects/unicron && npm run build
git add src/components/ResearchCard.jsx
git commit -m "feat: add ResearchCard — extracted, Apple-styled research card with swipe actions"
```

---

### Task 11: ResearchReport Component

**Files:**
- Create: `src/components/ResearchReport.jsx`

- [ ] **Step 1: Write ResearchReport.jsx**

This is the report detail view with segmented control, replacing the stacked accordions. Extract the section rendering logic from CompanyResearch.jsx.

The component should:
- Accept `companyData`, `onBack`, `onSave`, `onOpenChat` as props
- Render the company header with score and section pills
- Use SegmentedControl to switch between Company/Financial/Technical/Events
- Render only the active section's content

Due to the size of this component (it must replicate all the section rendering from CompanyResearch.jsx lines 628-894), this step requires:

1. Copy the `renderSection`, `renderDetailedSubsection`, `getRatingColor`, `getRatingIcon` functions from CompanyResearch.jsx
2. Replace the 4 stacked `renderSection()` calls with a single active section controlled by the SegmentedControl
3. Remove the inline chat accordion — replaced by the floating FAB

```jsx
import { useState } from 'react'
import { ChevronLeft, Save, CheckCircle, Star, AlertTriangle } from 'lucide-react'
import SegmentedControl from './ui/SegmentedControl'
import CompanyLogo from './CompanyLogo'

const SECTIONS = [
  { key: 'companyAnalysis',      label: 'Company' },
  { key: 'financialHealth',      label: 'Financial' },
  { key: 'technicalAnalysis',    label: 'Technical' },
  { key: 'recentDevelopments',   label: 'Events' },
]

// Copy getRatingColor, getRatingIcon, renderDetailedSubsection, and
// the full renderSection function from CompanyResearch.jsx (lines 612-894).
// Modify renderSection to NOT use expandedSections/toggleSection — always show expanded.
// This keeps all the existing rendering logic intact while removing the accordion pattern.

export default function ResearchReport({ companyData, onBack, onSave, onOpenChat }) {
  const [activeSection, setActiveSection] = useState(0)

  if (!companyData) return null

  const currentKey = SECTIONS[activeSection].key
  const currentData = companyData[currentKey]
  const currentRating = currentData?.rating

  // ... paste getRatingColor, getRatingIcon, renderDetailedSubsection here
  // ... paste renderSection here (modified to always be expanded, no toggle)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header card */}
      <div className="surface-2 rounded-2xl overflow-hidden">
        <div className={`h-0.5 ${companyData.overallRating >= 75 ? 'bg-gradient-to-r from-emerald-500 to-transparent' : companyData.overallRating >= 50 ? 'bg-gradient-to-r from-amber-500 to-transparent' : 'bg-gradient-to-r from-rose-500 to-transparent'}`} />
        <div className="p-5">
          {/* Back + actions */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={onBack} className="flex items-center gap-1.5 text-footnote text-tertiary hover:text-secondary transition-colors group min-h-[44px]">
              <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
              Research
            </button>
            {!companyData.saved ? (
              <button onClick={onSave} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold transition-spring min-h-[44px]">
                <Save className="h-3.5 w-3.5" /> Save Report
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-medium">
                <CheckCircle className="h-3.5 w-3.5" /> Saved
              </div>
            )}
          </div>

          {/* Symbol + score */}
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <CompanyLogo symbol={companyData.symbol} className="w-12 h-12" textSize="text-sm" />
                <div>
                  <h2 className="text-title-1 text-primary">{companyData.symbol}</h2>
                  <p className="text-footnote text-tertiary mt-0.5">Full Intelligence Report</p>
                </div>
              </div>
              {/* Section score pills */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {SECTIONS.map(({ key, label }) => {
                  const score = companyData[key]?.rating
                  if (!score) return null
                  return (
                    <div key={key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-footnote font-medium ${
                      score >= 70 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      score >= 50 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                      'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                      <span className="text-tertiary">{label}</span>
                      <span className="font-semibold">{score}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className={`text-3xl sm:text-5xl font-semibold font-mono ${
                companyData.overallRating >= 75 ? 'text-emerald-400' :
                companyData.overallRating >= 50 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {companyData.overallRating}
              </div>
              <div className="text-overline mt-0.5">Overall Score</div>
            </div>
          </div>
        </div>
      </div>

      {/* Segmented control */}
      <SegmentedControl
        segments={SECTIONS.map(s => ({ key: s.key, label: s.label }))}
        activeIndex={activeSection}
        onChange={setActiveSection}
      />

      {/* Active section content */}
      <div className="animate-fade-in">
        {renderSection(SECTIONS[activeSection].label, currentKey, currentData, currentRating)}
      </div>

      {/* Floating chat FAB */}
      <button
        onClick={onOpenChat}
        className="fixed bottom-24 md:bottom-8 right-6 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-spring z-40"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
    </div>
  )
}
```

**Important implementation note:** The `renderSection` function body should be copied from CompanyResearch.jsx lines 644-894, but modified to:
- Remove the `toggleSection` button wrapper (always expanded)
- Remove `expandedSections` checks
- Use design system classes (`surface-2`, `rounded-2xl`, `text-primary`, etc.)
- Replace `rounded-[20px]` with `rounded-2xl`

- [ ] **Step 2: Verify build and commit**

```bash
cd /c/Projects/unicron && npm run build
git add src/components/ResearchReport.jsx
git commit -m "feat: add ResearchReport with segmented control replacing stacked accordions"
```

---

### Task 12: ChatSheet Component

**Files:**
- Create: `src/components/ChatSheet.jsx`

- [ ] **Step 1: Write ChatSheet.jsx**

Extract the chat UI from CompanyResearch.jsx into a BottomSheet-based component.

```jsx
import { useState, useRef, useEffect } from 'react'
import { Send, Loader, User } from 'lucide-react'
import BottomSheet from './ui/BottomSheet'
import { authHeaders } from '../utils/auth.js'

export default function ChatSheet({ open, onClose, companyData, chatMessages, setChatMessages, researchData, setResearchData }) {
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
```

- [ ] **Step 2: Verify build and commit**

```bash
cd /c/Projects/unicron && npm run build
git add src/components/ChatSheet.jsx
git commit -m "feat: add ChatSheet — research chat in a bottom sheet"
```

---

### Task 13: Rewrite CompanyResearch.jsx

**Files:**
- Modify: `src/components/CompanyResearch.jsx`

This is the most complex task. CompanyResearch.jsx needs to be rewritten to:
1. Use ResearchCard for the card grid
2. Use ResearchReport for the detail view
3. Use ChatSheet for the floating chat
4. Use LargeTitle for the page header
5. Apply design system tokens throughout

- [ ] **Step 1: Add imports**

Replace existing imports at the top with:

```jsx
import { authHeaders } from '../utils/auth.js'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Loader2, RefreshCw, Plus, AlertTriangle, Trash2, CheckCircle, Bookmark } from 'lucide-react'
import { scrapeCompanyData } from '../services/webScraping'
import { fetchPrices as yahooFetchPrices } from '../services/priceService'
import { COMPANY_RESEARCH_VERSION } from '../config'
import { saveToLocalStorage, STORAGE_KEYS } from '../utils/storage'
import LargeTitle from './ui/LargeTitle'
import ResearchCard from './ResearchCard'
import ResearchReport from './ResearchReport'
import ChatSheet from './ChatSheet'
import { useToast } from './ui/Toast'
```

- [ ] **Step 2: Replace alert() calls with useToast**

At the top of the component function, add:
```jsx
const toast = useToast()
```

Replace all `alert(...)` calls:
- `alert(\`Research for ${companyData.symbol} saved successfully!\`)` → `toast(\`Research for ${companyData.symbol} saved\`, 'success')`
- `alert(\`Research for ${companyData.symbol} updated successfully!\`)` → `toast(\`Research for ${companyData.symbol} updated\`, 'success')`

Replace all `window.confirm(...)` calls with state-driven ConfirmSheet usage (or simplify to direct action with toast confirmation where the confirm was unnecessary).

- [ ] **Step 3: Add chat sheet state**

```jsx
const [chatSheetOpen, setChatSheetOpen] = useState(false)
```

- [ ] **Step 4: Rewrite the return JSX**

Replace the entire `return (...)` block. The new structure:

```jsx
return (
  <div className="space-y-6 pb-12">
    {/* Show report detail OR watchlist grid */}
    {companyData ? (
      <>
        <ResearchReport
          companyData={companyData}
          onBack={() => setCompanyData(null)}
          onSave={handleSaveResearch}
          onOpenChat={() => setChatSheetOpen(true)}
        />
        <ChatSheet
          open={chatSheetOpen}
          onClose={() => setChatSheetOpen(false)}
          companyData={companyData}
          chatMessages={chatMessages}
          setChatMessages={setChatMessages}
          researchData={researchData}
          setResearchData={setResearchData}
        />
      </>
    ) : (
      <>
        <LargeTitle title="Research" subtitle="Deep-dive analysis and ratings for your watchlist.">
          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex gap-3 mt-4">
            <div className="flex-1 relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-tertiary group-focus-within:text-blue-400 transition-colors" />
              </div>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="Search ticker..."
                className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl pl-12 pr-4 py-3 text-body text-white placeholder:text-disabled focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
              />
            </div>
            <button type="submit" disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl transition-spring shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2 min-h-[44px]">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              <span className="hidden sm:inline">{loading ? 'Analyzing' : 'Research'}</span>
            </button>
          </form>
        </LargeTitle>

        {/* Loading progress (keep existing progress bar, update styling) */}
        {loading && (
          /* ... existing loading progress UI with design system tokens ... */
        )}

        {/* Sort chips */}
        {allTrackedSymbols.length > 0 && (
          <div className="space-y-4">
            {/* Tracked Companies header + add watchlist input */}
            <div className="surface-2 rounded-2xl p-4">
              {/* ... keep existing header/controls with design system classes ... */}

              {/* Sort pills */}
              <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-0.5">
                {/* ... existing sort pills with min-h-[44px] added ... */}
              </div>
            </div>

            {/* Research Queue (keep existing, update styling) */}

            {/* Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {unifiedCards.map(({ symbol: sym, research: item, watchItem, livePrice, storedPrice, priceSource }) => (
                <ResearchCard
                  key={sym}
                  symbol={sym}
                  research={item}
                  livePrice={livePrice}
                  storedPrice={storedPrice}
                  priceSource={priceSource}
                  onView={handleViewResearch}
                  onRerun={handleRerunResearch}
                  onDelete={handleRemoveFromWatch}
                  onRunResearch={(s) => { setSymbol(s); handleSearch(null, s) }}
                />
              ))}
            </div>
          </div>
        )}
      </>
    )}
  </div>
)
```

- [ ] **Step 5: Remove dead code**

Remove from CompanyResearch.jsx:
- `renderSection` function (moved to ResearchReport)
- `renderDetailedSubsection` function (moved to ResearchReport)
- `getRatingColor`, `getRatingIcon` (moved to ResearchReport)
- `expandedSections` state and `toggleSection` function
- `chatOpen` state and inline chat JSX
- The old card rendering JSX (replaced by ResearchCard)

- [ ] **Step 6: Verify build**

Run: `cd /c/Projects/unicron && npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Manual test**

Run: `npm run dev`
- Verify Research tab shows large title + search + card grid
- Verify clicking a card opens the report with segmented control
- Verify the floating chat button opens the ChatSheet
- Verify swipe actions work on mobile (DevTools touch simulation)
- Verify back button returns to grid

- [ ] **Step 8: Commit**

```bash
git add src/components/CompanyResearch.jsx
git commit -m "feat: rewrite CompanyResearch — two-state architecture with segmented report and chat sheet"
```

---

### Task 14: Wrap App in ToastProvider

**Files:**
- Modify: `src/main.jsx`

- [ ] **Step 1: Add ToastProvider to main.jsx**

```jsx
import { ToastProvider } from './components/ui/Toast'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
)
```

- [ ] **Step 2: Verify build and commit**

```bash
cd /c/Projects/unicron && npm run build
git add src/main.jsx
git commit -m "feat: wrap App in ToastProvider for global toast notifications"
```

---

## ⬛ CHECKPOINT: Phase 3 Complete

Full verification:
- Research tab: card grid with swipe actions, sort pills, search
- Tap card → report with segmented control (Company/Financial/Technical/Events)
- Floating chat FAB → bottom sheet chat
- Back button returns to grid
- No `alert()` or `window.confirm()` calls in Research flow
- All corner radii use design system tokens
- Build succeeds with no errors

---

## Phase 4: Dashboard + Performance Polish

### Task 15: Dashboard Token Migration

**Files:**
- Modify: `src/components/Dashboard.jsx`

- [ ] **Step 1: Find-and-replace corner radii**

Replace throughout `Dashboard.jsx`:
- `rounded-[20px]` → `rounded-2xl`
- `rounded-[28px]` → `rounded-2xl`
- `bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08]` → `surface-2`
- `bg-white/[0.04]` inner cards → `surface-1` (remove the class, add `className="surface-1"`)

- [ ] **Step 2: Add LargeTitle**

Import LargeTitle and replace the existing header:

```jsx
import LargeTitle from './ui/LargeTitle'
```

Replace the existing `<header>` block with:
```jsx
<LargeTitle title="Dashboard" />
```

- [ ] **Step 3: Standardize text opacity**

Replace throughout:
- `text-white/85` → `text-primary`
- `text-white/70` → `text-secondary`
- `text-white/50` → `text-secondary`
- `text-white/40` → `text-tertiary`
- `text-white/30` → `text-tertiary`
- `text-white/25` → `text-disabled`
- `text-white/20` → `text-disabled`

Replace overline labels:
- `text-[10px] font-black tracking-[0.2em] text-white/50 uppercase` → `overline`

- [ ] **Step 4: Verify build, manual check, commit**

```bash
cd /c/Projects/unicron && npm run build
git add src/components/Dashboard.jsx
git commit -m "polish: Dashboard — migrate to design system tokens, add LargeTitle"
```

---

### Task 16: Performance Token Migration

**Files:**
- Modify: `src/components/Performance.jsx`

- [ ] **Step 1: Same token migration as Dashboard**

Apply the same find-and-replace patterns:
- Corner radii: `rounded-[28px]` → `rounded-2xl`, `rounded-[20px]` → `rounded-2xl`
- Surfaces: glass patterns → `surface-1`, `surface-2`
- Text opacity: standardize to 4 levels
- Add LargeTitle

- [ ] **Step 2: Replace year/month selector with SegmentedControl**

Import SegmentedControl and replace the current year/month button row with:

```jsx
import SegmentedControl from './ui/SegmentedControl'

// For year selection:
<SegmentedControl
  segments={availableYears.map(y => ({ key: y, label: String(y) }))}
  activeIndex={availableYears.indexOf(selectedYear)}
  onChange={(i) => setSelectedYear(availableYears[i])}
/>
```

- [ ] **Step 3: Verify build, manual check, commit**

```bash
cd /c/Projects/unicron && npm run build
git add src/components/Performance.jsx
git commit -m "polish: Performance — design system tokens, SegmentedControl for date selector"
```

---

## ⬛ CHECKPOINT: Phase 4 Complete

Verify Dashboard and Performance look consistent with the new design system. All cards use `surface-2`, typography is standardized, Large Titles collapse on scroll.

---

## Phase 5: Trades + Stock Portfolio

### Task 17: TradeReview Token Migration + Sheet Modal

**Files:**
- Modify: `src/components/TradeReview.jsx`

- [ ] **Step 1: Token migration**

Apply standard find-and-replace:
- Corner radii normalization
- Surface class migration
- Text opacity standardization
- Add LargeTitle "Trades"

- [ ] **Step 2: Wrap trade entry form in BottomSheet**

Add state: `const [formSheetOpen, setFormSheetOpen] = useState(false)`

Move the trade entry form JSX into:
```jsx
<BottomSheet open={formSheetOpen} onClose={() => setFormSheetOpen(false)} title="New Trade" maxHeight="90vh">
  {/* existing form content */}
</BottomSheet>
```

Add a "New Trade" button to trigger the sheet:
```jsx
<button onClick={() => setFormSheetOpen(true)}
  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2.5 rounded-xl transition-spring flex items-center gap-2 min-h-[44px]">
  <Plus className="h-4 w-4" /> New Trade
</button>
```

- [ ] **Step 3: Replace confirm() calls with ConfirmSheet**

Import ConfirmSheet and add state for delete/close confirmations:
```jsx
const [confirmAction, setConfirmAction] = useState(null)
```

Replace `window.confirm(...)` patterns with:
```jsx
<ConfirmSheet
  open={!!confirmAction}
  onClose={() => setConfirmAction(null)}
  onConfirm={() => confirmAction?.action()}
  title={confirmAction?.title}
  message={confirmAction?.message}
  confirmLabel={confirmAction?.label}
  destructive={confirmAction?.destructive}
/>
```

- [ ] **Step 4: Verify build, manual check, commit**

```bash
cd /c/Projects/unicron && npm run build
git add src/components/TradeReview.jsx
git commit -m "polish: Trades — design tokens, form in BottomSheet, ConfirmSheet for deletions"
```

---

### Task 18: StockPortfolio Token Migration

**Files:**
- Modify: `src/components/StockPortfolio.jsx`

- [ ] **Step 1: Token migration + LargeTitle**

Standard migration: corner radii, surfaces, text opacity, LargeTitle.

- [ ] **Step 2: Replace confirm() with ConfirmSheet**

Same pattern as TradeReview Task 17 Step 3.

- [ ] **Step 3: Verify build and commit**

```bash
cd /c/Projects/unicron && npm run build
git add src/components/StockPortfolio.jsx
git commit -m "polish: Stock Portfolio — design tokens, ConfirmSheet for deletions"
```

---

## ⬛ CHECKPOINT: Phase 5 Complete

Test Trades and Stock Portfolio on mobile and desktop. Verify:
- Trade form opens as bottom sheet on mobile
- Delete confirmations use ConfirmSheet not browser dialogs
- All visual tokens standardized

---

## Phase 6: Settings + Login + Chat

### Task 19: Settings Redesign

**Files:**
- Modify: `src/components/SettingsPanel.jsx`

- [ ] **Step 1: Restructure layout to iOS Settings pattern**

Replace the current 3-column grid layout with a single-column grouped list:

```jsx
<LargeTitle title="Settings" />

{/* Account section */}
<div className="surface-2 rounded-2xl overflow-hidden">
  <div className="overline px-4 pt-4 pb-2">Account</div>
  <SettingsRow label="Username" value={user.username} />
  <SettingsRow label="Theme" trailing={<ThemeToggle />} />
</div>

{/* Portfolio Rules section */}
<div className="surface-2 rounded-2xl overflow-hidden mt-6">
  <div className="overline px-4 pt-4 pb-2">Portfolio Rules</div>
  <SettingsRow label="Portfolio Size" value={`$${settings.portfolioSize.toLocaleString()}`} onTap={...} />
  {/* ... */}
</div>
```

Create a `SettingsRow` helper inside the file:
```jsx
function SettingsRow({ label, value, trailing, onTap }) {
  return (
    <button onClick={onTap}
      className="w-full flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03] transition-colors min-h-[44px]">
      <span className="text-body text-primary">{label}</span>
      <div className="flex items-center gap-2">
        {value && <span className="text-callout text-tertiary">{value}</span>}
        {trailing}
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Replace alert() with toast**

```jsx
const toast = useToast()
// Replace alert('Data imported successfully!') → toast('Data imported successfully', 'success')
// Replace alert('Invalid import data') → toast('Invalid import data', 'error')
```

- [ ] **Step 3: Verify build and commit**

```bash
cd /c/Projects/unicron && npm run build
git add src/components/SettingsPanel.jsx
git commit -m "redesign: Settings — iOS Settings pattern with grouped rows"
```

---

### Task 20: Login Polish

**Files:**
- Modify: `src/components/Login.jsx`

- [ ] **Step 1: Token migration**

- `rounded-[28px]` → `rounded-2xl`
- `rounded-[22px]` → `rounded-2xl`
- Surface classes, text opacity standardization
- Ensure card is centered: `min-h-screen flex items-center justify-center` (already done)

- [ ] **Step 2: Verify build and commit**

```bash
cd /c/Projects/unicron && npm run build
git add src/components/Login.jsx
git commit -m "polish: Login — design system tokens, standardized radii"
```

---

### Task 21: PortfolioChat + UnicronAI Polish

**Files:**
- Modify: `src/components/PortfolioChat.jsx`
- Modify: `src/components/UnicronAI.jsx`

- [ ] **Step 1: Token migration for both files**

Standard migration on both:
- Corner radii: `rounded-[20px]` → `rounded-2xl`, `rounded-[18px]` → `rounded-2xl`
- Surface classes
- Text opacity
- Add LargeTitle (UnicronAI)

- [ ] **Step 2: Standardize chat bubble styling**

In both files, update message bubbles to use consistent Apple Messages style:
- User: `bg-blue-500/20 border border-blue-500/20 rounded-2xl rounded-br-sm`
- AI: `surface-1 rounded-2xl rounded-bl-sm`
- Minimum bubble padding: `px-4 py-2.5`

- [ ] **Step 3: Replace confirm() calls with ConfirmSheet**

Both files use `confirm()` for clearing/deleting sessions. Replace with ConfirmSheet pattern.

- [ ] **Step 4: Verify build and commit**

```bash
cd /c/Projects/unicron && npm run build
git add src/components/PortfolioChat.jsx src/components/UnicronAI.jsx
git commit -m "polish: Chat components — design tokens, Messages-style bubbles, ConfirmSheet"
```

---

### Task 22: Global Cleanup — Remove Stale Patterns

**Files:**
- All modified component files

- [ ] **Step 1: Search for remaining non-standard patterns**

```bash
cd /c/Projects/unicron
# Find remaining non-standard corner radii
grep -rn 'rounded-\[' src/components/ --include='*.jsx'
# Find remaining alert/confirm calls
grep -rn 'alert(' src/components/ --include='*.jsx'
grep -rn 'window.confirm' src/components/ --include='*.jsx'
# Find remaining non-standard text opacity
grep -rn 'text-white/85\|text-white/70\|text-white/25' src/components/ --include='*.jsx'
# Find remaining green-* that should be emerald-*
grep -rn 'green-' src/components/ --include='*.jsx'
```

- [ ] **Step 2: Fix any remaining instances**

Replace any remaining `rounded-[Npx]` with the nearest standard token.
Replace any remaining `alert()`/`confirm()` with toast/ConfirmSheet.
Replace any remaining non-standard opacity with the 4-level system.
Replace any remaining `green-400`/`green-500`/`green-600` with `emerald-400`/`emerald-500`/`emerald-600`.

- [ ] **Step 3: Verify build and commit**

```bash
cd /c/Projects/unicron && npm run build
git add -A src/components/
git commit -m "chore: remove all non-standard design patterns — final cleanup pass"
```

---

## ⬛ CHECKPOINT: Phase 6 Complete — Full Implementation Done

Final verification checklist:
- [ ] `npm run build` succeeds
- [ ] Desktop (>1024px): sidebar navigation, all screens render
- [ ] iPad landscape (768-1024px): sidebar visible
- [ ] iPhone (<768px): bottom tab bar, "More" sheet works
- [ ] Research: card grid → segmented report → floating chat
- [ ] No browser `alert()` or `confirm()` calls anywhere
- [ ] Consistent corner radii (8/12/16px only)
- [ ] Consistent text opacity (0.9/0.6/0.35/0.2 only)
- [ ] Consistent surface levels (surface-1/2/3)
- [ ] All interactive elements ≥ 44px touch target
- [ ] `.gitignore` includes `.superpowers/` (if not already)
