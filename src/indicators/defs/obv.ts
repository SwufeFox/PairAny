/** OBV — On Balance Volume: cumulative signed volume. Incremental. */
import type { IndicatorDefinition } from '../../types/indicators'

interface ObvState {
  prevOBV: number | null
  prevClose: number | null
  prevIndex: number
}

export const obvDefinition: IndicatorDefinition = {
  id: 'obv',
  name: 'OBV',
  category: 'volume',
  description: 'On Balance Volume, cumulative signed volume by close direction.',
  defaultPlacement: 'pane',
  paramSchema: [],
  defaultParams: {},
  outputs: [{ id: 'obv', label: 'OBV', colorIndex: 0, width: 1.5 }],
  lookback: () => 1,
  compute(data, _params, state, from) {
    const n = data.length
    const out = new Float64Array(n).fill(NaN)
    const st = state as ObvState | null
    const cont =
      from > 0 &&
      st !== null &&
      st.prevIndex === from - 1 &&
      st.prevOBV !== null &&
      Number.isFinite(st.prevOBV)
    let obv: number | null = cont ? st.prevOBV : null
    let pc: number | null = cont ? st.prevClose : null
    let start = from
    let snapObv: number | null = null
    let snapPc: number | null = null
    if (!cont) {
      const c0 = data[0]
      if (c0) {
        out[0] = 0
        obv = 0
        pc = c0.close
      }
      start = 1
    }
    for (let i = start; i < n; i++) {
      if (i === n - 1) {
        snapObv = obv
        snapPc = pc
      }
      const c = data[i]
      if (!c || pc === null) {
        if (c) pc = c.close
        continue
      }
      let delta = 0
      if (c.close > pc) delta = c.volume
      else if (c.close < pc) delta = -c.volume
      obv = (obv ?? 0) + delta
      out[i] = obv
      pc = c.close
    }
    return { outputs: [out], state: { prevOBV: snapObv ?? obv, prevClose: snapPc ?? pc, prevIndex: n - 2 } }
  },
}
