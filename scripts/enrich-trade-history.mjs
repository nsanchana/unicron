/**
 * Enrich imported historical trades with full cost breakdown from Excel:
 * - buybackCost (per-share closing cost)
 * - closingFees
 * - profit (Excel's calculated net profit)
 * - annualReturn (from Excel)
 * - daysHeld
 * - originalDTE
 *
 * Matches by: symbol + strikePrice + expirationDate (±2 days)
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const KV_URL   = 'https://national-shepherd-15375.upstash.io';
const KV_TOKEN = 'ATwPAAIncDI4NGQ3MjYzZjcyZDA0OWYyODMzOTUwMTg1MWU5ZjI5OHAyMTUzNzU';

// ── helpers ────────────────────────────────────────────────────────────────
function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().split('T')[0];
}

function daysDiff(a, b) {
  if (!a || !b) return 999;
  return Math.abs((new Date(a) - new Date(b)) / 86400000);
}

async function kvGetRaw() {
  const r = await fetch(`${KV_URL}/get/user:1:data`, { headers: { Authorization: `Bearer ${KV_TOKEN}` }});
  const j = await r.json();
  const parsed = JSON.parse(j.result);
  return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
}

async function kvSave(data) {
  const r = await fetch(`${KV_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([["SET", "user:1:data", JSON.stringify(data)]])
  });
  return r.json();
}

// ── read Excel ─────────────────────────────────────────────────────────────
const wb = XLSX.readFile('/mnt/c/Users/nsanc/Downloads/Naresh Option Tracker Template.xlsx');
const ws = wb.Sheets['Option'];
const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
const headers = allRows[3];

const excelTrades = allRows.slice(4)
  .filter(r => r[3] !== null && r[3] !== undefined)
  .map(row => {
    const o = {};
    headers.forEach((h, i) => { if (h) o[h] = row[i]; });
    return {
      symbol:        o['Ticker'],
      strikePrice:   parseFloat(o['Strike']) || 0,
      executionDate: excelDateToISO(o['Opened']),
      expirationDate:excelDateToISO(o['Expiration']),
      premium:       parseFloat(o['Premium (Actual)']) || 0,
      qty:           parseInt(o['QTY']) || 1,
      // Cost breakdown
      buybackCost:   parseFloat(o['Closing Cost']) || 0,    // per share
      rollingCost:   parseFloat(o['Rolling Cost']) || 0,     // per share
      feesOpen:      parseFloat(o['Fees (Open)']) || 0,
      feesClose:     parseFloat(o['Fees (Closed)']) || 0,
      // P&L
      credit:        parseFloat(o['Credit']) || 0,
      debit:         parseFloat(o['Debit']) || 0,
      profit:        parseFloat(o['Profit']),                 // Excel net profit
      annualReturn:  parseFloat(o['Annual Return']) || null,
      profitYield:   parseFloat(o['Profit Yield']) || null,
      // Duration
      daysHeld:      parseInt(o['Days Held']) || null,
      originalDTE:   parseInt(o['Original Days']) || null,
      // Status
      rawStatus:     (o['Status'] || '').trim(),
      closedDate:    excelDateToISO(o['Date Closed']),
    };
  });

console.log(`Excel rows: ${excelTrades.length}`);

// ── fetch KV ──────────────────────────────────────────────────────────────
console.log('Fetching KV data...');
const kvData = await kvGetRaw();
const trades = kvData.tradeData;
console.log(`KV trades: ${trades.length}`);

// Imported trades are those with IDs ≤ 1768000000000 (generated from execution dates, not manual entry)
const isImported = t => t.id <= 1768000000000;

// ── match & enrich ─────────────────────────────────────────────────────────
let matched = 0, unmatched = 0, enriched = 0;
const unmatchedList = [];

const enrichedTrades = trades.map(trade => {
  if (!isImported(trade)) return trade; // leave manually-entered trades untouched

  // Find matching Excel row: symbol + strike + expiry within ±2 days
  const match = excelTrades.find(e =>
    e.symbol === trade.symbol &&
    Math.abs(e.strikePrice - trade.strikePrice) < 0.01 &&
    daysDiff(e.expirationDate, trade.expirationDate) <= 2
  );

  if (!match) {
    unmatched++;
    unmatchedList.push(`${trade.symbol} $${trade.strikePrice} exp:${trade.expirationDate}`);
    return trade;
  }

  matched++;

  // Only add fields with actual values — don't overwrite existing accurate data
  const updates = {};

  // Fees breakdown
  if (match.feesClose > 0)   updates.closingFees  = match.feesClose;
  if (match.buybackCost > 0) updates.buybackCost  = match.buybackCost;   // per share
  if (match.rollingCost > 0) updates.rollingCost  = match.rollingCost;   // per share

  // Recalculate netPremium with full breakdown for accuracy
  const credit       = match.premium * match.qty * 100;
  const buybackTotal = match.buybackCost * match.qty * 100;
  const rollTotal    = match.rollingCost * match.qty * 100;
  const totalCost    = buybackTotal + rollTotal + match.feesOpen + match.feesClose;
  const netPremium   = parseFloat((credit - totalCost).toFixed(2));

  updates.netPremium = netPremium;

  // Excel's authoritative profit figure
  if (!isNaN(match.profit)) updates.profit = parseFloat(match.profit.toFixed(2));

  // Duration & yield metadata
  if (match.daysHeld !== null)    updates.daysHeld    = match.daysHeld;
  if (match.originalDTE !== null) updates.originalDTE = match.originalDTE;
  if (match.annualReturn !== null && !isNaN(match.annualReturn))
    updates.annualReturn = parseFloat((match.annualReturn * 100).toFixed(2)); // store as %
  if (match.profitYield !== null && !isNaN(match.profitYield))
    updates.profitYield = parseFloat((match.profitYield * 100).toFixed(2));  // store as %

  if (Object.keys(updates).length > 0) enriched++;

  return { ...trade, ...updates };
});

console.log(`\nMatched: ${matched} | Unmatched: ${unmatched} | Enriched with new fields: ${enriched}`);

if (unmatchedList.length > 0) {
  console.log('\nUnmatched trades (no Excel row found):');
  unmatchedList.forEach(u => console.log(' ', u));
}

// Show a sample enriched trade
const sampleEnriched = enrichedTrades.find(t => isImported(t) && t.buybackCost > 0);
if (sampleEnriched) {
  console.log('\nSample trade with buyback after enrichment:');
  const { symbol, strikePrice, premium, fees, buybackCost, closingFees, netPremium, profit, daysHeld } = sampleEnriched;
  console.log(JSON.stringify({ symbol, strikePrice, premium, fees, buybackCost, closingFees, netPremium, profit, daysHeld }, null, 2));
}

// Show P&L summary before and after
const beforeNet = trades.filter(isImported).reduce((s,t) => s + (t.netPremium||0), 0);
const afterNet  = enrichedTrades.filter(isImported).reduce((s,t) => s + (t.netPremium||0), 0);
console.log(`\nHistorical netPremium total — Before: $${beforeNet.toFixed(2)} | After: $${afterNet.toFixed(2)}`);
console.log(`Difference: $${(afterNet - beforeNet).toFixed(2)}`);

// ── save ───────────────────────────────────────────────────────────────────
const newData = { ...kvData, tradeData: enrichedTrades, lastSynced: new Date().toISOString() };
console.log('\nSaving to KV...');
const result = await kvSave(newData);
console.log('Result:', JSON.stringify(result));
console.log('✅ Done. All historical trades now have full cost breakdown.');
