import { useState, useMemo, useEffect } from 'react'
import { Plus, Trash2, RefreshCw, Briefcase, Search, X, Edit2 } from 'lucide-react'
import CompanyLogo from './CompanyLogo'
import { fetchPrices } from '../services/priceService'
import EarningsBadge from "./EarningsBadge"
import LargeTitle from './ui/LargeTitle'
import { fetchEarningsDates } from "../services/earningsService"

const STATUS_OPTS = ['All', 'Active', 'Closed']
const PNL_OPTS    = ['All', 'Winners', 'Losers']
const YEAR_OPTS   = ['All', '2024', '2025', '2026']

function FilterPills({ label, options, value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-white/30 font-medium uppercase tracking-wider mr-0.5">{label}</span>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
            value === opt
              ? 'bg-white/20 border-white/25 text-white shadow-sm'
              : 'bg-white/[0.04] border-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.08]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function StockPortfolio({ stockData, onUpdate }) {
  const [loading, setLoading]           = useState(false)
  const [statusFilter, setStatusFilter] = useState('All')
  const [pnlFilter, setPnlFilter]       = useState('All')
  const [yearFilter, setYearFilter]     = useState('All')
  const [symbolSearch, setSymbolSearch] = useState('')
  const [earningsDates, setEarningsDates] = useState({})
  const [editingRowId, setEditingRowId] = useState(null)

  useEffect(() => {
    const activeSymbols = stockData
      .filter(s => !isClosed(s))
      .map(s => s.symbol)
      .filter(Boolean)
    if (activeSymbols.length === 0) return
    const unique = [...new Set(activeSymbols.map(s => s.toUpperCase()))]
    fetchEarningsDates(unique).then(dates => setEarningsDates(dates))
  }, [stockData])

  const handleEditClick = (id) => setEditingRowId(id)
  const handleCancelEdit = () => setEditingRowId(null)
  const handleSaveEdit = () => setEditingRowId(null)

  const isClosed = (item) => !!item.soldPrice && parseFloat(item.soldPrice) > 0

  const handleAddRow = () => {
    const id = Date.now()
    const newStock = {
      id,
      dateAssigned: new Date().toISOString().split('T')[0],
      symbol: '',
      shares: 100,
      assignedPrice: '',
      dateSold: '',
      soldPrice: '',
      currentPrice: '',
      lastPriceUpdate: null
    }
    onUpdate([newStock, ...stockData])
    setEditingRowId(id)
    
    // Clear filters to ensure the new row is visible
    setStatusFilter('All')
    setPnlFilter('All')
    setYearFilter('All')
    setSymbolSearch('')
  }

  const handleDeleteRow = (id) => {
    if (!confirm('Delete this stock entry?')) return
    onUpdate(stockData.filter(item => item.id !== id))
  }

  const handleUpdateField = (id, field, value) => {
    onUpdate(stockData.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  const handleRefreshPrices = async () => {
    setLoading(true)
    const uniqueSymbols = [...new Set(stockData.filter(s => s.symbol && !s.soldPrice).map(s => s.symbol))]
    const prices = await fetchPrices(uniqueSymbols)
    onUpdate(stockData.map(item =>
      prices[item.symbol?.toUpperCase()] != null && !item.soldPrice
        ? { ...item, currentPrice: prices[item.symbol.toUpperCase()], lastPriceUpdate: new Date().toISOString() }
        : item
    ))
    setLoading(false)
  }

  const calculatePnL = (item) => {
    const shares = parseFloat(item.shares) || 0
    const assigned = parseFloat(item.assignedPrice) || 0
    const sold = parseFloat(item.soldPrice)
    const current = parseFloat(item.currentPrice)
    if (sold) return (sold - assigned) * shares
    if (current) return (current - assigned) * shares
    return null
  }

  const calculatePnLPct = (item) => {
    const assigned = parseFloat(item.assignedPrice) || 0
    const sold = parseFloat(item.soldPrice)
    const current = parseFloat(item.currentPrice)
    if (!assigned) return null
    const price = sold || current
    if (!price) return null
    return ((price - assigned) / assigned) * 100
  }

  const fmt = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const formatRelativeTime = (iso) => {
    if (!iso) return null
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const activeStocks = stockData.filter(s => !isClosed(s))
  const closedStocks = stockData.filter(s => isClosed(s))
  const totalInvested = activeStocks.reduce((sum, i) => sum + (parseFloat(i.shares) || 0) * (parseFloat(i.assignedPrice) || 0), 0)
  const unrealisedPnL = activeStocks.reduce((sum, i) => sum + (calculatePnL(i) ?? 0), 0)
  const realisedPnL = closedStocks.reduce((sum, i) => sum + (calculatePnL(i) ?? 0), 0)
  const totalPnL = unrealisedPnL + realisedPnL

  // ── Sort: active first, then newest dateAssigned within each group ──────
  const sortedData = useMemo(() => {
    return [...stockData].sort((a, b) => {
      const aClosed = isClosed(a) ? 1 : 0
      const bClosed = isClosed(b) ? 1 : 0
      if (aClosed !== bClosed) return aClosed - bClosed
      // Within same group: newest first
      const dateA = new Date(a.dateAssigned || 0).getTime()
      const dateB = new Date(b.dateAssigned || 0).getTime()
      return dateB - dateA
    })
  }, [stockData])

  // ── Apply filters to sorted data ────────────────────────────────────────
  const visibleData = useMemo(() => {
    return sortedData.filter(item => {
      const closed = isClosed(item)
      if (statusFilter === 'Active' && closed) return false
      if (statusFilter === 'Closed' && !closed) return false

      const pnl = calculatePnL(item)
      if (pnlFilter === 'Winners' && (pnl === null || pnl < 0)) return false
      if (pnlFilter === 'Losers'  && (pnl === null || pnl >= 0)) return false

      const itemYear = (item.dateAssigned || '').slice(0, 4)
      if (yearFilter !== 'All' && itemYear !== yearFilter) return false

      if (symbolSearch.trim()) {
        if (!item.symbol?.toUpperCase().includes(symbolSearch.toUpperCase().trim())) return false
      }

      return true
    })
  }, [sortedData, statusFilter, pnlFilter, yearFilter, symbolSearch])

  const hasActiveFilters = statusFilter !== 'All' || pnlFilter !== 'All' || yearFilter !== 'All' || symbolSearch.trim()

  return (
    <div className="space-y-5 pb-12">

      <LargeTitle title="Stock Portfolio" subtitle="Assigned shares & P&L tracking.">
        <div className="flex items-center gap-2 flex-wrap mt-3">
          <button onClick={handleRefreshPrices} disabled={loading}
            className="flex items-center gap-2 surface-1 hover:bg-white/[0.10] text-secondary hover:text-white px-4 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-50 min-h-[44px]">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={handleAddRow}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium transition-spring min-h-[44px]">
            <Plus className="h-3.5 w-3.5" />
            Add Stock
          </button>
        </div>
      </LargeTitle>

      {/* Summary bar */}
      {stockData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/[0.05] border border-white/[0.07] rounded-2xl px-4 py-3">
            <div className="text-[11px] text-white/40 font-medium mb-1">Active Positions</div>
            <div className="text-xl font-semibold text-blue-400">{activeStocks.length}</div>
          </div>
          <div className="bg-white/[0.05] border border-white/[0.07] rounded-2xl px-4 py-3">
            <div className="text-[11px] text-white/40 font-medium mb-1">Total Invested</div>
            <div className="text-xl font-semibold font-mono text-white/90">${fmt(totalInvested)}</div>
          </div>
          <div className="bg-white/[0.05] border border-white/[0.07] rounded-2xl px-4 py-3">
            <div className="text-[11px] text-white/40 font-medium mb-1">Unrealised P&amp;L</div>
            <div className={`text-xl font-semibold font-mono ${unrealisedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {unrealisedPnL !== 0 ? `${unrealisedPnL >= 0 ? '+' : '-'}$${fmt(Math.abs(unrealisedPnL))}` : '—'}
            </div>
          </div>
          <div className="bg-white/[0.05] border border-white/[0.07] rounded-2xl px-4 py-3">
            <div className="text-[11px] text-white/40 font-medium mb-1">Realised P&amp;L</div>
            <div className={`text-xl font-semibold font-mono ${realisedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {realisedPnL !== 0 ? `${realisedPnL >= 0 ? '+' : '-'}$${fmt(Math.abs(realisedPnL))}` : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      {stockData.length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3 flex flex-col sm:flex-row gap-3 sm:items-center flex-wrap">
          <FilterPills label="Status" options={STATUS_OPTS} value={statusFilter} onChange={setStatusFilter} />
          <div className="hidden sm:block w-px h-4 bg-white/10" />
          <FilterPills label="P&L"    options={PNL_OPTS}    value={pnlFilter}    onChange={setPnlFilter}    />
          <div className="hidden sm:block w-px h-4 bg-white/10" />
          <FilterPills label="Year"   options={YEAR_OPTS}   value={yearFilter}   onChange={setYearFilter}   />
          <div className="hidden sm:block w-px h-4 bg-white/10" />
          {/* Symbol search */}
          <div className="flex items-center gap-2 flex-1 min-w-[120px]">
            <Search className="h-3.5 w-3.5 text-white/25 flex-shrink-0" />
            <input
              type="text"
              value={symbolSearch}
              onChange={e => setSymbolSearch(e.target.value)}
              placeholder="Search ticker…"
              className="bg-transparent text-xs text-white/70 placeholder:text-white/25 focus:outline-none w-full"
            />
            {symbolSearch && (
              <button onClick={() => setSymbolSearch('')} className="text-white/25 hover:text-white/60 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {/* Clear all */}
          {hasActiveFilters && (
            <button
              onClick={() => { setStatusFilter('All'); setPnlFilter('All'); setYearFilter('All'); setSymbolSearch('') }}
              className="text-[11px] text-white/35 hover:text-white/70 underline underline-offset-2 transition-colors ml-auto whitespace-nowrap"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Row count when filtered */}
      {hasActiveFilters && stockData.length > 0 && (
        <div className="text-[11px] text-white/35">
          Showing {visibleData.length} of {stockData.length} position{stockData.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Empty state */}
      {stockData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
            <Briefcase className="h-7 w-7 text-blue-400/50" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-base font-semibold text-white/60">No stocks yet</p>
            <p className="text-sm text-white/30">Add assigned stocks to track P&amp;L</p>
          </div>
          <button onClick={handleAddRow}
            className="bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/20 px-5 py-2 rounded-full text-sm font-medium transition-all">
            Add First Stock
          </button>
        </div>
      ) : (
        <>
          {/* ── Mobile cards ── */}
          <div className="md:hidden space-y-3">
            {visibleData.length === 0 && (
              <div className="text-center py-12 text-white/30 text-sm">No positions match the current filters.</div>
            )}
            {visibleData.map((item) => {
              const pnl = calculatePnL(item)
              const pnlPct = calculatePnLPct(item)
              const closed = isClosed(item)
              const isEditing = editingRowId === item.id

              return (
                <div key={item.id} className={`bg-white/[0.05] border border-white/[0.08] rounded-2xl overflow-hidden transition-all duration-300 ${closed && !isEditing ? 'opacity-75' : ''} ${isEditing ? 'ring-2 ring-blue-500/50 bg-blue-500/[0.02]' : ''}`}>
                  {/* Accent stripe */}
                  <div className={`h-0.5 ${pnl === null ? 'bg-white/10' : pnl >= 0 ? 'bg-gradient-to-r from-emerald-500 to-transparent' : 'bg-gradient-to-r from-rose-500 to-transparent'}`} />
                  <div className="p-4">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-white/30 uppercase font-medium ml-1">Symbol</label>
                            <input type="text" value={item.symbol}
                              onChange={(e) => handleUpdateField(item.id, 'symbol', e.target.value.toUpperCase())}
                              placeholder="SYM"
                              className="w-full bg-white/[0.07] border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-blue-500/50 transition-colors uppercase" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-white/30 uppercase font-medium ml-1">Shares</label>
                            <input type="number" value={item.shares}
                              onChange={(e) => handleUpdateField(item.id, 'shares', e.target.value)}
                              className="w-full bg-white/[0.07] border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-blue-500/50 transition-colors" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-white/30 uppercase font-medium ml-1">Assigned Price</label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-white/20">$</span>
                              <input type="number" step="0.01" value={item.assignedPrice}
                                onChange={(e) => handleUpdateField(item.id, 'assignedPrice', e.target.value)}
                                className="w-full bg-white/[0.07] border border-white/10 rounded-xl pl-6 pr-3 py-2.5 text-white focus:outline-none focus:border-blue-500/50 transition-colors font-mono" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-white/30 uppercase font-medium ml-1">Market Price</label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-white/20">$</span>
                              <input type="number" step="0.01" value={item.currentPrice}
                                onChange={(e) => handleUpdateField(item.id, 'currentPrice', e.target.value)}
                                className="w-full bg-white/[0.07] border border-white/10 rounded-xl pl-6 pr-3 py-2.5 text-white focus:outline-none focus:border-blue-500/50 transition-colors font-mono" />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-white/30 uppercase font-medium ml-1">Exit Price</label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-white/20">$</span>
                              <input type="number" step="0.01" value={item.soldPrice}
                                onChange={(e) => handleUpdateField(item.id, 'soldPrice', e.target.value)}
                                placeholder="—"
                                className="w-full bg-white/[0.07] border border-white/10 rounded-xl pl-6 pr-3 py-2.5 text-white focus:outline-none focus:border-blue-500/50 transition-colors font-mono placeholder:text-white/10" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-white/30 uppercase font-medium ml-1">Date Sold</label>
                            <input type="date" value={item.dateSold}
                              onChange={(e) => handleUpdateField(item.id, 'dateSold', e.target.value)}
                              className="w-full bg-white/[0.07] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-blue-500/50 transition-colors" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-white/30 uppercase font-medium ml-1">Date Assigned</label>
                            <input type="date" value={item.dateAssigned}
                              onChange={(e) => handleUpdateField(item.id, 'dateAssigned', e.target.value)}
                              className="w-full bg-white/[0.07] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-blue-500/50 transition-colors" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-2">
                          <button onClick={() => handleDeleteRow(item.id)}
                            className="flex items-center gap-2 text-rose-400/50 hover:text-rose-400 text-xs font-medium transition-colors px-1">
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                          <div className="flex gap-2">
                            <button onClick={handleCancelEdit}
                              className="px-4 py-2 text-sm font-medium text-white/40 hover:text-white/60 transition-colors">
                              Cancel
                            </button>
                            <button onClick={handleSaveEdit}
                              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-bold shadow-lg shadow-blue-500/20 transition-all">
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <CompanyLogo symbol={item.symbol} className="w-10 h-10" textSize="text-[10px]" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-white/90">{item.symbol || 'SYM'}</span>
                                <EarningsBadge earningsTs={earningsDates[item.symbol?.toUpperCase()]} compact />
                                {closed 
                                  ? <span className="text-[9px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-1.5 py-0.5 rounded-full">Closed</span>
                                  : <span className="text-[9px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/15 px-1.5 py-0.5 rounded-full">Active</span>
                                }
                              </div>
                              <div className="text-xs text-white/30">{item.shares} shares</div>
                            </div>
                          </div>
                          <button onClick={() => handleEditClick(item.id)} className="p-2 hover:bg-white/5 rounded-full text-white/20 hover:text-white/60 transition-colors">
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex justify-between items-end">
                          <div>
                            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Cost Basis</div>
                            <div className="text-sm font-medium text-white/70">
                              ${fmt(parseFloat(item.assignedPrice) || 0)} <span className="text-[10px] text-white/30">avg</span>
                            </div>
                            <div className="text-[10px] text-white/20 mt-0.5 font-mono">
                              ${fmt((parseFloat(item.shares) || 0) * (parseFloat(item.assignedPrice) || 0))} total
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-xl font-bold font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {pnlPct !== null ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%` : '—'}
                            </div>
                            <div className="text-sm font-medium text-white/50">
                              ${fmt(parseFloat(closed ? item.soldPrice : (item.currentPrice || 0)))}
                            </div>
                            {item.lastPriceUpdate && !closed && (
                              <div className="text-[9px] text-white/20 mt-0.5">{formatRelativeTime(item.lastPriceUpdate)}</div>
                            )}
                          </div>
                        </div>
                        
                        <div className="pt-3 border-t border-white/[0.05] flex justify-between items-center text-[10px] text-white/30">
                          <span>Assigned {item.dateAssigned}</span>
                          {closed && <span>Closed {item.dateSold}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Desktop cards ── */}
          <div className="hidden md:block max-w-4xl mx-auto space-y-4">
            {visibleData.length === 0 && (
              <div className="text-center py-24 bg-white/[0.02] border border-white/[0.05] rounded-3xl">
                <p className="text-white/30 text-sm">No positions match the current filters.</p>
              </div>
            )}
            {visibleData.map((item) => {
              const pnl = calculatePnL(item)
              const pnlPct = calculatePnLPct(item)
              const closed = isClosed(item)
              const isEditing = editingRowId === item.id

              if (isEditing) {
                return (
                  <div key={item.id} className="bg-white/[0.04] border border-blue-500/30 rounded-3xl overflow-hidden p-8 space-y-8 animate-in fade-in zoom-in-95 duration-200">
                    <div className="grid grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <label className="text-[11px] text-white/40 uppercase font-bold tracking-wider ml-1">Symbol</label>
                        <input type="text" value={item.symbol} onChange={(e) => handleUpdateField(item.id, 'symbol', e.target.value.toUpperCase())} className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:border-blue-500/50 transition-all uppercase font-bold" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] text-white/40 uppercase font-bold tracking-wider ml-1">Shares</label>
                        <input type="number" value={item.shares} onChange={(e) => handleUpdateField(item.id, 'shares', e.target.value)} className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] text-white/40 uppercase font-bold tracking-wider ml-1">Assigned Price</label>
                        <div className="relative">
                          <span className="absolute left-4 top-3.5 text-white/20">$</span>
                          <input type="number" step="0.01" value={item.assignedPrice} onChange={(e) => handleUpdateField(item.id, 'assignedPrice', e.target.value)} className="w-full bg-white/[0.05] border border-white/10 rounded-2xl pl-8 pr-4 py-3.5 text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] text-white/40 uppercase font-bold tracking-wider ml-1">Market Price</label>
                        <div className="relative">
                          <span className="absolute left-4 top-3.5 text-white/20">$</span>
                          <input type="number" step="0.01" value={item.currentPrice} onChange={(e) => handleUpdateField(item.id, 'currentPrice', e.target.value)} className="w-full bg-white/[0.05] border border-white/10 rounded-2xl pl-8 pr-4 py-3.5 text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] text-white/40 uppercase font-bold tracking-wider ml-1">Exit Price</label>
                        <div className="relative">
                          <span className="absolute left-4 top-3.5 text-white/20">$</span>
                          <input type="number" step="0.01" value={item.soldPrice} onChange={(e) => handleUpdateField(item.id, 'soldPrice', e.target.value)} placeholder="—" className="w-full bg-white/[0.05] border border-white/10 rounded-2xl pl-8 pr-4 py-3.5 text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono placeholder:text-white/10" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] text-white/40 uppercase font-bold tracking-wider ml-1">Date Sold</label>
                        <input type="date" value={item.dateSold} onChange={(e) => handleUpdateField(item.id, 'dateSold', e.target.value)} className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:border-blue-500/50 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] text-white/40 uppercase font-bold tracking-wider ml-1">Date Assigned</label>
                        <input type="date" value={item.dateAssigned} onChange={(e) => handleUpdateField(item.id, 'dateAssigned', e.target.value)} className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:border-blue-500/50 transition-all" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-white/5">
                      <button onClick={() => handleDeleteRow(item.id)} className="flex items-center gap-2 text-rose-400/40 hover:text-rose-400 text-xs font-bold uppercase tracking-widest transition-colors">
                        <Trash2 className="h-4 w-4" /> Delete Position
                      </button>
                      <div className="flex gap-4">
                        <button onClick={handleCancelEdit} className="px-8 py-3 text-sm font-bold text-white/30 hover:text-white/70 transition-colors uppercase tracking-widest">Cancel</button>
                        <button onClick={handleSaveEdit} className="px-10 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-sm font-black shadow-xl shadow-blue-500/20 transition-all uppercase tracking-widest">Save Changes</button>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div key={item.id} className={`group bg-white/[0.05] border border-white/[0.08] rounded-2xl overflow-hidden transition-all hover:bg-white/[0.08] hover:border-white/15 ${closed ? 'opacity-80' : ''}`}>
                  <div className="flex items-center justify-between p-5">
                    {/* Left side: CompanyLogo, Symbol (large), EarningsBadge, Status Badge, Shares, Assigned Price, Assigned Date */}
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        <CompanyLogo symbol={item.symbol} className="w-14 h-14 rounded-xl shadow-2xl" textSize="text-xs" />
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0f1117] ${closed ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-black text-white tracking-tight">{item.symbol || 'SYM'}</span>
                          <EarningsBadge earningsTs={earningsDates[item.symbol?.toUpperCase()]} />
                          {closed 
                            ? <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">Closed</span>
                            : <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">Active</span>
                          }
                        </div>
                        <div className="flex items-center gap-3 text-[13px] text-white/40">
                          <span className="font-medium text-white/60">{item.shares} Shares</span>
                          <span className="w-1 h-1 rounded-full bg-white/10" />
                          <span>Assigned at <span className="font-mono text-white/60">${fmt(parseFloat(item.assignedPrice) || 0)}</span></span>
                          <span className="w-1 h-1 rounded-full bg-white/10" />
                          <span>{item.dateAssigned}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right side: Market Performance section with Market Price, Relative Time, and large P&L Percentage */}
                    <div className="flex items-center gap-10">
                      <div className="text-right">
                        <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mb-1">Market Price</p>
                        <p className="text-xl font-bold text-white font-mono">${fmt(parseFloat(closed ? item.soldPrice : (item.currentPrice || 0)))}</p>
                        {item.lastPriceUpdate && !closed && (
                          <p className="text-[10px] text-white/20 mt-1 font-medium">{formatRelativeTime(item.lastPriceUpdate)}</p>
                        )}
                      </div>

                      <div className="text-right min-w-[140px]">
                        <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mb-1">P&L Percentage</p>
                        <p className={`text-4xl font-black font-mono leading-none ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pnlPct !== null ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%` : '—'}
                        </p>
                      </div>

                      <button onClick={() => handleEditClick(item.id)} className="p-3 hover:bg-white/10 rounded-xl text-white/20 hover:text-white/80 transition-all">
                        <Edit2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Desktop Summary Footer */}
            {stockData.length > 0 && (
              <div className="mt-10 p-8 bg-white/[0.02] border border-white/[0.05] rounded-3xl flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/20 font-medium">Portfolio Overview</p>
                  <p className="text-white/40 text-xs mt-1">Showing {visibleData.length} active and closed positions</p>
                </div>
                <div className="flex gap-16">
                  <div className="text-right">
                    <p className="text-[11px] text-white/30 uppercase font-extrabold tracking-[0.2em] mb-2">Total Invested</p>
                    <p className="text-3xl font-bold text-white/90 font-mono tracking-tighter">${fmt(totalInvested)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-white/30 uppercase font-extrabold tracking-[0.2em] mb-2">Total P&L</p>
                    <p className={`text-3xl font-bold font-mono tracking-tighter ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {totalPnL >= 0 ? '+' : '-'}${fmt(Math.abs(totalPnL))}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default StockPortfolio
