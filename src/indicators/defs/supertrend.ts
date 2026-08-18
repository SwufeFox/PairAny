/**
 * Supertrend — ATR(period)-based trailing bands; the line flips sides of
 * price on trend reversals. Segments are colored by direction (line above
 * price = bearish) via the `directional` output flag. Incremental with
 * Wilder-smoothed ATR carried in state.
 */
import type { IndicatorDefinition } from '../../types/indicators'
import { intParam, numParam, periodSchema } from './helpers'

interface SupertrendState {
  prevATR: number | null
  prevFinalUpper: number | null
  prevFinalLower: number | null
  prevSupertrend: number | null
  prevClose: number | null
  prevIndex: number
}

export const supertrendDefinition: IndicatorDefinition = {
  id: 'supertrend',
  name: 'Supertrend',
  category: 'trend',
  description: 'ATR-based trailing stop trend line.',
  defaultPlacement: 'overlay',
  paramSchema: [periodSchema('period', 'Period', 10), { key: 'multiplier', label: 'Multiplier', type: 'number', min: 0.5, max: 10, step: 0.5 }],
  defaultParams: { period: 10, multiplier: 3 },
  outputs: [{ id: 'supertrend', label: 'ST', colorIndex: 6, width: 1.5, directional: true }],
  lookback: () => 1,
  compute(data, params, state, from) {
    const n = data.length
    const period = intParam(params, 'period', 10)
    const mult = numParam(params, 'multiplier', 3)
    const out = new Float64Array(n).fill(NaN)
    const st = state as SupertrendState | null
    const cont =
      from > 0 &&
      st !== null &&
      st.prevIndex === from - 1 &&
      st.prevATR !== null &&
      st.prevFinalUpper !== null &&
      st.prevFinalLower !== null &&
      st.prevSupertrend !== null &&
      Number.isFinite(st.prevATR) &&
      Number.isFinite(st.prevFinalUpper) &&
      Number.isFinite(st.prevFinalLower)

    let atr: number | null = cont ? st.prevATR : null
    let fu: number | null = cont ? st.prevFinalUpper : null
    let fl: number | null = cont ? st.prevFinalLower : null
    let stVal: number | null = cont ? st.prevSupertrend : null
    let pc: number | null = cont ? st.prevClose : null
    let start = from
    let seeded = cont
    let snapAtr: number | null = null
    let snapFu: number | null = null
    let snapFl: number | null = null
    let snapSt: number | null = null
    let snapPc: number | null = null

    if (!cont) {
      start = Math.max(from, period - 1)
    }

    for (let i = start; i < n; i++) {
      if (i === n - 1) {
        snapAtr = atr
        snapFu = fu
        snapFl = fl
        snapSt = stVal
        snapPc = pc
      }
      const c = data[i]
      if (!c) {
        out[i] = NaN
        continue
      }
      const prev = i > 0 ? (data[i - 1] ?? c) : c
      const tr = i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close))
      if (!seeded) {
        if (i === period - 1) {
          let s = 0
          for (let j = 1; j <= i; j++) {
            const cj = data[j]
            const pj = data[j - 1]
            s += cj && pj ? Math.max(cj.high - cj.low, Math.abs(cj.high - pj.close), Math.abs(cj.low - pj.close)) : 0
          }
          atr = s / Math.max(1, i)
          seeded = true
        } else {
          atr = tr
          out[i] = NaN
          pc = c.close
          continue
        }
      } else if (atr !== null) {
        atr = (atr * (period - 1) + tr) / period
      }

      const mid = (c.high + c.low) / 2
      const basicU = mid + mult * (atr ?? 0)
      const basicL = mid - mult * (atr ?? 0)
      const prevFu = fu
      const prevFl = fl
      fu = fu === null || (basicU < fu || (pc !== null && pc > fu)) ? basicU : fu
      fl = fl === null || (basicL > fl || (pc !== null && pc < fl)) ? basicL : fl

      let cur: number
      if (pc === null || prevFu === null || prevFl === null) {
        cur = fl
      } else if (pc > prevFu) {
        cur = fl
      } else if (pc < prevFl) {
        cur = fu
      } else {
        cur = stVal ?? fl
      }
      out[i] = cur
      stVal = cur
      pc = c.close
    }

    return {
      outputs: [out],
      state: {
        prevATR: snapAtr ?? atr,
        prevFinalUpper: snapFu ?? fu,
        prevFinalLower: snapFl ?? fl,
        prevSupertrend: snapSt ?? stVal,
        prevClose: snapPc ?? pc,
        prevIndex: n - 2,
      },
    }
  },
}
