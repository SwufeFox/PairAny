/** VWMA — volume-weighted moving average. */
import type { IndicatorDefinition, IndicatorParams } from '../../types/indicators'
import { at } from '../../lib/array'
import { buildSource, intParam, periodSchema, sourceParam, sourceSchema } from './helpers'

export const vwmaDefinition: IndicatorDefinition = {
  id: 'vwma',
  name: 'VWMA',
  category: 'trend',
  description: 'Volume-weighted moving average of the selected source.',
  defaultPlacement: 'overlay',
  paramSchema: [periodSchema('period', 'Period', 20), sourceSchema()],
  defaultParams: { period: 20, source: 'close' },
  outputs: [{ id: 'vwma', label: 'VWMA', colorIndex: 3, width: 1.5 }],
  lookback: (params: IndicatorParams) => intParam(params, 'period', 20) - 1,
  compute(data, params, _state, from) {
    const n = data.length
    const period = intParam(params, 'period', 20)
    const src = buildSource(data, sourceParam(params), n)
    const out = new Float64Array(n).fill(NaN)
    const start = Math.max(from, period - 1)
    for (let i = start; i < n; i++) {
      let pv = 0
      let v = 0
      for (let j = 0; j < period; j++) {
        const c = data[i - period + 1 + j]
        pv += at(src, i - period + 1 + j) * (c?.volume ?? 0)
        v += c?.volume ?? 0
      }
      out[i] = v > 0 ? pv / v : NaN
    }
    return { outputs: [out], state: null }
  },
}
