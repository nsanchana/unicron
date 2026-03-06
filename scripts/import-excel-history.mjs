/**
 * Import full trade history from Excel into Unicron KV.
 * Deduplicates against existing KV trades by (symbol + strikePrice + year-month of expiry).
 * Preserves all existing KV trades unchanged.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const KV_URL   = 'https://national-shepherd-15375.upstash.io';
const KV_TOKEN = 'ATwPAAIncDI4NGQ3MjYzZjcyZDA0OWYyODMzOTUwMTg1MWU5ZjI5OHAyMTUzNzU';

// ── helpers ────────────────────────────────────────────────────────────────
function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return d.toISOString().split('T')[0];
}

function yearMonth(isoDate) {
  // e.g. "2026-03-13" → "2026-03"
  return isoDate ? isoDate.slice(0, 7) : '';
}

async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  const j = await r.json();
  return j.result ? JSON.parse(j.result) : null;
}

async function kvSet(key, value) {
  const r = await fetch(`${KV_URL}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(value))
  });
  return r.json();
}

// ── read Excel ─────────────────────────────────────────────────────────────
const wb = XLSX.readFile('/mnt/c/Users/nsanc/Downloads/Naresh Option Tracker Template.xlsx');
const ws = wb.Sheets['Option'];
const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
const headers = allRows[3];
const dataRows = allRows.slice(4).filter(r => r[3] !== null && r[3] !== undefined);

const typeMap = { 'Put': 'cashSecuredPut', 'Call': 'coveredCall' };

const excelTrades = [];
dataRows.forEach((row, rowIdx) => {
  const obj = {};
  headers.forEach((h, j) => { if (h) obj[h] = row[j]; });
  if (!obj['Ticker'] || !obj['Strike'] || !obj['Opened']) return;

  const rawStatus  = (obj['Status'] || '').trim();
  const cp         = (obj['C / P'] || '').trim();
  const tradeType  = typeMap[cp] || 'cashSecuredPut';
  const openedISO  = excelDateToISO(obj['Opened']);
  const expiryISO  = excelDateToISO(obj['Expiration']);
  const closedISO  = excelDateToISO(obj['Date Closed']);
  const premium    = parseFloat(obj['Premium (Actual)']) || 0;
  const qty        = parseInt(obj['QTY'])  || 1;
  const fees       = parseFloat(obj['Fees (Open)'])    || 0;
  const closingCost= parseFloat(obj['Closing Cost'])   || 0;
  const closingFees= parseFloat(obj['Fees (Closed)'])  || 0;
  const isClosed   = rawStatus !== 'Open';

  let result = null;
  if (rawStatus === 'Closed')    result = closingCost === 0 ? 'worthless' : 'closed';
  else if (rawStatus === 'Rolled')    result = 'rolled';
  else if (rawStatus === 'Assigned')  result = 'assigned';

  const credit      = premium * qty * 100;
  const buybackTotal= closingCost * qty * 100;
  const netPremium  = parseFloat((credit - buybackTotal - fees - closingFees).toFixed(2));

  excelTrades.push({
    symbol:        obj['Ticker'],
    tradeType,
    strikePrice:   parseFloat(obj['Strike']) || 0,
    premium,
    quantity:      qty,
    executionDate: openedISO,
    expirationDate:expiryISO,
    timestamp:     openedISO ? openedISO + 'T00:00:00.000Z' : null,
    executed:      true,
    planned:       false,
    status:        rawStatus === 'Rolled' ? 'rolled' : 'executed',
    closed:        isClosed,
    result,
    closedAt:      closedISO ? closedISO + 'T00:00:00.000Z' : null,
    fees,
    netPremium,
    _rawStatus:    rawStatus,
  });
});

console.log(`Excel trades parsed: ${excelTrades.length}`);

// ── fetch current KV data ──────────────────────────────────────────────────
console.log('\nFetching current KV data...');
const kvData = await kvGet('user:1:data');
const existingTrades = kvData.tradeData || [];
console.log(`Existing KV trades: ${existingTrades.length}`);

// Build dedup set: "SYMBOL|STRIKE|YEAR-MONTH"
const kvKeys = new Set(
  existingTrades.map(t => `${t.symbol}|${t.strikePrice}|${yearMonth(t.expirationDate)}`)
);

// ── find Excel trades not in KV ────────────────────────────────────────────
const toImport = excelTrades.filter(t => {
  const key = `${t.symbol}|${t.strikePrice}|${yearMonth(t.expirationDate)}`;
  return !kvKeys.has(key);
});

console.log(`\nTrades to import: ${toImport.length}`);
console.log(`Trades already in KV (skipped): ${excelTrades.length - toImport.length}`);

// Summary of what will be imported
const statCounts = {};
toImport.forEach(t => { statCounts[t._rawStatus] = (statCounts[t._rawStatus]||0)+1; });
console.log('Import breakdown by status:', statCounts);

// Show a sample
console.log('\nSample imports (first 5):');
toImport.slice(0, 5).forEach(t =>
  console.log(` ${t.symbol} ${t.tradeType} $${t.strikePrice} exp:${t.expirationDate} [${t._rawStatus}] net:$${t.netPremium}`)
);

// ── build new trade list ───────────────────────────────────────────────────
// Generate IDs: use a fake timestamp offset to keep them sorted before 2026 KV trades
let idBase = 1700000000000; // Nov 2023
const importedWithIds = toImport.map(t => {
  const d = new Date(t.executionDate || '2024-01-01');
  const id = d.getTime() + Math.floor(Math.random() * 999999);
  const { _rawStatus, ...clean } = t;
  return { id, ...clean };
});

// Merge: historical imports first (sorted by date), then existing KV trades
const merged = [
  ...importedWithIds.sort((a,b) => (a.executionDate||'').localeCompare(b.executionDate||'')),
  ...existingTrades,
];

console.log(`\nTotal trades after merge: ${merged.length}`);

// ── save to KV ─────────────────────────────────────────────────────────────
const newData = {
  ...kvData,
  tradeData: merged,
  lastSynced: new Date().toISOString(),
};

console.log('\nSaving to KV...');
const result = await kvSet('user:1:data', newData);
console.log('KV response:', JSON.stringify(result));
console.log('\n✅ Import complete! Unicron now has', merged.length, 'trades total.');
