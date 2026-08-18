/** Interval helpers: canonical Binance list, durations, labels. */
import type { KlineInterval } from '../types/market'

/** All intervals Binance spot klines actually support — do not add others. */
export const ALL_INTERVALS: KlineInterval[] = [
  '1s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M',
]

export const QUICK_INTERVALS: KlineInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M']

/** Approximate duration in ms (used for axis gaps and REST pagination; 1M ≈ 30d). */
export const INTERVAL_MS: Record<KlineInterval, number> = {
  '1s': 1_000,
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
  '3d': 259_200_000,
  '1w': 604_800_000,
  '1M': 2_592_000_000,
}

export function intervalToMs(interval: KlineInterval): number {
  return INTERVAL_MS[interval]
}

/** True for sub-day intervals (time-of-day axis labels apply). */
export function isIntraday(interval: KlineInterval): boolean {
  return interval === '1s' || interval.endsWith('m') || interval.endsWith('h')
}

/** Toolbar label: 1m / 5m / 15m / 1H / 4H / 1D / 1W / 1M. */
export function intervalLabel(interval: KlineInterval): string {
  return interval.replace(/^(\d+)([smhdwM])$/, (_, n: string, u: string) => `${n}${u === 'm' ? 'm' : u.toUpperCase()}`)
}

/** Full label for the interval menu. */
export function intervalLongLabel(interval: KlineInterval): string {
  const map: Record<string, string> = {
    '1s': '1 second',
    '1m': '1 minute',
    '3m': '3 minutes',
    '5m': '5 minutes',
    '15m': '15 minutes',
    '30m': '30 minutes',
    '1h': '1 hour',
    '2h': '2 hours',
    '4h': '4 hours',
    '6h': '6 hours',
    '8h': '8 hours',
    '12h': '12 hours',
    '1d': '1 day',
    '3d': '3 days',
    '1w': '1 week',
    '1M': '1 month',
  }
  return map[interval] ?? interval
}
