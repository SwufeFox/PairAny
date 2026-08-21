/**
 * CandleStore — the single source of truth for one symbol+interval.
 *
 * Owns a sorted-by-openTime candle array plus an openTime→index map for O(1)
 * dedup. REST batches and WebSocket events both flow through `upsert`, so
 * duplicate klines (REST echo of a live candle, repeated WS events, reconnect
 * re-sync) collapse onto the same slot. `version` bumps on every mutation;
 * consumers (synthetic engine, chart) subscribe instead of polling React.
 */
import type { Candle } from '../types/market'
import { Emitter } from '../lib/events'

export type UpsertResult = 'added' | 'updated' | 'ignored'

const DUPLICATE_EPS = 1e-12

export class CandleStore {
  private candles: Candle[] = []
  private index = new Map<number, number>()
  private versionCounter = 0
  /** >0 while a batch merge is in flight; per-upsert emits are suppressed. */
  private emitDepth = 0
  private emitter = new Emitter<number>()
  private moreOlder = true

  /** Insert or update by openTime. Candle must not be NaN-typed. */
  upsert(c: Candle): UpsertResult {
    const idx = this.index.get(c.openTime)
    if (idx !== undefined) {
      const existing = this.candles[idx]
      if (existing && sameCandle(existing, c)) return 'ignored'
      if (existing) this.candles[idx] = c
      this.bump()
      return 'updated'
    }
    const first = this.candles[0]
    const last = this.candles[this.candles.length - 1]
    if (!last || c.openTime > last.openTime) {
      this.candles.push(c)
      this.index.set(c.openTime, this.candles.length - 1)
    } else if (!first || c.openTime < first.openTime) {
      this.candles.unshift(c)
      this.rebuildIndex()
    } else {
      // Insert into the middle (rare: gap fill from a reconnect backlog).
      let lo = 0
      let hi = this.candles.length
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        const midT = this.candles[mid]?.openTime ?? 0
        if (midT < c.openTime) lo = mid + 1
        else hi = mid
      }
      this.candles.splice(lo, 0, c)
      this.rebuildIndex()
    }
    this.bump()
    return 'added'
  }

  /**
   * Merge an ascending REST batch. Returns counts for diagnostics.
   * Emissions are coalesced: one notify per batch instead of one per candle
   * (a 1000-candle backfill must not trigger 1000 downstream rebuilds).
   */
  merge(ascending: readonly Candle[]): { added: number; updated: number; ignored: number } {
    let added = 0
    let updated = 0
    let ignored = 0
    const changedBefore = this.versionCounter
    this.emitDepth++
    try {
      for (const c of ascending) {
        const r = this.upsert(c)
        if (r === 'added') added++
        else if (r === 'updated') updated++
        else ignored++
      }
    } finally {
      this.emitDepth--
    }
    if (this.versionCounter !== changedBefore && this.emitDepth === 0) {
      this.emitter.emit(this.versionCounter)
    }
    return { added, updated, ignored }
  }

  get length(): number {
    return this.candles.length
  }

  /** Stable reference; contents change only via upsert/merge (which bump version). */
  getCandles(): readonly Candle[] {
    return this.candles
  }

  getLast(): Candle | undefined {
    return this.candles[this.candles.length - 1]
  }

  getByTime(openTime: number): Candle | undefined {
    const idx = this.index.get(openTime)
    return idx === undefined ? undefined : this.candles[idx]
  }

  get version(): number {
    return this.versionCounter
  }

  /** false once the REST layer proved no older data exists. */
  get moreHistoryAvailable(): boolean {
    return this.moreOlder
  }

  setMoreHistoryAvailable(v: boolean): void {
    this.moreOlder = v
  }

  /** Subscribe to changes; callback receives the new version. */
  subscribe(fn: (version: number) => void): () => void {
    return this.emitter.subscribe(fn)
  }

  private bump(): void {
    this.versionCounter++
    if (this.emitDepth === 0) this.emitter.emit(this.versionCounter)
  }

  private rebuildIndex(): void {
    this.index.clear()
    for (let i = 0; i < this.candles.length; i++) {
      const c = this.candles[i]
      if (c) this.index.set(c.openTime, i)
    }
  }
}

/** Structural equality for dedup: identical OHLCV ⇒ no version bump. */
function sameCandle(a: Candle, b: Candle): boolean {
  return (
    Math.abs(a.open - b.open) < DUPLICATE_EPS &&
    Math.abs(a.high - b.high) < DUPLICATE_EPS &&
    Math.abs(a.low - b.low) < DUPLICATE_EPS &&
    Math.abs(a.close - b.close) < DUPLICATE_EPS &&
    Math.abs(a.volume - b.volume) < DUPLICATE_EPS &&
    a.closed === b.closed
  )
}
