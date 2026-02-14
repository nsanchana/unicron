import { useState } from 'react'
import { Settings, Save, DollarSign, Target, AlertTriangle, Sun, Moon, Download, RefreshCw } from 'lucide-react'

function SettingsPanel({ settings, onSettingsUpdate, theme, onThemeToggle, onImportData, onExportData }) {
  const [formData, setFormData] = useState(settings)
  const [saved, setSaved] = useState(false)

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    setSaved(false)
  }

  const handleNestedChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }))
    setSaved(false)
  }

  const handleSave = () => {
    onSettingsUpdate(formData)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const validateSettings = () => {
    const errors = []
    if (formData.portfolioSize < 1000) {
      errors.push('Portfolio size must be at least $1,000')
    }
    if (formData.weeklyPremiumTarget.min >= formData.weeklyPremiumTarget.max) {
      errors.push('Minimum premium target must be less than maximum')
    }
    if (formData.maxTradePercentage > 100 || formData.maxTradePercentage < 1) {
      errors.push('Max trade percentage must be between 1% and 100%')
    }
    return errors
  }

  const errors = validateSettings()

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
            <Settings className="h-8 w-8 text-blue-400" />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tighter text-[var(--text-primary)] uppercase italic">Platform Settings</h2>
            <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-[0.2em] mt-1">Configure your trading engine & guardrails</p>
          </div>
        </div>
        {saved && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest animate-float shadow-lg shadow-emerald-500/10">
            ✓ Settings Securely Saved
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Portfolio Configuration */}
          <div className="glass-card">
            <div className="flex items-center space-x-3 mb-8 border-b border-white/5 pb-6">
              <div className="p-2 bg-blue-500/10 rounded-xl">
                <Target className="h-5 w-5 text-blue-400" />
              </div>
              <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight">Portfolio & Risk Control</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-3 ml-1">Initial Portfolio Size</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-blue-400 font-black">$</span>
                    </div>
                    <input
                      type="number"
                      value={formData.portfolioSize}
                      onChange={(e) => handleInputChange('portfolioSize', parseInt(e.target.value))}
                      className="glass-input w-full pl-10 pr-4 py-3.5 text-xl font-black text-[var(--text-primary)] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-3 ml-1">Risk Per Deployment Max (%)</label>
                  <div className="space-y-4">
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={formData.maxTradePercentage}
                      onChange={(e) => handleInputChange('maxTradePercentage', parseInt(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--inner-card-bg)] accent-blue-500 border border-white/5"
                    />
                    <div className="flex justify-between items-center bg-[var(--inner-card-bg)] p-3 rounded-xl border border-white/5">
                      <span className="text-2xl font-black text-[var(--text-primary)] font-mono">{formData.maxTradePercentage}%</span>
                      <span className="text-[10px] font-black text-red-400 uppercase tracking-widest bg-red-400/10 px-3 py-1.5 rounded-lg border border-red-500/20">
                        Max: ${((formData.portfolioSize * formData.maxTradePercentage) / 100).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-3 ml-1">Weekly Premium Objective</label>
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-[var(--inner-card-bg)] p-4 rounded-2xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500/30"></div>
                    <span className="text-[9px] font-black text-yellow-500 uppercase tracking-widest block mb-2">Target Minimum</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xl font-black text-[var(--text-primary)] font-mono">$</span>
                      <input
                        type="number"
                        value={formData.weeklyPremiumTarget.min}
                        onChange={(e) => handleNestedChange('weeklyPremiumTarget', 'min', parseInt(e.target.value))}
                        className="bg-transparent border-none p-0 text-2xl font-black text-[var(--text-primary)] font-mono w-full focus:ring-0"
                      />
                    </div>
                  </div>
                  <div className="bg-[var(--inner-card-bg)] p-4 rounded-2xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/30"></div>
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block mb-2">Target Maximum</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xl font-black text-[var(--text-primary)] font-mono">$</span>
                      <input
                        type="number"
                        value={formData.weeklyPremiumTarget.max}
                        onChange={(e) => handleNestedChange('weeklyPremiumTarget', 'max', parseInt(e.target.value))}
                        className="bg-transparent border-none p-0 text-2xl font-black text-[var(--text-primary)] font-mono w-full focus:ring-0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Display & Interface */}
          <div className="glass-card">
            <h3 className="text-sm font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Sun className="h-4 w-4 text-blue-400" /> Interface Engine
            </h3>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-[var(--inner-card-bg)] p-6 rounded-2xl border border-white/5">
              <div className="flex-1">
                <p className="text-[var(--text-primary)] font-bold mb-1">Visual Theme</p>
                <p className="text-xs text-[var(--text-secondary)] font-medium">Switch between high-contrast dark and elegant light interfaces.</p>
              </div>
              <div className="bg-black/20 p-1.5 rounded-2xl border border-white/5 flex w-full md:w-auto">
                <button
                  onClick={() => onThemeToggle('light')}
                  className={`flex-1 md:flex-none flex items-center justify-center space-x-3 px-8 py-3 rounded-xl transition-all duration-300 font-black uppercase tracking-widest text-[10px] ${theme === 'light'
                    ? 'bg-white text-slate-950 shadow-xl'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                  <span>Light Mode</span>
                </button>
                <button
                  onClick={() => onThemeToggle('dark')}
                  className={`flex-1 md:flex-none flex items-center justify-center space-x-3 px-8 py-3 rounded-xl transition-all duration-300 font-black uppercase tracking-widest text-[10px] ${theme === 'dark'
                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                >
                  <Moon className="h-3.5 w-3.5" />
                  <span>Dark Mode</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Action Center */}
          <div className="space-y-4">
            <button
              onClick={handleSave}
              disabled={errors.length > 0}
              className={`w-full p-6 rounded-2xl border transition-all duration-300 flex items-center justify-center space-x-4 group shadow-xl ${saved
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-blue-500/20'
                }`}
            >
              <div className={`p-2 rounded-xl transition-transform ${saved ? 'bg-emerald-500 text-black' : 'bg-white/20 group-hover:rotate-12'}`}>
                {saved ? <RefreshCw className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
              </div>
              <span className="text-xl font-black uppercase tracking-tighter italic">
                {saved ? 'Processing...' : 'Commit Changes'}
              </span>
            </button>

            {errors.length > 0 && (
              <div className="glass-card border-red-500/30 bg-red-500/5 p-6 animate-shake">
                <h4 className="text-sm font-black text-red-400 mb-3 flex items-center uppercase tracking-widest">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  System Warnings
                </h4>
                <ul className="space-y-2">
                  {errors.map((error, index) => (
                    <li key={index} className="text-[10px] font-black text-red-300 uppercase leading-relaxed tracking-wider flex items-start">
                      <span className="mr-2">🚨</span> {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Strategic Guardrails */}
          <div className="glass-card bg-gradient-to-b from-blue-600/5 to-transparent border-blue-500/20">
            <h3 className="text-xs font-black text-blue-400 mb-6 uppercase tracking-[0.2em] border-b border-blue-500/10 pb-4 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Strategic Directives
            </h3>
            <div className="space-y-6">
              <div className="group bg-white/5 p-4 rounded-2xl border border-white/5 transition-all hover:bg-white/10">
                <p className="text-[9px] font-black text-[var(--text-secondary)] mb-2 uppercase tracking-widest">Est. Annual Target</p>
                <div className="text-2xl font-black text-[var(--text-primary)] font-mono tracking-tighter leading-none">
                  ${(formData.weeklyPremiumTarget.min * 52).toLocaleString()} - ${(formData.weeklyPremiumTarget.max * 52).toLocaleString()}
                </div>
              </div>

              <div className="p-4 bg-[var(--inner-card-bg)] rounded-2xl border border-white/5 space-y-4">
                <h4 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-4">Core Guardrails</h4>
                <div className="space-y-3">
                  {[
                    { text: '30D Cash Secured Puts', color: 'bg-emerald-400' },
                    { text: '5D Covered Calls', color: 'bg-blue-400' },
                    { text: 'Capital Preservation Primary', color: 'bg-red-400' }
                  ].map((rule, idx) => (
                    <div key={idx} className="flex items-center space-x-3 group">
                      <div className={`w-1.5 h-1.5 rounded-full ${rule.color} shadow-[0_0_8px_currentColor] group-hover:scale-125 transition-transform`} />
                      <span className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wide">{rule.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Data Backup */}
          <div className="glass-card border-purple-500/20">
            <h3 className="text-xs font-black text-purple-400 mb-4 uppercase tracking-[0.2em] flex items-center border-b border-purple-500/10 pb-4">
              <Download className="h-4 w-4 mr-2" /> Data Intelligence
            </h3>
            <div className="space-y-3">
              <button
                onClick={onExportData}
                className="w-full flex items-center justify-center space-x-3 bg-[var(--inner-card-bg)] hover:bg-white/10 text-[var(--text-primary)] py-4 rounded-xl border border-white/5 transition-all font-black uppercase tracking-widest text-[10px] group"
              >
                <Download className="h-4 w-4 text-blue-400 group-hover:translate-y-0.5 transition-transform" />
                <span>Export JSON Vault</span>
              </button>

              <label className="block w-full cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = (event) => {
                      try {
                        const data = JSON.parse(event.target.result)
                        const success = onImportData(data)
                        if (success) {
                          alert('Vault restored successfully!')
                          window.location.reload()
                        }
                      } catch (err) {
                        alert('Data corruption detected: ' + err.message)
                      }
                    }
                    reader.readAsText(file)
                  }}
                />
                <div className="w-full flex items-center justify-center space-x-3 bg-[var(--inner-card-bg)] hover:bg-white/10 text-[var(--text-primary)] py-4 rounded-xl border border-white/5 transition-all font-black uppercase tracking-widest text-[10px] group">
                  <Save className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span>Restore from Vault</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel