/** WMA — linearly weighted moving average (recent values weight more). */
import type { IndicatorDefinition, IndicatorParams } from '../../types/indicators'
import { at } from '../../lib/array'
import { buildSource, intParam, periodSchema, sourceParam, sourceSchema } from './helpers'

export const wmaDefinition: IndicatorDefinition = {
  id: 'wma',
  name: 'WMA',
  category: 'trend',
  description: 'Linearly weighted moving average of the selected source.',
  defaultPlacement: 'overlay',
  paramSchema: [periodSchema('period', 'Period', 20), sourceSchema()],
  defaultParams: { period: 20, source: 'close' },
  outputs: [{ id: 'wma', label: 'WMA', colorIndex: 2, width: 1.5 }],
  lookback: (params: IndicatorParams) => intParam(params, 'period', 20) - 1,
  compute(data, params, _state, from) {
    const n = data.length
    const period = intParam(params, 'period', 20)
    const src = buildSource(data, sourceParam(params), n)
    const out = new Float64Array(n).fill(NaN)
    const start = Math.max(from, period - 1)
    const total = (period * (period + 1)) / 2
    for (let i = start; i < n; i++) {
      let sum = 0
      for (let j = 0; j < period; j++) {
        sum += (j + 1) * at(src, i - period + 1 + j)
      }
      out[i] = sum / total
    }
    return { outputs: [out], state: null }
  },
}
