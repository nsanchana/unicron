
// Diagnostic Script for Granular Scoring Fixes (v1.3.1)
const weights = {
    businessModel: 0.25,
    financialHealth: 0.20,
    marketPosition: 0.15,
    growthStrategy: 0.15,
    economicMoat: 0.15,
    industryTrends: 0.10
};

function calculateOverallRating(analysis) {
    let weightedSum = 0;
    let totalWeight = 0;

    Object.keys(weights).forEach(cat => {
        const rating = analysis[cat]?.rating;
        // The newly hardened logic in server.js/api/index.js
        if (typeof rating === 'number' && !isNaN(rating)) {
            weightedSum += rating * weights[cat];
            totalWeight += weights[cat];
        }
    });

    let overallRating = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

    // Boundary check
    overallRating = Math.min(100, Math.max(0, overallRating));

    return overallRating;
}

// Test Case 1: Generational Leader (AAPL-like)
const leader = {
    businessModel: { rating: 98 },
    financialHealth: { rating: 95 },
    marketPosition: { rating: 92 },
    growthStrategy: { rating: 88 },
    economicMoat: { rating: 97 },
    industryTrends: { rating: 85 }
};

// Test Case 2: Volatile/Growth (TSLA-like)
const volatile = {
    businessModel: { rating: 85 },
    financialHealth: { rating: 65 },
    marketPosition: { rating: 80 },
    growthStrategy: { rating: 95 },
    economicMoat: { rating: 70 },
    industryTrends: { rating: 90 }
};

// Test Case 3: Underperforming/Value (INTC-like)
const underperformer = {
    businessModel: { rating: 55 },
    financialHealth: { rating: 45 },
    marketPosition: { rating: 50 },
    growthStrategy: { rating: 40 },
    economicMoat: { rating: 45 },
    industryTrends: { rating: 35 }
};

// EDGE CASE: Missing Categories (Previously likely cause of 663)
const incomplete = {
    businessModel: { rating: 70 },
    financialHealth: { rating: 80 }
    // others missing
};

// EDGE CASE: Bad Data (NaN/Undefined)
const buggy = {
    businessModel: { rating: 90 },
    financialHealth: { rating: "90" }, // string
    marketPosition: { rating: NaN },    // NaN
    economicMoat: { rating: undefined } // undefined
};

console.log('--- Granular Scoring Fix Verification (v1.3.1) ---');
console.log('Generational Leader Score:', calculateOverallRating(leader));       // Expect ~93
console.log('Volatile/Growth Score:', calculateOverallRating(volatile));       // Expect ~79
console.log('Underperformer Score:', calculateOverallRating(underperformer));   // Expect ~47
console.log('Incomplete Data Score:', calculateOverallRating(incomplete));     // Expect ~74 (normalized weight)
console.log('Buggy Data Score:', calculateOverallRating(buggy));               // Expect 90 (handles bad types)
console.log('--------------------------------------------------');
