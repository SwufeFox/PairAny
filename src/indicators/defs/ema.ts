/**
 * EMA — exponential moving average, seeded with an SMA over the first period
 * and continued incrementally via carried state. O(1) per tick.
 */
import type { IndicatorDefinition } from '../../types/indicators'
import { at } from '../../lib/array'
import { buildSource, intParam, periodSchema, sourceParam, sourceSchema } from './helpers'

interface EmaState {
  prev: number | null
  prevIndex: number
}

export const emaDefinition: IndicatorDefinition = {
  id: 'ema',
  name: 'EMA',
  category: 'trend',
  description: 'Exponential moving average (SMA-seeded) of the selected source.',
  defaultPlacement: 'overlay',
  paramSchema: [periodSchema('period', 'Period', 12), sourceSchema()],
  defaultParams: { period: 12, source: 'close' },
  outputs: [{ id: 'ema', label: 'EMA', colorIndex: 1, width: 1.5 }],
  lookback: () => 1,
  compute(data, params, state, from) {
    const n = data.length
    const period = intParam(params, 'period', 12)
    const src = buildSource(data, sourceParam(params), n)
    const out = new Float64Array(n).fill(NaN)
    const k = 2 / (period + 1)
    const st = state as EmaState | null
    let prev: number | null = null
    let start = from
    if (from > 0 && st !== null && st.prevIndex === from - 1 && st.prev !== null && Number.isFinite(st.prev)) {
      prev = st.prev
    } else {
      start = Math.max(from, period - 1)
      if (start < n) {
        let sum = 0
        for (let i = start - period + 1; i <= start; i++) sum += at(src, i)
        prev = sum / period
        out[start] = prev
        start += 1
      }
    }
    for (let i = start; i < n; i++) {
      prev = at(src, i) * k + (prev ?? at(src, i)) * (1 - k)
      out[i] = prev
    }
    // Carried state must correspond to index n-2 (one behind the last
    // computed), because the engine may re-derive the last candle on update.
    const prevAtN2 = n >= 2 ? out[n - 2] : undefined
    return {
      outputs: [out],
      state: {
        prev: prevAtN2 !== undefined && Number.isFinite(prevAtN2) ? (prevAtN2 as number) : null,
        prevIndex: n - 2,
      },
    }
  },
}
