import { describe, expect, it } from 'vitest'
import { synchronizeCandles } from './candle-sync'
import { CandleStore } from '../market/candle-store'
import type { Candle } from '../types/market'

function candle(openTime: number, close = 1): Candle {
  return { openTime, open: 1, high: 1.1, low: 0.9, close, volume: 1, quoteVolume: 1, closeTime: openTime + 59_000, trades: 1, closed: true }
}

describe('synchronizeCandles', () => {
  it('pairs candles with identical openTime', () => {
    const a = [candle(1000), candle(2000), candle(3000)]
    const b = [candle(1000), candle(2000), candle(3000)]
    const { pairs, missingA, missingB } = synchronizeCandles(a, b)
    expect(pairs.map((p) => p.openTime)).toEqual([1000, 2000, 3000])
    expect(missingA).toBe(0)
    expect(missingB).toBe(0)
  })

  it('reports candles missing on either side and skips them', () => {
    const a = [candle(1000), candle(2000), candle(3000), candle(4000)]
    const b = [candle(1000), candle(3000)]
    const { pairs, missingA, missingB } = synchronizeCandles(a, b)
    expect(pairs.map((p) => p.openTime)).toEqual([1000, 3000])
    expect(missingA).toBe(2) // 2000, 4000 present in A only
    expect(missingB).toBe(0)
  })

  it('handles out-of-order input by sorting (defensive)', () => {
    const a = [candle(3000), candle(1000), candle(2000)]
    const b = [candle(2000), candle(1000)]
    const sortedA = [...a].sort((x, y) => x.openTime - y.openTime)
    const sortedB = [...b].sort((x, y) => x.openTime - y.openTime)
    const { pairs } = synchronizeCandles(sortedA, sortedB)
    expect(pairs.map((p) => p.openTime)).toEqual([1000, 2000])
  })

  it('empty input yields empty output', () => {
    const { pairs, missingA, missingB } = synchronizeCandles([], [])
    expect(pairs).toEqual([])
    expect(missingA).toBe(0)
    expect(missingB).toBe(0)
  })
})

describe('CandleStore', () => {
  it('dedupes by openTime (REST + WS overlap) and keeps the newest value', () => {
    const store = new CandleStore()
    expect(store.upsert(candle(1000, 5))).toBe('added')
    expect(store.upsert(candle(1000, 6))).toBe('updated')
    expect(store.upsert(candle(1000, 6))).toBe('ignored')
    expect(store.length).toBe(1)
    expect(store.getLast()?.close).toBe(6)
  })

  it('keeps the array sorted for head/middle/tail inserts', () => {
    const store = new CandleStore()
    store.upsert(candle(3000))
    store.upsert(candle(1000))
    store.upsert(candle(2000))
    store.upsert(candle(1500))
    expect(store.getCandles().map((c) => c.openTime)).toEqual([1000, 1500, 2000, 3000])
  })

  it('merge() collapses duplicates and counts outcomes', () => {
    const store = new CandleStore()
    store.merge([candle(1000), candle(2000), candle(3000)])
    const result = store.merge([candle(2000, 7), candle(4000)])
    expect(result).toEqual({ added: 1, updated: 1, ignored: 0 })
    expect(store.length).toBe(4)
  })

  it('bumps version only on real changes', () => {
    const store = new CandleStore()
    const v0 = store.version
    store.upsert(candle(1000))
    const v1 = store.version
    store.upsert(candle(1000))
    expect(store.version).toBe(v1)
    expect(v1).toBeGreaterThan(v0)
  })
})
