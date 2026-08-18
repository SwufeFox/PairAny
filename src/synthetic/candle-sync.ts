/**
 * Candle synchronization: align two sorted candle series on openTime.
 *
 * Both stores keep their arrays sorted ascending with unique openTimes, so a
 * two-pointer merge produces pairs in O(n+m). Candles that exist on only one
 * side are reported (missingA / missingB) and skipped — the synthetic series
 * never fabricates a candle for a gap. A candle pair is only produced when
 * both legs have a candle for the exact same openTime.
 */
import type { Candle } from '../types/market'

export interface SyncedCandlePair {
  openTime: number
  a: Candle
  b: Candle
}

export interface SyncResult {
  pairs: SyncedCandlePair[]
  /** openTimes present in A but not B. */
  missingA: number
  /** openTimes present in B but not A. */
  missingB: number
}

export function synchronizeCandles(a: readonly Candle[], b: readonly Candle[]): SyncResult {
  const pairs: SyncedCandlePair[] = []
  let missingA = 0
  let missingB = 0
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    const ca = a[i]
    const cb = b[j]
    if (ca === undefined || cb === undefined) break
    if (ca.openTime === cb.openTime) {
      pairs.push({ openTime: ca.openTime, a: ca, b: cb })
      i++
      j++
    } else if (ca.openTime < cb.openTime) {
      missingA++
      i++
    } else {
      missingB++
      j++
    }
  }
  missingA += a.length - i
  missingB += b.length - j
  return { pairs, missingA, missingB }
}
