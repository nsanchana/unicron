import { useState } from 'react'
import { Settings, Save, Target, AlertTriangle, Sun, Moon, Download, Check, Wallet, PlusCircle, Trash2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

function SettingsPanel({ settings, onSettingsUpdate, theme, onThemeToggle, onImportData, onExportData }) {
  const [formData, setFormData] = useState(settings)
  const [saved, setSaved] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const [newTx, setNewTx] = useState({ date: today, type: 'deposit', amount: '', note: '' })

  const fundingHistory = (formData.fundingHistory || []).slice().sort((a, b) => b.date.localeCompare(a.date))
  const totalDeposited = (formData.fundingHistory || []).reduce(
    (s, t) => s + (t.type === 'deposit' ? t.amount : -t.amount), 0
  )

  const handleAddTransaction = () => {
    const amount = parseFloat(newTx.amount)
    if (!newTx.date || isNaN(amount) || amount <= 0) return
    const tx = { id: Date.now(), date: newTx.date, type: newTx.type, amount, note: newTx.note || '' }
    const updated = [...(formData.fundingHistory || []), tx]
    const newTotal = updated.reduce((s, t) => s + (t.type === 'deposit' ? t.amount : -t.amount), 0)
    const newSettings = { ...formData, fundingHistory: updated, totalDeposited: parseFloat(newTotal.toFixed(2)) }
    setFormData(newSettings)
    onSettingsUpdate(newSettings)
    setNewTx({ date: today, type: 'deposit', amount: '', note: '' })
  }

  const handleDeleteTransaction = (id) => {
    const updated = (formData.fundingHistory || []).filter(t => t.id !== id)
    const newTotal = updated.reduce((s, t) => s + (t.type === 'deposit' ? t.amount : -t.amount), 0)
    const newSettings = { ...formData, fundingHistory: updated, totalDeposited: parseFloat(newTotal.toFixed(2)) }
    setFormData(newSettings)
    onSettingsUpdate(newSettings)
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const handleNestedChange = (parent, field, value) => {
    setFormData(prev => ({ ...prev, [parent]: { ...prev[parent], [field]: value } }))
    setSaved(false)
  }

  const handleSave = () => {
    onSettingsUpdate(formData)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const validateSettings = () => {
    const errors = []
    if (formData.portfolioSize < 1000) errors.push('Portfolio size must be at least $1,000')
    if (formData.weeklyPremiumTarget.min >= formData.weeklyPremiumTarget.max) errors.push('Minimum premium target must be less than maximum')
    if (formData.maxTradePercentage > 100 || formData.maxTradePercentage < 1) errors.push('Max trade percentage must be between 1% and 100%')
    return errors
  }

  const errors = validateSettings()
  const inputCls = "w-full bg-white/[0.06] border border-white/[0.10] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all"
  const labelCls = "text-xs font-medium text-white/50 mb-1.5 block"

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">

      {/* Page Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-6 border-b border-white/[0.06]">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-500/10 rounded-2xl border border-slate-500/20">
              <Settings className="h-6 w-6 text-slate-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
          </div>
          <p className="text-white/40 font-medium text-sm ml-[52px]">Configure your portfolio and trading guardrails.</p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full text-sm font-medium">
            <Check className="h-4 w-4" /> Saved
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">

          {/* Portfolio & Risk */}
          <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-6 space-y-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-white/[0.06]">
              <Target className="h-4 w-4 text-blue-400" />
              <h3 className="text-base font-semibold text-white">Portfolio &amp; Risk Control</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-5">
                {/* Portfolio size */}
                <div>
                  <label className={labelCls}>Portfolio Size</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-semibold text-sm">$</span>
                    <input
                      type="number"
                      value={formData.portfolioSize}
                      onChange={(e) => handleInputChange('portfolioSize', parseInt(e.target.value))}
                      className={inputCls + ' pl-8 font-mono'}
                    />
                  </div>
                </div>

                {/* Max trade % */}
                <div>
                  <label className={labelCls}>Max Risk Per Trade (%)</label>
                  <input
                    type="range" min="1" max="100" step="1"
                    value={formData.maxTradePercentage}
                    onChange={(e) => handleInputChange('maxTradePercentage', parseInt(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-blue-500 bg-white/10 mb-3"
                  />
                  <div className="flex items-center justify-between bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5">
                    <span className="text-lg font-bold text-white font-mono">{formData.maxTradePercentage}%</span>
                    <span className="text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/15 px-3 py-1 rounded-full">
                      Max ${((formData.portfolioSize * formData.maxTradePercentage) / 100).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Weekly premium targets */}
              <div className="space-y-3">
                <label className={labelCls}>Weekly Premium Target</label>
                <div className="bg-white/[0.04] border border-amber-500/20 rounded-xl p-4">
                  <p className="text-[10px] font-semibold text-amber-400 mb-2">Minimum</p>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-sm font-semibold">$</span>
                    <input
                      type="number"
                      value={formData.weeklyPremiumTarget.min}
                      onChange={(e) => handleNestedChange('weeklyPremiumTarget', 'min', parseInt(e.target.value))}
                      className="bg-transparent border-none p-0 text-xl font-bold text-white font-mono w-full focus:outline-none"
                    />
                  </div>
                </div>
                <div className="bg-white/[0.04] border border-emerald-500/20 rounded-xl p-4">
                  <p className="text-[10px] font-semibold text-emerald-400 mb-2">Maximum</p>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-sm font-semibold">$</span>
                    <input
                      type="number"
                      value={formData.weeklyPremiumTarget.max}
                      onChange={(e) => handleNestedChange('weeklyPremiumTarget', 'max', parseInt(e.target.value))}
                      className="bg-transparent border-none p-0 text-xl font-bold text-white font-mono w-full focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Funding History */}
          <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <Wallet className="h-4 w-4 text-emerald-400" />
                <h3 className="text-base font-semibold text-white">Funding History</h3>
              </div>
              <div className="text-right">
                <p className="text-lg font-black font-mono text-emerald-400">${totalDeposited.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="text-[10px] text-white/35 uppercase tracking-widest">{(formData.fundingHistory || []).length} transactions</p>
              </div>
            </div>

            {/* Add transaction form */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
              <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Add Transaction</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className={labelCls}>Date</label>
                  <input type="date" value={newTx.date}
                    onChange={e => setNewTx(p => ({ ...p, date: e.target.value }))}
                    className={inputCls + ' text-xs'}
                  />
                </div>
                <div>
                  <label className={labelCls}>Type</label>
                  <select value={newTx.type}
                    onChange={e => setNewTx(p => ({ ...p, type: e.target.value }))}
                    className={inputCls + ' text-xs'}
                  >
                    <option value="deposit">Deposit</option>
                    <option value="withdrawal">Withdrawal</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Amount ($)</label>
                  <input type="number" placeholder="0.00" value={newTx.amount}
                    onChange={e => setNewTx(p => ({ ...p, amount: e.target.value }))}
                    className={inputCls + ' font-mono text-xs'}
                  />
                </div>
                <div>
                  <label className={labelCls}>Note (optional)</label>
                  <input type="text" placeholder="e.g. Top-up" value={newTx.note}
                    onChange={e => setNewTx(p => ({ ...p, note: e.target.value }))}
                    className={inputCls + ' text-xs'}
                  />
                </div>
              </div>
              <button onClick={handleAddTransaction}
                disabled={!newTx.date || !newTx.amount || parseFloat(newTx.amount) <= 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 rounded-xl text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <PlusCircle className="h-4 w-4" /> Add
              </button>
            </div>

            {/* Transaction log */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {fundingHistory.length === 0 ? (
                <p className="text-sm text-white/30 text-center py-6">No transactions yet</p>
              ) : fundingHistory.map(tx => (
                <div key={tx.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${tx.type === 'deposit' ? 'bg-emerald-500/[0.04] border-emerald-500/10' : 'bg-rose-500/[0.04] border-rose-500/10'}`}>
                  {tx.type === 'deposit'
                    ? <ArrowDownCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    : <ArrowUpCircle   className="h-4 w-4 text-rose-400 shrink-0" />}
                  <span className="text-[11px] text-white/40 font-mono w-24 shrink-0">{tx.date}</span>
                  <span className={`text-sm font-black font-mono flex-1 ${tx.type === 'deposit' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tx.type === 'deposit' ? '+' : '-'}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {tx.note && <span className="text-[11px] text-white/30 truncate max-w-[120px]">{tx.note}</span>}
                  <button onClick={() => handleDeleteTransaction(tx.id)}
                    className="ml-auto p-1.5 rounded-lg hover:bg-rose-500/10 text-white/20 hover:text-rose-400 transition-all shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] p-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-white/[0.06] mb-5">
              <Sun className="h-4 w-4 text-amber-400" />
              <h3 className="text-base font-semibold text-white">Interface Theme</h3>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-white/50 font-medium">Switch between light and dark mode.</p>
              <div className="flex bg-white/[0.06] border border-white/[0.08] rounded-full p-1 gap-1">
                <button
                  onClick={() => onThemeToggle('light')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${theme === 'light' ? 'bg-white text-black shadow' : 'text-white/50 hover:text-white'}`}
                >
                  <Sun className="h-3.5 w-3.5" /> Light
                </button>
                <button
                  onClick={() => onThemeToggle('dark')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${theme === 'dark' ? 'bg-blue-500 text-white shadow' : 'text-white/50 hover:text-white'}`}
                >
                  <Moon className="h-3.5 w-3.5" /> Dark
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={errors.length > 0}
            className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-full font-semibold text-sm transition-all active:scale-95 disabled:opacity-40 ${
              saved ? 'bg-emerald-500/15 border border-emerald-500/20 text-emerald-400' : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved' : 'Save Settings'}
          </button>

          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-[16px] p-4 animate-shake">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                <h4 className="text-sm font-semibold text-rose-400">Validation Errors</h4>
              </div>
              <ul className="space-y-1.5">
                {errors.map((error, i) => (
                  <li key={i} className="text-xs text-rose-300 leading-relaxed">• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Annual target */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-[16px] p-4 space-y-3">
            <h4 className="text-xs font-semibold text-white/40">Est. Annual Target</h4>
            <p className="text-lg font-bold text-white font-mono">
              ${(formData.weeklyPremiumTarget.min * 52).toLocaleString()} – ${(formData.weeklyPremiumTarget.max * 52).toLocaleString()}
            </p>
            <div className="pt-2 border-t border-white/[0.06] space-y-2">
              {[
                { text: '30D Cash Secured Puts', color: 'text-emerald-400' },
                { text: '5D Covered Calls',      color: 'text-blue-400'    },
                { text: 'Capital Preservation',  color: 'text-rose-400'    },
              ].map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full bg-current ${r.color}`} />
                  <span className={`text-xs font-medium ${r.color}`}>{r.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Data backup */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-[16px] p-4 space-y-3">
            <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
              <Download className="h-4 w-4 text-purple-400" />
              <h4 className="text-xs font-semibold text-white/60">Data Backup</h4>
            </div>
            <button
              onClick={onExportData}
              className="w-full flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white/70 hover:text-white py-2.5 rounded-xl text-sm font-medium transition-all"
            >
              <Download className="h-4 w-4" /> Export JSON
            </button>
            <label className="block w-full cursor-pointer">
              <input
                type="file" accept=".json" className="hidden"
                onChange={(e) => {
                  const file = e.target.files[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = (event) => {
                    try {
                      const data = JSON.parse(event.target.result)
                      const success = onImportData(data)
                      if (success) { alert('Data restored successfully!'); window.location.reload() }
                    } catch (err) { alert('Import failed: ' + err.message) }
                  }
                  reader.readAsText(file)
                }}
              />
              <div className="w-full flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white/70 hover:text-white py-2.5 rounded-xl text-sm font-medium transition-all">
                <Save className="h-4 w-4" /> Import JSON
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
