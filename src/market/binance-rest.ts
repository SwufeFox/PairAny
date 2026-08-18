/** Binance REST market-data client. Public endpoints, no API key. */
import type { Candle, ExchangeInfo, KlineInterval, SymbolInfo } from '../types/market'
import { parseKlineRow } from '../types/market'
import { exchangeInfoPath, klinesHistoryPath, klinesPath, REST_TIMEOUT_MS } from './config'

export class BinanceRestError extends Error {
  readonly status: number | null
  constructor(message: string, status: number | null) {
    super(message)
    this.name = 'BinanceRestError'
    this.status = status
  }
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url, { signal })
  } catch (err) {
    throw new BinanceRestError(
      `Network error reaching Binance (${err instanceof Error ? err.message : 'unknown'})`,
      null,
    )
  }
  if (!res.ok) {
    throw new BinanceRestError(`Binance API ${res.status} ${res.statusText}`, res.status)
  }
  return res.json()
}

/** Fetch up to `limit` (≤ 1000) recent klines. Always sorted ascending. */
export async function fetchKlines(symbol: string, interval: KlineInterval, limit = 1000): Promise<Candle[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REST_TIMEOUT_MS)
  try {
    const data = await fetchJson(klinesPath(symbol, interval, limit), controller.signal)
    if (!Array.isArray(data)) {
      throw new BinanceRestError(`Unexpected klines payload for ${symbol}`, null)
    }
    return data.map((row) => parseKlineRow(Array.isArray(row) ? row : []))
  } finally {
    clearTimeout(timer)
  }
}

/** Fetch older klines ending before `endTime` (exclusive), ascending. */
export async function fetchKlinesBefore(
  symbol: string,
  interval: KlineInterval,
  endTime: number,
  limit = 1000,
): Promise<Candle[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REST_TIMEOUT_MS)
  try {
    const data = await fetchJson(klinesHistoryPath(symbol, interval, endTime, limit), controller.signal)
    if (!Array.isArray(data)) {
      throw new BinanceRestError(`Unexpected klines payload for ${symbol}`, null)
    }
    return data.map((row) => parseKlineRow(Array.isArray(row) ? row : []))
  } finally {
    clearTimeout(timer)
  }
}

let exchangeInfoCache: ExchangeInfo | null = null
let exchangeInfoPromise: Promise<ExchangeInfo> | null = null

/** Load (and cache) the full spot symbol list from /exchangeInfo. */
export function fetchExchangeInfo(force = false): Promise<ExchangeInfo> {
  if (exchangeInfoCache && !force) return Promise.resolve(exchangeInfoCache)
  if (exchangeInfoPromise) return exchangeInfoPromise
  exchangeInfoPromise = (async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REST_TIMEOUT_MS)
    try {
      const data = (await fetchJson(exchangeInfoPath(), controller.signal)) as Partial<ExchangeInfo>
      if (!Array.isArray(data.symbols)) {
        throw new BinanceRestError('Unexpected exchangeInfo payload', null)
      }
      exchangeInfoCache = {
        serverTime: typeof data.serverTime === 'number' ? data.serverTime : Date.now(),
        symbols: (data.symbols as SymbolInfo[]).filter(
          (s) =>
            typeof s.symbol === 'string' &&
            typeof s.baseAsset === 'string' &&
            typeof s.quoteAsset === 'string' &&
            Array.isArray(s.filters),
        ),
      }
      return exchangeInfoCache
    } finally {
      clearTimeout(timer)
      exchangeInfoPromise = null
    }
  })()
  return exchangeInfoPromise
}

export function resetExchangeInfoCache(): void {
  exchangeInfoCache = null
}
