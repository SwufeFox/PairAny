/**
 * VWAP — session volume-weighted average price, anchored at UTC day
 * boundaries (matching Binance's UTC kline days). Incremental via state.
 * Note: for synthetic pairs the "volume" is the combined USDT notional, so
 * VWAP weights by notional — documented in the UI.
 */
import type { IndicatorDefinition } from '../../types/indicators'

interface VwapState {
  dayKey: number
  cumPV: number
  cumV: number
  prevIndex: number
}

export const vwapDefinition: IndicatorDefinition = {
  id: 'vwap',
  name: 'VWAP',
  category: 'trend',
  description: 'Volume-weighted average price, anchored to UTC day sessions.',
  defaultPlacement: 'overlay',
  paramSchema: [],
  defaultParams: {},
  outputs: [{ id: 'vwap', label: 'VWAP', colorIndex: 5, width: 1.5 }],
  lookback: () => 1,
  compute(data, _params, state, from) {
    const n = data.length
    const out = new Float64Array(n).fill(NaN)
    const st = state as VwapState | null
    let dayKey = -1
    let cumPV = 0
    let cumV = 0
    let start = from
    let snapDay = -1
    let snapPV = 0
    let snapV = 0
    if (from > 0 && st !== null && st.prevIndex === from - 1) {
      dayKey = st.dayKey
      cumPV = st.cumPV
      cumV = st.cumV
    } else {
      start = 0
    }
    for (let i = start; i < n; i++) {
      if (i === n - 1) {
        snapDay = dayKey
        snapPV = cumPV
        snapV = cumV
      }
      const c = data[i]
      if (!c) {
        out[i] = NaN
        continue
      }
      const day = Math.floor(c.openTime / 86_400_000)
      if (day !== dayKey) {
        dayKey = day
        cumPV = 0
        cumV = 0
      }
      const tp = (c.high + c.low + c.close) / 3
      cumPV += tp * c.volume
      cumV += c.volume
      out[i] = cumV > 0 ? cumPV / cumV : NaN
    }
    return { outputs: [out], state: { dayKey: snapDay, cumPV: snapPV, cumV: snapV, prevIndex: n - 2 } }
  },
}
