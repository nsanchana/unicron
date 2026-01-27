import { useState, useEffect } from 'react'
import { Plus, Trash2, Save, RefreshCw, DollarSign, TrendingUp, TrendingDown, Briefcase } from 'lucide-react'

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

        for (const symbol of uniqueSymbols) {
            try {
                const response = await fetch(`/api/scrape/stock-price`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ symbol })
                })

                if (response.ok) {
                    const data = await response.json()
                    if (data.price) {
                        // Update all records with this symbol
                        const currentPrice = parseFloat(data.price)
                        const updatedData = stockData.map(item => {
                            if (item.symbol === symbol && !item.soldPrice) {
                                return {
                                    ...item,
                                    currentPrice: currentPrice,
                                    lastPriceUpdate: new Date().toISOString()
                                }
                            }
                            return item
                        })
                        // Iterate to next loop with fresh data? No, calculating state updates in loop is tricky.
                        // Better to build a map.
                    }
                }
            } catch (error) {
                console.error(`Error fetching price for ${symbol}:`, error)
            }
        }

        // Since I can't easily update state in loop, let's do massive update
        // Actually, simpler approach:
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
                <div className="bg-gradient-to-r from-emerald-600/10 to-transparent p-6 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black tracking-tight flex items-center">
                            <Briefcase className="h-6 w-6 mr-3 text-emerald-400" />
                            Assigned Stock Inventory
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">Manage stocks acquired via Cash-Secured Puts</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className={`px-4 py-2 rounded-xl border ${getTotalPnL() >= 0 ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                            <span className="text-xs font-bold uppercase tracking-widest mr-2 opacity-70">Total P&L:</span>
                            <span className="text-xl font-black">${getTotalPnL().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <button
                            onClick={handleRefreshPrices}
                            disabled={loading}
                            className="btn-primary flex items-center space-x-2 bg-blue-600 hover:bg-blue-500"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            <span>Update Prices</span>
                        </button>
                        <button
                            onClick={handleAddRow}
                            className="btn-primary flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Add Stock</span>
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20 backdrop-blur-sm">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/10">
                                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-3 whitespace-nowrap">Date Assigned</th>
                                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-3 whitespace-nowrap">Symbol</th>
                                <th className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-3 whitespace-nowrap">Shares</th>
                                <th className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-3 whitespace-nowrap">Assigned Price</th>
                                <th className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-3 whitespace-nowrap">Total Cost</th>
                                <th className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-3 whitespace-nowrap">Current Price</th>
                                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-3 whitespace-nowrap border-l border-white/5">Date Sold</th>
                                <th className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-3 whitespace-nowrap">Sold Price</th>
                                <th className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-3 whitespace-nowrap">P&L</th>
                                <th className="w-8"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {stockData.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="text-center py-16 text-gray-500">
                                        <div className="flex flex-col items-center justify-center space-y-3">
                                            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                                <Plus className="h-6 w-6 text-emerald-500/50" />
                                            </div>
                                            <p>No assigned stocks yet</p>
                                            <button
                                                onClick={handleAddRow}
                                                className="text-emerald-400 text-sm hover:underline"
                                            >
                                                Add your first stock
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
                                        <tr key={item.id} className={`group hover:bg-white/5 transition-colors ${isSold ? 'bg-emerald-900/5' : ''}`}>
                                            {/* Date Assigned */}
                                            <td className="px-3 py-3 w-[140px]">
                                                <input
                                                    type="date"
                                                    value={item.dateAssigned}
                                                    onChange={(e) => handleUpdateField(item.id, 'dateAssigned', e.target.value)}
                                                    className="bg-transparent text-gray-300 text-sm focus:text-white outline-none w-full cursor-pointer opacity-70 focus:opacity-100"
                                                />
                                            </td>
                                            {/* Symbol */}
                                            <td className="px-3 py-3">
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-300 shrink-0">
                                                        {item.symbol ? item.symbol.substring(0, 2) : '??'}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={item.symbol}
                                                        onChange={(e) => handleUpdateField(item.id, 'symbol', e.target.value.toUpperCase())}
                                                        placeholder="SYM"
                                                        className="bg-transparent font-bold text-white w-12 outline-none uppercase placeholder-gray-700"
                                                    />
                                                </div>
                                            </td>
                                            {/* Shares */}
                                            <td className="px-3 py-3">
                                                <input
                                                    type="number"
                                                    value={item.shares}
                                                    onChange={(e) => handleUpdateField(item.id, 'shares', e.target.value)}
                                                    className="bg-transparent text-right text-sm text-gray-300 focus:text-white outline-none w-full"
                                                />
                                            </td>
                                            {/* Assigned Price */}
                                            <td className="px-3 py-3 whitespace-nowrap">
                                                <div className="relative text-right">
                                                    <span className="text-gray-600 text-xs mr-1">$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.assignedPrice}
                                                        onChange={(e) => handleUpdateField(item.id, 'assignedPrice', e.target.value)}
                                                        className="bg-transparent text-sm text-gray-300 focus:text-white outline-none w-16 text-right"
                                                    />
                                                </div>
                                            </td>
                                            {/* Total Cost */}
                                            <td className="px-3 py-3 text-right whitespace-nowrap">
                                                <span className="text-sm font-mono text-gray-400">
                                                    ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                            {/* Current Price */}
                                            <td className="px-3 py-3 whitespace-nowrap">
                                                <div className="relative text-right">
                                                    <span className="text-gray-600 text-xs mr-1">$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.currentPrice}
                                                        onChange={(e) => handleUpdateField(item.id, 'currentPrice', e.target.value)}
                                                        className="bg-transparent text-sm font-medium text-blue-300 focus:text-blue-200 outline-none w-16 text-right"
                                                    />
                                                </div>
                                            </td>
                                            {/* Date Sold */}
                                            <td className="px-3 py-3 border-l border-white/5 w-[140px]">
                                                <input
                                                    type="date"
                                                    value={item.dateSold}
                                                    onChange={(e) => handleUpdateField(item.id, 'dateSold', e.target.value)}
                                                    className={`bg-transparent text-sm outline-none w-full cursor-pointer ${item.dateSold ? 'text-gray-300' : 'text-gray-600'}`}
                                                />
                                            </td>
                                            {/* Sold Price */}
                                            <td className="px-3 py-3 whitespace-nowrap">
                                                <div className="relative text-right">
                                                    <span className="text-gray-600 text-xs mr-1">$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.soldPrice}
                                                        onChange={(e) => handleUpdateField(item.id, 'soldPrice', e.target.value)}
                                                        className={`bg-transparent text-sm outline-none w-16 text-right ${item.soldPrice ? 'text-emerald-400 font-bold' : 'text-gray-600'}`}
                                                    />
                                                </div>
                                            </td>
                                            {/* P&L */}
                                            <td className="px-3 py-3 text-right whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${pnl >= 0
                                                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                    }`}>
                                                    {pnl >= 0 ? '+' : ''}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                            {/* Actions */}
                                            <td className="px-3 py-3 text-center">
                                                <button
                                                    onClick={() => handleDeleteRow(item.id)}
                                                    className="p-1.5 hover:bg-red-500/20 text-gray-600 hover:text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
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
                                <tr className="border-t-2 border-white/10 bg-white/5">
                                    <td colSpan="4" className="p-3 text-right font-bold text-gray-400 uppercase tracking-widest text-xs">Totals</td>
                                    <td className="p-3">
                                        <div className="font-bold text-sm text-gray-300 pl-2">
                                            ${stockData.reduce((sum, item) => sum + ((parseFloat(item.shares) || 0) * (parseFloat(item.assignedPrice) || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </td>
                                    <td colSpan="3"></td>
                                    <td className="p-3">
                                        <div className={`font-black text-sm pl-2 ${getTotalPnL() >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {getTotalPnL() >= 0 ? '+' : ''}${getTotalPnL().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
    )
}

export default StockPortfolio
