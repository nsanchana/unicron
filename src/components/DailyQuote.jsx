import { useState } from 'react'
import { Quote, RefreshCw } from 'lucide-react'
import { INVESTOR_QUOTES, getDailyQuote } from '../data/investorQuotes'

export default function DailyQuote() {
  const [quoteIndex, setQuoteIndex] = useState(() => {
    const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
    return dayIndex % INVESTOR_QUOTES.length
  })

  const quote = INVESTOR_QUOTES[quoteIndex]

  const shuffle = () => {
    let next
    do { next = Math.floor(Math.random() * INVESTOR_QUOTES.length) } while (next === quoteIndex)
    setQuoteIndex(next)
  }

  return (
    <div className="relative bg-gradient-to-br from-violet-500/[0.07] to-indigo-500/[0.04] backdrop-blur-2xl border border-violet-500/[0.15] rounded-2xl p-5 overflow-hidden">
      {/* Subtle glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/[0.06] rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-start gap-4">
        {/* Quote icon */}
        <div className="flex-shrink-0 mt-0.5 p-2 bg-violet-500/10 rounded-xl">
          <Quote className="h-4 w-4 text-violet-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/80 leading-relaxed italic">
            &ldquo;{quote.quote}&rdquo;
          </p>
          <p className="mt-2 text-xs font-semibold text-violet-400/80 tracking-wide">
            — {quote.author}
          </p>
        </div>

        {/* Shuffle button */}
        <button
          onClick={shuffle}
          title="Another quote"
          className="flex-shrink-0 p-1.5 text-white/20 hover:text-violet-400 transition-colors rounded-lg hover:bg-violet-500/10"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
