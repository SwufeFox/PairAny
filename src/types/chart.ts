/** Chart-layer types: what the renderer consumes. Pure data, no React, no `any`. */
import type { Candle } from './market'
import type { IndicatorOutput } from './indicators'

export type ChartType = 'candles' | 'hollow' | 'ohlc' | 'line' | 'area'

/** User-facing chart appearance preferences (persisted). */
export interface ChartPrefs {
  chartType: ChartType
  logScale: boolean
  showGrid: boolean
}

/**
 * How volume is displayed for the active series.
 * - 'volume'    → exchange-reported base-asset volume (direct pairs).
 * - 'synthetic' → combined USDT notional of both legs (synthetic pairs, labeled).
 * - 'hidden'    → no volume pane at all.
 */
export type VolumeMode = 'volume' | 'synthetic' | 'hidden'

export type RatioMode = 'tick-accurate' | 'approximate'

export interface SeriesLeg {
  symbol: string
  /** Last known close of this leg at the hovered candle, for the crosshair. */
  close: number | null
}

/** Immutable snapshot the app builds from the market layer for one render pass. */
export interface SeriesSnapshot {
  candles: readonly Candle[]
  /** Bumped whenever candles change (WS tick, REST merge, interval switch). */
  version: number
  isSynthetic: boolean
  volumeMode: VolumeMode
  legs: SeriesLeg[]
  ratioMode: RatioMode
  syncStats: { aligned: number; missingA: number; missingB: number }
  /** false once REST has no older data for the active interval. */
  moreHistoryAvailable: boolean
  /** openTime of the oldest candle we can still load (next REST batch start). */
  oldestLoaded: number | null
}

/** One computed indicator ready to draw. */
export interface RenderedIndicator {
  uid: string
  definitionId: string
  label: string
  placement: 'overlay' | 'pane'
  colorOffset: number
  outputs: Float64Array[]
  outputMeta: IndicatorOutput[]
  /** 'bars' = volume-style bars in its pane; 'line' = polyline. */
  kind: 'line' | 'bars'
  /** How the pane header formats the latest value. */
  format: 'price' | 'compact'
}

/** Overlaid comparison series (%-normalized against the visible window). */
export interface CompareSeries {
  label: string
  /** close values aligned to the candle array (NaN where absent). */
  values: Float64Array
  colorIndex: number
}

/** Everything the chart renderer needs for one frame. */
export interface ChartEngineInput {
  data: SeriesSnapshot
  indicators: RenderedIndicator[]
  compare: CompareSeries | null
  prefs: ChartPrefs
  interval: string
  /** Interval duration in ms — drawing anchors map pixel→openTime with it. */
  intervalMs: number
  i18n: ChartStrings
}

export interface PaneLayout {
  /** Top/bottom insets in device-independent px. */
  top: number
  bottom: number
  left: number
  right: number
  /** Pane list, first is main. */
  panes: Array<{ id: string; top: number; height: number }>
}

/** One visible candle + context, pushed to the crosshair tooltip. */
export interface CrosshairSnapshot {
  index: number
  candle: Candle | null
  /** Price under the pointer in the hovered pane (for the legend pill). */
  hoverPrice: number | null
  x: number
  y: number
  paneId: string
  /** Snapped candle center x (CSS px) for tooltip avoidance. */
  candleX: number | null
  /** Candle slot width in CSS px. */
  slotW: number
}

/** Strings the canvas needs (localized by the app). */
export interface ChartStrings {
  headerO: string
  headerH: string
  headerL: string
  headerC: string
  loading: string
  paneVolume: string
  paneSyntheticVolume: string
}

/** Drawing tools: anchored to (openTime, price) so they survive pan/zoom AND
 * history loads — array indices shift when older candles are prepended,
 * timestamps do not. */
export type DrawingTool = 'trendline' | 'horizontal' | 'rectangle' | 'arrow'

export interface Drawing {
  id: number
  type: DrawingTool
  /** Anchor 1: candle openTime (epoch ms, interpolated off-grid) + price. */
  t1: number
  p1: number
  /** Anchor 2: same space. */
  t2: number
  p2: number
}

export interface ChartThemeTokens {
  up: string
  down: string
  grid: string
  gridStrong: string
  crosshair: string
  axisText: string
  background: string
  border: string
  backgroundInverse: string
  foregroundInverse: string
  fontMono: string
  fontSans: string
  ind: string[]
}
