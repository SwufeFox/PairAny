/**
 * Synthetic pair ratio math.
 *
 * A/B = (A/USDT) / (B/USDT), candle by candle.
 *
 * The true path of the ratio inside one candle is not recoverable from OHLC
 * alone: with only two anchors per leg we do not know whether A.high and
 * B.low occurred at the same instant. The four-corner envelope below is the
 * tightest bound derivable from OHLC data — the true high is guaranteed to
 * be ≤ max(corner ratios) and the true low ≥ min(corner ratios) — so it is
 * conservative (never shows an extreme the data cannot contain) but not
 * tick-exact. This is the `approximate` mode; `tick-accurate` would require
 * trade-level paths and is intentionally not claimed.
 */
import type { Candle } from '../types/market'
import type { RatioMode } from '../types/chart'

export const RATIO_MODE: RatioMode = 'approximate'

export interface RatioCandle {
  open: number
  high: number
  low: number
  close: number
}

export interface RatioInput {
  a: Pick<Candle, 'open' | 'high' | 'low' | 'close'>
  b: Pick<Candle, 'open' | 'high' | 'low' | 'close'>
}

/** OHLC of A/B for one aligned candle pair, using the corner envelope. */
export function calculateRatio(input: RatioInput): RatioCandle {
  const { a, b } = input
  if (b.open <= 0 || b.high <= 0 || b.low <= 0 || b.close <= 0) {
    // A non-positive denominator is impossible for real market data; keep the
    // NaN visible rather than fabricating a number.
    return { open: NaN, high: NaN, low: NaN, close: NaN }
  }
  const open = a.open / b.open
  const close = a.close / b.close
  const ah_bl = a.high / b.low
  const ah_bh = a.high / b.high
  const al_bl = a.low / b.low
  const al_bh = a.low / b.high
  return {
    open,
    close,
    high: Math.max(ah_bl, ah_bh, al_bl, al_bh),
    low: Math.min(ah_bl, ah_bh, al_bl, al_bh),
  }
}

/**
 * Combined USDT notional of both legs: real quote-volume data, labeled
 * "Synthetic Volume" in the UI — it is the aggregate traded notional across
 * both underlying markets, never presented as an exchange-reported volume.
 */
export function calculateSyntheticVolume(a: Pick<Candle, 'volume' | 'close' | 'quoteVolume'>, b: Pick<Candle, 'volume' | 'close' | 'quoteVolume'>): number {
  const legA = a.quoteVolume > 0 ? a.quoteVolume : a.volume * a.close
  const legB = b.quoteVolume > 0 ? b.quoteVolume : b.volume * b.close
  return legA + legB
}
