/** Volume MA — simple moving average of volume. Windowed. */
import type { IndicatorDefinition, IndicatorParams } from '../../types/indicators'
import { intParam, periodSchema } from './helpers'

export const volumeMaDefinition: IndicatorDefinition = {
  id: 'volume-ma',
  name: 'Volume MA',
  category: 'volume',
  description: 'Moving average of traded volume.',
  defaultPlacement: 'pane',
  paramSchema: [periodSchema('period', 'Period', 20)],
  defaultParams: { period: 20 },
  outputs: [{ id: 'vma', label: 'Vol MA', colorIndex: 1, width: 1.5 }],
  lookback: (params: IndicatorParams) => intParam(params, 'period', 20) - 1,
  compute(data, params, _state, from) {
    const n = data.length
    const period = intParam(params, 'period', 20)
    const out = new Float64Array(n).fill(NaN)
    const start = Math.max(from, period - 1)
    let sum = 0
    for (let i = start - period + 1; i <= start; i++) sum += data[i]?.volume ?? 0
    out[start] = sum / period
    for (let i = start + 1; i < n; i++) {
      sum += (data[i]?.volume ?? 0) - (data[i - period]?.volume ?? 0)
      out[i] = sum / period
    }
    return { outputs: [out], state: null }
  },
}
