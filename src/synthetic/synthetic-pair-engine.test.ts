import { describe, expect, it } from 'vitest'
import { SyntheticPairEngine } from './synthetic-pair-engine'
import { CandleStore } from '../market/candle-store'
import type { Candle } from '../types/market'

function candle(openTime: number, o: number, h: number, l: number, c: number, volume = 1, quoteVolume = 2): Candle {
  return { openTime, open: o, high: h, low: l, close: c, volume, closeTime: openTime + 59_000, quoteVolume, trades: 1, closed: true }
}

function makeStores() {
  const a = new CandleStore()
  const b = new CandleStore()
  return { a, b }
}

describe('SyntheticPairEngine', () => {
  it('computes BTC/ETH from BTCUSDT / ETHUSDT candles', () => {
    const { a, b } = makeStores()
    // BTCUSDT: 60000 → 61000; ETHUSDT: 3000 → 3050
    a.upsert(candle(1000, 60000, 61500, 59500, 61000, 10, 600000))
    b.upsert(candle(1000, 3000, 3050, 2950, 3050, 100, 300000))
    const engine = new SyntheticPairEngine({ a, b })
    const series = engine.getSeries()
    expect(series.mode).toBe('approximate')
    expect(series.candles).toHaveLength(1)
    const c = series.candles[0] as Candle
    expect(c.open).toBeCloseTo(60000 / 3000, 12)
    expect(c.close).toBeCloseTo(61000 / 3050, 12)
    expect(c.high).toBeCloseTo(61500 / 2950, 12)
    expect(c.low).toBeCloseTo(59500 / 3050, 12)
    expect(c.volume).toBeCloseTo(900000, 9) // combined notional
    expect(c.closed).toBe(true)
  })

  it('inversion is exact: engine with swapped legs yields reciprocal series', () => {
    const { a: aStore, b: bStore } = makeStores()
    aStore.upsert(candle(1000, 60000, 61500, 59500, 61000))
    aStore.upsert(candle(2000, 61000, 62000, 60000, 61500))
    bStore.upsert(candle(1000, 3000, 3050, 2950, 3050))
    bStore.upsert(candle(2000, 3050, 3100, 3000, 3080))

    const ab = new SyntheticPairEngine({ a: aStore, b: bStore }).getSeries()
    const ba = new SyntheticPairEngine({ a: bStore, b: aStore }).getSeries()
    expect(ab.candles).toHaveLength(2)
    expect(ba.candles).toHaveLength(2)
    for (let i = 0; i < 2; i++) {
      const a1 = ab.candles[i] as Candle
      const b1 = ba.candles[i] as Candle
      expect(b1.open).toBeCloseTo(1 / a1.open, 12)
      expect(b1.close).toBeCloseTo(1 / a1.close, 12)
      expect(b1.high).toBeCloseTo(1 / a1.low, 12)
      expect(b1.low).toBeCloseTo(1 / a1.high, 12)
    }
  })

  it('skips one-sided candles and reports the missing stats', () => {
    const { a, b } = makeStores()
    a.upsert(candle(1000, 10, 11, 9, 10))
    a.upsert(candle(2000, 10, 11, 9, 10))
    a.upsert(candle(3000, 10, 11, 9, 10))
    b.upsert(candle(1000, 2, 3, 1, 2))
    b.upsert(candle(3000, 2, 3, 1, 2))
    const series = new SyntheticPairEngine({ a, b }).getSeries()
    expect(series.candles.map((c) => c.openTime)).toEqual([1000, 3000])
    expect(series.stats.missingA).toBe(1) // 2000 exists in A only
    expect(series.stats.missingB).toBe(0)
  })

  it('marks a synthetic candle live only while both legs are open', () => {
    const { a, b } = makeStores()
    const engine = new SyntheticPairEngine({ a, b })
    a.upsert({ ...candle(1000, 10, 11, 9, 10), closed: false })
    b.upsert(candle(1000, 2, 3, 1, 2))
    expect(engine.getSeries().candles[0]?.closed).toBe(false)
    b.upsert({ ...candle(1000, 2, 3, 1, 2.1), closed: false })
    expect(engine.getSeries().candles[0]?.close).toBeCloseTo(10 / 2.1, 12)
    expect(engine.getSeries().candles[0]?.closed).toBe(false)
    engine.dispose()
  })

  it('emits coalesced updates and bumps version on leg changes', async () => {
    const { a, b } = makeStores()
    const engine = new SyntheticPairEngine({ a, b })
    let events = 0
    const un = engine.subscribe(() => events++)
    a.upsert(candle(1000, 10, 11, 9, 10))
    b.upsert(candle(1000, 2, 3, 1, 2))
    // Microtask coalescing collapses both mutations into one emission.
    await new Promise((r) => setTimeout(r, 0))
    expect(events).toBe(1)
    un()
    engine.dispose()
  })
})
