/** Registry of every indicator definition + registration helper. */
import type { IndicatorDefinition, IndicatorCategory } from '../types/indicators'
import type { IndicatorEngine } from './indicator-engine'
import { maDefinition } from './defs/ma'
import { emaDefinition } from './defs/ema'
import { wmaDefinition } from './defs/wma'
import { vwmaDefinition } from './defs/vwma'
import { bollingerDefinition } from './defs/bollinger'
import { ichimokuDefinition } from './defs/ichimoku'
import { vwapDefinition } from './defs/vwap'
import { supertrendDefinition } from './defs/supertrend'
import { rsiDefinition } from './defs/rsi'
import { macdDefinition } from './defs/macd'
import { stochasticDefinition } from './defs/stochastic'
import { cciDefinition } from './defs/cci'
import { williamsRDefinition } from './defs/williams-r'
import { volumeDefinition } from './defs/volume'
import { volumeMaDefinition } from './defs/volume-ma'
import { obvDefinition } from './defs/obv'
import { mfiDefinition } from './defs/mfi'

export const ALL_INDICATORS: IndicatorDefinition[] = [
  maDefinition,
  emaDefinition,
  wmaDefinition,
  vwmaDefinition,
  bollingerDefinition,
  ichimokuDefinition,
  vwapDefinition,
  supertrendDefinition,
  rsiDefinition,
  macdDefinition,
  stochasticDefinition,
  cciDefinition,
  williamsRDefinition,
  volumeDefinition,
  volumeMaDefinition,
  obvDefinition,
  mfiDefinition,
]

export function registerAllIndicators(engine: IndicatorEngine): void {
  for (const def of ALL_INDICATORS) engine.register(def)
}

export function indicatorsByCategory(): Map<IndicatorCategory, IndicatorDefinition[]> {
  const map = new Map<IndicatorCategory, IndicatorDefinition[]>()
  for (const def of ALL_INDICATORS) {
    const list = map.get(def.category)
    if (list) list.push(def)
    else map.set(def.category, [def])
  }
  return map
}

export const CATEGORY_LABELS: Record<IndicatorCategory, string> = {
  trend: 'Trend',
  momentum: 'Momentum',
  volume: 'Volume',
}
