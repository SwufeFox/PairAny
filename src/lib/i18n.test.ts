import { describe, expect, it } from 'vitest'
import { STRINGS, detectLocale, resolveLocale, format } from './i18n'
import type { I18n, Locale } from './i18n'

describe('i18n', () => {
  it('has complete bundles: same key tree for every locale', () => {
    const en = STRINGS.en
    const check = (node: unknown, path: string): void => {
      if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
          check(value, `${path}.${key}`)
        }
        return
      }
      // Leaf: every locale must have the key with a non-empty string.
      const keyPath = path.replace(/^\./, '')
      for (const locale of ['en', 'zh', 'ja'] as Locale[]) {
        const leaf = keyPath.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], STRINGS[locale])
        expect(typeof leaf, `${locale} missing ${keyPath}`).toBe('string')
        expect(String(leaf).length, `${locale} empty ${keyPath}`).toBeGreaterThan(0)
      }
    }
    check(en, '')
  })

  it('covers every indicator id and param key', () => {
    const ids = ['ma', 'ema', 'wma', 'vwma', 'bollinger', 'ichimoku', 'vwap', 'supertrend', 'rsi', 'macd', 'stochastic', 'cci', 'williams-r', 'volume', 'volume-ma', 'obv', 'mfi']
    const params = ['period', 'source', 'mult', 'multiplier', 'fast', 'slow', 'signal', 'kPeriod', 'kSmooth', 'dPeriod', 'tenkan', 'kijun', 'senkouB']
    for (const id of ids) {
      expect(STRINGS.en.indicators[id], `en indicator ${id}`).toBeDefined()
      expect(STRINGS.zh.indicators[id], `zh indicator ${id}`).toBeDefined()
      expect(STRINGS.ja.indicators[id], `ja indicator ${id}`).toBeDefined()
    }
    for (const key of params) {
      expect(STRINGS.en.params[key], `en param ${key}`).toBeDefined()
      expect(STRINGS.zh.params[key], `zh param ${key}`).toBeDefined()
    }
  })

  it('detects and resolves locale from browser language', () => {
    expect(detectLocale('zh-CN')).toBe('zh')
    expect(detectLocale('ja-JP')).toBe('ja')
    expect(detectLocale('en-US')).toBe('en')
    expect(detectLocale('fr-FR')).toBe('en')
    expect(resolveLocale('zh', 'en-US')).toBe('zh')
    expect(resolveLocale('auto', 'zh-CN')).toBe('zh')
  })

  it('substitutes placeholders', () => {
    expect(format('No direct {pair} pair exists on Binance spot.', { pair: 'BTCETH' })).toContain('BTCETH')
  })

  it('typed bundle matches the interface (no missing fields at compile time)', () => {
    const en: I18n = STRINGS.en
    expect(en.toolbar.indicators).toBe('Indicators')
    expect(en.canvas.o).toBe('O')
  })
})
