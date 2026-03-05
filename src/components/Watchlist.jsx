import { useState, useEffect, useCallback } from 'react'
import { Bookmark, Plus, Trash2, RefreshCw, AlertTriangle, TrendingUp } from 'lucide-react'
import CompanyLogo from './CompanyLogo'

const WATCHLIST_KEY = 'unicron_watchlist'

const getSentiment = (rating) => {
    if (rating >= 75) return { label: 'Bullish',     bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' }
    if (rating >= 50) return { label: 'Neutral',     bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-400'   }
    return              { label: 'Bearish',     bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    text: 'text-rose-400'    }
}

const getResearchAge = (dateString) => {
    if (!dateString) return null
    const days = Math.floor((new Date() - new Date(dateString)) / (1000 * 60 * 60 * 24))
    if (days === 0) return { label: 'Today', stale: false }
    if (days < 7)   return { label: `${days}d ago`, stale: false }
    if (days < 30)  return { label: `${Math.floor(days / 7)}w ago`, stale: days > 14 }
    return { label: `${Math.floor(days / 30)}mo ago`, stale: true }
}

const formatTime = (date) => {
    if (!date) return null
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function Watchlist({ researchData = [] }) {
    const [watchlist, setWatchlist]     = useState(() => {
        try { return JSON.parse(localStorage.getItem(WATCHLIST_KEY)) || [] }
        catch { return [] }
    })
    const [input, setInput]             = useState('')
    const [prices, setPrices]           = useState({})
    const [loading, setLoading]         = useState(false)
    const [lastUpdated, setLastUpdated] = useState(null)

    const save = (list) => {
        setWatchlist(list)
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list))
    }

    const fetchPrices = useCallback(async (symbols) => {
        if (!symbols || symbols.length === 0) return
        setLoading(true)
        try {
            const res = await fetch('/api/scrape/batch-prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ symbols }),
            })
            if (res.ok) {
                const data = await res.json()
                setPrices(prev => ({ ...prev, ...data }))
                setLastUpdated(new Date())
            }
        } catch (err) {
            console.error('Watchlist price fetch failed:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (watchlist.length > 0) {
            fetchPrices(watchlist.map(w => w.symbol))
        }
    }, []) // eslint-disable-line

    const handleAdd = () => {
        const sym = input.trim().toUpperCase()
        if (!sym) return
        if (watchlist.some(w => w.symbol === sym)) {
            setInput('')
            return
        }
        const updated = [...watchlist, { id: Date.now(), symbol: sym, addedAt: new Date().toISOString() }]
        save(updated)
        setInput('')
        fetchPrices([sym])
    }

    const handleRemove = (id) => {
        save(watchlist.filter(w => w.id !== id))
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                            <Bookmark className="h-4 w-4 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white/90">Watchlist</h3>
                            <p className="text-[11px] text-white/40 mt-0.5">Track tickers with live prices and research ratings</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {lastUpdated && (
                            <span className="text-[11px] text-white/25">Updated {formatTime(lastUpdated)}</span>
                        )}
                        <button
                            onClick={() => fetchPrices(watchlist.map(w => w.symbol))}
                            disabled={loading || watchlist.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-[11px] font-medium rounded-full disabled:opacity-30 transition-all"
                        >
                            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                            Refresh Prices
                        </button>
                    </div>
                </div>

                {/* Add ticker */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        placeholder="Add ticker e.g. NVDA"
                        className="bg-white/[0.06] border border-white/[0.10] rounded-xl px-3 py-2.5 text-sm font-semibold text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all flex-1 max-w-xs uppercase"
                    />
                    <button
                        onClick={handleAdd}
                        disabled={!input.trim()}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Plus className="h-4 w-4" /> Add
                    </button>
                </div>
            </div>

            {/* Empty state */}
            {watchlist.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="p-4 bg-white/[0.04] rounded-2xl mb-4">
                        <Bookmark className="h-8 w-8 text-white/20" />
                    </div>
                    <p className="text-sm font-medium text-white/30">Add a ticker to start watching</p>
                    <p className="text-[11px] text-white/15 mt-1">Live prices + research ratings in one place</p>
                </div>
            )}

            {/* Cards grid */}
            {watchlist.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {watchlist.map(item => {
                        const price     = prices[item.symbol]
                        const research  = researchData.find(r => r.symbol === item.symbol)
                        const sentiment = research ? getSentiment(research.overallRating) : null
                        const age       = research ? getResearchAge(research.date) : null

                        return (
                            <div key={item.id} className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-5 group hover:border-white/[0.12] transition-all">
                                {/* Card header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <CompanyLogo symbol={item.symbol} className="w-10 h-10" />
                                        <div>
                                            <span className="text-lg font-semibold text-white/90">{item.symbol}</span>
                                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                {sentiment ? (
                                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${sentiment.bg} ${sentiment.border} ${sentiment.text}`}>
                                                        {sentiment.label}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/30">
                                                        No Research
                                                    </span>
                                                )}
                                                {age && (
                                                    <span className={`text-[10px] font-medium flex items-center gap-0.5 ${age.stale ? 'text-amber-400' : 'text-white/25'}`}>
                                                        {age.stale && <AlertTriangle className="h-2.5 w-2.5" />}
                                                        {age.label}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemove(item.id)}
                                        className="p-1.5 hover:bg-rose-500/15 text-white/20 hover:text-rose-400 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        title="Remove"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>

                                {/* Price */}
                                <div className="flex items-end justify-between">
                                    <div>
                                        <div className="text-[11px] font-medium text-white/30 mb-1">Current Price</div>
                                        {loading && !price ? (
                                            <div className="h-7 w-20 bg-white/[0.06] rounded-lg animate-pulse" />
                                        ) : (
                                            <div className="text-2xl font-semibold font-mono text-white/85">
                                                {price ? `$${parseFloat(price).toFixed(2)}` : '—'}
                                            </div>
                                        )}
                                    </div>
                                    {research && (
                                        <div className="text-right">
                                            <div className="text-[11px] font-medium text-white/30 mb-1">Research Score</div>
                                            <div className={`text-xl font-semibold font-mono ${sentiment?.text || 'text-white/50'}`}>
                                                {research.overallRating}
                                                <span className="text-sm text-white/30">/100</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default Watchlist
