/** MA — simple moving average. Windowed, O(period) per tick. */
import type { IndicatorDefinition, IndicatorParams } from '../../types/indicators'
import { at } from '../../lib/array'
import { buildSource, intParam, periodSchema, sourceParam, sourceSchema } from './helpers'

export const maDefinition: IndicatorDefinition = {
  id: 'ma',
  name: 'MA',
  category: 'trend',
  description: 'Simple moving average of the selected source.',
  defaultPlacement: 'overlay',
  paramSchema: [periodSchema('period', 'Period', 20), sourceSchema()],
  defaultParams: { period: 20, source: 'close' },
  outputs: [{ id: 'ma', label: 'MA', colorIndex: 0, width: 1.5 }],
  lookback: (params: IndicatorParams) => intParam(params, 'period', 20) - 1,
  compute(data, params, _state, from) {
    const n = data.length
    const period = intParam(params, 'period', 20)
    const src = buildSource(data, sourceParam(params), n)
    const out = new Float64Array(n).fill(NaN)
    const start = Math.max(from, period - 1)
    let sum = 0
    for (let i = start - period + 1; i <= start; i++) sum += at(src, i)
    out[start] = sum / period
    for (let i = start + 1; i < n; i++) {
      sum += at(src, i) - at(src, i - period)
      out[i] = sum / period
    }
    return { outputs: [out], state: null }
  },
}
