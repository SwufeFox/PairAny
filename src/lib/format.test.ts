import { describe, expect, it } from 'vitest'
import { formatAxisTime, formatChange, formatCompact, formatPercent, formatPrice, formatPriceTick } from './format'

describe('formatPrice', () => {
  it('is magnitude-adaptive and never scientific for market magnitudes', () => {
    expect(formatPrice(65000)).toBe('65000')
    expect(formatPrice(1.23456789)).toBe('1.23457')
    expect(formatPrice(0.00001234567)).toBe('0.0000123457')
    expect(formatPrice(0.00000001)).toBe('0.00000001')
    expect(formatPrice(1234567.89)).toBe('1234570')
  })

  it('handles zero and non-finite', () => {
    expect(formatPrice(0)).toBe('0')
    expect(formatPrice(Number.NaN)).toBe('—')
    expect(formatPrice(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('formatPriceTick', () => {
  it('rounds to the symbol tick grid', () => {
    expect(formatPriceTick(0.123456, 0.01)).toBe('0.12')
    expect(formatPriceTick(123.456, 1)).toBe('123')
    expect(formatPriceTick(0.000023456, 0.000001)).toBe('0.000023')
  })
})

describe('formatChange / formatPercent / formatCompact', () => {
  it('signs changes and percentages', () => {
    expect(formatChange(12.345)).toBe('+12.345')
    expect(formatChange(-0.05)).toBe('-0.05')
    expect(formatPercent(1.234)).toBe('+1.23%')
    expect(formatPercent(-0.5)).toBe('-0.50%')
  })

  it('compacts large counts', () => {
    expect(formatCompact(1234567)).toBe('1.235M')
    expect(formatCompact(45600)).toBe('45.6K')
    expect(formatCompact(12)).toBe('12')
  })
})

describe('formatAxisTime', () => {
  it('renders time-of-day for intraday intervals and dates for daily+', () => {
    const t = Date.UTC(2026, 7, 18, 9, 30)
    expect(formatAxisTime(t, '1m')).toMatch(/^\d{2}:\d{2}$/)
    expect(formatAxisTime(t, '1d')).toMatch(/[A-Z][a-z]{2}/)
  })
})
