import React, { useState } from 'react';
import { Search, Star, TrendingUp, DollarSign, BarChart3, Users, Newspaper } from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from '../utils/api';

function CompanyResearch() {
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [research, setResearch] = useState(null);
  const [error, setError] = useState('');

  const handleResearch = async () => {
    if (!symbol.trim()) return;

    setLoading(true);
    setError('');
    try {
      const response = await axios.get(getApiUrl(`/api/research/${symbol.toUpperCase()}`));
      setResearch(response.data);
    } catch (err) {
      setError('Failed to fetch company data. Please try again.');
      console.error('Research error:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateRating = (data) => {
    // Equal weighting for all sections
    const sections = ['marketPosition', 'financials', 'technical', 'options', 'news'];
    let totalScore = 0;
    let validSections = 0;

    sections.forEach(section => {
      if (data[section] && data[section].rating) {
        totalScore += data[section].rating;
        validSections++;
      }
    });

    return validSections > 0 ? (totalScore / validSections).toFixed(1) : 0;
  };

  const getRatingColor = (rating) => {
    if (rating >= 4) return 'text-green-600 dark:text-green-400';
    if (rating >= 3) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const sections = [
    { key: 'marketPosition', label: 'Market Position', icon: TrendingUp },
    { key: 'financials', label: 'Financials', icon: DollarSign },
    { key: 'technical', label: 'Technical Analysis', icon: BarChart3 },
    { key: 'options', label: 'Options Data', icon: Users },
    { key: 'news', label: 'Recent Developments', icon: Newspaper },
  ];

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <div className="gradient-card rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Company Research</h2>
        <div className="flex space-x-4">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="Enter stock symbol (e.g., AAPL)"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            onKeyPress={(e) => e.key === 'Enter' && handleResearch()}
          />
          <button
            onClick={handleResearch}
            disabled={loading || !symbol.trim()}
            className="gradient-button text-white px-6 py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Search className="w-4 h-4" />
            <span>{loading ? 'Researching...' : 'Research'}</span>
          </button>
        </div>
        {error && <p className="text-red-600 dark:text-red-400 mt-2">{error}</p>}
      </div>

      {/* Research Results */}
      {research && (
        <div className="space-y-6">
          {/* Overall Rating */}
          <div className="gradient-card rounded-lg p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{research.symbol} - {research.companyName}</h3>
                <p className="text-gray-600 dark:text-gray-400">Overall Rating</p>
              </div>
              <div className="flex items-center space-x-2">
                <Star className={`w-6 h-6 ${getRatingColor(calculateRating(research))}`} />
                <span className={`text-2xl font-bold ${getRatingColor(calculateRating(research))}`}>
                  {calculateRating(research)}/5
                </span>
              </div>
            </div>
          </div>

          {/* Section Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sections.map((section) => {
              const Icon = section.icon;
              const data = research[section.key];
              return (
                <div key={section.key} className="gradient-card rounded-lg p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Icon className="w-5 h-5 text-blue-500" />
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{section.label}</h4>
                    </div>
                    {data && data.rating && (
                      <div className="flex items-center space-x-1">
                        <Star className={`w-4 h-4 ${getRatingColor(data.rating)}`} />
                        <span className={`font-medium ${getRatingColor(data.rating)}`}>{data.rating}/5</span>
                      </div>
                    )}
                  </div>
                  {data ? (
                    <div className="space-y-2">
                      <p className="text-gray-700 dark:text-gray-300">{data.summary}</p>
                      {data.details && (
                        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          {data.details.map((detail, index) => (
                            <li key={index} className="flex items-start">
                              <span className="text-blue-500 mr-2">•</span>
                              {detail}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">No data available</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyResearch;