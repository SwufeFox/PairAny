/**
 * Centralized Binance endpoints.
 *
 * The public market-data endpoints (`data-api.binance.vision` /
 * `data-stream.binance.vision`) are used by default: they are the officially
 * documented public endpoints, need no API key, and are not geo-restricted
 * the way api.binance.com is. Swap to the main endpoints here if needed —
 * nothing else in the codebase references hostnames.
 */

export const REST_BASE_URL = 'https://data-api.binance.vision'
export const WS_BASE_URL = 'wss://data-stream.binance.vision'

/** Alternative official endpoints (uncomment to use). */
// export const REST_BASE_URL = 'https://api.binance.com'
// export const WS_BASE_URL = 'wss://stream.binance.com:9443'

/** Max candles per /klines request. */
export const KLINE_LIMIT = 1000

/** Candles re-fetched after a WebSocket reconnect to cover the gap. */
export const RECONNECT_SYNC_CANDLES = 300

/** REST request timeout in ms. */
export const REST_TIMEOUT_MS = 15_000

/** App-level WebSocket ping cadence and liveness thresholds. */
export const WS_PING_INTERVAL_MS = 30_000
export const WS_PONG_TIMEOUT_MS = 15_000
export const WS_MAX_BACKOFF_MS = 30_000

export function klinesPath(symbol: string, interval: string, limit: number): string {
  return `${REST_BASE_URL}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`
}

export function klinesHistoryPath(symbol: string, interval: string, endTime: number, limit: number): string {
  return `${REST_BASE_URL}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&endTime=${endTime}&limit=${limit}`
}

export function exchangeInfoPath(): string {
  return `${REST_BASE_URL}/api/v3/exchangeInfo`
}

export function klineStreamPath(symbol: string, interval: string): string {
  return `${WS_BASE_URL}/ws/${symbol.toLowerCase()}@kline_${interval}`
}
