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
