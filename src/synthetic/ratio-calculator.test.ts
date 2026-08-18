import { describe, expect, it } from 'vitest'
import { calculateRatio, calculateSyntheticVolume, RATIO_MODE } from './ratio-calculator'
import type { Candle } from '../types/market'

function candle(open: number, high: number, low: number, close: number, volume = 100, quoteVolume = 0): Candle {
  return { openTime: 0, open, high, low, close, volume, closeTime: 0, quoteVolume, trades: 1, closed: true }
}

describe('calculateRatio', () => {
  it('computes open/close as exact leg quotients', () => {
    const r = calculateRatio({ a: candle(10, 11, 9, 10.5), b: candle(2, 2.1, 1.9, 2.05) })
    expect(r.open).toBeCloseTo(5, 12)
    expect(r.close).toBeCloseTo(10.5 / 2.05, 12)
  })

  it('high is the max of the four corner ratios', () => {
    const a = candle(10, 12, 8, 9)
    const b = candle(2, 2.5, 1.5, 1.8)
    const r = calculateRatio({ a, b })
    const corners = [12 / 1.5, 12 / 2.5, 8 / 1.5, 8 / 2.5]
    expect(r.high).toBeCloseTo(Math.max(...corners), 12)
    expect(r.low).toBeCloseTo(Math.min(...corners), 12)
    // The envelope must contain the open/close ratios (guaranteed bound).
    expect(r.high).toBeGreaterThanOrEqual(r.open)
    expect(r.high).toBeGreaterThanOrEqual(r.close)
    expect(r.low).toBeLessThanOrEqual(r.open)
    expect(r.low).toBeLessThanOrEqual(r.close)
  })

  it('inversion is exact: ETH/BTC = 1 / (BTC/ETH)', () => {
    const a = candle(10, 12, 8, 9.5, 100, 200)
    const b = candle(2, 2.5, 1.5, 1.8, 50, 100)
    const ab = calculateRatio({ a, b })
    const ba = calculateRatio({ a: b, b: a })
    expect(ba.open).toBeCloseTo(1 / ab.open, 12)
    expect(ba.close).toBeCloseTo(1 / ab.close, 12)
    expect(ba.high).toBeCloseTo(1 / ab.low, 12)
    expect(ba.low).toBeCloseTo(1 / ab.high, 12)
  })

  it('returns NaN for a non-positive denominator instead of fabricating data', () => {
    const r = calculateRatio({ a: candle(10, 11, 9, 10), b: candle(0, 0, 0, 0) })
    expect(r.high).toBeNaN()
    expect(r.low).toBeNaN()
  })

  it('labels the mode as approximate (OHLC envelope, not tick-accurate)', () => {
    expect(RATIO_MODE).toBe('approximate')
  })
})

describe('calculateSyntheticVolume', () => {
  it('sums quote volumes of both legs (combined USDT notional)', () => {
    const v = calculateSyntheticVolume(candle(10, 11, 9, 10, 100, 1000), candle(2, 3, 1, 2, 50, 500))
    expect(v).toBe(1500)
  })

  it('falls back to price×volume when quote volume is missing', () => {
    const v = calculateSyntheticVolume(candle(10, 11, 9, 10, 100, 0), candle(2, 3, 1, 2, 50, 0))
    expect(v).toBeCloseTo(100 * 10 + 50 * 2, 9)
  })
})
