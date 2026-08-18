/**
 * Ichimoku Cloud — tenkan/kijun over 9/26, senkou A/B shifted forward 26
 * (cloud), chikou shifted back 26. Windowed; shifted outputs are derived
 * from values already computed in the same pass.
 */
import type { IndicatorDefinition, IndicatorParams } from '../../types/indicators'
import type { Candle } from '../../types/market'
import { at } from '../../lib/array'
import { intParam, periodSchema } from './helpers'

function midPoint(data: readonly Candle[], end: number, period: number): number {
  let hi = -Infinity
  let lo = Infinity
  for (let i = end - period + 1; i <= end; i++) {
    const c = data[i]
    if (!c) return NaN
    if (c.high > hi) hi = c.high
    if (c.low < lo) lo = c.low
  }
  return (hi + lo) / 2
}

export const ichimokuDefinition: IndicatorDefinition = {
  id: 'ichimoku',
  name: 'Ichimoku Cloud',
  category: 'trend',
  description: 'Tenkan/Kijun/Senkou A/B/Chikou with the standard 9/26/52 periods.',
  defaultPlacement: 'overlay',
  paramSchema: [
    periodSchema('tenkan', 'Tenkan', 9),
    periodSchema('kijun', 'Kijun', 26),
    periodSchema('senkouB', 'Senkou B', 52),
  ],
  defaultParams: { tenkan: 9, kijun: 26, senkouB: 52 },
  outputs: [
    { id: 'tenkan', label: 'Tenkan', colorIndex: 0, width: 1 },
    { id: 'kijun', label: 'Kijun', colorIndex: 1, width: 1 },
    { id: 'senkouA', label: 'Senkou A', colorIndex: 2, width: 1, dash: 'dashed', cloudWith: 'senkouB' },
    { id: 'senkouB', label: 'Senkou B', colorIndex: 3, width: 1, dash: 'dashed' },
    { id: 'chikou', label: 'Chikou', colorIndex: 4, width: 1 },
  ],
  lookback: (params: IndicatorParams) => intParam(params, 'senkouB', 52) - 1,
  compute(data, params, _state, from) {
    const n = data.length
    const tenkanP = intParam(params, 'tenkan', 9)
    const kijunP = intParam(params, 'kijun', 26)
    const senkouBP = intParam(params, 'senkouB', 52)
    const tenkan = new Float64Array(n).fill(NaN)
    const kijun = new Float64Array(n).fill(NaN)
    const senkouA = new Float64Array(n).fill(NaN)
    const senkouB = new Float64Array(n).fill(NaN)
    const chikou = new Float64Array(n).fill(NaN)

    for (let i = Math.max(from, tenkanP - 1); i < n; i++) tenkan[i] = midPoint(data, i, tenkanP)
    for (let i = Math.max(from, kijunP - 1); i < n; i++) kijun[i] = midPoint(data, i, kijunP)

    // Cloud is shifted kijunP bars forward: value at i uses tenkan/kijun at i+kijunP.
    const lastCloud = n - kijunP
    for (let i = from; i < lastCloud; i++) {
      const ta = at(tenkan, i + kijunP)
      const kj = at(kijun, i + kijunP)
      if (Number.isFinite(ta) && Number.isFinite(kj)) senkouA[i] = (ta + kj) / 2
      const b = midPoint(data, i + kijunP, senkouBP)
      if (Number.isFinite(b)) senkouB[i] = b
    }
    for (let i = Math.max(from, kijunP); i < n; i++) {
      const c = data[i - kijunP]
      if (c) chikou[i] = c.close
    }
    return { outputs: [tenkan, kijun, senkouA, senkouB, chikou], state: null }
  },
}
