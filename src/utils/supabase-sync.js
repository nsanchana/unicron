import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

/**
 * Map a camelCase localStorage position object to snake_case Supabase columns.
 */
function mapPositionToRow(position) {
  // Derive option_type: use optionType if present, otherwise infer from tradeType
  let optionType = position.optionType
  if (!optionType && position.tradeType) {
    const tt = position.tradeType.toLowerCase()
    if (tt.includes('put')) optionType = 'put'
    else if (tt.includes('call')) optionType = 'call'
    else optionType = tt
  }

  return {
    id: String(position.id),
    symbol: position.symbol,
    option_type: optionType,
    trade_type: position.tradeType,
    strike_price: position.strikePrice,
    expiration_date: position.expirationDate,
    stock_price_at_entry: position.stockPrice ?? null,
    premium: position.premium,
    quantity: position.quantity ?? 1,
    fees: position.fees ?? 0.65,
    net_premium: position.netPremium ?? null,
    status: position.status ?? 'executed',
    closed: position.closed ?? false,
    executed: position.executed ?? true,
    execution_date: position.executionDate ?? null,
    closed_at: position.closedAt ?? null,
    closed_reason: position.closedReason ?? null,
    current_market_price: position.currentMarketPrice ?? null,
    last_price_update: position.lastPriceUpdate ?? null,
    notes: position.notes ?? null,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Upsert a single position to Supabase. Fire-and-forget.
 */
export async function syncPositionToSupabase(position) {
  if (!supabase) return
  try {
    const row = mapPositionToRow(position)
    await supabase
      .from('unicron_positions')
      .upsert(row, { onConflict: 'id' })
  } catch (err) {
    // Fire-and-forget: silently ignore errors
  }
}

/**
 * Delete a position from Supabase by id. Fire-and-forget.
 */
export async function deletePositionFromSupabase(positionId) {
  if (!supabase) return
  try {
    await supabase
      .from('unicron_positions')
      .delete()
      .eq('id', String(positionId))
  } catch (err) {
    // Fire-and-forget: silently ignore errors
  }
}

/**
 * Bulk upsert an array of positions to Supabase. Fire-and-forget.
 */
export async function bulkSyncPositionsToSupabase(positions) {
  if (!supabase) return
  if (!Array.isArray(positions) || positions.length === 0) return
  try {
    const rows = positions.map(mapPositionToRow)
    await supabase
      .from('unicron_positions')
      .upsert(rows, { onConflict: 'id' })
  } catch (err) {
    // Fire-and-forget: silently ignore errors
  }
}

// ── Stock holdings sync ─────────────────────────────────────────────────────

function mapStockToRow(stock) {
  return {
    id: String(stock.id),
    symbol: stock.symbol,
    shares: stock.shares,
    purchase_price: stock.assignedPrice ?? stock.purchasePrice ?? null,
    purchase_date: stock.dateAssigned ?? stock.purchaseDate ?? null,
    current_price: stock.currentPrice ?? null,
    last_price_update: stock.lastPriceUpdate ?? null,
    sold_price: stock.soldPrice ?? null,
    date_sold: stock.dateSold ?? null,
    stock_pnl: stock.stockPnL ?? null,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Bulk upsert stock holdings to Supabase. Fire-and-forget.
 */
export async function bulkSyncStocksToSupabase(stocks) {
  if (!supabase) return
  if (!Array.isArray(stocks) || stocks.length === 0) return
  try {
    const rows = stocks.map(mapStockToRow)
    await supabase
      .from('unicron_stocks')
      .upsert(rows, { onConflict: 'id' })
  } catch (err) {
    // Fire-and-forget: silently ignore errors
  }
}
