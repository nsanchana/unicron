# Unicron - Options Trading Analysis Tool

## Overview

Unicron is a full-stack options trading analysis tool with web scraping, portfolio management, AI-powered trade analysis, and Black-Scholes calculations. It uses a React 18 frontend with a Vite dev server and an Express.js backend proxy.

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, Lucide React icons
- **Backend**: Express.js (port 3001), Cheerio (web scraping), Sequelize + SQLite
- **AI**: Google Gemini API (`@google/generative-ai`)
- **Auth**: bcryptjs, express-session with Sequelize session store
- **Deployment**: Vercel (serverless functions in `api/`)

## Project Structure

```
src/
  components/    # React components (Dashboard, CompanyResearch, TradeReview, etc.)
  services/      # Web scraping, price fetching, earnings data
  utils/         # Options math (Black-Scholes), localStorage helpers, auth utils
api/             # Vercel serverless functions (auth, chat, scraping, AI endpoints)
server.js        # Local Express dev server (scraping proxy, Gemini AI, auth)
auth.js          # Sequelize models (User, AICache, UserData), session config
```

## Commands

- `npm start` - Start both frontend (port 3000) and backend (port 3001) via concurrently
- `npm run dev` - Start Vite dev server only (port 3000)
- `npm run server` - Start Express backend only (port 3001)
- `npm run build` - Production build via Vite

## Development Notes

- The Vite dev server proxies `/api` requests to `localhost:3001`
- The Express server handles web scraping (Yahoo Finance, Stock Analysis) to avoid CORS issues
- SQLite database (`database.sqlite`) stores users, sessions, AI cache, and user data
- Environment variables are loaded via dotenv - expects `GEMINI_API_KEY` and `SESSION_SECRET`
- Vercel deployment uses serverless functions in `api/` with a 60s max duration
- The UI uses a dark theme with gold accents
