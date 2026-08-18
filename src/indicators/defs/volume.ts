/** Volume — raw volume bars (exchange volume, or synthetic notional for
 * synthetic pairs; the pane header labels it accordingly). */
import type { IndicatorDefinition } from '../../types/indicators'

export const volumeDefinition: IndicatorDefinition = {
  id: 'volume',
  name: 'Volume',
  category: 'volume',
  description: 'Traded volume per candle.',
  defaultPlacement: 'pane',
  paramSchema: [],
  defaultParams: {},
  outputs: [{ id: 'volume', label: 'Vol', colorIndex: 4, width: 1 }],
  paneKind: 'bars',
  paneFormat: 'compact',
  lookback: () => 0,
  compute(data, _params, _state, from) {
    const n = data.length
    const out = new Float64Array(n).fill(NaN)
    for (let i = from; i < n; i++) {
      const c = data[i]
      out[i] = c ? c.volume : NaN
    }
    return { outputs: [out], state: null }
  },
}
