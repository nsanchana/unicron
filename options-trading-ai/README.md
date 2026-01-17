11# Options Trading AI - Enhanced Version

A comprehensive options trading analysis tool with company research, trade review, portfolio management, and conservative trading rules.

## Features

### 🏠 Dashboard
- Portfolio overview with $71k starting capital
- Real-time allocation tracking (50% max)
- Weekly premium progress ($340-$410 target range)
- Risk assessment and alerts
- Recent trades history

### 🔍 Company Research
- Web scraping from Yahoo Finance
- 5-section equal-weighted analysis:
  - Market Position
  - Financials
  - Technical Analysis
  - Options Data
  - Recent Developments
- Overall rating system (1-5 stars)

### 📊 Trade Review
- Black-Scholes options pricing model
- Complete Greeks calculation (Delta, Gamma, Theta, Vega, Rho)
- Risk assessment based on conservative rules
- Cash-secured puts (max 30 days)
- Covered calls (max 5 days)
- Trade recommendations

### ⚙️ Settings
- Portfolio configuration
- Premium targets and trading rules
- Light/Dark mode toggle with premium blue/pink gradients

### 🎨 Premium UI
- Light/Dark mode with persistent storage
- Blue primary and pink accent color scheme
- Gradient backgrounds and cards
- Responsive design with Tailwind CSS
- Auto-refresh every 10 minutes

## Technology Stack

- **Frontend**: React 18 + Vite
- **Backend**: Express.js proxy server
- **Styling**: Tailwind CSS with custom theme
- **Data**: Yahoo Finance web scraping with Cheerio
- **Calculations**: Black-Scholes model implementation
- **Storage**: Local storage with CSV export

## Installation

1. **Clone and Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Application**
   ```bash
   npm start
   ```
   This runs both the frontend (port 3000) and proxy server (port 3002) concurrently.

3. **Access the App**
   Open http://localhost:5173 in your browser.

## Project Structure

```
src/
├── components/
│   ├── Dashboard.jsx          # Portfolio overview
│   ├── CompanyResearch.jsx    # Web scraping research
│   ├── TradeReview.jsx        # Options analysis
│   └── SettingsPanel.jsx      # Portfolio configuration
├── utils/
│   ├── optionsCalculations.js # Black-Scholes math
│   └── storage.js             # Local storage management
├── App.jsx                    # Main application with tabs
├── main.jsx                   # React entry point
└── index.css                  # Global styles with gradients

server.js                      # Express proxy for scraping
tailwind.config.js            # Blue/pink color scheme
```

## Conservative Trading Rules

- **Cash-Secured Puts**: Maximum 30 days to expiration
- **Covered Calls**: Maximum 5 days to expiration
- **Portfolio Allocation**: Maximum 50% of capital allocated
- **Weekly Premium Target**: $340 - $410
- **Risk Management**: Strict adherence to position sizing

## API Endpoints

### Research Endpoint
```
GET /api/research/:symbol
```
Scrapes Yahoo Finance data and returns structured analysis.

### Health Check
```
GET /api/health
```
Server status check.

## Data Persistence

- Portfolio data saved to localStorage
- Theme preference persistence
- Settings configuration
- CSV export functionality for trades

## Development

### Available Scripts
- `npm run dev` - Start frontend development server
- `npm run server` - Start proxy server
- `npm start` - Run both servers concurrently

### Adding New Features
1. Create components in `src/components/`
2. Add utilities in `src/utils/`
3. Update routing in `App.jsx`
4. Add API endpoints in `server.js`

## Disclaimer

This tool is for educational and analytical purposes only. Options trading involves significant risk and is not suitable for all investors. Past performance does not guarantee future results. Always consult with a financial advisor before making investment decisions.