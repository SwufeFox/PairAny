/**
 * Price/volume formatting.
 *
 * Raw values are never rounded in the data layer; formatting happens only
 * at display boundaries (axis labels, crosshair, tooltips). Formatting is
 * magnitude-adaptive so a 0.00001234 ratio and a 65000 USDT price both
 * render sensibly, without fixed decimal counts and without scientific
 * notation for typical market magnitudes.
 */

const intlCache = new Map<string, Intl.NumberFormat>()

function numberFormat(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(options)
  let f = intlCache.get(key)
  if (!f) {
    f = new Intl.NumberFormat('en-US', options)
    intlCache.set(key, f)
  }
  return f
}

/** Format a raw price with `sigDigits` significant digits, no grouping. */
export function formatPrice(value: number, sigDigits = 6): string {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e15) return numberFormat({ maximumFractionDigits: 0, useGrouping: false }).format(value)
  return numberFormat({ maximumSignificantDigits: sigDigits, useGrouping: false }).format(value)
}

/**
 * Format a price rounded to the symbol's tick size (used by direct pairs,
 * where the exchange defines the representable grid).
 */
export function formatPriceTick(value: number, tickSize: number, sigDigits = 8): string {
  if (!Number.isFinite(value)) return '—'
  if (!Number.isFinite(tickSize) || tickSize <= 0) return formatPrice(value, sigDigits)
  const stepped = Math.round(value / tickSize) * tickSize
  // Number of decimals the tick size implies (handles tick = 0.01, 1, 0.000001, 5 …).
  const decimals = Math.max(0, -Math.floor(Math.log10(tickSize) + 1e-9))
  return numberFormat({ minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false }).format(stepped)
}

/** Signed change, e.g. "+12.34" / "-0.05". */
export function formatChange(change: number, sigDigits = 6): string {
  if (!Number.isFinite(change)) return '—'
  const sign = change > 0 ? '+' : change < 0 ? '-' : ''
  return sign + formatPrice(Math.abs(change), sigDigits)
}

/** Signed percentage, e.g. "+1.23%". */
export function formatPercent(pct: number, digits = 2): string {
  if (!Number.isFinite(pct)) return '—'
  const sign = pct > 0 ? '+' : pct < 0 ? '-' : ''
  return `${sign}${Math.abs(pct).toFixed(digits)}%`
}

/** Compact large counts for volume: 1.23M, 456K, 12.  */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1e9) return trimZeros(value / 1e9) + 'B'
  if (abs >= 1e6) return trimZeros(value / 1e6) + 'M'
  if (abs >= 1e3) return trimZeros(value / 1e3) + 'K'
  return trimZeros(value)
}

function trimZeros(v: number): string {
  const s = v.toFixed(3)
  return s.replace(/\.?0+$/, '')
}

/** Time-of-day / date for the time axis, driven by the candle interval. */
export function formatAxisTime(openTime: number, interval: string): string {
  const d = new Date(openTime)
  if (interval.endsWith('s') || interval.endsWith('m') || interval.endsWith('h')) {
    return hhmm.format(d)
  }
  if (interval === '1d') return mmmd.format(d)
  if (interval === '1M') return mmmyyyy.format(d)
  // 3d, 1w
  return mmmd.format(d)
}

const hhmm = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const mmmd = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const mmmyyyy = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })

/** Full timestamp for the crosshair tooltip (local timezone, explicit). */
export function formatFullTime(openTime: number): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(openTime))
}
