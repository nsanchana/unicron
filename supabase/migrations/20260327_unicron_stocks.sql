-- Unicron stock holdings table
-- Synced from browser localStorage for server-side access (digests)

CREATE TABLE IF NOT EXISTS unicron_stocks (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  shares NUMERIC NOT NULL,
  purchase_price NUMERIC,
  purchase_date TEXT,
  current_price NUMERIC,
  last_price_update TEXT,
  sold_price NUMERIC,
  date_sold TEXT,
  stock_pnl NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE unicron_stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON unicron_stocks FOR ALL USING (true) WITH CHECK (true);
