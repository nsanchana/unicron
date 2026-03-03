import { useState } from 'react'
import { Plus, Trash2, RefreshCw, Briefcase, CheckCircle } from 'lucide-react'
import CompanyLogo from './CompanyLogo'

function StockPortfolio({ stockData, onUpdate }) {
  const [loading, setLoading] = useState(false)

  const handleAddRow = () => {
    const newStock = {
      id: Date.now(),
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
    const prices = {}
    await Promise.all(uniqueSymbols.map(async (symbol) => {
      try {
        const response = await fetch('/api/scrape/stock-price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ symbol })
        })
        if (response.ok) {
          const data = await response.json()
          if (data.price) prices[symbol] = parseFloat(data.price)
        }
      } catch (e) { console.error(e) }
    }))
    onUpdate(stockData.map(item =>
      prices[item.symbol] && !item.soldPrice
        ? { ...item, currentPrice: prices[item.symbol], lastPriceUpdate: new Date().toISOString() }
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

  const isClosed = (item) => !!item.soldPrice && parseFloat(item.soldPrice) > 0

  const activeStocks = stockData.filter(s => !isClosed(s))
  const closedStocks = stockData.filter(s => isClosed(s))
  const totalInvested = activeStocks.reduce((sum, i) => sum + (parseFloat(i.shares) || 0) * (parseFloat(i.assignedPrice) || 0), 0)
  const unrealisedPnL = activeStocks.reduce((sum, i) => sum + (calculatePnL(i) ?? 0), 0)
  const realisedPnL = closedStocks.reduce((sum, i) => sum + (calculatePnL(i) ?? 0), 0)
  const totalPnL = unrealisedPnL + realisedPnL

  return (
    <div className="space-y-5 pb-12">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/15 rounded-2xl border border-blue-500/20">
            <Briefcase className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">Stocks</h2>
            <p className="text-[11px] text-white/40 font-medium">Assigned shares &amp; P&amp;L tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleRefreshPrices} disabled={loading}
            className="flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white/70 hover:text-white px-4 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={handleAddRow}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium transition-all">
            <Plus className="h-3.5 w-3.5" />
            Add Stock
          </button>
        </div>
      </div>

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

      {/* Empty state */}
      {stockData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-14 h-14 rounded-[18px] bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
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
            {stockData.map((item) => {
              const pnl = calculatePnL(item)
              const pnlPct = calculatePnLPct(item)
              const closed = isClosed(item)
              return (
                <div key={item.id} className={`bg-white/[0.05] border border-white/[0.08] rounded-[20px] overflow-hidden ${closed ? 'opacity-75' : ''}`}>
                  {/* Accent stripe */}
                  <div className={`h-0.5 ${pnl === null ? 'bg-white/10' : pnl >= 0 ? 'bg-gradient-to-r from-emerald-500 to-transparent' : 'bg-gradient-to-r from-rose-500 to-transparent'}`} />
                  <div className="p-4 space-y-3">

                    {/* Row 1: symbol + status + delete */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CompanyLogo symbol={item.symbol} className="w-9 h-9" textSize="text-[9px]" />
                        <div>
                          <div className="flex items-center gap-2">
                            <input type="text" value={item.symbol}
                              onChange={(e) => handleUpdateField(item.id, 'symbol', e.target.value.toUpperCase())}
                              placeholder="SYM"
                              className="bg-transparent text-base font-semibold text-white/90 focus:outline-none w-16 uppercase placeholder:text-white/25" />
                            {closed
                              ? <span className="flex items-center gap-1 text-[9px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-1.5 py-0.5 rounded-full"><CheckCircle className="h-2.5 w-2.5" />Closed</span>
                              : <span className="flex items-center gap-1 text-[9px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/15 px-1.5 py-0.5 rounded-full"><span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse inline-block" />Active</span>
                            }
                          </div>
                          <div className="text-[10px] text-white/30 mt-0.5">
                            <input type="number" value={item.shares}
                              onChange={(e) => handleUpdateField(item.id, 'shares', e.target.value)}
                              className="bg-transparent text-[10px] text-white/30 font-mono focus:outline-none w-10 inline" />
                            &nbsp;shares
                          </div>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteRow(item.id)}
                        className="p-1.5 hover:bg-rose-500/15 text-white/20 hover:text-rose-400 rounded-lg transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Row 2: Cost Basis | Market/Exit Price | P&L */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-[10px] text-white/30 mb-0.5">Cost Basis</div>
                        <div className="flex items-center gap-0.5">
                          <span className="text-white/25 text-xs">$</span>
                          <input type="number" step="0.01" value={item.assignedPrice}
                            onChange={(e) => handleUpdateField(item.id, 'assignedPrice', e.target.value)}
                            className="bg-transparent text-sm font-semibold font-mono text-white/85 focus:outline-none w-full" />
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-white/30 mb-0.5">{closed ? 'Exit Price' : 'Market Price'}</div>
                        <div className="flex items-center gap-0.5">
                          <span className={`text-xs ${closed ? 'text-emerald-400/50' : 'text-blue-400/60'}`}>$</span>
                          <input type="number" step="0.01" value={closed ? item.soldPrice : item.currentPrice}
                            onChange={(e) => handleUpdateField(item.id, closed ? 'soldPrice' : 'currentPrice', e.target.value)}
                            className={`bg-transparent text-sm font-semibold font-mono focus:outline-none w-full ${closed ? 'text-emerald-400' : 'text-blue-400'}`} />
                        </div>
                        {item.lastPriceUpdate && !closed && (
                          <div className="text-[9px] text-white/25 mt-0.5">{formatRelativeTime(item.lastPriceUpdate)}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-white/30 mb-0.5">P&amp;L</div>
                        {pnl !== null && pnlPct !== null ? (
                          <>
                            <div className={`text-base font-semibold font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                            </div>
                            <div className={`text-[10px] font-mono ${pnl >= 0 ? 'text-emerald-400/60' : 'text-rose-400/60'}`}>
                              {pnl >= 0 ? '+' : '-'}${fmt(Math.abs(pnl))}
                            </div>
                          </>
                        ) : (
                          <div className="text-white/20 text-sm">—</div>
                        )}
                      </div>
                    </div>

                    {/* Row 3: dates */}
                    <div className="flex items-center gap-4 pt-2.5 border-t border-white/[0.05] flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-white/30">Assigned</span>
                        <input type="date" value={item.dateAssigned}
                          onChange={(e) => handleUpdateField(item.id, 'dateAssigned', e.target.value)}
                          className="bg-transparent text-[10px] text-white/45 font-mono focus:outline-none" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-white/30">{closed ? 'Closed' : 'Exit price'}</span>
                        {closed ? (
                          <input type="date" value={item.dateSold}
                            onChange={(e) => handleUpdateField(item.id, 'dateSold', e.target.value)}
                            className="bg-transparent text-[10px] text-white/45 font-mono focus:outline-none" />
                        ) : (
                          <div className="flex items-center gap-0.5">
                            <span className="text-white/20 text-xs">$</span>
                            <input type="number" step="0.01" value={item.soldPrice}
                              onChange={(e) => handleUpdateField(item.id, 'soldPrice', e.target.value)}
                              placeholder="—"
                              className="bg-transparent text-[10px] text-white/45 font-mono focus:outline-none w-14 placeholder:text-white/15" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Desktop table ── */}
          <div className="hidden md:block bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/[0.03] border-b border-white/[0.06]">
                    <th className="w-1 px-3 py-3" />
                    {['Stock', 'Shares', 'Cost Basis', 'Market Price', 'P&L', 'Assigned', 'Exit Price', ''].map((h, i) => (
                      <th key={i} className={`text-[11px] font-medium text-white/40 px-4 py-3 whitespace-nowrap ${i >= 1 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {stockData.map((item) => {
                    const pnl = calculatePnL(item)
                    const pnlPct = calculatePnLPct(item)
                    const totalCost = (parseFloat(item.shares) || 0) * (parseFloat(item.assignedPrice) || 0)
                    const closed = isClosed(item)
                    return (
                      <tr key={item.id} className={`group hover:bg-white/[0.03] transition-colors ${closed ? 'opacity-70' : ''}`}>

                        {/* Colour stripe */}
                        <td className="pl-3 pr-0 py-4 w-1">
                          <div className={`w-1 h-7 rounded-full ${pnl === null ? 'bg-white/10' : pnl >= 0 ? 'bg-emerald-500/60' : 'bg-rose-500/60'}`} />
                        </td>

                        {/* Symbol */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2.5">
                            <CompanyLogo symbol={item.symbol} className="w-8 h-8" textSize="text-[10px]" />
                            <div>
                              <div className="flex items-center gap-2">
                                <input type="text" value={item.symbol}
                                  onChange={(e) => handleUpdateField(item.id, 'symbol', e.target.value.toUpperCase())}
                                  placeholder="SYM"
                                  className="bg-transparent text-sm font-semibold text-white/90 focus:outline-none w-14 uppercase placeholder:text-white/25" />
                                {closed
                                  ? <span className="flex items-center gap-1 text-[9px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-1.5 py-0.5 rounded-full"><CheckCircle className="h-2.5 w-2.5" />Closed</span>
                                  : <span className="flex items-center gap-1 text-[9px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/15 px-1.5 py-0.5 rounded-full"><span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse inline-block" />Active</span>
                                }
                              </div>
                              <div className="text-[10px] text-white/30 mt-0.5 font-mono">${fmt(totalCost)} invested</div>
                            </div>
                          </div>
                        </td>

                        {/* Shares */}
                        <td className="px-4 py-4 text-right">
                          <input type="number" value={item.shares}
                            onChange={(e) => handleUpdateField(item.id, 'shares', e.target.value)}
                            className="bg-transparent text-sm text-white/75 font-mono focus:outline-none w-16 text-right" />
                        </td>

                        {/* Cost Basis */}
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <span className="text-white/25 text-xs">$</span>
                            <input type="number" step="0.01" value={item.assignedPrice}
                              onChange={(e) => handleUpdateField(item.id, 'assignedPrice', e.target.value)}
                              className="bg-transparent text-sm font-semibold font-mono text-white/85 focus:outline-none w-20 text-right" />
                          </div>
                        </td>

                        {/* Market / Exit Price */}
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <span className={`text-xs ${closed ? 'text-emerald-400/50' : 'text-blue-400/60'}`}>$</span>
                            <input type="number" step="0.01" value={item.currentPrice}
                              onChange={(e) => handleUpdateField(item.id, 'currentPrice', e.target.value)}
                              className={`bg-transparent text-sm font-semibold font-mono focus:outline-none w-20 text-right ${closed ? 'text-emerald-400' : 'text-blue-400'}`} />
                          </div>
                          {item.lastPriceUpdate && !closed && (
                            <div className="text-[9px] text-white/25 text-right mt-0.5">{formatRelativeTime(item.lastPriceUpdate)}</div>
                          )}
                        </td>

                        {/* P&L — hero cell */}
                        <td className="px-4 py-4 text-right">
                          {pnl !== null && pnlPct !== null ? (
                            <>
                              <div className={`text-base font-semibold font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                              </div>
                              <div className={`text-[11px] font-mono ${pnl >= 0 ? 'text-emerald-400/60' : 'text-rose-400/60'}`}>
                                {pnl >= 0 ? '+' : '-'}${fmt(Math.abs(pnl))}
                              </div>
                            </>
                          ) : (
                            <span className="text-white/20">—</span>
                          )}
                        </td>

                        {/* Assigned Date */}
                        <td className="px-4 py-4 text-right">
                          <input type="date" value={item.dateAssigned}
                            onChange={(e) => handleUpdateField(item.id, 'dateAssigned', e.target.value)}
                            className="bg-transparent text-xs text-white/45 font-mono focus:outline-none" />
                        </td>

                        {/* Exit Price (or sold date if closed) */}
                        <td className="px-4 py-4 text-right">
                          {closed ? (
                            <div>
                              <div className="flex items-center justify-end gap-0.5">
                                <span className="text-emerald-400/50 text-xs">$</span>
                                <input type="number" step="0.01" value={item.soldPrice}
                                  onChange={(e) => handleUpdateField(item.id, 'soldPrice', e.target.value)}
                                  className="bg-transparent text-sm font-semibold font-mono text-emerald-400 focus:outline-none w-20 text-right" />
                              </div>
                              <input type="date" value={item.dateSold}
                                onChange={(e) => handleUpdateField(item.id, 'dateSold', e.target.value)}
                                className="bg-transparent text-[9px] text-white/30 font-mono focus:outline-none text-right" />
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-0.5">
                              <span className="text-white/20 text-xs">$</span>
                              <input type="number" step="0.01" value={item.soldPrice}
                                onChange={(e) => handleUpdateField(item.id, 'soldPrice', e.target.value)}
                                placeholder="—"
                                className="bg-transparent text-sm font-mono text-white/40 focus:outline-none w-20 text-right placeholder:text-white/15" />
                            </div>
                          )}
                        </td>

                        {/* Delete */}
                        <td className="px-3 py-4">
                          <button onClick={() => handleDeleteRow(item.id)}
                            className="p-1.5 hover:bg-rose-500/15 text-white/20 hover:text-rose-400 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/[0.08] bg-white/[0.02]">
                    <td colSpan="2" className="px-4 py-3">
                      <span className="text-[11px] text-white/30">{stockData.length} position{stockData.length !== 1 ? 's' : ''}</span>
                    </td>
                    <td />
                    <td className="px-4 py-3 text-right">
                      <div className="text-[10px] text-white/30 mb-0.5">Total Invested</div>
                      <div className="text-sm font-semibold font-mono text-white/80">
                        ${fmt(stockData.reduce((s, i) => s + ((parseFloat(i.shares) || 0) * (parseFloat(i.assignedPrice) || 0)), 0))}
                      </div>
                    </td>
                    <td />
                    <td className="px-4 py-3 text-right">
                      <div className="text-[10px] text-white/30 mb-0.5">Total P&amp;L</div>
                      <div className={`text-lg font-semibold font-mono ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {totalPnL >= 0 ? '+' : '-'}${fmt(Math.abs(totalPnL))}
                      </div>
                    </td>
                    <td colSpan="3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default StockPortfolio
