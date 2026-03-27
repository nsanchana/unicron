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
    <div className={`bg-[#0a0a0f] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3 hover:border-white/[0.14] transition-spring ${
      sentiment ? sentiment.border : ''
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
              <div className="text-overline mb-0.5" style={{ fontSize: '9px' }}>{label}</div>
              <div className={`text-footnote font-semibold ${!score ? 'text-disabled' : score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                {score || '—'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Target + Upside */}
      {fmtTarget && (
        <div className="flex items-center justify-between px-3 py-2 bg-white/[0.03] rounded-xl">
          <div>
            <div className="overline" style={{ marginBottom: 2 }}>Analyst Target</div>
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
