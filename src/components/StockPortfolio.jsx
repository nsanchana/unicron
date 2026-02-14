import { useState, useEffect } from 'react'
import { Plus, Trash2, Save, RefreshCw, DollarSign, TrendingUp, TrendingDown, Briefcase, Target } from 'lucide-react'
import CompanyLogo from './CompanyLogo'

function StockPortfolio({ stockData, onUpdate }) {
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState(null)

    // Add a new empty row
    const handleAddRow = () => {
        const newStock = {
            id: Date.now(),
            dateAssigned: new Date().toISOString().split('T')[0],
            symbol: '',
            shares: 100, // Default to 1 option contract worth
            assignedPrice: '',
            dateSold: '',
            soldPrice: '',
            currentPrice: '',
            lastPriceUpdate: null
        }
        const updatedData = [newStock, ...stockData]
        onUpdate(updatedData)
        setEditingId(newStock.id)
    }

    // Delete a row
    const handleDeleteRow = (id) => {
        if (!confirm('Are you sure you want to delete this stock entry?')) return
        const updatedData = stockData.filter(item => item.id !== id)
        onUpdate(updatedData)
    }

    // Update a field in a row
    const handleUpdateField = (id, field, value) => {
        const updatedData = stockData.map(item => {
            if (item.id === id) {
                return { ...item, [field]: value }
            }
            return item
        })
        onUpdate(updatedData)
    }

    // Fetch current prices for all symbols
    const handleRefreshPrices = async () => {
        setLoading(true)
        const uniqueSymbols = [...new Set(stockData.filter(s => s.symbol && !s.soldPrice).map(s => s.symbol))]
        const prices = {}

        await Promise.all(uniqueSymbols.map(async (symbol) => {
            try {
                const response = await fetch(`/api/scrape/stock-price`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ symbol })
                })
                if (response.ok) {
                    const data = await response.json()
                    if (data.price) prices[symbol] = parseFloat(data.price)
                }
            } catch (e) {
                console.error(e)
            }
        }))

        const updatedData = stockData.map(item => {
            if (prices[item.symbol] && !item.soldPrice) {
                return {
                    ...item,
                    currentPrice: prices[item.symbol],
                    lastPriceUpdate: new Date().toISOString()
                }
            }
            return item
        })

        onUpdate(updatedData)
        setLoading(false)
    }

    // Calculate generic P&L
    const calculatePnL = (item) => {
        const shares = parseFloat(item.shares) || 0
        const assigned = parseFloat(item.assignedPrice) || 0
        const sold = parseFloat(item.soldPrice)
        const current = parseFloat(item.currentPrice)

        if (sold) {
            return (sold - assigned) * shares
        } else if (current) {
            return (current - assigned) * shares
        }
        return 0
    }

    const getTotalPnL = () => {
        return stockData.reduce((sum, item) => sum + calculatePnL(item), 0)
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="glass-card overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600/10 to-transparent p-6 border-b border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                            <Briefcase className="h-8 w-8 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)] uppercase italic leading-none">Stock Intelligence</h2>
                            <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest mt-1.5 leading-none">Inventory & Unrealized Performance</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4 w-full md:w-auto">
                        <div className={`flex-1 md:flex-none px-6 py-3 rounded-2xl border flex flex-col items-center justify-center ${getTotalPnL() >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] mb-1 opacity-70">Global P&L</span>
                            <span className="text-xl font-black font-mono leading-none">${getTotalPnL().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={handleRefreshPrices}
                                disabled={loading}
                                className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                                <span>Refine Prices</span>
                            </button>
                            <button
                                onClick={handleAddRow}
                                className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Add Inventory</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Table Container */}
                <div className="p-1">
                    <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20 backdrop-blur-sm">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-white/5 border-b border-white/10">
                                    <th className="text-left text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-4 py-4 whitespace-nowrap">Assigned Date</th>
                                    <th className="text-left text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-4 py-4 whitespace-nowrap">Asset</th>
                                    <th className="text-right text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-4 py-4 whitespace-nowrap">Shares</th>
                                    <th className="text-right text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-4 py-4 whitespace-nowrap">Cost Basis</th>
                                    <th className="text-right text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-4 py-4 whitespace-nowrap">Total Value</th>
                                    <th className="text-right text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-4 py-4 whitespace-nowrap">Market Price</th>
                                    <th className="text-left text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-4 py-4 whitespace-nowrap border-l border-white/5">Exit Date</th>
                                    <th className="text-right text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-4 py-4 whitespace-nowrap">Exit Price</th>
                                    <th className="text-right text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-4 py-4 whitespace-nowrap font-mono">P&L Status</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {stockData.length === 0 ? (
                                    <tr>
                                        <td colSpan="10" className="text-center py-20">
                                            <div className="flex flex-col items-center justify-center space-y-4">
                                                <div className="w-16 h-16 rounded-full bg-blue-500/5 flex items-center justify-center border border-blue-500/10">
                                                    <Briefcase className="h-8 w-8 text-blue-500/30" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[var(--text-primary)] font-black uppercase tracking-widest text-sm">No Tactical Inventory</p>
                                                    <p className="text-[var(--text-secondary)] text-xs font-bold uppercase tracking-tighter italic">Log your assigned assets to begin tracking performance</p>
                                                </div>
                                                <button
                                                    onClick={handleAddRow}
                                                    className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-500/20 transition-all"
                                                >
                                                    Initialize First Asset
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    stockData.map((item) => {
                                        const pnl = calculatePnL(item)
                                        const totalCost = (parseFloat(item.shares) || 0) * (parseFloat(item.assignedPrice) || 0)
                                        const isSold = !!item.soldPrice && parseFloat(item.soldPrice) > 0

                                        return (
                                            <tr key={item.id} className={`group hover:bg-white/5 transition-colors ${isSold ? 'bg-emerald-500/5' : ''}`}>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="date"
                                                        value={item.dateAssigned}
                                                        onChange={(e) => handleUpdateField(item.id, 'dateAssigned', e.target.value)}
                                                        className="bg-transparent text-[var(--text-primary)] text-sm font-mono outline-none w-full opacity-60 focus:opacity-100"
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center space-x-3">
                                                        <CompanyLogo symbol={item.symbol} className="w-8 h-8 rounded-lg shadow-lg border border-white/10" textSize="text-[10px]" />
                                                        <input
                                                            type="text"
                                                            value={item.symbol}
                                                            onChange={(e) => handleUpdateField(item.id, 'symbol', e.target.value.toUpperCase())}
                                                            placeholder="SYM"
                                                            className="bg-transparent font-black text-[var(--text-primary)] w-14 outline-none uppercase placeholder-[var(--text-secondary)] tracking-tighter"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <input
                                                        type="number"
                                                        value={item.shares}
                                                        onChange={(e) => handleUpdateField(item.id, 'shares', e.target.value)}
                                                        className="bg-transparent text-right text-sm font-black text-[var(--text-primary)] font-mono outline-none w-full"
                                                    />
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <div className="relative text-right flex items-center justify-end space-x-1">
                                                        <span className="text-[var(--text-secondary)] text-[10px] font-black">$</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.assignedPrice}
                                                            onChange={(e) => handleUpdateField(item.id, 'assignedPrice', e.target.value)}
                                                            className="bg-transparent text-sm font-black text-[var(--text-primary)] font-mono outline-none w-20 text-right"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <span className="text-sm font-black text-[var(--text-secondary)] font-mono">
                                                        ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <div className="relative text-right flex items-center justify-end space-x-1">
                                                        <span className="text-blue-500 text-[10px] font-black">$</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.currentPrice}
                                                            onChange={(e) => handleUpdateField(item.id, 'currentPrice', e.target.value)}
                                                            className="bg-transparent text-sm font-black text-blue-400 focus:text-blue-300 font-mono outline-none w-20 text-right"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 border-l border-white/5">
                                                    <input
                                                        type="date"
                                                        value={item.dateSold}
                                                        onChange={(e) => handleUpdateField(item.id, 'dateSold', e.target.value)}
                                                        className={`bg-transparent text-sm font-mono outline-none w-full ${item.dateSold ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] opacity-40'}`}
                                                    />
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <div className="relative text-right flex items-center justify-end space-x-1">
                                                        <span className={`${item.soldPrice ? 'text-emerald-500' : 'text-[var(--text-secondary)] opacity-40'} text-[10px] font-black`}>$</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.soldPrice}
                                                            onChange={(e) => handleUpdateField(item.id, 'soldPrice', e.target.value)}
                                                            className={`bg-transparent text-sm font-mono outline-none w-20 text-right ${item.soldPrice ? 'text-emerald-400 font-black' : 'text-[var(--text-secondary)] opacity-40'}`}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${pnl >= 0
                                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10'
                                                        : 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-lg shadow-red-500/10'
                                                        }`}>
                                                        {pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <button
                                                        onClick={() => handleDeleteRow(item.id)}
                                                        className="p-2 hover:bg-red-500/20 text-[var(--text-secondary)] hover:text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                            {stockData.length > 0 && (
                                <tfoot>
                                    <tr className="border-t border-white/10 bg-white/5">
                                        <td colSpan="4" className="px-4 py-5 text-right text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">Aggregate Cost Basis</td>
                                        <td className="px-4 py-5 text-right">
                                            <div className="font-black text-sm text-[var(--text-primary)] font-mono">
                                                ${stockData.reduce((sum, item) => sum + ((parseFloat(item.shares) || 0) * (parseFloat(item.assignedPrice) || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </td>
                                        <td colSpan="3" className="px-4 py-5 text-right text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">Net Unrealized/Realized</td>
                                        <td className="px-4 py-5 text-right">
                                            <div className={`font-black text-lg font-mono ${getTotalPnL() >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {getTotalPnL() >= 0 ? '+' : '-'}${Math.abs(getTotalPnL()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default StockPortfolio
