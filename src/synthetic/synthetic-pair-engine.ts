/**
 * SyntheticPairEngine — builds the A/B series from two leg CandleStores.
 *
 *   synchronizeCandles() → aligned (openTime, a, b) pairs
 *   calculateOpen/High/Low/Close() → ratio OHLC per pair (corner envelope)
 *   calculateVolume() → combined USDT notional (labeled "Synthetic Volume")
 *
 * The series is rebuilt lazily: any mutation on either leg marks it dirty and
 * schedules one coalesced rebuild+emit via microtask, so a burst of WS ticks
 * produces one notification per frame-turn instead of one per tick.
 */
import type { Candle } from '../types/market'
import type { CandleStore } from '../market/candle-store'
import { synchronizeCandles } from './candle-sync'
import { calculateRatio, calculateSyntheticVolume, RATIO_MODE } from './ratio-calculator'
import type { RatioMode } from '../types/chart'
import { Emitter } from '../lib/events'

export interface SyntheticSeries {
  candles: readonly Candle[]
  version: number
  mode: RatioMode
  stats: { aligned: number; missingA: number; missingB: number }
  /** false once either leg has no older REST history. */
  moreHistoryAvailable: boolean
  oldestLoaded: number | null
}

export class SyntheticPairEngine {
  private series: SyntheticSeries | null = null
  private dirty = false
  private scheduled = false
  private emitter = new Emitter<SyntheticSeries>()
  private unsubscribes: Array<() => void> = []

  constructor(private readonly legs: { a: CandleStore; b: CandleStore }) {
    const markDirty = (): void => {
      this.dirty = true
      if (!this.scheduled) {
        this.scheduled = true
        queueMicrotask(() => {
          this.scheduled = false
          if (this.dirty) {
            this.dirty = false
            this.rebuild()
            this.emitter.emit(this.series as SyntheticSeries)
          }
        })
      }
    }
    this.unsubscribes.push(this.legs.a.subscribe(markDirty), this.legs.b.subscribe(markDirty))
  }

  getSeries(): SyntheticSeries {
    if (!this.series || this.dirty) this.rebuild()
    return this.series as SyntheticSeries
  }

  subscribe(fn: (series: SyntheticSeries) => void): () => void {
    return this.emitter.subscribe(fn)
  }

  dispose(): void {
    for (const un of this.unsubscribes) un()
    this.unsubscribes = []
  }

  private rebuild(): void {
    const a = this.legs.a.getCandles()
    const b = this.legs.b.getCandles()
    const { pairs, missingA, missingB } = synchronizeCandles(a, b)

    const candles: Candle[] = new Array(pairs.length)
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i]
      if (!pair) continue
      const ratio = calculateRatio(pair)
      candles[i] = {
        openTime: pair.openTime,
        open: ratio.open,
        high: ratio.high,
        low: ratio.low,
        close: ratio.close,
        volume: calculateSyntheticVolume(pair.a, pair.b),
        quoteVolume: pair.a.quoteVolume + pair.b.quoteVolume,
        trades: pair.a.trades + pair.b.trades,
        closed: pair.a.closed && pair.b.closed,
        closeTime: pair.a.closeTime,
      }
    }

    const first = candles[0]
    this.series = {
      candles,
      version: this.legs.a.version + this.legs.b.version,
      mode: RATIO_MODE,
      stats: { aligned: pairs.length, missingA, missingB },
      moreHistoryAvailable: this.legs.a.moreHistoryAvailable && this.legs.b.moreHistoryAvailable,
      oldestLoaded: first ? first.openTime : null,
    }
  }
}
