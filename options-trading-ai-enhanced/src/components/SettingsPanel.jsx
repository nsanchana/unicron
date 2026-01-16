import { useState } from 'react'
import { Settings, Save, DollarSign, Target, AlertTriangle } from 'lucide-react'

function SettingsPanel({ settings, onSettingsUpdate }) {
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
    <div className="max-w-2xl space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
          <Settings className="h-6 w-6 text-primary-400" />
          <span>Portfolio Settings</span>
        </h2>

        <div className="space-y-6">
          {/* Portfolio Size */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-primary-400" />
              <span>Portfolio Size ($)</span>
            </label>
            <input
              type="number"
              min="1000"
              step="1000"
              value={formData.portfolioSize}
              onChange={(e) => handleInputChange('portfolioSize', parseInt(e.target.value))}
              className="input-primary w-full"
              placeholder="71000"
            />
            <p className="text-xs text-gray-400 mt-1">
              Your total starting portfolio value for the year
            </p>
          </div>

          {/* Weekly Premium Target */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center space-x-2">
              <Target className="h-4 w-4 text-primary-400" />
              <span>Weekly Premium Target ($)</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={formData.weeklyPremiumTarget.min}
                  onChange={(e) => handleNestedChange('weeklyPremiumTarget', 'min', parseInt(e.target.value))}
                  className="input-primary w-full"
                  placeholder="340"
                />
                <p className="text-xs text-gray-400 mt-1">Minimum</p>
              </div>
              <div>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={formData.weeklyPremiumTarget.max}
                  onChange={(e) => handleNestedChange('weeklyPremiumTarget', 'max', parseInt(e.target.value))}
                  className="input-primary w-full"
                  placeholder="410"
                />
                <p className="text-xs text-gray-400 mt-1">Maximum</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Target premium income per week (25-30% annual return)
            </p>
          </div>

          {/* Max Trade Percentage */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-primary-400" />
              <span>Maximum Trade Allocation (%)</span>
            </label>
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={formData.maxTradePercentage}
              onChange={(e) => handleInputChange('maxTradePercentage', parseInt(e.target.value))}
              className="input-primary w-full"
              placeholder="50"
            />
            <p className="text-xs text-gray-400 mt-1">
              Maximum percentage of portfolio to allocate to a single trade
            </p>
          </div>

          {/* Trading Rules Summary */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Trading Rules Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Portfolio Size:</span>
                <span>${formData.portfolioSize?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Max per Trade:</span>
                <span>${((formData.portfolioSize * formData.maxTradePercentage) / 100).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Weekly Target:</span>
                <span>${formData.weeklyPremiumTarget.min} - ${formData.weeklyPremiumTarget.max}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Annual Target:</span>
                <span>${(formData.weeklyPremiumTarget.min * 52).toLocaleString()} - ${(formData.weeklyPremiumTarget.max * 52).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Validation Errors */}
          {errors.length > 0 && (
            <div className="bg-red-900 border border-red-700 rounded-lg p-4">
              <h3 className="font-semibold text-red-400 mb-2">Validation Errors</h3>
              <ul className="text-sm text-red-300 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={errors.length > 0}
              className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              <span>{saved ? 'Saved!' : 'Save Settings'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Risk Management Guidelines */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Risk Management Guidelines</h3>
        <div className="space-y-3 text-sm text-gray-300">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
            <p><strong>Cash Secured Puts:</strong> Primary strategy with 30-day expiry, close after 15-21 days</p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
            <p><strong>Covered Calls:</strong> Use 5-day expiry to maximize premium earnings</p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
            <p><strong>Position Sizing:</strong> Never exceed {formData.maxTradePercentage}% of portfolio per trade</p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
            <p><strong>Risk Tolerance:</strong> Conservative approach - prioritize capital preservation</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel