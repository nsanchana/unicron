import { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, Target, Calendar, Award, Clock, BarChart2, Percent, DollarSign, Activity, Shield, PhoneCall, LineChart } from 'lucide-react'
import PortfolioChat from './PortfolioChat'

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const YEARS = ['2024', '2025', '2026', 'All Time']

// ── helpers ────────────────────────────────────────────────────────────────
function inYear(dateStr, year) {
  if (!dateStr || year === 'All Time') return true
  return String(dateStr).slice(0, 4) === year
}
function safeNet(t) {
  return t.netPremium ?? (t.premium * (t.quantity || 1) * 100)
}
function mean(arr) {
  const valid = arr.filter(v => v != null && !isNaN(v))
  return valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : 0
}
function fmt$(n, decimals = 0) {
  const abs = Math.abs(n)
  return (n < 0 ? '-$' : '$') + abs.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// ── sub-components ─────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub, colour = 'text-white/85', border = 'border-white/[0.08]', iconBg = 'bg-white/[0.06]', iconColour = 'text-white/40' }) {
  return (
    <div className={`bg-white/[0.05] backdrop-blur-2xl border ${border} rounded-[28px] p-5 flex flex-col justify-between`}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`p-2 ${iconBg} rounded-xl`}>
          <Icon className={`h-4 w-4 ${iconColour}`} />
        </div>
        <span className="text-[11px] font-semibold text-white/40">{label}</span>
      </div>
      <div>
        <div className={`text-2xl font-bold font-mono leading-none tracking-tight ${colour}`}>{value}</div>
        {sub && <div className="text-[11px] text-white/35 mt-1.5">{sub}</div>}
      </div>
    </div>
  )
}

function MonthBar({ label, value, maxValue, isFuture, isCurrentMonth, isYearView = false }) {
  const pct = maxValue > 0 ? Math.min(Math.abs(value) / maxValue * 100, 100) : 0
  const isNeg = value < 0
  const barColour = isFuture ? 'bg-white/10' : isNeg ? 'bg-rose-500/60' : value > 0 ? 'bg-emerald-500/70' : 'bg-white/15'
  const borderColour = isCurrentMonth ? 'border-blue-500/30 shadow-[0_0_16px_rgba(59,130,246,0.1)]' : isFuture ? 'border-white/[0.04]' : 'border-white/[0.06]'
  const labelSize = isYearView ? 'text-base font-bold tracking-tight' : 'text-[10px] font-semibold tracking-wide'
  const valueSize = isYearView ? 'text-sm font-bold font-mono' : 'text-[10px] font-mono font-semibold'
  const barWidth  = isYearView ? 'w-12' : 'w-5'
  const barHeight = isYearView ? 96 : 64
  return (
    <div className={`relative bg-white/[0.04] border ${borderColour} rounded-2xl ${isYearView ? 'p-5' : 'p-3'} flex flex-col items-center gap-2`}>
      <span className={`${labelSize} ${isCurrentMonth ? 'text-blue-400' : 'text-white/60'}`}>{label}</span>
      <div className="w-full flex-1 flex items-end justify-center" style={{ height: barHeight }}>
        <div
          className={`${barWidth} rounded-t-md transition-all duration-500 ${barColour}`}
          style={{ height: isFuture ? '4px' : `${Math.max(pct, 3)}%` }}
        />
      </div>
      <span className={`${valueSize} ${isFuture ? 'text-white/20' : isNeg ? 'text-rose-400' : value > 0 ? 'text-emerald-400' : 'text-white/30'}`}>
        {isFuture ? '—' : value === 0 ? '$0' : fmt$(value)}
      </span>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────
export default function Performance({ tradeData = [], stockData = [], settings = {}, chatHistory = [], onUpdateHistory }) {
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()))
  const currentMonth = new Date().getMonth()
  const currentYear  = String(new Date().getFullYear())

  // ── derived data ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    // Closed executed option trades in the selected period
    const closedOptions = tradeData.filter(t =>
      t.executed && t.closed && inYear(t.closedAt || t.expirationDate, selectedYear)
    )
    // Sold stocks in the selected period
    const soldStocks = (stockData || []).filter(s =>
      s.dateSold && s.soldPrice && inYear(s.dateSold, selectedYear)
    )

    const wins        = closedOptions.filter(t => t.result === 'worthless').length
    const assignments = closedOptions.filter(t => t.result === 'assigned').length
    const rolled      = closedOptions.filter(t => t.result === 'rolled').length
    const winDenom    = closedOptions.length - rolled
    const winRate     = winDenom > 0 ? (wins / winDenom) * 100 : 0
    const assignRate  = closedOptions.length > 0 ? (assignments / closedOptions.length) * 100 : 0

    const optionPnL = closedOptions.reduce((s, t) => s + safeNet(t), 0)
    const stockPnL  = soldStocks.reduce((s, st) => s + (parseFloat(st.stockPnL) || 0), 0)
    const totalPnL  = optionPnL + stockPnL

    const avgPremium  = mean(closedOptions.map(t => safeNet(t)))
    const avgDaysHeld = mean(closedOptions.filter(t => t.daysHeld).map(t => t.daysHeld))
    const avgDTE      = mean(closedOptions.filter(t => t.originalDTE).map(t => t.originalDTE))
    const avgEarlyClose = mean(
      closedOptions.filter(t => t.result !== 'worthless' && t.daysHeld).map(t => t.daysHeld)
    )

    // Monthly breakdown (for specific year)
    const monthly = MONTHS.map((_, i) => {
      const yr = selectedYear === 'All Time' ? null : selectedYear
      const optIncome = tradeData
        .filter(t => t.executed && t.closed)
        .filter(t => {
          const d = t.closedAt || t.expirationDate
          if (!d) return false
          if (yr && String(d).slice(0, 4) !== yr) return false
          return new Date(d).getMonth() === i
        })
        .reduce((s, t) => s + safeNet(t), 0)
      const stIncome = (stockData || [])
        .filter(s => s.dateSold && s.soldPrice)
        .filter(s => {
          if (yr && String(s.dateSold).slice(0, 4) !== yr) return false
          return new Date(s.dateSold).getMonth() === i
        })
        .reduce((s, st) => s + (parseFloat(st.stockPnL) || 0), 0)
      return optIncome + stIncome
    })

    // Yearly breakdown (for All Time)
    const yearly = ['2024', '2025', '2026'].map(yr => {
      const opt = tradeData
        .filter(t => t.executed && t.closed && String(t.closedAt || t.expirationDate || '').slice(0, 4) === yr)
        .reduce((s, t) => s + safeNet(t), 0)
      const st = (stockData || [])
        .filter(s => s.dateSold && String(s.dateSold).slice(0, 4) === yr)
        .reduce((s, x) => s + (parseFloat(x.stockPnL) || 0), 0)
      return opt + st
    })

    // Symbol breakdown
    const bySymbol = {}
    closedOptions.forEach(t => {
      if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { count: 0, net: 0, wins: 0, denom: 0 }
      bySymbol[t.symbol].count++
      bySymbol[t.symbol].net += safeNet(t)
      if (t.result !== 'rolled') bySymbol[t.symbol].denom++
      if (t.result === 'worthless') bySymbol[t.symbol].wins++
    })
    const symbolList = Object.entries(bySymbol)
      .map(([sym, d]) => ({ sym, count: d.count, net: d.net, winRate: d.denom > 0 ? (d.wins / d.denom) * 100 : 0 }))
      .sort((a, b) => b.net - a.net)

    // Type breakdown
    const byType = { cashSecuredPut: { count:0,net:0,wins:0,denom:0 }, coveredCall: { count:0,net:0,wins:0,denom:0 } }
    closedOptions.forEach(t => {
      const k = t.tradeType === 'coveredCall' ? 'coveredCall' : 'cashSecuredPut'
      byType[k].count++
      byType[k].net += safeNet(t)
      if (t.result !== 'rolled') byType[k].denom++
      if (t.result === 'worthless') byType[k].wins++
    })

    return {
      closedOptions, soldStocks,
      totalPnL, optionPnL, stockPnL,
      winRate, assignRate, avgPremium, avgDaysHeld, avgDTE, avgEarlyClose,
      monthly, yearly, symbolList, byType,
      count: closedOptions.length,
    }
  }, [tradeData, stockData, selectedYear])

  const maxMonthly = Math.max(...stats.monthly.map(Math.abs), 1)
  const maxYearly  = Math.max(...stats.yearly.map(Math.abs), 1)

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-6 border-b border-white/[0.06]">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <TrendingUp className="h-6 w-6 text-emerald-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Performance</h1>
          </div>
          <p className="text-white/40 font-medium text-sm ml-[52px]">Track your trading performance and P&L analytics.</p>
        </div>
      </header>

      {/* ── Year Selector ────────────────────────────────────────────────── */}
      <div className="flex items-center">
        <div className="flex bg-white/5 backdrop-blur-md border border-white/10 p-1 rounded-2xl gap-0.5">
        {YEARS.map(yr => (
          <button
            key={yr}
            onClick={() => setSelectedYear(yr)}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all ${
              selectedYear === yr
                ? 'bg-white/20 text-white shadow-lg'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.08]'
            }`}
          >
            {yr}
          </button>
        ))}
        </div>
        <span className="text-[11px] text-white/30 ml-3">
          {stats.count} closed trade{stats.count !== 1 ? 's' : ''}
          {stats.soldStocks.length > 0 && ` · ${stats.soldStocks.length} stock exit${stats.soldStocks.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* ── Metric Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Total P&L"
          value={fmt$(stats.totalPnL)}
          sub={stats.stockPnL !== 0 ? `Options ${fmt$(stats.optionPnL)} · Stocks ${fmt$(stats.stockPnL)}` : `Options only`}
          colour={stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}
          border={stats.totalPnL >= 0 ? 'border-emerald-500/20' : 'border-rose-500/20'}
          iconBg={stats.totalPnL >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}
          iconColour={stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
        <MetricCard
          icon={Award}
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          sub="Expired worthless"
          colour="text-emerald-400"
          iconBg="bg-emerald-500/10"
          iconColour="text-emerald-400"
        />
        <MetricCard
          icon={Activity}
          label="Trades Closed"
          value={stats.count}
          sub={`${stats.byType.cashSecuredPut.count} CSP · ${stats.byType.coveredCall.count} CC`}
          colour="text-blue-400"
          iconBg="bg-blue-500/10"
          iconColour="text-blue-400"
        />
        <MetricCard
          icon={TrendingUp}
          label="Avg Net Premium"
          value={fmt$(stats.avgPremium, 0)}
          sub="Per closed trade"
          colour="text-sky-400"
          iconBg="bg-sky-500/10"
          iconColour="text-sky-400"
        />
        <MetricCard
          icon={Percent}
          label="Assignment Rate"
          value={`${stats.assignRate.toFixed(1)}%`}
          sub="CSP assigned"
          colour={stats.assignRate > 20 ? 'text-amber-400' : 'text-white/70'}
          iconBg={stats.assignRate > 20 ? 'bg-amber-500/10' : 'bg-white/[0.06]'}
          iconColour={stats.assignRate > 20 ? 'text-amber-400' : 'text-white/40'}
        />
        <MetricCard
          icon={Clock}
          label="Avg Days Held"
          value={stats.avgDaysHeld > 0 ? `${Math.round(stats.avgDaysHeld)}d` : '—'}
          sub={stats.avgDTE > 0 ? `Opened at ${Math.round(stats.avgDTE)}DTE` : ''}
          colour="text-purple-400"
          iconBg="bg-purple-500/10"
          iconColour="text-purple-400"
        />
      </div>

      {/* ── Income Roadmap ────────────────────────────────────────────────── */}
      <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[28px] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
            <Calendar className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/85">
              {selectedYear === 'All Time' ? 'All-Time Year-by-Year Income' : `${selectedYear} Monthly Income`}
            </h3>
            <p className="text-[11px] text-white/40 mt-0.5">Options premiums + stock gains</p>
          </div>
          <div className="ml-auto text-right">
            <div className={`text-lg font-bold font-mono ${stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmt$(stats.totalPnL)}
            </div>
            <div className="text-[11px] text-white/35">period total</div>
          </div>
        </div>

        {selectedYear === 'All Time' ? (
          /* Year-by-year bars */
          <div className="grid grid-cols-3 gap-6">
            {['2024', '2025', '2026'].map((yr, i) => (
              <MonthBar
                key={yr}
                label={yr}
                value={stats.yearly[i]}
                maxValue={maxYearly}
                isFuture={yr > currentYear}
                isCurrentMonth={yr === currentYear}
                isYearView={true}
              />
            ))}
          </div>
        ) : (
          /* Monthly bars */
          <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
            {MONTHS.map((m, i) => {
              const isFuture = selectedYear === currentYear && i > currentMonth
              return (
                <MonthBar
                  key={m}
                  label={m}
                  value={stats.monthly[i]}
                  maxValue={maxMonthly}
                  isFuture={isFuture}
                  isCurrentMonth={selectedYear === currentYear && i === currentMonth}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* ── Symbol + Type breakdown ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* P&L by Symbol */}
        <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[28px] p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <BarChart2 className="h-4 w-4 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-white/85">P&L by Symbol</h3>
          </div>
          {stats.symbolList.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-8">No closed trades in this period</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {stats.symbolList.map(({ sym, count, net, winRate }) => (
                <div key={sym} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${net >= 0 ? 'bg-emerald-500/[0.04] border-emerald-500/10' : 'bg-rose-500/[0.04] border-rose-500/10'}`}>
                  <span className={`text-xs font-bold w-12 ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{sym}</span>
                  <span className="text-[11px] text-white/35 w-16">{count} trade{count !== 1 ? 's' : ''}</span>
                  <span className={`text-sm font-bold font-mono flex-1 ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt$(net)}</span>
                  <span className="text-[11px] text-white/40 font-mono">{winRate.toFixed(0)}% win</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Income Sources Breakdown */}
        <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[28px] p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
              <Target className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white/85">Income Sources</h3>
              <p className="text-[11px] text-white/35 mt-0.5">Where you made your money</p>
            </div>
            <div className="ml-auto text-right">
              <div className={`text-base font-bold font-mono ${stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt$(stats.totalPnL)}</div>
              <div className="text-[11px] text-white/30">combined</div>
            </div>
          </div>
          <div className="space-y-3">
            {/* Cash Secured Puts + Covered Calls */}
            {[
              { key: 'cashSecuredPut', label: 'Cash Secured Puts', colour: 'blue',   Icon: Shield     },
              { key: 'coveredCall',    label: 'Covered Calls',     colour: 'violet', Icon: PhoneCall  },
            ].map(({ key, label, colour, Icon }) => {
              const d = stats.byType[key]
              const wr = d.denom > 0 ? (d.wins / d.denom * 100).toFixed(1) : '0'
              const avg = d.count > 0 ? d.net / d.count : 0
              const sharePct = stats.totalPnL !== 0 ? Math.abs(d.net / stats.totalPnL * 100).toFixed(0) : '0'
              return (
                <div key={key} className={`p-4 bg-${colour}-500/[0.05] border border-${colour}-500/15 rounded-2xl`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 bg-${colour}-500/10 rounded-lg`}>
                        <Icon className={`h-3.5 w-3.5 text-${colour}-400`} />
                      </div>
                      <span className={`text-xs font-semibold text-${colour}-400`}>{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full bg-${colour}-500/10 text-${colour}-400`}>{sharePct}% of total</span>
                      <span className="text-[11px] text-white/35">{d.count} trades</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-[11px] text-white/35 font-medium mb-1">Total P&L</div>
                      <div className={`text-base font-bold font-mono ${d.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt$(d.net)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-white/35 font-medium mb-1">Win Rate</div>
                      <div className="text-base font-bold font-mono text-white/85">{wr}%</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-white/35 font-medium mb-1">Avg / Trade</div>
                      <div className="text-base font-bold font-mono text-white/85">{fmt$(avg)}</div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Stock Capital Gains */}
            {(() => {
              const stNet = stats.stockPnL
              const stCount = stats.soldStocks.length
              const stAvg = stCount > 0 ? stNet / stCount : 0
              const stWinners = stats.soldStocks.filter(s => (parseFloat(s.stockPnL) || 0) > 0).length
              const stWinRate = stCount > 0 ? (stWinners / stCount * 100).toFixed(1) : '0'
              const sharePct = stats.totalPnL !== 0 ? Math.abs(stNet / stats.totalPnL * 100).toFixed(0) : '0'
              return (
                <div className="p-4 bg-emerald-500/[0.05] border border-emerald-500/15 rounded-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                        <LineChart className="h-3.5 w-3.5 text-emerald-400" />
                      </div>
                      <span className="text-xs font-semibold text-emerald-400">Stock Capital Gains</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">{sharePct}% of total</span>
                      <span className="text-[11px] text-white/35">{stCount} exit{stCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-[11px] text-white/35 font-medium mb-1">Total P&L</div>
                      <div className={`text-base font-bold font-mono ${stNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt$(stNet)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-white/35 font-medium mb-1">Win Rate</div>
                      <div className="text-base font-bold font-mono text-white/85">{stWinRate}%</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-white/35 font-medium mb-1">Avg / Exit</div>
                      <div className="text-base font-bold font-mono text-white/85">{fmt$(stAvg)}</div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ── Duration Stats ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          icon={Clock} label="Avg DTE at Entry"
          value={stats.avgDTE > 0 ? `${Math.round(stats.avgDTE)}d` : '—'}
          sub="Days to expiry when opened"
          colour="text-purple-400" iconBg="bg-purple-500/10" iconColour="text-purple-400"
        />
        <MetricCard
          icon={Calendar} label="Avg Days Held"
          value={stats.avgDaysHeld > 0 ? `${Math.round(stats.avgDaysHeld)}d` : '—'}
          sub="All closed trades"
          colour="text-sky-400" iconBg="bg-sky-500/10" iconColour="text-sky-400"
        />
        <MetricCard
          icon={TrendingDown} label="Avg Early Close"
          value={stats.avgEarlyClose > 0 ? `${Math.round(stats.avgEarlyClose)}d` : '—'}
          sub="Trades closed before expiry"
          colour="text-rose-400" iconBg="bg-rose-500/10" iconColour="text-rose-400"
        />
      </div>

      {/* ── Unicron AI Chat ───────────────────────────────────────────────── */}
      <PortfolioChat
        tradeData={tradeData}
        stockData={stockData}
        settings={settings}
        chatHistory={chatHistory}
        onUpdateHistory={onUpdateHistory}
      />

    </div>
  )
}
