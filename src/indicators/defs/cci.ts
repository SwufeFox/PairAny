/** CCI — Commodity Channel Index over the typical price. Windowed. */
import type { IndicatorDefinition, IndicatorParams } from '../../types/indicators'
import { at } from '../../lib/array'
import { buildSource, intParam, periodSchema, sourceParam, sourceSchema } from './helpers'

export const cciDefinition: IndicatorDefinition = {
  id: 'cci',
  name: 'CCI',
  category: 'momentum',
  description: 'Commodity Channel Index (0.015 mean-deviation scaling).',
  defaultPlacement: 'pane',
  paramSchema: [periodSchema('period', 'Period', 20), sourceSchema()],
  defaultParams: { period: 20, source: 'hlc3' },
  outputs: [{ id: 'cci', label: 'CCI', colorIndex: 0, width: 1.5 }],
  lookback: (params: IndicatorParams) => intParam(params, 'period', 20) - 1,
  compute(data, params, _state, from) {
    const n = data.length
    const period = intParam(params, 'period', 20)
    const tp = buildSource(data, sourceParam(params, 'hlc3'), n)
    const out = new Float64Array(n).fill(NaN)
    const start = Math.max(from, period - 1)
    for (let i = start; i < n; i++) {
      let sum = 0
      for (let j = 0; j < period; j++) sum += at(tp, i - period + 1 + j)
      const mean = sum / period
      let dev = 0
      for (let j = 0; j < period; j++) dev += Math.abs(at(tp, i - period + 1 + j) - mean)
      const meanDev = dev / period
      out[i] = meanDev === 0 ? 0 : (at(tp, i) - mean) / (0.015 * meanDev)
    }
    return { outputs: [out], state: null }
  },
}
