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

    res.json({
      symbol: meta.symbol,
      price: meta.regularMarketPrice,
      companyName: meta.longName || meta.shortName || symbol.toUpperCase(),
      previousClose: meta.chartPreviousClose,
      dayHigh: meta.regularMarketDayHigh,
      dayLow: meta.regularMarketDayLow,
      volume: meta.regularMarketVolume,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow
    });
  } catch (error) {
    console.error('Quote error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch quote',
      message: error.message
    });
  }
}
