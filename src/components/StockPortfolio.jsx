import { useState } from 'react'
import { Plus, Trash2, RefreshCw, Briefcase } from 'lucide-react'
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
        return 0
    }

    const getTotalPnL = () => stockData.reduce((sum, item) => sum + calculatePnL(item), 0)

    const fmt = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const totalPnL = getTotalPnL()
    const inputCls = "bg-transparent text-sm text-white font-mono focus:outline-none w-full"

    return (
        <div className="space-y-5 pb-12">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/15 rounded-2xl border border-blue-500/20">
                        <Briefcase className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-white tracking-tight">Stock Portfolio</h2>
                        <p className="text-sm text-white/40 font-medium">Assigned shares &amp; P&amp;L tracking</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className={`px-4 py-2 rounded-full border text-sm font-semibold font-mono ${totalPnL >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                        {totalPnL >= 0 ? '+' : '-'}${fmt(Math.abs(totalPnL))} P&amp;L
                    </div>
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

            {/* Table */}
            {stockData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                    <div className="w-14 h-14 rounded-[18px] bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
                        <Briefcase className="h-7 w-7 text-blue-400/50" />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-base font-semibold text-white/60">No stocks yet</p>
                        <p className="text-sm text-white/30">Add assigned stocks to track performance</p>
                    </div>
                    <button onClick={handleAddRow}
                        className="bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/20 px-5 py-2 rounded-full text-sm font-medium transition-all">
                        Add First Stock
                    </button>
                </div>
            ) : (
                <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-white/[0.04] border-b border-white/[0.06]">
                                    {['Assigned', 'Symbol', 'Shares', 'Cost Basis', 'Total Cost', 'Market Price', 'Exit Date', 'Exit Price', 'P&L', ''].map((h, i) => (
                                        <th key={i} className="text-left text-xs font-semibold text-white/40 px-4 py-3 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {stockData.map((item) => {
                                    const pnl = calculatePnL(item)
                                    const totalCost = (parseFloat(item.shares) || 0) * (parseFloat(item.assignedPrice) || 0)
                                    const isSold = !!item.soldPrice && parseFloat(item.soldPrice) > 0
                                    return (
                                        <tr key={item.id} className={`group hover:bg-white/[0.03] transition-colors ${isSold ? 'opacity-70' : ''}`}>
                                            <td className="px-4 py-3">
                                                <input type="date" value={item.dateAssigned}
                                                    onChange={(e) => handleUpdateField(item.id, 'dateAssigned', e.target.value)}
                                                    className="bg-transparent text-sm text-white/60 font-mono focus:outline-none" />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <CompanyLogo symbol={item.symbol} className="w-7 h-7 rounded-lg border border-white/10" textSize="text-[10px]" />
                                                    <input type="text" value={item.symbol}
                                                        onChange={(e) => handleUpdateField(item.id, 'symbol', e.target.value.toUpperCase())}
                                                        placeholder="SYM"
                                                        className="bg-transparent text-sm font-semibold text-white focus:outline-none w-14 uppercase placeholder:text-white/25" />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <input type="number" value={item.shares}
                                                    onChange={(e) => handleUpdateField(item.id, 'shares', e.target.value)}
                                                    className={inputCls + " text-right w-16"} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1 justify-end">
                                                    <span className="text-white/30 text-xs">$</span>
                                                    <input type="number" step="0.01" value={item.assignedPrice}
                                                        onChange={(e) => handleUpdateField(item.id, 'assignedPrice', e.target.value)}
                                                        className={inputCls + " text-right w-20"} />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="text-sm text-white/50 font-mono">${fmt(totalCost)}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1 justify-end">
                                                    <span className="text-blue-400/60 text-xs">$</span>
                                                    <input type="number" step="0.01" value={item.currentPrice}
                                                        onChange={(e) => handleUpdateField(item.id, 'currentPrice', e.target.value)}
                                                        className={inputCls + " text-right text-blue-400 w-20"} />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <input type="date" value={item.dateSold}
                                                    onChange={(e) => handleUpdateField(item.id, 'dateSold', e.target.value)}
                                                    className="bg-transparent text-sm text-white/50 font-mono focus:outline-none" />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1 justify-end">
                                                    <span className={`text-xs ${item.soldPrice ? 'text-emerald-400/60' : 'text-white/20'}`}>$</span>
                                                    <input type="number" step="0.01" value={item.soldPrice}
                                                        onChange={(e) => handleUpdateField(item.id, 'soldPrice', e.target.value)}
                                                        className={inputCls + ` text-right w-20 ${item.soldPrice ? 'text-emerald-400' : 'text-white/30'}`} />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                    pnl >= 0
                                                        ? 'bg-emerald-500/15 text-emerald-400'
                                                        : 'bg-rose-500/15 text-rose-400'
                                                }`}>
                                                    {pnl >= 0 ? '+' : '-'}${fmt(Math.abs(pnl))}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <button onClick={() => handleDeleteRow(item.id)}
                                                    className="p-1.5 hover:bg-rose-500/20 text-white/20 hover:text-rose-400 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="border-t border-white/[0.08] bg-white/[0.02]">
                                    <td colSpan="4" className="px-4 py-3 text-xs font-medium text-white/30 text-right">Total Cost Basis</td>
                                    <td className="px-4 py-3 text-right text-sm font-semibold text-white font-mono">
                                        ${fmt(stockData.reduce((s, i) => s + ((parseFloat(i.shares)||0)*(parseFloat(i.assignedPrice)||0)), 0))}
                                    </td>
                                    <td colSpan="3" className="px-4 py-3 text-xs font-medium text-white/30 text-right">Total P&amp;L</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`text-base font-bold font-mono ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {totalPnL >= 0 ? '+' : '-'}${fmt(Math.abs(totalPnL))}
                                        </span>
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

export default StockPortfolio
