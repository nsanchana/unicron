import { formatEarningsDate, getEarningsUrgency } from "../services/earningsService"

/**
 * EarningsBadge — compact earnings date pill for trade rows and stock rows.
 * Props:
 *   earningsTs: number|null  (unix timestamp in seconds)
 *   compact: bool  (default false — if true, smaller text)
 */
export default function EarningsBadge({ earningsTs, compact = false }) {
  const label = formatEarningsDate(earningsTs)
  if (!label) return null

  const urgency = getEarningsUrgency(earningsTs)

  const styles = {
    danger:  "bg-red-500/20 text-red-400 border border-red-500/30",
    caution: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/25",
    info:    "bg-slate-500/15 text-slate-400 border border-slate-500/20",
    none:    null,
  }

  const style = styles[urgency]
  if (!style) return null

  const icon = urgency === "danger" ? "⚡" : urgency === "caution" ? "📅" : "📅"

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap ${style} ${
      compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
    }`}>
      {icon} {label}
    </span>
  )
}
