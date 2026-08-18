/** Typed localStorage persistence for terminal settings (theme is persisted
 * separately by Appica's ThemeProvider). */
import type { ChartPrefs } from '../types/chart'
import type { KlineInterval } from '../types/market'
import type { IndicatorParams, IndicatorPlacement } from '../types/indicators'
import type { ColorBlindMode } from './color-blind'
import type { LanguagePref } from '../lib/i18n'

export type PairMode = 'direct' | 'synthetic' | 'auto'

export interface PersistedIndicator {
  definitionId: string
  params: IndicatorParams
  visible: boolean
  placement: IndicatorPlacement
}

export interface PersistedSettings {
  colorBlind: ColorBlindMode
  interval: KlineInterval
  chartType: ChartPrefs['chartType']
  logScale: boolean
  showGrid: boolean
  pair: { base: string; quote: string; mode: PairMode }
  /** 'auto' shows exchange volume (direct) or labeled synthetic volume; 'hidden' hides it. */
  volumeMode: 'auto' | 'hidden'
  language: LanguagePref
  /** Recently applied pairs, newest first, e.g. ['BTC/ETH']. */
  recentPairs: string[]
  indicators: PersistedIndicator[]
  compareSymbol: string | null
}

export const SETTINGS_KEY = 'pairany.settings.v1'

export const DEFAULT_SETTINGS: PersistedSettings = {
  colorBlind: 'normal',
  interval: '1m',
  chartType: 'candles',
  logScale: false,
  showGrid: true,
  pair: { base: 'BTC', quote: 'ETH', mode: 'auto' },
  volumeMode: 'auto',
  language: 'auto',
  recentPairs: [],
  indicators: [{ definitionId: 'volume', params: {}, visible: true, placement: 'pane' }],
  compareSymbol: null,
}

export function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    const base = typeof parsed.pair?.base === 'string' ? parsed.pair.base : DEFAULT_SETTINGS.pair.base
    const quote = typeof parsed.pair?.quote === 'string' ? parsed.pair.quote : DEFAULT_SETTINGS.pair.quote
    const mode = parsed.pair?.mode === 'direct' || parsed.pair?.mode === 'synthetic' || parsed.pair?.mode === 'auto' ? parsed.pair.mode : DEFAULT_SETTINGS.pair.mode
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      pair: { base, quote, mode },
      indicators: Array.isArray(parsed.indicators) && parsed.indicators.length > 0 ? parsed.indicators : DEFAULT_SETTINGS.indicators,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: PersistedSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Storage full/blocked — settings simply won't persist.
  }
}
