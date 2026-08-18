/** Parse the Binance kline stream payload into typed data. */
import type { Candle, KlineInterval } from '../types/market'
import { isKlineInterval } from '../types/market'

export interface KlineEvent {
  eventType: 'kline'
  eventTime: number
  symbol: string
  kline: Candle
  interval: KlineInterval
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v !== '' && v !== 'null') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Parse a raw `@kline_<interval>` frame. Returns null for anything else. */
export function parseKlineEvent(raw: unknown): KlineEvent | null {
  if (!isRecord(raw)) return null
  if (raw.e !== 'kline') return null
  const k = raw.k
  if (!isRecord(k)) return null
  const interval = k.i
  if (typeof interval !== 'string' || !isKlineInterval(interval)) return null

  const openTime = num(k.t)
  const closeTime = num(k.T)
  const open = num(k.o)
  const high = num(k.h)
  const low = num(k.l)
  const close = num(k.c)
  const volume = num(k.v)
  const quoteVolume = num(k.q)
  const trades = num(k.n)
  if (openTime === null || closeTime === null || open === null || high === null || low === null || close === null) {
    return null
  }

  return {
    eventType: 'kline',
    eventTime: num(raw.E) ?? Date.now(),
    symbol: typeof raw.s === 'string' ? raw.s : '',
    interval,
    kline: {
      openTime,
      closeTime,
      open,
      high,
      low,
      close,
      volume: volume ?? 0,
      quoteVolume: quoteVolume ?? 0,
      trades: trades ?? 0,
      closed: k.x === true,
    },
  }
}
