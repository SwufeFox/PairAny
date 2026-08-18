/** Shared helpers for indicator definitions. */
import type { Candle } from '../../types/market'
import type { IndicatorParams, IndicatorSource, ParamOption, ParamSchema } from '../../types/indicators'

export function numParam(params: IndicatorParams, key: string, fallback: number): number {
  const v = params[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export function intParam(params: IndicatorParams, key: string, fallback: number): number {
  return Math.max(1, Math.round(numParam(params, key, fallback)))
}

export function sourceParam(params: IndicatorParams, fallback: IndicatorSource = 'close'): IndicatorSource {
  const v = params['source']
  if (v === 'open' || v === 'high' || v === 'low' || v === 'close' || v === 'hlc3' || v === 'ohlc4') return v
  return fallback
}

export function sourceValue(c: Candle, source: IndicatorSource): number {
  switch (source) {
    case 'open':
      return c.open
    case 'high':
      return c.high
    case 'low':
      return c.low
    case 'hlc3':
      return (c.high + c.low + c.close) / 3
    case 'ohlc4':
      return (c.open + c.high + c.low + c.close) / 4
    default:
      return c.close
  }
}

export function buildSource(data: readonly Candle[], source: IndicatorSource, n: number): Float64Array {
  const arr = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const c = data[i]
    arr[i] = c ? sourceValue(c, source) : NaN
  }
  return arr
}

export const SOURCE_OPTIONS: ParamOption[] = [
  { label: 'Close', value: 'close' },
  { label: 'Open', value: 'open' },
  { label: 'High', value: 'high' },
  { label: 'Low', value: 'low' },
  { label: 'HLC3', value: 'hlc3' },
  { label: 'OHLC4', value: 'ohlc4' },
]

export function periodSchema(key: string, label: string, def: number, min = 1, max = 500): ParamSchema {
  return { key, label, type: 'number', min, max, step: 1, default: def }
}

export function sourceSchema(): ParamSchema {
  return { key: 'source', label: 'Source', type: 'select', options: SOURCE_OPTIONS }
}
