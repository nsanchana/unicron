import { useRef, useState } from 'react'

export default function SwipeableRow({ children, actions = [], className = '' }) {
  const startX = useRef(0)
  const currentX = useRef(0)
  const [offset, setOffset] = useState(0)
  const [swiping, setSwiping] = useState(false)

  const actionWidth = actions.length * 72

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
    if (offset > actionWidth / 2) {
      setOffset(actionWidth)
    } else {
      setOffset(0)
    }
  }

  const close = () => setOffset(0)

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
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
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative z-10"
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
