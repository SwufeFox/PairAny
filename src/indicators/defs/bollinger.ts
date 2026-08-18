/** Bollinger Bands — SMA ± k × population standard deviation. */
import type { IndicatorDefinition, IndicatorParams } from '../../types/indicators'
import { at } from '../../lib/array'
import { buildSource, intParam, numParam, periodSchema, sourceParam, sourceSchema } from './helpers'

export const bollingerDefinition: IndicatorDefinition = {
  id: 'bollinger',
  name: 'Bollinger Bands',
  category: 'trend',
  description: 'Moving average band of ±k standard deviations.',
  defaultPlacement: 'overlay',
  paramSchema: [periodSchema('period', 'Period', 20), { key: 'mult', label: 'StdDev ×', type: 'number', min: 0.1, max: 10, step: 0.1 }, sourceSchema()],
  defaultParams: { period: 20, mult: 2, source: 'close' },
  outputs: [
    { id: 'middle', label: 'Mid', colorIndex: 0, width: 1.5 },
    { id: 'upper', label: 'Upper', colorIndex: 4, width: 1, dash: 'dashed' },
    { id: 'lower', label: 'Lower', colorIndex: 4, width: 1, dash: 'dashed' },
  ],
  lookback: (params: IndicatorParams) => intParam(params, 'period', 20) - 1,
  compute(data, params, _state, from) {
    const n = data.length
    const period = intParam(params, 'period', 20)
    const mult = numParam(params, 'mult', 2)
    const src = buildSource(data, sourceParam(params), n)
    const middle = new Float64Array(n).fill(NaN)
    const upper = new Float64Array(n).fill(NaN)
    const lower = new Float64Array(n).fill(NaN)
    const start = Math.max(from, period - 1)
    for (let i = start; i < n; i++) {
      let sum = 0
      for (let j = 0; j < period; j++) sum += at(src, i - period + 1 + j)
      const mean = sum / period
      let sq = 0
      for (let j = 0; j < period; j++) {
        const d = at(src, i - period + 1 + j) - mean
        sq += d * d
      }
      const sd = Math.sqrt(sq / period)
      middle[i] = mean
      upper[i] = mean + mult * sd
      lower[i] = mean - mult * sd
    }
    return { outputs: [middle, upper, lower], state: null }
  },
}
