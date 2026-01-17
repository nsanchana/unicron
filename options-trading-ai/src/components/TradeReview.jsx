import React, { useState, useEffect, useCallback } from 'react';
import { Calculator, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { calculateOptionPrice, calculateGreeks } from '../utils/optionsCalculations';
import axios from 'axios';
import { getApiUrl } from '../utils/api';

function TradeReview() {
  const [tradeParams, setTradeParams] = useState({
    symbol: '',
    currentPrice: 0,
    strikePrice: 0,
    timeToExpiry: 30, // days
    volatility: 0.2, // 20%
    riskFreeRate: 0.05, // 5%
    dividendYield: 0,
    optionType: 'call',
    tradeType: 'cashSecuredPut'
  });

  const [analysis, setAnalysis] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [priceError, setPriceError] = useState('');

  // Debounced fetch for stock price
  const fetchStockPrice = useCallback(async (symbol) => {
    if (!symbol || symbol.length < 1) {
      return;
    }

    setLoadingPrice(true);
    setPriceError('');

    try {
      const response = await axios.get(getApiUrl(`/api/quote/${symbol.toUpperCase()}`));
      const { price } = response.data;

      if (price) {
        setTradeParams(prev => ({
          ...prev,
          currentPrice: price
        }));
      }
    } catch (error) {
      console.error('Failed to fetch stock price:', error);
      setPriceError('Could not fetch price');
    } finally {
      setLoadingPrice(false);
    }
  }, []);

  // Fetch price when symbol changes (with debounce)
  useEffect(() => {
    const symbol = tradeParams.symbol.trim();
    if (symbol.length >= 1) {
      const timeoutId = setTimeout(() => {
        fetchStockPrice(symbol);
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [tradeParams.symbol, fetchStockPrice]);

  const handleCalculate = () => {
    try {
      const price = calculateOptionPrice(tradeParams);
      const greeks = calculateGreeks(tradeParams);
      const riskAssessment = assessRisk(tradeParams, price, greeks);
      const recommendation = generateRecommendation(tradeParams, riskAssessment);

      setAnalysis({
        price,
        greeks,
        riskAssessment,
        recommendation
      });
    } catch (error) {
      console.error('Calculation error:', error);
    }
  };

  const assessRisk = (params, price, greeks) => {
    let riskLevel = 'Low';
    let concerns = [];

    // Time to expiry check
    if (params.tradeType === 'cashSecuredPut' && params.timeToExpiry > 30) {
      riskLevel = 'High';
      concerns.push('Expiry exceeds 30-day limit for cash-secured puts');
    }
    if (params.tradeType === 'coveredCall' && params.timeToExpiry > 5) {
      riskLevel = 'High';
      concerns.push('Expiry exceeds 5-day limit for covered calls');
    }

    // Delta check (probability)
    if (params.optionType === 'put' && greeks.delta > 0.3) {
      concerns.push('High probability of exercise');
    }
    if (params.optionType === 'call' && greeks.delta > 0.7) {
      concerns.push('High probability of exercise');
    }

    // Theta check (time decay)
    if (Math.abs(greeks.theta) < 0.01) {
      concerns.push('Low time decay benefit');
    }

    // Vega check (volatility risk)
    if (Math.abs(greeks.vega) > 0.1) {
      concerns.push('High volatility risk');
    }

    return { riskLevel, concerns };
  };

  const generateRecommendation = (params, risk) => {
    if (risk.riskLevel === 'High') {
      return {
        action: 'Avoid',
        reason: 'Trade violates conservative rules or has high risk factors',
        alternative: 'Consider shorter-dated options or different strike prices'
      };
    }

    const premium = analysis?.price || 0;
    const breakeven = params.optionType === 'call'
      ? params.strikePrice + premium
      : params.strikePrice - premium;

    return {
      action: 'Consider',
      reason: `Premium: $${premium.toFixed(2)}, Breakeven: $${breakeven.toFixed(2)}`,
      alternative: 'Monitor market conditions before execution'
    };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Trade Parameters */}
      <div className="gradient-card rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Trade Review</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Symbol</label>
            <input
              type="text"
              value={tradeParams.symbol}
              onChange={(e) => setTradeParams({...tradeParams, symbol: e.target.value.toUpperCase()})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current Price
              {loadingPrice && <Loader2 className="inline w-4 h-4 ml-2 animate-spin text-blue-500" />}
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={tradeParams.currentPrice}
                onChange={(e) => setTradeParams({...tradeParams, currentPrice: parseFloat(e.target.value) || 0})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
              {priceError && <p className="text-xs text-red-500 mt-1">{priceError}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Strike Price</label>
            <input
              type="number"
              step="0.01"
              value={tradeParams.strikePrice}
              onChange={(e) => setTradeParams({...tradeParams, strikePrice: parseFloat(e.target.value) || 0})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Days to Expiry</label>
            <input
              type="number"
              value={tradeParams.timeToExpiry}
              onChange={(e) => setTradeParams({...tradeParams, timeToExpiry: parseInt(e.target.value) || 0})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Volatility (%)</label>
            <input
              type="number"
              step="0.01"
              value={(tradeParams.volatility * 100).toFixed(1)}
              onChange={(e) => setTradeParams({...tradeParams, volatility: parseFloat(e.target.value) / 100 || 0})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Risk-Free Rate (%)</label>
            <input
              type="number"
              step="0.01"
              value={(tradeParams.riskFreeRate * 100).toFixed(1)}
              onChange={(e) => setTradeParams({...tradeParams, riskFreeRate: parseFloat(e.target.value) / 100 || 0})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Option Type</label>
            <select
              value={tradeParams.optionType}
              onChange={(e) => setTradeParams({...tradeParams, optionType: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="call">Call</option>
              <option value="put">Put</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trade Type</label>
            <select
              value={tradeParams.tradeType}
              onChange={(e) => setTradeParams({...tradeParams, tradeType: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="cashSecuredPut">Cash-Secured Put</option>
              <option value="coveredCall">Covered Call</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleCalculate}
              className="gradient-button text-white px-6 py-2 rounded-md hover:opacity-90 transition-opacity w-full flex items-center justify-center space-x-2"
            >
              <Calculator className="w-4 h-4" />
              <span>Calculate</span>
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6">
          {/* Option Price */}
          <div className="gradient-card rounded-lg p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Option Price</h3>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(analysis.price)}
            </div>
          </div>

          {/* Greeks */}
          <div className="gradient-card rounded-lg p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Greeks</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">Delta</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{analysis.greeks.delta.toFixed(3)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">Gamma</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{analysis.greeks.gamma.toFixed(3)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">Theta</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{analysis.greeks.theta.toFixed(3)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">Vega</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{analysis.greeks.vega.toFixed(3)}</p>
              </div>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="gradient-card rounded-lg p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Risk Assessment</h3>
            <div className="flex items-center space-x-2 mb-4">
              {analysis.riskAssessment.riskLevel === 'Low' && <CheckCircle className="w-5 h-5 text-green-500" />}
              {analysis.riskAssessment.riskLevel === 'Medium' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
              {analysis.riskAssessment.riskLevel === 'High' && <AlertTriangle className="w-5 h-5 text-red-500" />}
              <span className={`font-medium ${
                analysis.riskAssessment.riskLevel === 'Low' ? 'text-green-600 dark:text-green-400' :
                analysis.riskAssessment.riskLevel === 'Medium' ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {analysis.riskAssessment.riskLevel} Risk
              </span>
            </div>
            {analysis.riskAssessment.concerns.length > 0 && (
              <ul className="space-y-2">
                {analysis.riskAssessment.concerns.map((concern, index) => (
                  <li key={index} className="flex items-start text-gray-700 dark:text-gray-300">
                    <span className="text-red-500 mr-2">•</span>
                    {concern}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recommendation */}
          <div className="gradient-card rounded-lg p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recommendation</h3>
            <div className="space-y-2">
              <p className={`text-lg font-medium ${
                analysis.recommendation.action === 'Consider' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {analysis.recommendation.action}
              </p>
              <p className="text-gray-700 dark:text-gray-300">{analysis.recommendation.reason}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{analysis.recommendation.alternative}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TradeReview;