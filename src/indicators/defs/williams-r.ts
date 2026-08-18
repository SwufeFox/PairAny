/** Williams %R — overbought/oversold oscillator, −100..0. Windowed. */
import type { IndicatorDefinition, IndicatorParams } from '../../types/indicators'
import { at } from '../../lib/array'
import { buildSource, intParam, periodSchema, sourceParam, sourceSchema } from './helpers'

export const williamsRDefinition: IndicatorDefinition = {
  id: 'williams-r',
  name: 'Williams %R',
  category: 'momentum',
  description: 'Williams %R overbought/oversold oscillator.',
  defaultPlacement: 'pane',
  paramSchema: [periodSchema('period', 'Period', 14), sourceSchema()],
  defaultParams: { period: 14, source: 'close' },
  outputs: [{ id: 'wr', label: '%R', colorIndex: 0, width: 1.5 }],
  lookback: (params: IndicatorParams) => intParam(params, 'period', 14) - 1,
  compute(data, params, _state, from) {
    const n = data.length
    const period = intParam(params, 'period', 14)
    const src = buildSource(data, sourceParam(params), n)
    const out = new Float64Array(n).fill(NaN)
    const start = Math.max(from, period - 1)
    for (let i = start; i < n; i++) {
      let hh = -Infinity
      let ll = Infinity
      for (let j = i - period + 1; j <= i; j++) {
        const c = data[j]
        if (!c) continue
        if (c.high > hh) hh = c.high
        if (c.low < ll) ll = c.low
      }
      out[i] = hh === ll ? -50 : (-100 * (hh - at(src, i))) / (hh - ll)
    }
    return { outputs: [out], state: null }
  },
}
