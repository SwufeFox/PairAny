/** Shared market-domain types. No `any`, no React, no Binance import — pure data shapes. */

/** Binance spot kline intervals that exist on the public API. */
export const KLINE_INTERVALS = [
  '1s',
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
] as const

export type KlineInterval = (typeof KLINE_INTERVALS)[number]

export function isKlineInterval(v: string): v is KlineInterval {
  return (KLINE_INTERVALS as readonly string[]).includes(v)
}

/** One OHLCV candle. All prices are raw numbers (never rounded in storage). */
export interface Candle {
  /** Kline open time, epoch ms UTC (Binance `k.t`). */
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  /** Kline close time, epoch ms UTC. */
  closeTime: number
  quoteVolume: number
  trades: number
  /** true once the exchange closed the candle (`k.x`); live candles are false. */
  closed: boolean
}

/** Per-leg / per-symbol network lifecycle state, surfaced in the status bar. */
export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export interface ConnectionStatus {
  state: ConnectionState
  /** epoch ms of the last data-bearing message received. */
  lastMessageAt: number | null
  /** human-readable reason when not connected. */
  detail?: string
}

/** Subset of Binance exchangeInfo symbol entries we need. */
export interface SymbolInfo {
  symbol: string
  baseAsset: string
  quoteAsset: string
  status: string
  /** 'SPOT' etc. May be empty on the public endpoint (data moved to permissionSets). */
  permissions: string[]
  /** Newer format: one array per permission set. */
  permissionSets?: string[][]
  baseAssetPrecision: number
  quoteAssetPrecision: number
  /** filters: PRICE_FILTER tickSize, LOT_SIZE stepSize, MIN_NOTIONAL minNotional. */
  filters: Array<{ filterType: string; [k: string]: unknown }>
}

export interface ExchangeInfo {
  serverTime: number
  symbols: SymbolInfo[]
}

/** Parsed Binance REST kline row (12 fields) → Candle. */
export function parseKlineRow(row: readonly unknown[]): Candle {
  const num = (v: unknown): number => Number(v)
  return {
    openTime: num(row[0]),
    open: num(row[1]),
    high: num(row[2]),
    low: num(row[3]),
    close: num(row[4]),
    volume: num(row[5]),
    closeTime: num(row[6]),
    quoteVolume: num(row[7]),
    trades: num(row[8]),
    closed: true,
  }
}
