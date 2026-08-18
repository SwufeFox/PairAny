/** MFI — Money Flow Index (14): positive/negative money-flow ratio. Windowed. */
import type { IndicatorDefinition, IndicatorParams } from '../../types/indicators'
import { intParam, periodSchema } from './helpers'

export const mfiDefinition: IndicatorDefinition = {
  id: 'mfi',
  name: 'MFI',
  category: 'volume',
  description: 'Money Flow Index, volume-weighted RSI analogue.',
  defaultPlacement: 'pane',
  paramSchema: [periodSchema('period', 'Period', 14)],
  defaultParams: { period: 14 },
  outputs: [{ id: 'mfi', label: 'MFI', colorIndex: 0, width: 1.5 }],
  lookback: (params: IndicatorParams) => intParam(params, 'period', 14),
  compute(data, params, _state, from) {
    const n = data.length
    const period = intParam(params, 'period', 14)
    const out = new Float64Array(n).fill(NaN)
    const start = Math.max(from, period)
    for (let i = start; i < n; i++) {
      let pos = 0
      let neg = 0
      for (let j = i - period + 1; j <= i; j++) {
        const c = data[j]
        const prev = data[j - 1]
        if (!c || !prev) continue
        const tp = (c.high + c.low + c.close) / 3
        const prevTp = (prev.high + prev.low + prev.close) / 3
        const flow = tp * c.volume
        if (tp > prevTp) pos += flow
        else if (tp < prevTp) neg += flow
      }
      out[i] = neg === 0 ? (pos === 0 ? 50 : 100) : 100 - 100 / (1 + pos / neg)
    }
    return { outputs: [out], state: null }
  },
}
