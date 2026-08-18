/**
 * MarketDataController — owns one CandleStore + one WebSocket per symbol,
 * wires REST initial load, rolling history, reconnect re-sync, and exposes
 * per-symbol connection status. It knows nothing about pairs or ratios; the
 * synthetic engine consumes its stores.
 */
import type { ConnectionState, ConnectionStatus, KlineInterval } from '../types/market'
import { Emitter } from '../lib/events'
import { intervalToMs } from '../lib/interval'
import { BinanceWebSocketClient } from './binance-websocket'
import { fetchKlines, fetchKlinesBefore, BinanceRestError } from './binance-rest'
import { CandleStore } from './candle-store'
import { klineStreamPath, KLINE_LIMIT, RECONNECT_SYNC_CANDLES } from './config'
import { parseKlineEvent } from './ws-kline'

interface Leg {
  symbol: string
  store: CandleStore
  ws: BinanceWebSocketClient
  status: ConnectionStatus
  /** true while a REST fetch is in flight for this leg. */
  fetching: boolean
}

export class MarketDataController {
  private legs = new Map<string, Leg>()
  private interval: KlineInterval = '1m'
  private statusEmitter = new Emitter<string>()

  get currentInterval(): KlineInterval {
    return this.interval
  }

  /** Switch interval: every active leg re-syncs and resubscribes. */
  setInterval(interval: KlineInterval): void {
    if (interval === this.interval) return
    this.interval = interval
    for (const leg of this.legs.values()) {
      this.restartLeg(leg)
    }
  }

  /** Attach (or re-sync) a symbol. Idempotent per symbol. */
  attach(symbol: string): void {
    const key = symbol.toUpperCase()
    let leg = this.legs.get(key)
    if (!leg) {
      leg = {
        symbol: key,
        store: new CandleStore(),
        ws: new BinanceWebSocketClient({
          url: klineStreamPath(key, this.interval),
          onMessage: (payload) => this.handleKlineEvent(key, payload),
          onStatus: (state) => this.handleSocketStatus(key, state),
          onReconnect: () => {
            void this.reSyncLeg(key, RECONNECT_SYNC_CANDLES)
          },
        }),
        status: { state: 'idle', lastMessageAt: null },
        fetching: false,
      }
      this.legs.set(key, leg)
    } else if (leg.store.length > 0) {
      // Re-attaching an existing leg: refresh from REST, keep socket state.
      void this.reSyncLeg(key, KLINE_LIMIT)
      return
    }
    this.startLeg(leg)
  }

  /** Detach a symbol: stop the socket, drop the store. */
  detach(symbol: string): void {
    const key = symbol.toUpperCase()
    const leg = this.legs.get(key)
    if (!leg) return
    leg.ws.stop()
    this.legs.delete(key)
    this.statusEmitter.emit(key)
  }

  /** Full REST re-sync + socket restart (used by the Retry button). */
  refresh(symbol: string): void {
    const leg = this.legs.get(symbol.toUpperCase())
    if (!leg) return
    this.restartLeg(leg)
  }

  /**
   * Load one older REST batch for a leg. Returns false when Binance has no
   * more history (the store then stops asking). Throttled by callers.
   */
  async loadOlder(symbol: string): Promise<boolean> {
    const leg = this.legs.get(symbol.toUpperCase())
    if (!leg || leg.fetching) return true
    const oldest = leg.store.getCandles()[0]
    if (!oldest) return true
    leg.fetching = true
    try {
      const batch = await fetchKlinesBefore(symbol.toUpperCase(), this.interval, oldest.openTime - 1, KLINE_LIMIT)
      if (batch.length === 0) {
        leg.store.setMoreHistoryAvailable(false)
        return false
      }
      const merged = leg.store.merge(batch)
      // A batch whose newest candle overlaps the previous oldest proves there
      // is more; Binance may also return fewer than limit at the tail.
      if (batch.length < KLINE_LIMIT && !merged.ignored) {
        leg.store.setMoreHistoryAvailable(false)
      }
      return true
    } catch {
      return true // transient; caller retries on next pan
    } finally {
      leg.fetching = false
    }
  }

  getLeg(symbol: string): CandleStore | undefined {
    if (!symbol) return undefined
    return this.legs.get(symbol.toUpperCase())?.store
  }

  getStatus(symbol: string): ConnectionStatus | undefined {
    if (!symbol) return undefined
    return this.legs.get(symbol.toUpperCase())?.status
  }

  /** Subscribe to per-symbol status changes; `*` listens to all. */
  subscribeStatus(scope: string, fn: () => void): () => void {
    return this.statusEmitter.subscribe((s) => {
      if (s === scope || scope === '*') fn()
    })
  }

  dispose(): void {
    for (const leg of this.legs.values()) leg.ws.stop()
    this.legs.clear()
  }

  // ---- internals ----

  private startLeg(leg: Leg): void {
    leg.status = { state: 'connecting', lastMessageAt: leg.status.lastMessageAt, detail: 'Loading historical data…' }
    this.statusEmitter.emit(leg.symbol)
    void this.fetchInitial(leg)
    leg.ws.start()
  }

  private async fetchInitial(leg: Leg): Promise<void> {
    leg.fetching = true
    try {
      const candles = await fetchKlines(leg.symbol, this.interval, KLINE_LIMIT)
      leg.store.merge(candles)
      this.markCurrentCandleOpen(leg)
      if (candles.length < KLINE_LIMIT) leg.store.setMoreHistoryAvailable(false)
      // Socket may connect independently; only surface REST errors here.
      leg.status.detail = undefined
      this.statusEmitter.emit(leg.symbol)
    } catch (err) {
      leg.status = {
        state: 'disconnected',
        lastMessageAt: leg.status.lastMessageAt,
        detail: err instanceof BinanceRestError ? err.message : 'Failed to load market data',
      }
      this.statusEmitter.emit(leg.symbol)
    } finally {
      leg.fetching = false
    }
  }

  private async reSyncLeg(symbol: string, limit: number): Promise<void> {
    const leg = this.legs.get(symbol)
    if (!leg) return
    try {
      const candles = await fetchKlines(symbol, this.interval, limit)
      leg.store.merge(candles)
      this.markCurrentCandleOpen(leg)
      leg.status.detail = undefined
      this.statusEmitter.emit(symbol)
    } catch {
      // Keep the socket running; next reconnect will try again.
    }
  }

  private restartLeg(leg: Leg): void {
    leg.ws.stop()
    leg.store = new CandleStore()
    this.startLeg(leg)
  }

  private handleKlineEvent(symbol: string, payload: unknown): void {
    const event = parseKlineEvent(payload)
    const leg = this.legs.get(symbol)
    if (!event || !leg) return
    if (event.interval !== this.interval) return // stale stream from a previous interval
    if (event.symbol !== symbol) return

    const last = leg.store.getLast()
    // Out-of-order guard: a live (unclosed) update for an older candle than
    // the newest one we hold is stale — Binance pushes per-trade updates for
    // the current candle only, so this catches replay/ordering issues.
    if (!event.kline.closed && last !== undefined && event.kline.openTime < last.openTime) return

    leg.store.upsert(event.kline)
    leg.status.lastMessageAt = event.eventTime
  }

  private handleSocketStatus(symbol: string, state: ConnectionState): void {
    const leg = this.legs.get(symbol)
    if (!leg) return
    if (state === 'connected') {
      leg.status.state = 'connected'
      leg.status.detail = undefined
    } else if (state === 'reconnecting') {
      leg.status.state = 'reconnecting'
      leg.status.detail = 'Reconnecting…'
    } else if (state === 'connecting') {
      leg.status.state = 'connecting'
      if (!leg.status.detail) leg.status.detail = 'Connecting…'
    }
    this.statusEmitter.emit(symbol)
  }

  /**
   * The REST batch includes the in-progress candle but no `x` flag; mark it
   * unclosed until the WebSocket stream takes over and tells the truth.
   */
  private markCurrentCandleOpen(leg: Leg): void {
    const last = leg.store.getLast()
    if (!last) return
    const now = Date.now()
    const ms = intervalToMs(this.interval)
    if (last.closeTime > now - ms && last.closed) {
      leg.store.upsert({ ...last, closed: false })
    }
  }
}
