/** Read chart design tokens from the live stylesheet (theme + color-blind
 * mode classes land on <html>, so getComputedStyle always reflects them). */
import type { ChartThemeTokens } from '../types/chart'

const IND_TOKENS = ['ind-1', 'ind-2', 'ind-3', 'ind-4', 'ind-5', 'ind-6', 'ind-7', 'ind-8'] as const

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v.length > 0 ? v : fallback
}

export function readChartTokens(): ChartThemeTokens {
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
