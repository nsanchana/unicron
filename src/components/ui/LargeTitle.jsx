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

      <div ref={sentinelRef} className="h-0" />

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
