/**
 * Manual Verification Script for Scoring Logic
 * This script simulates the frontend's score calculation logic using actual data structures
 * returned by the updated API (mocked for testing purposes to avoid costs/delays).
 */

function calculateGlobalScore(data) {
    const companyPillars = [
        data.companyAnalysis?.detailedAnalysis?.marketPosition?.rating || 0,
        data.companyAnalysis?.detailedAnalysis?.businessModel?.rating || 0,
        data.companyAnalysis?.detailedAnalysis?.industryTrends?.rating || 0,
        data.companyAnalysis?.detailedAnalysis?.customerBase?.rating || 0,
        data.companyAnalysis?.detailedAnalysis?.growthStrategy?.rating || 0,
        data.companyAnalysis?.detailedAnalysis?.economicMoat?.rating || 0
    ].filter(r => r > 0)

    const otherModules = [
        data.financialHealth?.rating || 0,
        data.technicalAnalysis?.rating || 0,
        data.recentDevelopments?.rating || 0
    ].filter(r => r > 0)

    const allRatings = [...companyPillars, ...otherModules]

    if (allRatings.length === 0) return 0
    return Math.round(allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length)
}

// Test Case 1: Strong Company (high variance)
const strongCompany = {
    companyAnalysis: {
        detailedAnalysis: {
            marketPosition: { rating: 90 },
            businessModel: { rating: 85 },
            industryTrends: { rating: 75 },
            customerBase: { rating: 95 },
            growthStrategy: { rating: 80 },
            economicMoat: { rating: 90 }
        }
    },
    financialHealth: { rating: 92 },
    technicalAnalysis: { rating: 85 },
    recentDevelopments: { rating: 70 }
}

// Test Case 2: Struggling Company (low ratings)
const weakCompany = {
    companyAnalysis: {
        detailedAnalysis: {
            marketPosition: { rating: 30 },
            businessModel: { rating: 40 },
            industryTrends: { rating: 25 },
            customerBase: { rating: 50 },
            growthStrategy: { rating: 35 },
            economicMoat: { rating: 20 }
        }
    },
    financialHealth: { rating: 25 },
    technicalAnalysis: { rating: 40 },
    recentDevelopments: { rating: 30 }
}

const strongScore = calculateGlobalScore(strongCompany)
const weakScore = calculateGlobalScore(weakCompany)

console.log(`Strong Company Global Score: ${strongScore}/100`)
console.log(`Weak Company Global Score: ${weakScore}/100`)
console.log(`Variance: ${strongScore - weakScore} points`)

if (strongScore >= 80 && weakScore <= 40) {
    console.log("SUCCESS: Scoring logic shows significant variance!")
} else {
    console.log("WARNING: Variance might still be low.")
}
