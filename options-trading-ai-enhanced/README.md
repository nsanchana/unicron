# Enhanced Options Trading Analysis Tool

A comprehensive options trading analysis tool with web scraping, portfolio management, and Black-Scholes calculations. Built with React, Express, and modern web technologies.

## 🚀 Features

### Company Research Module
- **Web Scraping**: Real-time data scraping from Yahoo Finance, Stock Analysis and other sources
- **Comprehensive Analysis**: Market position, financial health, technical analysis, options data, and recent developments
- **Equal Weight Rating**: All analysis sections contribute equally to overall company rating (1-10 scale)
- **Data Persistence**: Local storage with CSV export functionality

### Trade Review Module
- **Risk Assessment**: Conservative trading rules with portfolio allocation limits
- **Trade Recommendations**: AI-powered analysis with confidence scores and warnings
- **Strategy Support**: Cash-secured puts (prefer 30-day) and covered calls (prefer 5-day)

### Portfolio Management
- **Starting Capital**: $71,000 with 50% maximum allocation per trade
- **Weekly Premium Target**: $340-$410 income goal
- **Risk Monitoring**: Real-time alerts for allocation limits and risk thresholds
- **Performance Tracking**: Weekly premium tracking with trade history

### User Interface
- **Tabbed Interface**: Clean navigation between Dashboard, Research, Trade Review, and Settings
- **Dark Theme**: Visually attractive UI with Gold accents
- **Auto-Refresh**: 10-minute automatic data updates
- **CSV Export**: Download research and trade data for external analysis

## 🛠️ Technology Stack

- **Frontend**: React 18 + Vite
- **Backend**: Express.js proxy server
- **Web Scraping**: Cheerio for HTML parsing
- **Styling**: Tailwind CSS with custom dark theme
- **Data Persistence**: Browser localStorage
- **Options Math**: Custom Black-Scholes implementation
- **HTTP Client**: Axios for API requests

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Modern web browser

## 🚀 Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd options-trading-ai-enhanced
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   npm start
   ```

   This will start both the frontend (http://localhost:3000) and backend proxy server (http://localhost:3001)

4. **Access the application**
   - Open http://localhost:3000 in your browser
   - The application will auto-refresh data every 10 minutes

## 📖 Usage Guide

### 1. Portfolio Setup
- Navigate to the **Settings** tab
- Configure your starting capital ($71,000 default)
- Set maximum allocation percentage (50% default)
- Define weekly premium targets ($340-$410 default)
- Review conservative trading rules

### 2. Company Research
- Go to the **Research** tab
- Enter a stock symbol (e.g., AAPL, TSLA, NVDA)
- Click "Analyze Company" to scrape comprehensive data
- Review the 5-section analysis with equal-weighted rating
- Export research data to CSV if needed

### 3. Trade Analysis
- Switch to the **Trade Review** tab
- Select a researched company from the dropdown
- Choose trade type (Cash-Secured Put or Covered Call)
- Set strike price and expiration date
- Click "Analyze Trade" for Black-Scholes calculations
- Review risk assessment and AI recommendations

### 4. Portfolio Dashboard
- View **Dashboard** for portfolio overview
- Monitor weekly premium progress
- Check risk alerts and recent activity
- Track trade history and performance

## 🔧 Configuration

### Portfolio Settings
```javascript
{
  capital: 71000,           // Starting capital in dollars
  maxAllocation: 50,        // Maximum % per trade
  weeklyPremiumTarget: {    // Target income range
    min: 340,
    max: 410
  },
  riskTolerance: 'conservative',
  tradingRules: {
    cashSecuredPut: { maxDays: 30 },
    coveredCall: { maxDays: 5 }
  }
}
```

### Trading Rules
- **Cash-Secured Puts**: Maximum 30 days to expiration
- **Covered Calls**: Maximum 5 days to expiration
- **Risk Management**: 50% maximum allocation per trade
- **Premium Target**: $340-$410 weekly income goal

## 📊 Data Sources

The application scrapes data from:
- **Yahoo Finance**: Company profiles, financials, technical data, news
- **Stock Analysis**: Company profiles, financials, technical data, news
- **Real-time Updates**: 10-minute auto-refresh cycle
- **Local Storage**: Persistent data with CSV export capability

## 🧮 Options Calculations

### Risk Assessment Factors
- Portfolio allocation limits
- Greeks-based risk analysis
- Company fundamental ratings
- Time to expiration constraints

## 🔒 Security & Performance

- **CORS Proxy**: Express server handles web scraping to avoid CORS issues
- **Rate Limiting**: Respectful scraping with delays between requests
- **Local Storage**: No external data transmission
- **Error Handling**: Graceful fallbacks for failed requests

## 📈 Development

### Project Structure
```
src/
├── components/
│   ├── App.jsx              # Main application with tabs
│   ├── Dashboard.jsx        # Portfolio overview
│   ├── CompanyResearch.jsx  # Research interface
│   ├── TradeReview.jsx      # Trade analysis
│   └── SettingsPanel.jsx    # Portfolio configuration
├── services/
│   └── webScraping.js       # Scraping functions
├── utils/
│   ├── optionsCalculations.js # Black-Scholes math
│   └── storage.js           # Local storage utilities
└── index.css               # Dark theme styles

server.js                   # Express proxy server
```

### Adding New Features
1. Create component in `src/components/`
2. Add utility functions in `src/utils/`
3. Update scraping logic in `src/services/`
4. Test with both frontend and backend servers

## 🐛 Troubleshooting

### Common Issues
- **Server won't start**: Check if port 3001 is available
- **Scraping fails**: Verify internet connection and target websites
- **Data not saving**: Check browser localStorage permissions
- **Calculations error**: Ensure valid numeric inputs for trades

### Debug Mode
- Open browser DevTools (F12)
- Check Console for error messages
- Network tab shows scraping requests
- Application tab shows localStorage data

## 📄 License

This project is for educational and personal use only. Not intended for actual trading decisions.

## ⚠️ Disclaimer

This tool is for educational purposes only. Options trading involves substantial risk and is not suitable for all investors. Past performance does not guarantee future results. Always consult with a qualified financial advisor before making investment decisions.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues or questions:
- Check the troubleshooting section
- Review browser console for errors
- Ensure all dependencies are installed
- Verify server is running on port 3001