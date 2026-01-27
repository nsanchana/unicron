// Local storage utilities for data persistence

export const STORAGE_KEYS = {
  PORTFOLIO_SETTINGS: 'optionsTrading_portfolioSettings',
  RESEARCH_DATA: 'optionsTrading_researchData',
  TRADE_DATA: 'optionsTrading_tradeData',
  STOCK_DATA: 'optionsTrading_stockData',
  LAST_REFRESH: 'optionsTrading_lastRefresh'
}

// Generic localStorage functions
export function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error(`Error saving ${key}:`, error)
  }
}

export function loadFromLocalStorage(key) {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error(`Error loading ${key}:`, error)
    return null
  }
}

// Portfolio settings
export function savePortfolioSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.PORTFOLIO_SETTINGS, JSON.stringify(settings))
  } catch (error) {
    console.error('Error saving portfolio settings:', error)
  }
}

export function loadPortfolioSettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PORTFOLIO_SETTINGS)
    return data ? JSON.parse(data) : {
      capital: 71000,
      maxAllocation: 50,
      weeklyPremiumTarget: { min: 340, max: 410 },
      riskTolerance: 'conservative',
      tradingRules: {
        cashSecuredPut: { maxDays: 30 },
        coveredCall: { maxDays: 5 }
      }
    }
  } catch (error) {
    console.error('Error loading portfolio settings:', error)
    return null
  }
}

// Research data
export function saveResearchData(data) {
  try {
    localStorage.setItem(STORAGE_KEYS.RESEARCH_DATA, JSON.stringify(data))
  } catch (error) {
    console.error('Error saving research data:', error)
  }
}

export function loadResearchData() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RESEARCH_DATA)
    if (!data) return []

    const researchData = JSON.parse(data)

    // Migrate old 0-10 ratings to 0-100 scale
    const migratedData = researchData.map(item => {
      if (item.overallRating !== undefined && item.overallRating <= 10 && item.overallRating >= 0) {
        return {
          ...item,
          overallRating: item.overallRating * 10
        }
      }
      return item
    })

    // Save migrated data back to localStorage
    if (migratedData.some((item, index) => item.overallRating !== researchData[index].overallRating)) {
      saveToLocalStorage(STORAGE_KEYS.RESEARCH_DATA, migratedData)
    }

    return migratedData
  } catch (error) {
    console.error('Error loading research data:', error)
    return []
  }
}

// Trade data
export function saveTradeData(data) {
  try {
    localStorage.setItem(STORAGE_KEYS.TRADE_DATA, JSON.stringify(data))
  } catch (error) {
    console.error('Error saving trade data:', error)
  }
}

export function loadTradeData() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TRADE_DATA)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Error loading trade data:', error)
    return []
  }
}

// Last refresh timestamp
export function saveLastRefresh(timestamp) {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_REFRESH, timestamp.toISOString())
  } catch (error) {
    console.error('Error saving last refresh:', error)
  }
}

export function loadLastRefresh() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LAST_REFRESH)
    return data ? new Date(data) : new Date()
  } catch (error) {
    console.error('Error loading last refresh:', error)
    return new Date()
  }
}

// CSV export functionality
export function exportToCSV(data, filename) {
  if (!data || data.length === 0) {
    alert('No data to export')
    return
  }

  // Get all unique keys from the data
  const headers = new Set()
  data.forEach(item => {
    Object.keys(item).forEach(key => {
      if (typeof item[key] !== 'object' || item[key] === null) {
        headers.add(key)
      }
    })
  })

  // Create CSV content
  const csvContent = [
    Array.from(headers).join(','),
    ...data.map(row =>
      Array.from(headers).map(header => {
        const value = row[header]
        if (value === null || value === undefined) return ''
        if (typeof value === 'object') return JSON.stringify(value)
        // Escape commas and quotes in CSV
        const stringValue = String(value)
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      }).join(',')
    )
  ].join('\n')

  // Create and download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Clear all data
export function clearAllData() {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
    return true
  } catch (error) {
    console.error('Error clearing data:', error)
    return false
  }
}

// Get storage usage info
export function getStorageInfo() {
  try {
    let totalSize = 0
    let itemCount = 0

    Object.values(STORAGE_KEYS).forEach(key => {
      const data = localStorage.getItem(key)
      if (data) {
        totalSize += data.length
        itemCount++
      }
    })

    return {
      totalSize: Math.round(totalSize / 1024), // KB
      itemCount,
      maxSize: 5120 // 5MB typical limit
    }
  } catch (error) {
    console.error('Error getting storage info:', error)
    return null
  }
}