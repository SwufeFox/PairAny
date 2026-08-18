import { describe, expect, it } from 'vitest'
import { maDefinition } from './defs/ma'
import { emaDefinition } from './defs/ema'
import { bollingerDefinition } from './defs/bollinger'
import { rsiDefinition } from './defs/rsi'
import { macdDefinition } from './defs/macd'
import { IndicatorEngine } from './indicator-engine'
import { registerAllIndicators } from './registry'
import { at } from '../lib/array'
import type { Candle } from '../types/market'

function candle(openTime: number, close: number, volume = 100): Candle {
  return { openTime, open: close, high: close * 1.01, low: close * 0.99, close, volume, closeTime: openTime + 59_000, quoteVolume: volume * close, trades: 1, closed: true }
}

function closes(values: number[], startTime = 0): Candle[] {
  return values.map((v, i) => candle(startTime + i * 60_000, v))
}

function run(def: (typeof maDefinition), data: Candle[], params?: Record<string, number | string>) {
  const engine = new IndicatorEngine()
  engine.register(def)
  engine.add(def.id, params)
  engine.setData(data, 1, true)
  return engine.getRendered()[0]?.outputs[0] ?? new Float64Array(0)
}

describe('MA', () => {
  it('computes the simple moving average with warmup', () => {
    const out = run(maDefinition, closes([1, 2, 3, 4, 5]), { period: 3 })
    expect(out[0]).toBeNaN()
    expect(out[1]).toBeNaN()
    expect(out[2]).toBeCloseTo(2, 12)
    expect(out[3]).toBeCloseTo(3, 12)
    expect(out[4]).toBeCloseTo(4, 12)
  })

  it('is exact for a constant series', () => {
    const out = run(maDefinition, closes([7, 7, 7, 7]), { period: 2 })
    expect(out[3]).toBeCloseTo(7, 12)
  })
})

describe('EMA', () => {
  it('seeds with SMA and continues exponentially', () => {
    const out = run(emaDefinition, closes([1, 2, 3, 4, 5]), { period: 3 })
    // k = 2/4 = 0.5; seed SMA(3) = 2 at index 2
    expect(out[2]).toBeCloseTo(2, 12)
    expect(out[3]).toBeCloseTo(4 * 0.5 + 2 * 0.5, 12) // 3
    expect(out[4]).toBeCloseTo(5 * 0.5 + 3 * 0.5, 12) // 4
  })
})

describe('Bollinger Bands', () => {
  it('computes middle/upper/lower with population stddev', () => {
    const engine = new IndicatorEngine()
    engine.register(bollingerDefinition)
    engine.add('bollinger', { period: 3, mult: 2 })
    engine.setData(closes([1, 2, 3]), 1, true)
    const outputs = engine.getRendered()[0]?.outputs ?? []
    expect(outputs.length).toBe(3)
    const middle = outputs[0]?.[2] as number
    const upper = outputs[1]?.[2] as number
    const lower = outputs[2]?.[2] as number
    expect(middle).toBeCloseTo(2, 12)
    const sd = Math.sqrt(((1 - 2) ** 2 + (2 - 2) ** 2 + (3 - 2) ** 2) / 3)
    expect(upper).toBeCloseTo(2 + 2 * sd, 12)
    expect(lower).toBeCloseTo(2 - 2 * sd, 12)
  })
})

describe('RSI', () => {
  it('is 100 after a strictly rising run (no losses)', () => {
    const out = run(rsiDefinition, closes([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]), { period: 14 })
    expect(at(out, 14)).toBe(100)
  })

  it('is 50 for a flat series', () => {
    const out = run(rsiDefinition, closes([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]), { period: 14 })
    expect(at(out, 14)).toBe(50)
  })

  it('is NaN during warmup', () => {
    const out = run(rsiDefinition, closes([1, 2, 3]), { period: 14 })
    expect(at(out, 0)).toBeNaN()
    expect(at(out, 2)).toBeNaN()
  })
})

describe('MACD', () => {
  it('produces a positive MACD for a rising series and hist = macd − signal', () => {
    const rising = closes([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160])
    const engine = new IndicatorEngine()
    engine.register(macdDefinition)
    engine.add('macd', { fast: 12, slow: 26, signal: 9 })
    engine.setData(rising, 1, true)
    const outputs = engine.getRendered()[0]?.outputs ?? []
    expect(outputs.length).toBe(3)
    const macd = outputs[0] as Float64Array
    const signal = outputs[1] as Float64Array
    const hist = outputs[2] as Float64Array
    const last = rising.length - 1
    expect(macd[last]).toBeGreaterThan(0)
    expect(Number.isFinite(signal[last])).toBe(true)
    expect(hist[last]).toBeCloseTo((macd[last] as number) - (signal[last] as number), 9)
  })
})

describe('edge cases and incremental recompute', () => {
  it('empty and single-candle data do not throw and yield NaN', () => {
    expect(run(maDefinition, [], { period: 3 }).length).toBe(0)
    const one = run(rsiDefinition, closes([10]), { period: 14 })
    expect(one[0]).toBeNaN()
  })

  it('handles large datasets without NaN in the tail', () => {
    const big = closes(Array.from({ length: 5000 }, (_, i) => 100 + Math.sin(i / 7) * 10))
    const out = run(macdDefinition, big, { fast: 12, slow: 26, signal: 9 })
    for (let i = 500; i < big.length; i++) {
      expect(Number.isFinite(out[i])).toBe(true)
    }
  })

  it('incremental tail recompute matches a full recompute (append)', () => {
    const engine = new IndicatorEngine()
    registerAllIndicators(engine)
    engine.add('ma', { period: 20 })
    engine.add('ema', { period: 12 })
    engine.add('rsi', { period: 14 })

    const base = closes(Array.from({ length: 300 }, (_, i) => 50 + Math.sin(i / 5) * 5 + i / 100))
    engine.setData(base, 1, true)
    const before = engine.getRendered()

    // Append one candle (non-structural) — like a WS tick.
    const next = [...base, candle(base.length * 60_000, 55.5)]
    engine.setData(next, 2, false)
    const after = engine.getRendered()

    // Full recompute from scratch must agree with the incremental result.
    const fresh = new IndicatorEngine()
    registerAllIndicators(fresh)
    fresh.add('ma', { period: 20 })
    fresh.add('ema', { period: 12 })
    fresh.add('rsi', { period: 14 })
    fresh.setData(next, 1, true)
    const reference = fresh.getRendered()

    expect(after.length).toBe(reference.length)
    for (let k = 0; k < reference.length; k++) {
      for (let i = 0; i < next.length; i++) {
        const a = after[k]?.outputs[0]?.[i]
        const r = reference[k]?.outputs[0]?.[i]
        if (Number.isNaN(a as number) && Number.isNaN(r as number)) continue
        expect(a).toBeCloseTo(r as number, 9)
      }
    }
    // Historical values are untouched by the append.
    expect(after[0]?.outputs[0]?.[150]).toBeCloseTo(before[0]?.outputs[0]?.[150] as number, 9)
  })

  it('incremental update of the last candle (WS live tick) stays correct', () => {
    const engine = new IndicatorEngine()
    registerAllIndicators(engine)
    engine.add('ema', { period: 5 })
    const data = closes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    engine.setData(data, 1, true)

    const updated = [...data.slice(0, -1), candle(data.length * 60_000, 20)]
    engine.setData(updated, 2, false)
    const incremental = engine.getRendered()[0]?.outputs[0] as Float64Array

    const fresh = new IndicatorEngine()
    registerAllIndicators(fresh)
    fresh.add('ema', { period: 5 })
    fresh.setData(updated, 1, true)
    const reference = fresh.getRendered()[0]?.outputs[0] as Float64Array
    for (let i = 0; i < updated.length; i++) {
      if (Number.isNaN(incremental[i] as number) && Number.isNaN(reference[i] as number)) continue
      expect(incremental[i]).toBeCloseTo(reference[i] as number, 9)
    }
  })
})
