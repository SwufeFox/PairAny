/** Stochastic Oscillator — %K smoothed, then %D smoothed. Windowed. */
import type { IndicatorDefinition, IndicatorParams } from '../../types/indicators'
import type { Candle } from '../../types/market'
import { at } from '../../lib/array'
import { intParam, periodSchema } from './helpers'

function rawKValue(data: readonly Candle[], i: number, period: number): number | null {
  let hh = -Infinity
  let ll = Infinity
  for (let j = i - period + 1; j <= i; j++) {
    const c = data[j]
    if (!c) return null
    if (c.high > hh) hh = c.high
    if (c.low < ll) ll = c.low
  }
  if (hh === ll) return 50
  const c = data[i]
  return c ? ((c.close - ll) / (hh - ll)) * 100 : null
}

export const stochasticDefinition: IndicatorDefinition = {
  id: 'stochastic',
  name: 'Stochastic',
  category: 'momentum',
  description: 'Stochastic %K with %D signal line.',
  defaultPlacement: 'pane',
  paramSchema: [
    periodSchema('kPeriod', 'K Period', 14),
    periodSchema('kSmooth', 'K Smooth', 3, 1, 50),
    periodSchema('dPeriod', 'D Period', 3, 1, 50),
  ],
  defaultParams: { kPeriod: 14, kSmooth: 3, dPeriod: 3 },
  outputs: [
    { id: 'k', label: '%K', colorIndex: 0, width: 1.5 },
    { id: 'd', label: '%D', colorIndex: 1, width: 1.5 },
  ],
  lookback: (params: IndicatorParams) => {
    const k = intParam(params, 'kPeriod', 14)
    const s = intParam(params, 'kSmooth', 3)
    const d = intParam(params, 'dPeriod', 3)
    return k - 1 + s - 1 + d - 1
  },
  compute(data, params, _state, from) {
    const n = data.length
    const kP = intParam(params, 'kPeriod', 14)
    const kS = intParam(params, 'kSmooth', 3)
    const dP = intParam(params, 'dPeriod', 3)

    const raw = new Float64Array(n).fill(NaN)
    const k = new Float64Array(n).fill(NaN)
    const d = new Float64Array(n).fill(NaN)

    // Raw %K needs a small lookback before `from` for the smoothing window.
    const rawStart = Math.max(0, from - kS + 1)
    for (let i = rawStart; i < n; i++) {
      const r = rawKValue(data, i, kP)
      if (r !== null) raw[i] = r
    }
    const kStart = Math.max(from, kP - 1 + kS - 1)
    for (let i = kStart; i < n; i++) {
      let sum = 0
      for (let j = i - kS + 1; j <= i; j++) sum += at(raw, j)
      k[i] = sum / kS
    }
    const dStart = Math.max(from, kP - 1 + kS - 1 + dP - 1)
    for (let i = dStart; i < n; i++) {
      let sum = 0
      for (let j = i - dP + 1; j <= i; j++) sum += at(k, j)
      d[i] = sum / dP
    }
    return { outputs: [k, d], state: null }
  },
}
