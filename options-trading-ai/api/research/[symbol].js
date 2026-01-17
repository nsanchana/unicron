import axios from 'axios';

async function fetchYahooFinanceData(symbol) {
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`;

  const response = await axios.get(chartUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });

  const result = response.data.chart.result;
  if (!result || result.length === 0) {
    throw new Error('No data found for symbol');
  }

  return result[0];
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { symbol } = req.query;
    const data = await fetchYahooFinanceData(symbol.toUpperCase());
    const meta = data.meta;
    const quotes = data.indicators?.quote?.[0] || {};

    // Extract data from API response
    const currentPrice = meta.regularMarketPrice;
    const companyName = meta.longName || meta.shortName || symbol.toUpperCase();
    const previousClose = meta.chartPreviousClose;
    const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh;
    const fiftyTwoWeekLow = meta.fiftyTwoWeekLow;
    const dayHigh = meta.regularMarketDayHigh;
    const dayLow = meta.regularMarketDayLow;
    const volume = meta.regularMarketVolume;

    // Calculate simple moving averages from historical data
    const closePrices = quotes.close?.filter(p => p !== null) || [];
    const calculateMA = (prices, period) => {
      if (prices.length < period) return null;
      const recentPrices = prices.slice(-period);
      return recentPrices.reduce((a, b) => a + b, 0) / period;
    };

    const ma10 = calculateMA(closePrices, 10);
    const ma20 = calculateMA(closePrices, 20);

    // Calculate price change
    const priceChange = previousClose ? currentPrice - previousClose : 0;
    const priceChangePercent = previousClose ? ((priceChange / previousClose) * 100) : 0;

    // Calculate volatility (standard deviation of daily returns)
    const calculateVolatility = (prices) => {
      if (prices.length < 5) return null;
      const returns = [];
      for (let i = 1; i < prices.length; i++) {
        if (prices[i] && prices[i-1]) {
          returns.push((prices[i] - prices[i-1]) / prices[i-1]);
        }
      }
      if (returns.length === 0) return null;
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
      return Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized volatility percentage
    };

    const volatility = calculateVolatility(closePrices);

    // Calculate ratings based on available data
    const calculateRating = () => {
      let score = 0;
      let factors = 0;

      // Price vs 52-week range (higher in range = more bullish)
      if (fiftyTwoWeekHigh && fiftyTwoWeekLow) {
        const range = fiftyTwoWeekHigh - fiftyTwoWeekLow;
        const position = (currentPrice - fiftyTwoWeekLow) / range;
        if (position > 0.7) score += 1;
        else if (position > 0.4) score += 0.5;
        factors++;
      }

      // Price vs moving averages (above MA = bullish)
      if (ma10 && currentPrice > ma10) {
        score += 0.5;
      }
      if (ma20 && currentPrice > ma20) {
        score += 0.5;
      }
      if (ma10 || ma20) factors++;

      // Daily performance
      if (priceChangePercent > 1) score += 1;
      else if (priceChangePercent > 0) score += 0.5;
      else if (priceChangePercent < -1) score -= 0.5;
      factors++;

      // Volume (higher volume = more interest)
      if (volume > 10000000) score += 1;
      else if (volume > 1000000) score += 0.5;
      factors++;

      // Volatility (moderate is good for options)
      if (volatility) {
        if (volatility > 20 && volatility < 50) score += 1;
        else if (volatility > 15 && volatility < 60) score += 0.5;
        factors++;
      }

      const rawScore = factors > 0 ? (score / factors) * 5 : 3;
      return Math.min(5, Math.max(1, Math.round(rawScore)));
    };

    const overallRating = calculateRating();

    // Structure the response
    const research = {
      symbol: symbol.toUpperCase(),
      companyName,
      currentPrice,
      marketPosition: {
        rating: overallRating,
        summary: `${companyName} shows ${overallRating >= 4 ? 'strong' : overallRating >= 3 ? 'moderate' : 'weak'} market positioning.`,
        details: [
          `Current Price: $${currentPrice?.toFixed(2) || 'N/A'}`,
          `Day Range: $${dayLow?.toFixed(2) || 'N/A'} - $${dayHigh?.toFixed(2) || 'N/A'}`,
          `52-Week Range: $${fiftyTwoWeekLow?.toFixed(2) || 'N/A'} - $${fiftyTwoWeekHigh?.toFixed(2) || 'N/A'}`
        ]
      },
      financials: {
        rating: overallRating,
        summary: `Trading activity indicates ${volume > 5000000 ? 'high' : volume > 1000000 ? 'moderate' : 'low'} market interest.`,
        details: [
          `Volume: ${volume?.toLocaleString() || 'N/A'}`,
          `Previous Close: $${previousClose?.toFixed(2) || 'N/A'}`,
          `Change: ${priceChange >= 0 ? '+' : ''}$${priceChange?.toFixed(2) || 'N/A'} (${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent?.toFixed(2) || 'N/A'}%)`
        ]
      },
      technical: {
        rating: overallRating,
        summary: `Technical indicators suggest ${currentPrice > (ma20 || 0) ? 'bullish' : currentPrice < (ma20 || Infinity) ? 'bearish' : 'neutral'} momentum.`,
        details: [
          `10-Day MA: ${ma10 ? '$' + ma10.toFixed(2) : 'N/A'}`,
          `20-Day MA: ${ma20 ? '$' + ma20.toFixed(2) : 'N/A'}`,
          `Price vs MA: ${ma20 ? (currentPrice > ma20 ? 'Above' : 'Below') + ' 20-day average' : 'N/A'}`
        ]
      },
      options: {
        rating: volatility ? (volatility > 20 && volatility < 50 ? 4 : 3) : 3,
        summary: volatility ? `Implied volatility of ${volatility.toFixed(1)}% suggests ${volatility > 30 ? 'good' : 'moderate'} options premiums.` : 'Volatility data being calculated.',
        details: [
          `Historical Volatility: ${volatility ? volatility.toFixed(1) + '%' : 'N/A'}`,
          `Volatility Assessment: ${volatility ? (volatility > 40 ? 'High' : volatility > 25 ? 'Moderate' : 'Low') : 'N/A'}`,
          `Options Suitability: ${volatility ? (volatility > 20 ? 'Good for premium selling' : 'Consider directional trades') : 'N/A'}`
        ]
      },
      news: {
        rating: 3,
        summary: 'Market data retrieved successfully from Yahoo Finance.',
        details: [
          `Exchange: ${meta.fullExchangeName || meta.exchangeName || 'N/A'}`,
          `Currency: ${meta.currency || 'USD'}`,
          `Last Updated: ${new Date(meta.regularMarketTime * 1000).toLocaleString()}`
        ]
      }
    };

    res.json(research);
  } catch (error) {
    console.error('Research error:', error.message);
    res.status(500).json({
      error: 'Failed to analyze company. Please check the symbol and try again.',
      message: error.message
    });
  }
}
