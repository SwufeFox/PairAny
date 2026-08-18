/** ExchangeInfo cache + derived lookups (assets, direct pairs, tick sizes). */
import { fetchExchangeInfo } from './binance-rest'
import type { ExchangeInfo, SymbolInfo } from '../types/market'

export interface AssetEntry {
  asset: string
  /** An example spot symbol for this base asset (prefers USDT quote). */
  exampleSymbol: string
}

function isTradableSpot(s: SymbolInfo): boolean {
  if (s.status !== 'TRADING') return false
  // Modern exchangeInfo carries permissions as permissionSets.
  if (Array.isArray(s.permissionSets) && s.permissionSets.length > 0) {
    return s.permissionSets.some((set) => set.includes('SPOT'))
  }
  // Legacy flat permissions field.
  if (Array.isArray(s.permissions) && s.permissions.length > 0) {
    return s.permissions.includes('SPOT')
  }
  // Public market-data view may omit both; TRADING is the operative gate.
  return true
}

/** Distinct tradable base assets (each with an example symbol, USDT preferred). */
export function listBaseAssets(info: ExchangeInfo): AssetEntry[] {
  const map = new Map<string, string>()
  for (const s of info.symbols) {
    if (!isTradableSpot(s)) continue
    const existing = map.get(s.baseAsset)
    if (!existing || (s.quoteAsset === 'USDT' && !existing.endsWith('USDT'))) {
      map.set(s.baseAsset, s.symbol)
    }
  }
  return [...map.entries()]
    .map(([asset, exampleSymbol]) => ({ asset, exampleSymbol }))
    .sort((x, y) => x.asset.localeCompare(y.asset))
}

/** Distinct tradable quote assets. */
export function listQuoteAssets(info: ExchangeInfo): string[] {
  const set = new Set<string>()
  for (const s of info.symbols) {
    if (isTradableSpot(s)) set.add(s.quoteAsset)
  }
  return [...set].sort()
}

/** Tradable symbols quoted in USDT (compare picker). */
export function listUsdtQuoteSymbols(info: ExchangeInfo): string[] {
  const out: string[] = []
  for (const s of info.symbols) {
    if (isTradableSpot(s) && s.quoteAsset === 'USDT') out.push(s.symbol)
  }
  return out.sort()
}

export class ExchangeInfoStore {
  private info: ExchangeInfo | null = null
  private loading: Promise<ExchangeInfo> | null = null
  private loadError: string | null = null

  load(force = false): Promise<ExchangeInfo> {
    if (this.info && !force) return Promise.resolve(this.info)
    if (this.loading) return this.loading
    this.loading = fetchExchangeInfo(force)
      .then((info) => {
        this.info = info
        this.loadError = null
        return info
      })
      .catch((err: unknown) => {
        this.loadError = err instanceof Error ? err.message : 'Failed to load exchange info'
        throw err
      })
      .finally(() => {
        this.loading = null
      })
    return this.loading
  }

  get(): ExchangeInfo | null {
    return this.info
  }

  get error(): string | null {
    return this.loadError
  }

  getSymbol(raw: string): SymbolInfo | undefined {
    if (!this.info) return undefined
    const symbol = raw.toUpperCase()
    return this.info.symbols.find((s) => s.symbol === symbol && isTradableSpot(s))
  }

  hasSymbol(raw: string): boolean {
    return this.getSymbol(raw) !== undefined
  }

  /** Direct spot pair for base/quote, e.g. base=BTC quote=ETH → 'BTCETH', or null. */
  getDirectPair(base: string, quote: string): string | null {
    if (!this.info) return null
    const symbol = `${base}${quote}`.toUpperCase()
    const found = this.info.symbols.find((s) => s.symbol === symbol)
    return found !== undefined && isTradableSpot(found) ? symbol : null
  }

  /** USDT-quoted spot symbol for an asset, e.g. BTC → 'BTCUSDT'. */
  getUsdtPair(asset: string): string | null {
    if (!this.info) return null
    const symbol = `${asset}USDT`.toUpperCase()
    if (this.getSymbol(symbol)) return symbol
    return null
  }

  /** True when base/quote is a tradable spot pair. */
  hasPair(base: string, quote: string): boolean {
    return this.getSymbol(`${base}${quote}`) !== undefined
  }

  /** Distinct tradable base assets (each with an example symbol, USDT preferred). */
  getBaseAssets(): AssetEntry[] {
    if (!this.info) return []
    return listBaseAssets(this.info)
  }

  /** Distinct tradable quote assets. */
  getQuoteAssets(): string[] {
    if (!this.info) return []
    return listQuoteAssets(this.info)
  }

  /** Tick size from the PRICE_FILTER, or null when absent. */
  getTickSize(symbol: string): number | null {
    const info = this.getSymbol(symbol)
    if (!info) return null
    const filter = info.filters.find((f) => f.filterType === 'PRICE_FILTER')
    const tick = filter?.tickSize
    if (typeof tick === 'string') {
      const n = Number(tick)
      return Number.isFinite(n) && n > 0 ? n : null
    }
    return null
  }
}
