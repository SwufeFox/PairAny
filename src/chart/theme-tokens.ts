/** Read chart design tokens from the live stylesheet (theme + color-blind
 * mode classes land on <html>, so getComputedStyle always reflects them). */
import type { ChartThemeTokens } from '../types/chart'

const IND_TOKENS = ['ind-1', 'ind-2', 'ind-3', 'ind-4', 'ind-5', 'ind-6', 'ind-7', 'ind-8'] as const

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v.length > 0 ? v : fallback
}

/**
 * Theme tokens, cached per (theme × color-blind mode) signature.
 *
 * `draw()` used to call `readChartTokens()` every frame — 20+
 * `getComputedStyle` reads per rAF. The token set only changes when the
 * theme class or a color-blind class on <html> changes, so we cache by that
 * signature and re-read only when it flips (or the cache is invalidated).
 */
let cache: ChartThemeTokens | null = null
let cacheKey = ''

/** Drop the cached tokens (call after programmatic class mutations). */
export function invalidateChartTokens(): void {
  cache = null
  cacheKey = ''
}

function themeSignature(): string {
  const root = document.documentElement.classList
  return `${root.contains('dark') ? 'd' : 'l'}|${root.contains('cb-rg-safe') ? 'r' : ''}${root.contains('cb-deuteranopia') ? 'D' : ''}${root.contains('cb-protanopia') ? 'P' : ''}${root.contains('cb-tritanopia') ? 'T' : ''}`
}

export function readChartTokens(): ChartThemeTokens {
  const key = themeSignature()
  if (cache && key === cacheKey) return cache
  const tokens = readTokens()
  cache = tokens
  cacheKey = key
  return tokens
}

function readTokens(): ChartThemeTokens {
  return {
    up: cssVar('--chart-up', '#22c55e'),
    down: cssVar('--chart-down', '#ef4444'),
    grid: cssVar('--chart-grid', 'rgba(128,128,128,0.15)'),
    gridStrong: cssVar('--chart-grid-strong', 'rgba(128,128,128,0.25)'),
    crosshair: cssVar('--chart-crosshair', 'rgba(128,128,128,0.6)'),
    axisText: cssVar('--chart-axis-text', '#666'),
    background: cssVar('--background', '#ffffff'),
    border: cssVar('--border', 'rgba(128,128,128,0.2)'),
    backgroundInverse: cssVar('--background-inverse', '#111827'),
    foregroundInverse: cssVar('--foreground-inverse', '#ffffff'),
    fontMono: cssVar('--font-mono', 'ui-monospace, SFMono-Regular, Menlo, monospace'),
    fontSans: cssVar('--font-sans', 'system-ui, sans-serif'),
    ind: IND_TOKENS.map((t) => cssVar(`--chart-${t}`, '#3b82f6')),
  }
}

