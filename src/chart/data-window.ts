/**
 * Data window ("详细信息") — the fixed-position detail panel that shows the
 * hovered candle's full OHLCV readout plus both legs. Replaces the old
 * floating crosshair tooltip; rendered imperatively so mousemove never
 * re-renders React. Styling uses Appica semantic tokens via Tailwind
 * utilities; up/down colors come from the chart tokens.
 */
import type { Candle } from '../types/market'
import { formatChange, formatCompact, formatFullTime, formatPercent, formatPrice } from '../lib/format'

export interface DataWindowData {
  pairLabel: string
  openTime: number
  candle: Candle
  /** Latest close — the "vs now" change % baseline. */
  currentClose: number | null
  /** Localized volume-row label ('Volume' | 'Synthetic Volume (est.)' | 'Hidden'). */
  volumeLabel: string
  legs: Array<{ symbol: string; close: number | null }>
  isSynthetic: boolean
  /** Localized field labels. */
  labels: {
    open: string
    high: string
    low: string
    close: string
    change: string
    changePct: string
    /** "vs now" relative-change label, e.g. 对现价 / vs Current. */
    vsNow: string
    syntheticClose: string
    closeSuffix: string
  }
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function row(label: string, value: string, valueClass = ''): HTMLElement {
  const r = el('div', 'flex items-baseline justify-between gap-6')
  r.append(el('span', 'text-foreground-subtle text-[11px]', label))
  r.append(el('span', `tnum text-foreground-inverse text-[11px] font-medium ${valueClass}`, value))
  return r
}

/** Rebuild the detail-panel content inside `root`. */
export function renderDataWindow(root: HTMLElement, data: DataWindowData | null): void {
  if (!data) {
    root.replaceChildren(el('div', 'text-foreground-subtle text-[11px]', '—'))
    return
  }
  const { candle, legs, isSynthetic } = data
  const change = candle.close - candle.open
  const pct = candle.open !== 0 ? (change / candle.open) * 100 : 0
  const dir = change >= 0 ? 'text-(--chart-up)' : 'text-(--chart-down)'
  const frag = document.createDocumentFragment()

  const header = el('div', 'mb-1.5 flex items-baseline justify-between gap-4')
  header.append(el('span', 'text-foreground-inverse text-xs font-semibold', data.pairLabel))
  header.append(el('span', 'text-foreground-subtle text-[10px]', formatFullTime(data.openTime)))
  frag.append(header)

  frag.append(row(data.labels.open, formatPrice(candle.open)))
  frag.append(row(data.labels.high, formatPrice(candle.high)))
  frag.append(row(data.labels.low, formatPrice(candle.low)))
  frag.append(row(data.labels.close, formatPrice(candle.close)))
  frag.append(row(data.labels.change, formatChange(change), dir))
  frag.append(row(data.labels.changePct, formatPercent(pct), dir))
  // Hovered close relative to the CURRENT price, colored by direction.
  if (data.currentClose !== null && data.currentClose > 0) {
    const vsPct = ((candle.close - data.currentClose) / data.currentClose) * 100
    const vsDir = vsPct >= 0 ? 'text-(--chart-up)' : 'text-(--chart-down)'
    frag.append(row(data.labels.vsNow, formatPercent(vsPct), vsDir))
  }
  if (data.volumeLabel !== 'Hidden') {
    frag.append(row(data.volumeLabel, formatCompact(candle.volume)))
  }

  if (isSynthetic && legs.length > 0) {
    frag.append(el('div', 'border-border-muted my-1.5 border-t'))
    for (const leg of legs) {
      frag.append(row(
        `${leg.symbol} ${data.labels.closeSuffix}`,
        leg.close !== null ? formatPrice(leg.close) : '—',
      ))
    }
    frag.append(row(data.labels.syntheticClose, formatPrice(candle.close), 'text-foreground-intense'))
  }

  root.replaceChildren(frag)
}
