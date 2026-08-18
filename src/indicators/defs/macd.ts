/**
 * MACD — EMA(fast) − EMA(slow), signal = EMA(signal) of the MACD line,
 * histogram = macd − signal. SMAs seed the EMAs; the signal SMA-seeds on the
 * first `signal` MACD values. Incremental via state.
 */
import type { IndicatorDefinition } from '../../types/indicators'
import { at } from '../../lib/array'
import { buildSource, intParam, periodSchema } from './helpers'

interface MacdState {
  ef: number | null
  es: number | null
  sig: number | null
  prevIndex: number
}

export const macdDefinition: IndicatorDefinition = {
  id: 'macd',
  name: 'MACD',
  category: 'momentum',
  description: 'Moving Average Convergence Divergence (12/26/9).',
  defaultPlacement: 'pane',
  paramSchema: [
    periodSchema('fast', 'Fast', 12, 1, 200),
    periodSchema('slow', 'Slow', 26, 1, 500),
    periodSchema('signal', 'Signal', 9, 1, 200),
  ],
  defaultParams: { fast: 12, slow: 26, signal: 9 },
  outputs: [
    { id: 'macd', label: 'MACD', colorIndex: 0, width: 1.5 },
    { id: 'signal', label: 'Signal', colorIndex: 1, width: 1.5 },
    { id: 'hist', label: 'Histogram', colorIndex: 2, width: 1 },
  ],
  lookback: () => 1,
  compute(data, params, state, from) {
    const n = data.length
    const fast = intParam(params, 'fast', 12)
    const slow = intParam(params, 'slow', 26)
    const sigP = intParam(params, 'signal', 9)
    const src = buildSource(data, 'close', n)
    const macd = new Float64Array(n).fill(NaN)
    const signal = new Float64Array(n).fill(NaN)
    const hist = new Float64Array(n).fill(NaN)
    const kf = 2 / (fast + 1)
    const ks = 2 / (slow + 1)
    const kg = 2 / (sigP + 1)

    const st = state as MacdState | null
    const cont =
      from > 0 &&
      st !== null &&
      st.prevIndex === from - 1 &&
      st.ef !== null &&
      st.es !== null &&
      Number.isFinite(st.ef) &&
      Number.isFinite(st.es)
    let ef: number | null = cont ? st.ef : null
    let es: number | null = cont ? st.es : null
    let sig: number | null = cont ? st.sig : null
    let start = from
    let snapEf: number | null = null
    let snapEs: number | null = null
    let snapSig: number | null = null

    if (!cont) {
      start = Math.max(from, slow - 1)
      if (start >= n) {
        return { outputs: [macd, signal, hist], state: { ef: null, es: null, sig: null, prevIndex: n - 2 } }
      }
      let sf = 0
      let ss = 0
      for (let i = 0; i < fast; i++) sf += at(src, i)
      for (let i = 0; i < slow; i++) ss += at(src, i)
      ef = sf / fast
      es = ss / slow
      macd[start] = ef - es
      const sigSeed = start + sigP
      if (sigSeed >= n) {
        let earlyEf: number | null = null
        let earlyEs: number | null = null
        for (let i = start + 1; i < n; i++) {
          if (i === n - 1) {
            earlyEf = ef
            earlyEs = es
          }
          ef = at(src, i) * kf + (ef as number) * (1 - kf)
          es = at(src, i) * ks + (es as number) * (1 - ks)
          macd[i] = ef - es
        }
        return { outputs: [macd, signal, hist], state: { ef: earlyEf, es: earlyEs, sig: null, prevIndex: n - 2 } }
      }
      let mSum = macd[start] as number
      for (let i = start + 1; i <= sigSeed; i++) {
        ef = at(src, i) * kf + (ef as number) * (1 - kf)
        es = at(src, i) * ks + (es as number) * (1 - ks)
        macd[i] = ef - es
        mSum += macd[i] as number
      }
      sig = mSum / (sigP + 1)
      signal[sigSeed] = sig
      start = sigSeed + 1
    }

    for (let i = start; i < n; i++) {
      if (i === n - 1) {
        snapEf = ef
        snapEs = es
        snapSig = sig
      }
      ef = at(src, i) * kf + (ef as number) * (1 - kf)
      es = at(src, i) * ks + (es as number) * (1 - ks)
      macd[i] = ef - es
      sig = (macd[i] as number) * kg + (sig as number) * (1 - kg)
      signal[i] = sig
      hist[i] = (macd[i] as number) - (signal[i] as number)
    }

    return { outputs: [macd, signal, hist], state: { ef: snapEf ?? ef, es: snapEs ?? es, sig: snapSig ?? sig, prevIndex: n - 2 } }
  },
}
