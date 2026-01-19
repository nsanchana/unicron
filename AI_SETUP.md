# AI-Powered Company Research Setup

Unicron now uses Claude AI to provide intelligent, context-aware analysis of company research data instead of generic template text.

## Setup Instructions

### 1. Get an Anthropic API Key

1. Visit [https://console.anthropic.com/](https://console.anthropic.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the API key (it starts with `sk-ant-`)

### 2. Configure Environment Variables

1. Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and add your API key:
   ```
   ANTHROPIC_API_KEY=sk-ant-your-actual-api-key-here
   ```

### 3. Restart the Server

After adding your API key, restart the development server:

```bash
npm start
```

## How It Works

When you run Company Research, the system:

1. **Scrapes data** from financial websites (stockanalysis.com, Yahoo Finance, etc.)
2. **Analyzes the data** using Claude AI with specialized prompts for each section:
   - **Company Analysis**: Evaluates competitive position, business model strength, and suitability for options trading
   - **Financial Health**: Assesses financial stability, revenue trends, and recommendations for options strategies
   - **Technical Analysis**: Reviews price momentum, trends, and suggests optimal strike prices
   - **Options Data**: Analyzes implied volatility, liquidity, and recommends strategies
   - **Recent Developments**: Examines news sentiment and catalysts that could affect positions

3. **Provides actionable insights** specifically tailored for options income trading strategies (cash-secured puts and covered calls)

## Without API Key

If you don't configure an API key, the system will fall back to generic template insights. The application will still work, but the analysis sections will show basic descriptions instead of AI-generated recommendations.

## Cost Considerations

- Claude 3.5 Sonnet pricing: ~$3 per million input tokens, ~$15 per million output tokens
- Each research analysis uses approximately 300-500 tokens per section
- For typical usage (5-10 company researches per day), cost is minimal (< $0.50/day)
- You can monitor your usage at [https://console.anthropic.com/](https://console.anthropic.com/)

## Privacy & Security

- Your API key is stored locally in `.env` file (never committed to git)
- Only company research data (publicly available information) is sent to Claude
- Your personal trading data, portfolio size, and trade positions are **never** sent to external APIs
- The Anthropic API does not train models on your data

## Benefits of AI Analysis

### Before (Generic Templates)
```
"Financial analysis for AAPL evaluates the company's profitability,
liquidity, and solvency. Strong financials typically show consistent
revenue growth, healthy profit margins, manageable debt levels..."
```

### After (AI-Generated Insights)
```
"AAPL demonstrates exceptional financial strength with $383B in revenue
and industry-leading profit margins of 26%. This stability makes it ideal
for selling cash-secured puts, as assignment risk is mitigated by the
company's fortress balance sheet. Consider strikes 5-10% OTM for premium
collection with high probability of expiring worthless."
```

## Troubleshooting

**Error: "Invalid API key"**
- Check that your API key in `.env` starts with `sk-ant-`
- Ensure there are no extra spaces or quotes around the key
- Verify the key is active in your Anthropic console

**Generic analysis still showing**
- Restart the server after adding the API key
- Check server console logs for any error messages
- Verify `.env` file is in the project root directory

**Analysis taking too long**
- AI analysis adds 1-2 seconds per section
- This is normal - Claude is analyzing your data in real-time
- Total research time: ~10-15 seconds (vs ~5 seconds without AI)

## Support

For issues specific to the AI integration, check:
- Server console for error messages
- Anthropic status page: [https://status.anthropic.com/](https://status.anthropic.com/)
- Your API key usage/limits in Anthropic console
