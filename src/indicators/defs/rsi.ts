/** RSI — Wilder-smoothed Relative Strength Index. Incremental via state. */
import type { IndicatorDefinition } from '../../types/indicators'
import { at } from '../../lib/array'
import { buildSource, intParam, periodSchema, sourceParam, sourceSchema } from './helpers'

interface RsiState {
  prevAvgGain: number | null
  prevAvgLoss: number | null
  prevClose: number | null
  prevIndex: number
}

export const rsiDefinition: IndicatorDefinition = {
  id: 'rsi',
  name: 'RSI',
  category: 'momentum',
  description: 'Relative Strength Index with Wilder smoothing.',
  defaultPlacement: 'pane',
  paramSchema: [periodSchema('period', 'Period', 14), sourceSchema()],
  defaultParams: { period: 14, source: 'close' },
  outputs: [{ id: 'rsi', label: 'RSI', colorIndex: 0, width: 1.5 }],
  lookback: () => 1,
  compute(data, params, state, from) {
    const n = data.length
    const period = intParam(params, 'period', 14)
    const src = buildSource(data, sourceParam(params), n)
    const out = new Float64Array(n).fill(NaN)
    const st = state as RsiState | null
    const cont =
      from > 0 &&
      st !== null &&
      st.prevIndex === from - 1 &&
      st.prevAvgGain !== null &&
      st.prevAvgLoss !== null &&
      Number.isFinite(st.prevAvgGain) &&
      Number.isFinite(st.prevAvgLoss)

    let ag: number | null = cont ? st.prevAvgGain : null
    let al: number | null = cont ? st.prevAvgLoss : null
    let pc: number | null = cont ? st.prevClose : null
    let start = from
    let snapAg: number | null = null
    let snapAl: number | null = null
    let snapPc: number | null = null

    if (!cont) {
      start = Math.max(from, period)
      if (start < n) {
        let g = 0
        let l = 0
        for (let i = 1; i <= start; i++) {
          const ch = at(src, i) - at(src, i - 1)
          if (ch > 0) g += ch
          else l -= ch
        }
        ag = g / period
        al = l / period
        out[start] = rsiFrom(ag, al)
        pc = at(src, start)
        start += 1
      }
    }

    for (let i = start; i < n; i++) {
      // At the top of the last iteration the rolling values are those of n-2.
      if (i === n - 1) {
        snapAg = ag
        snapAl = al
        snapPc = pc
      }
      if (i === 0 || ag === null || al === null) {
        pc = at(src, i)
        continue
      }
      const ch = at(src, i) - at(src, i - 1)
      const gain = ch > 0 ? ch : 0
      const loss = ch < 0 ? -ch : 0
      ag = (ag * (period - 1) + gain) / period
      al = (al * (period - 1) + loss) / period
      out[i] = rsiFrom(ag, al)
      pc = at(src, i)
    }

    return {
      outputs: [out],
      state: { prevAvgGain: snapAg ?? ag, prevAvgLoss: snapAl ?? al, prevClose: snapPc ?? pc, prevIndex: n - 2 },
    }
  },
}

function rsiFrom(ag: number, al: number): number {
  if (al === 0) return ag === 0 ? 50 : 100
  return 100 - 100 / (1 + ag / al)
}
