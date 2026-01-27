import { useState } from 'react'
import { Settings, Save, DollarSign, Target, AlertTriangle, Sun, Moon, Download } from 'lucide-react'

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
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-black tracking-tight flex items-center space-x-3">
          <Settings className="h-8 w-8 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
          <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            System Preferences
          </span>
        </h2>
        {saved && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-sm font-bold animate-float">
            ✓ Settings Securely Saved
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600/10 to-transparent p-6 border-b border-white/5">
              <h3 className="text-lg font-bold text-white flex items-center">
                <Target className="h-5 w-5 mr-2 text-blue-400" />
                Capital Control & Targets
              </h3>
            </div>

            <div className="p-8 space-y-8">
              {/* Portfolio Size */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest ml-1">
                  Total Portfolio Capital ($)
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <DollarSign className="h-5 w-5 text-blue-400 group-focus-within:text-blue-300 transition-colors" />
                  </div>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    value={formData.portfolioSize}
                    onChange={(e) => handleInputChange('portfolioSize', parseInt(e.target.value))}
                    className="glass-input w-full pl-12 py-4 text-xl font-bold"
                  />
                </div>
              </div>

              {/* Weekly Premium Target */}
              <div className="space-y-4">
                <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest ml-1">
                  Weekly Premium Objective
                </label>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-gray-500 ml-1">MINIMUM TARGET</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={formData.weeklyPremiumTarget.min}
                      onChange={(e) => handleNestedChange('weeklyPremiumTarget', 'min', parseInt(e.target.value))}
                      className="glass-input w-full py-4 text-center text-lg font-bold text-yellow-400/90"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-gray-500 ml-1">MAXIMUM TARGET</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={formData.weeklyPremiumTarget.max}
                      onChange={(e) => handleNestedChange('weeklyPremiumTarget', 'max', parseInt(e.target.value))}
                      className="glass-input w-full py-4 text-center text-lg font-bold text-emerald-400/90"
                    />
                  </div>
                </div>
              </div>

              {/* Max Trade Percentage */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest ml-1">
                  Risk Per Deployment Max (%)
                </label>
                <div className="relative group">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={formData.maxTradePercentage}
                    onChange={(e) => handleInputChange('maxTradePercentage', parseInt(e.target.value))}
                    className="w-full h-2 glass-item appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-3xl font-black text-white">{formData.maxTradePercentage}%</span>
                    <span className="text-sm font-bold text-red-400/80 bg-red-400/10 px-3 py-1 rounded-full">
                      MAX ALLOCATION: ${((formData.portfolioSize * formData.maxTradePercentage) / 100).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-8">
            <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-widest border-b border-white/5 pb-4">Display Engine</h3>
            <div className="flex items-center justify-between">
              <p className="text-gray-400 font-medium">Choose your primary visual interface theme</p>
              <div className="bg-gray-900/50 p-1.5 rounded-2xl border border-white/5 flex space-x-2">
                <button
                  onClick={() => onThemeToggle('light')}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-xl transition-all duration-300 font-bold ${theme === 'light'
                    ? 'bg-white text-gray-900 shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                    : 'text-gray-400 hover:text-white'
                    }`}
                >
                  <Sun className="h-4 w-4" />
                  <span>Light</span>
                </button>
                <button
                  onClick={() => onThemeToggle('dark')}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-xl transition-all duration-300 font-bold ${theme === 'dark'
                    ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]'
                    : 'text-gray-400 hover:text-white'
                    }`}
                >
                  <Moon className="h-4 w-4" />
                  <span>Dark</span>
                </button>
              </div>
            </div>
          </div>

          {/* Data Management Card */}
          <div className="glass-card overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600/10 to-transparent p-6 border-b border-white/5">
              <h3 className="text-lg font-bold text-white flex items-center">
                <Save className="h-5 w-5 mr-2 text-purple-400" />
                Data Management
              </h3>
            </div>

            <div className="p-8">
              <p className="text-gray-400 text-sm mb-6">
                Manually backup your research, trades, and settings to a local file, or restore from a previous backup.
                Use this to transfer data between devices.
              </p>

              <div className="flex space-x-4">
                <button
                  onClick={onExportData}
                  className="flex-1 flex items-center justify-center space-x-2 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl border border-white/10 transition-all font-bold group"
                >
                  <Download className="h-4 w-4 text-blue-400 group-hover:scale-110 transition-transform" />
                  <span>Export Backup</span>
                </button>

                <label className="flex-1 cursor-pointer">
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
                            alert('Data imported successfully!')
                            window.location.reload() // Reload to reflect changes
                          }
                        } catch (err) {
                          alert('Failed to parse import file: ' + err.message)
                        }
                      }
                      reader.readAsText(file)
                    }}
                  />
                  <div className="flex items-center justify-center space-x-2 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl border border-white/10 transition-all font-bold h-full group">
                    <Save className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span>Import Backup</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="glass-card bg-gradient-to-b from-blue-600/5 to-transparent border-blue-500/20">
          <h3 className="text-sm font-black text-blue-400 mb-6 uppercase tracking-[0.2em] border-b border-blue-500/10 pb-4 flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Strategic Guardrails
          </h3>
          <div className="space-y-6">
            <div className="group">
              <p className="text-xs font-bold text-gray-500 mb-2">EXPECTED ANNUAL YIELD</p>
              <div className="text-2xl font-black text-white">
                ${(formData.weeklyPremiumTarget.min * 52).toLocaleString()} - ${(formData.weeklyPremiumTarget.max * 52).toLocaleString()}
              </div>
              <div className="h-1 w-full glass-item rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 w-[70%]" />
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4">
              <h4 className="text-xs font-bold text-gray-400">CORE DIRECTIVES</h4>
              <div className="space-y-3">
                {[
                  { text: '30D Cash Secured Puts', color: 'bg-emerald-400' },
                  { text: '5D Covered Calls', color: 'bg-blue-400' },
                  { text: 'Capital Preservation First', color: 'bg-red-400' }
                ].map((rule, idx) => (
                  <div key={idx} className="flex items-center space-x-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${rule.color} shadow-[0_0_8px_currentColor]`} />
                    <span className="text-sm font-bold text-gray-300">{rule.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={errors.length > 0}
          className="w-full glass-card bg-blue-600 hover:bg-blue-500 text-white border-blue-400/50 py-6 transition-all duration-300 flex items-center justify-center space-x-3 group active:scale-[0.98] disabled:opacity-50"
        >
          <div className="p-2 bg-white/20 rounded-lg group-hover:rotate-12 transition-transform">
            <Save className="h-6 w-6" />
          </div>
          <span className="text-xl font-black tracking-tight uppercase">
            {saved ? 'Securely Updated' : 'Commit Changes'}
          </span>
        </button>

        {errors.length > 0 && (
          <div className="glass-card border-red-500/30 bg-red-500/5 p-6 animate-pulse">
            <h4 className="text-sm font-bold text-red-400 mb-3 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2" />
              SYSTEM ERROR
            </h4>
            <ul className="space-y-1">
              {errors.map((error, index) => (
                <li key={index} className="text-xs font-bold text-red-300 uppercase leading-relaxed">
                  🚨 {error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsPanel