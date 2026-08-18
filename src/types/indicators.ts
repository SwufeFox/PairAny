/** Indicator domain types: the contract between indicator definitions,
 * the IndicatorEngine, and the chart renderer. No React imports. */

export type IndicatorCategory = 'trend' | 'momentum' | 'volume'
export type IndicatorPlacement = 'overlay' | 'pane'
export type IndicatorSource = 'open' | 'high' | 'low' | 'close' | 'hlc3' | 'ohlc4'

export type ParamValue = number | string | boolean

export interface ParamOption {
  label: string
  value: string
}

export interface ParamSchema {
  key: string
  label: string
  type: 'number' | 'select' | 'boolean'
  min?: number
  max?: number
  step?: number
  options?: ParamOption[]
  default?: ParamValue
}

/** One line/band an indicator produces (e.g. "upper" band). */
export interface IndicatorOutput {
  id: string
  label: string
  /** Index into the chart's indicator palette; -1 → default. */
  colorIndex: number
  /** Dash style for the line. */
  dash?: 'solid' | 'dashed'
  /** Line width in device-independent px. */
  width?: number
  /**
   * Fill the area between this output and the named output (Ichimoku cloud).
   * The renderer fills `this` → `cloudWith` with a translucent tint.
   */
  cloudWith?: string
  /**
   * Color each segment by the candle direction (close ≥ open ? up : down)
   * instead of a palette color (Supertrend).
   */
  directional?: boolean
}

export type IndicatorParams = Record<string, ParamValue>

export interface IndicatorResult {
  /** One Float64Array per output, aligned to candle indices (NaN = no value). */
  outputs: Float64Array[]
  /** Opaque continuation state so windowed indicators compute incrementally. */
  state: unknown
}

/**
 * A pure function definition of an indicator. `compute` is called with the
 * full series plus the index `from` where new/updated data begins; the
 * implementation only needs to (re)compute values at or after `from` and
 * may reuse `state` carried from the previous call.
 *
 * Contract:
 *  - `outputs[i]` is NaN where the indicator is undefined (warmup, gaps).
 *  - `from === 0` means full recompute — any carried `state` must be ignored.
 *  - otherwise the engine guarantees `from === lastComputedIndex + 1 - lookback`,
 *    i.e. the window `[from - lookback, from)` is untouched since the last
 *    call, so windowed indicators can continue from `state`.
 */
export interface IndicatorDefinition {
  id: string
  name: string
  category: IndicatorCategory
  description: string
  defaultPlacement: IndicatorPlacement
  paramSchema: ParamSchema[]
  defaultParams: IndicatorParams
  outputs: IndicatorOutput[]
  /** Leading candles needed before a recompute starting at `from` is correct. */
  lookback(params: IndicatorParams): number
  compute(data: readonly Candle[], params: IndicatorParams, state: unknown, from: number): IndicatorResult
  /** Pane rendering style for pane-placed indicators (volume = bars). */
  paneKind?: 'bars'
  /** Pane header value formatting. */
  paneFormat?: 'compact'
}

import type { Candle } from '../types/market'

/** A configured, live indicator instance (what the user added to the chart). */
export interface IndicatorInstance {
  uid: string
  definitionId: string
  params: IndicatorParams
  visible: boolean
  placement: IndicatorPlacement
  /** Palette rotation so repeated same-type indicators get distinct colors. */
  colorOffset: number
}

/** Mutable per-instance computation cache owned by the engine. */
export interface IndicatorCache {
  outputs: Float64Array[]
  state: unknown
  /** Highest candle index whose value is current (inclusive). -1 = nothing. */
  computedTo: number
  dataVersion: number
}
