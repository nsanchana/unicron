// Black-Scholes model and options calculations
// Based on standard financial mathematics formulas

export function calculateOptionGreeks(S, K, T, optionType, r, sigma) {
  // S: current stock price
  // K: strike price
  // T: time to expiration in years
  // r: risk-free rate
  // sigma: volatility

  if (!S || !K || !T || T <= 0) {
    return {
      delta: null,
      gamma: null,
      theta: null,
      vega: null,
      rho: null,
      interpretation: 'Invalid parameters for Greeks calculation'
    }
  }

  // Convert T to years if it's in days
  if (T > 1) T = T / 365

  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)

  // Cumulative normal distribution
  const N = (x) => {
    const a1 = 0.254829592
    const a2 = -0.284496736
    const a3 = 1.421413741
    const a4 = -1.453152027
    const a5 = 1.061405429
    const p = 0.3275911

    const sign = x < 0 ? -1 : 1
    x = Math.abs(x) / Math.sqrt(2.0)

    const t = 1.0 / (1.0 + p * x)
    const erf = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

    return 0.5 * (1.0 + sign * erf)
  }

  const n = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)

  let delta, gamma, theta, vega, rho

  if (optionType === 'call') {
    delta = N(d1)
    gamma = n(d1) / (S * sigma * Math.sqrt(T))
    theta = -(S * sigma * n(d1)) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * N(d2)
    vega = S * Math.sqrt(T) * n(d1)
    rho = K * T * Math.exp(-r * T) * N(d2)
  } else { // put
    delta = -N(-d1)
    gamma = n(d1) / (S * sigma * Math.sqrt(T))
    theta = -(S * sigma * n(d1)) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * N(-d2)
    vega = S * Math.sqrt(T) * n(d1)
    rho = -K * T * Math.exp(-r * T) * N(-d2)
  }

  // Generate interpretation
  let interpretation = ''

  if (optionType === 'call') {
    if (delta > 0.6) interpretation += 'High delta indicates strong directional bias. '
    else if (delta < 0.3) interpretation += 'Low delta suggests limited directional exposure. '

    if (gamma > 0.05) interpretation += 'High gamma means position sensitivity increases near expiration. '
    if (theta < -0.05) interpretation += 'Significant time decay working in your favor. '
    if (vega > 0.1) interpretation += 'High vega means volatility changes will significantly impact the position. '
  } else { // put
    if (Math.abs(delta) > 0.6) interpretation += 'High delta indicates strong directional bias. '
    else if (Math.abs(delta) < 0.3) interpretation += 'Low delta suggests limited directional exposure. '

    if (gamma > 0.05) interpretation += 'High gamma means position sensitivity increases near expiration. '
    if (theta < -0.05) interpretation += 'Significant time decay working in your favor. '
    if (vega > 0.1) interpretation += 'High vega means volatility changes will significantly impact the position. '
  }

  if (!interpretation) interpretation = 'Greeks indicate balanced risk profile.'

  return {
    delta,
    gamma,
    theta,
    vega,
    rho,
    d1,
    d2,
    interpretation
  }
}

export function assessTradeRisk(tradeType, stockPrice, strikePrice, greeks, portfolioSettings, earningsAndEvents = null) {
  const factors = []
  let overallRisk = 'Medium'
  let maxLoss = 0

  if (tradeType === 'cashSecuredPut') {
    // Cash-secured put risk assessment
    const premium = Math.abs(greeks.theta || 0) * 100 // Rough premium estimate
    const capitalRequired = strikePrice * 100 // 100 shares

    maxLoss = capitalRequired - premium

    // Risk factors for cash-secured puts
    if (strikePrice > stockPrice * 1.1) {
      factors.push({
        type: 'warning',
        message: 'Strike price significantly above current stock price - higher assignment risk'
      })
    }

    if (Math.abs(greeks.delta || 0) > 0.3) {
      factors.push({
        type: 'warning',
        message: 'High delta indicates significant directional risk'
      })
    }

    if (portfolioSettings && capitalRequired > portfolioSettings.capital * portfolioSettings.maxAllocation / 100) {
      factors.push({
        type: 'negative',
        message: 'Trade exceeds maximum allocation limit'
      })
      overallRisk = 'High'
    }

    if (factors.length === 0) {
      factors.push({
        type: 'positive',
        message: 'Trade aligns with conservative cash-secured put strategy'
      })
      overallRisk = 'Low'
    }

  } else if (tradeType === 'coveredCall') {
    // Covered call risk assessment
    const premium = Math.abs(greeks.theta || 0) * 100
    const capitalRequired = stockPrice * 100
    maxLoss = capitalRequired - premium

    // Risk factors for covered calls
    if (strikePrice < stockPrice * 0.95) {
      factors.push({
        type: 'warning',
        message: 'Strike price below current stock price - higher chance of being assigned'
      })
    }

    if (Math.abs(greeks.delta || 0) > 0.3) {
      factors.push({
        type: 'warning',
        message: 'High delta indicates significant upside potential being capped'
      })
    }

    if (portfolioSettings && capitalRequired > portfolioSettings.capital * portfolioSettings.maxAllocation / 100) {
      factors.push({
        type: 'negative',
        message: 'Trade exceeds maximum allocation limit'
      })
      overallRisk = 'High'
    }

    if (factors.length === 0) {
      factors.push({
        type: 'positive',
        message: 'Trade aligns with conservative covered call strategy'
      })
      overallRisk = 'Low'
    }
  }

  // Add earnings and events data to risk assessment
  if (earningsAndEvents) {
    // Add earnings date information
    if (earningsAndEvents.nextEarningsDate) {
      const estimateLabel = earningsAndEvents.isEstimate ? ' [ESTIMATE]' : ''
      factors.push({
        type: 'info',
        message: `Next earnings: ${earningsAndEvents.nextEarningsDate}${estimateLabel} (Source: ${earningsAndEvents.source || 'Various'}, Confidence: ${earningsAndEvents.earningsConfidence})`
      })
    } else {
      factors.push({
        type: 'warning',
        message: 'Earnings date not found - Unable to locate confirmed earnings date. Check company IR page for updates.'
      })
    }

    // Add upcoming events
    if (earningsAndEvents.upcomingEvents && earningsAndEvents.upcomingEvents.length > 0) {
      earningsAndEvents.upcomingEvents.forEach(event => {
        factors.push({
          type: event.impact === 'High' ? 'warning' : 'info',
          message: `${event.type}: ${event.description}`,
          detail: event.note
        })
      })
    }
  }

  return {
    overallRisk,
    maxLoss,
    factors,
    earningsAndEvents
  }
}

export function generateTradeRecommendation(tradeType, greeks, riskAssessment, companyRating, portfolioSettings, tradeDetails = null) {
  let action = 'Hold'
  let confidence = 50
  let rating = 5 // 0-10 scale
  let rationale = ''
  const warnings = []

  // Extract trade details if provided
  const premium = tradeDetails?.premium || Math.abs(greeks.theta || 0) * 100
  const stockPrice = tradeDetails?.stockPrice || 0
  const strikePrice = tradeDetails?.strikePrice || 0
  const daysToExpiration = tradeDetails?.daysToExpiration || 0
  const earningsAndEvents = tradeDetails?.earningsAndEvents

  // Base scoring
  let score = 0

  // Company rating impact (0-10 scale)
  if (companyRating >= 8) score += 2
  else if (companyRating >= 6) score += 1
  else if (companyRating <= 3) score -= 2

  // Risk assessment impact
  if (riskAssessment.overallRisk === 'Low') score += 2
  else if (riskAssessment.overallRisk === 'High') score -= 2

  // Greeks analysis
  if (greeks.delta !== null) {
    if (tradeType === 'cashSecuredPut') {
      // For puts, lower delta is better (less directional risk)
      if (Math.abs(greeks.delta) < 0.3) score += 1
      else if (Math.abs(greeks.delta) > 0.6) score -= 1
    } else {
      // For calls, moderate delta is good
      if (Math.abs(greeks.delta) > 0.2 && Math.abs(greeks.delta) < 0.5) score += 1
    }
  }

  if (greeks.theta !== null) {
    // Positive theta is good for sellers
    if (greeks.theta > 0) score += 1
  }

  // Premium analysis - calculate return percentage
  let premiumYield = 0
  if (premium && stockPrice) {
    premiumYield = (premium / stockPrice) * 100
    if (premiumYield > 2) score += 1
    if (premiumYield > 4) score += 1
  }

  // Days to expiration factor
  if (daysToExpiration > 0 && daysToExpiration <= 30) {
    score += 1 // Shorter duration reduces risk
  }

  // Earnings proximity risk
  if (earningsAndEvents?.nextEarningsDate && daysToExpiration > 0) {
    // This is a simplified check - in reality you'd parse the date
    warnings.push('Verify earnings date does not fall within your option expiration window')
  }

  // Determine action and rating based on score
  if (score >= 4) {
    action = 'Strong Buy'
    confidence = 80 + Math.min(15, (score - 4) * 5)
    rating = Math.min(10, 8 + (score - 4) * 0.5)
  } else if (score >= 2) {
    action = 'Buy'
    confidence = 65 + (score - 2) * 7.5
    rating = 6 + (score - 2) * 1
  } else if (score >= -1) {
    action = 'Hold'
    confidence = 45 + (score + 1) * 10
    rating = 4 + (score + 1) * 0.7
  } else if (score >= -3) {
    action = 'Avoid'
    confidence = 30 + (score + 3) * 7.5
    rating = 2 + (score + 3) * 0.7
  } else {
    action = 'Strong Avoid'
    confidence = Math.max(10, 25 + (score + 3) * 5)
    rating = Math.max(0, 1 + (score + 3) * 0.3)
  }

  // Generate comprehensive rationale
  const rationalePoints = []

  // Trade structure analysis
  if (tradeType === 'cashSecuredPut') {
    rationalePoints.push(`**Trade Structure:** Selling a cash-secured put on ${stockPrice ? `stock currently trading at $${stockPrice.toFixed(2)}` : 'this stock'} with a strike price of $${strikePrice.toFixed(2)}. This obligates you to purchase 100 shares at the strike price if assigned, while collecting $${premium.toFixed(2)} per share in premium (${premiumYield.toFixed(2)}% return).`)
  } else {
    rationalePoints.push(`**Trade Structure:** Selling a covered call on ${stockPrice ? `stock you own at $${stockPrice.toFixed(2)}` : 'shares you own'} with a strike price of $${strikePrice.toFixed(2)}. This caps your upside at the strike price while collecting $${premium.toFixed(2)} per share in premium (${premiumYield.toFixed(2)}% return).`)
  }

  // Premium analysis
  if (premiumYield > 3) {
    rationalePoints.push(`**Premium Quality:** The premium of ${premiumYield.toFixed(2)}% is attractive for a ${daysToExpiration}-day trade, suggesting elevated implied volatility or favorable risk/reward. This annualizes to approximately ${((premiumYield / daysToExpiration) * 365).toFixed(1)}% return if repeated consistently.`)
  } else if (premiumYield > 1.5) {
    rationalePoints.push(`**Premium Quality:** The premium of ${premiumYield.toFixed(2)}% is reasonable for this timeframe. While not exceptional, it provides meaningful income generation with controlled risk.`)
  } else if (premiumYield > 0) {
    rationalePoints.push(`**Premium Quality:** The premium of ${premiumYield.toFixed(2)}% is modest. Consider if this adequately compensates you for the risk, or if waiting for higher implied volatility would be more prudent.`)
  }

  // Risk analysis
  if (riskAssessment.overallRisk === 'Low') {
    rationalePoints.push(`**Risk Profile:** The trade demonstrates LOW overall risk. ${tradeType === 'cashSecuredPut' ? 'You are protected by having sufficient cash to purchase shares if assigned, and the strike price provides a reasonable entry point.' : 'Your downside is protected by share ownership, with the main risk being capped upside if the stock rallies strongly.'}`)
  } else if (riskAssessment.overallRisk === 'Medium') {
    rationalePoints.push(`**Risk Profile:** The trade has MEDIUM risk. ${tradeType === 'cashSecuredPut' ? 'Monitor the stock price action and be prepared for potential assignment. Ensure you are comfortable owning shares at this strike price.' : 'Your shares could be called away if the stock exceeds the strike price, which may not be ideal if you believe in long-term upside.'}`)
  } else {
    rationalePoints.push(`**Risk Profile:** This trade carries HIGH risk. ${tradeType === 'cashSecuredPut' ? 'The strike price or position size may be aggressive relative to your capital or the stock volatility. Consider reducing position size or adjusting strike selection.' : 'The covered call may limit your gains significantly if the stock rallies. Reconsider whether selling calls aligns with your outlook.'}`)
  }

  // Company fundamentals
  if (companyRating >= 7) {
    rationalePoints.push(`**Company Quality:** Strong fundamental rating (${companyRating}/10) supports this strategy. The underlying company demonstrates solid financials and business fundamentals, reducing the risk of unexpected negative surprises.`)
  } else if (companyRating >= 5) {
    rationalePoints.push(`**Company Quality:** Moderate fundamental rating (${companyRating}/10). The company shows acceptable but not exceptional quality. Ensure you monitor company-specific news and be prepared for potential volatility.`)
  } else {
    rationalePoints.push(`**Company Quality:** Below-average fundamental rating (${companyRating}/10) introduces additional risk. Consider whether the premium adequately compensates for elevated fundamental risk, or if focusing on higher-quality names would be more prudent.`)
    warnings.push('Low company rating increases risk of adverse price movements')
  }

  // Earnings and events impact
  if (earningsAndEvents) {
    if (earningsAndEvents.nextEarningsDate) {
      const estimateWarning = earningsAndEvents.isEstimate
        ? ' **Note: This is an ESTIMATED date** - verify with the company\'s investor relations page before entering the trade.'
        : ''
      rationalePoints.push(`**Earnings Catalyst:** Next earnings release: ${earningsAndEvents.nextEarningsDate} (Confidence: ${earningsAndEvents.earningsConfidence}, Source: ${earningsAndEvents.source}).${estimateWarning} **Critical:** Confirm this date does NOT fall within your option expiration window. Earnings typically cause 5-15% price swings, which can dramatically impact option outcomes. If earnings are before expiration, either avoid the trade or price in the elevated risk.`)
    } else {
      rationalePoints.push(`**Earnings Catalyst:** Unable to locate confirmed earnings date. This could mean earnings are far out or the data is unavailable. **Action required:** Check the company's investor relations page or financial calendar sites (earnings.com, nasdaq.com) before entering this trade. Avoid holding through earnings unless you're comfortable with the elevated volatility risk. Implied volatility typically spikes before earnings, then collapses afterward (volatility crush).`)
    }

    if (earningsAndEvents.upcomingEvents && earningsAndEvents.upcomingEvents.length > 0) {
      rationalePoints.push(`**Additional Catalysts:** ${earningsAndEvents.upcomingEvents.length} potential market-moving events identified: ${earningsAndEvents.upcomingEvents.map(e => e.type).join(', ')}. Each represents a risk factor that could affect your position. Stay informed and set price alerts to react quickly if needed.`)
    }

    if (earningsAndEvents.marketSentiment) {
      rationalePoints.push(`**Market Sentiment:** ${earningsAndEvents.marketSentiment.description} Key considerations: ${earningsAndEvents.marketSentiment.factors.slice(0, 2).join('; ')}.`)
    }
  }

  // Time decay analysis
  if (daysToExpiration > 0 && daysToExpiration <= 30) {
    rationalePoints.push(`**Time Decay:** With ${daysToExpiration} days to expiration, theta decay will accelerate as you approach expiration, working in your favor as the option seller. The majority of option value decay occurs in the final 30 days, with exponential acceleration in the last 7-10 days.`)
  } else if (daysToExpiration > 30) {
    rationalePoints.push(`**Time Decay:** This longer-dated option (${daysToExpiration} days) provides more time for the position to work out, but theta decay will be slower initially. Consider if shorter-dated options might provide better risk-adjusted returns.`)
  }

  // Position sizing and capital allocation
  const capitalRequired = tradeType === 'cashSecuredPut' ? strikePrice * 100 : stockPrice * 100
  if (portfolioSettings && capitalRequired > 0) {
    const allocationPct = (capitalRequired / portfolioSettings.capital) * 100
    if (allocationPct > portfolioSettings.maxAllocation) {
      rationalePoints.push(`**Position Sizing:** ⚠️ This trade requires ${allocationPct.toFixed(1)}% of your capital, EXCEEDING your maximum allocation of ${portfolioSettings.maxAllocation}%. Reduce position size to maintain disciplined risk management.`)
      warnings.push(`Trade exceeds ${portfolioSettings.maxAllocation}% max allocation - reduce position size`)
    } else {
      rationalePoints.push(`**Position Sizing:** This trade allocates ${allocationPct.toFixed(1)}% of your capital, within your ${portfolioSettings.maxAllocation}% maximum allocation limit. Proper position sizing ensures you can weather adverse movements without jeopardizing your overall portfolio.`)
    }
  }

  // Final recommendation summary
  const recommendationSummary = action === 'Strong Buy'
    ? `**Recommendation: STRONG BUY (${rating.toFixed(1)}/10)** - This trade demonstrates strong risk-adjusted return potential. All key factors align favorably: attractive premium, acceptable risk profile, and supportive fundamentals. Proceed with confidence, but maintain discipline with position sizing and stop-loss rules.`
    : action === 'Buy'
    ? `**Recommendation: BUY (${rating.toFixed(1)}/10)** - This trade presents a reasonable opportunity with acceptable risk/reward characteristics. While not perfect, the premium and risk factors support execution. Monitor the position actively and be prepared to adjust if conditions change.`
    : action === 'Hold'
    ? `**Recommendation: HOLD/NEUTRAL (${rating.toFixed(1)}/10)** - This trade has mixed characteristics. The risk/reward profile is balanced but not compelling. Consider waiting for a better setup with either higher premium, better company fundamentals, or improved market conditions.`
    : action === 'Avoid'
    ? `**Recommendation: AVOID (${rating.toFixed(1)}/10)** - This trade presents unfavorable risk/reward characteristics. Multiple negative factors suggest the premium does not adequately compensate for the risks. Wait for better opportunities with more favorable conditions.`
    : `**Recommendation: STRONG AVOID (${rating.toFixed(1)}/10)** - This trade demonstrates poor risk-adjusted potential. Significant negative factors make this trade inadvisable. Focus your capital on higher-quality opportunities with better risk management characteristics.`

  rationalePoints.unshift(recommendationSummary)

  rationale = rationalePoints.join('\n\n')

  // Add standard warnings
  if (riskAssessment.overallRisk === 'High') {
    warnings.push('High risk trade - consider reducing position size or avoiding')
  }

  if (companyRating < 5) {
    warnings.push('Low company rating increases fundamental risk')
  }

  // Calculate expected return
  const expectedReturn = premium * 100 // Premium per contract (100 shares)

  return {
    action,
    confidence: Math.round(Math.min(95, Math.max(5, confidence))),
    rating: Math.round(rating * 10) / 10, // Round to 1 decimal place
    rationale,
    warnings,
    expectedReturn
  }
}

// Utility function to calculate days to expiration
export function daysToExpiration(expirationDate) {
  const today = new Date()
  const exp = new Date(expirationDate)
  const diffTime = exp - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

// Utility function to calculate option premium (simplified)
export function estimatePremium(stockPrice, strikePrice, daysToExp, optionType, volatility = 0.3) {
  const T = daysToExp / 365
  const r = 0.02 // risk-free rate
  const sigma = volatility

  const greeks = calculateOptionGreeks(stockPrice, strikePrice, T, optionType, r, sigma)

  // Rough premium estimate based on Black-Scholes
  if (optionType === 'call') {
    return stockPrice * greeks.delta - strikePrice * Math.exp(-r * T) * greeks.rho / (r * strikePrice * T)
  } else {
    return strikePrice * Math.exp(-r * T) * (1 - greeks.rho / (r * strikePrice * T)) - stockPrice * greeks.delta
  }
}