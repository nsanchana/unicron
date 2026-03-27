CREATE TABLE IF NOT EXISTS unicron_positions (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  option_type TEXT NOT NULL,
  trade_type TEXT NOT NULL,
  strike_price NUMERIC NOT NULL,
  expiration_date TEXT NOT NULL,
  stock_price_at_entry NUMERIC,
  premium NUMERIC NOT NULL,
  quantity INTEGER DEFAULT 1,
  fees NUMERIC DEFAULT 0.65,
  net_premium NUMERIC,
  status TEXT DEFAULT 'executed',
  closed BOOLEAN DEFAULT false,
  executed BOOLEAN DEFAULT true,
  execution_date TEXT,
  closed_at TEXT,
  closed_reason TEXT,
  current_market_price NUMERIC,
  last_price_update TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE unicron_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON unicron_positions FOR ALL USING (true) WITH CHECK (true);
