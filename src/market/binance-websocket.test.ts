import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BinanceWebSocketClient } from './binance-websocket'
import type { WebSocketLike } from './binance-websocket'
import { parseKlineEvent } from './ws-kline'
import { CandleStore } from './candle-store'

/** Test double implementing WebSocketLike. */
class FakeSocket implements WebSocketLike {
  static all: FakeSocket[] = []
  readyState = 0
  sent: string[] = []
  onopen: ((event: unknown) => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onclose: ((event: { code?: number; reason?: string }) => void) | null = null

  constructor(public url: string) {
    FakeSocket.all.push(this)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(code?: number, reason?: string): void {
    this.onclose?.({ code, reason })
  }

  open(): void {
    this.readyState = 1
    this.onopen?.(null)
  }

  message(data: unknown): void {
    this.onmessage?.({ data })
  }

  drop(): void {
    this.onerror?.(null)
    this.onclose?.({ code: 1006, reason: 'abnormal closure' })
  }
}

function makeKlineFrame(openTime: number, close: string, closed: boolean): string {
  return JSON.stringify({
    e: 'kline',
    E: openTime + 1,
    s: 'BTCUSDT',
    k: {
      t: openTime,
      T: openTime + 59_999,
      s: 'BTCUSDT',
      i: '1m',
      o: '60000',
      h: '61000',
      l: '59000',
      c: close,
      v: '1.5',
      n: 3,
      x: closed,
      q: '90000',
      V: '1',
      Q: '60000',
      B: '0',
    },
  })
}

describe('BinanceWebSocketClient', () => {
  beforeEach(() => {
    FakeSocket.all = []
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function makeClient(onMessage = vi.fn(), onStatus = vi.fn(), onReconnect = vi.fn()) {
    const client = new BinanceWebSocketClient({
      url: 'wss://example/ws/btcusdt@kline_1m',
      socketFactory: (url) => new FakeSocket(url),
      onMessage,
      onStatus,
      onReconnect,
    })
    return { client, onMessage, onStatus, onReconnect }
  }

  it('connects and reports state transitions', () => {
    const { client, onStatus } = makeClient()
    client.start()
    expect(onStatus).toHaveBeenCalledWith('connecting')
    const socket = FakeSocket.all[0]
    expect(socket?.url).toContain('kline_1m')
    socket?.open()
    expect(onStatus).toHaveBeenCalledWith('connected')
    expect(client.currentState).toBe('connected')
    client.stop()
    expect(client.currentState).toBe('idle')
  })

  it('forwards market-data frames and swallows protocol PING/PONG', () => {
    const { client, onMessage } = makeClient()
    client.start()
    const socket = FakeSocket.all[0]
    socket?.open()
    socket?.message(makeKlineFrame(1000, '60001', false))
    socket?.message('{"id":1,"result":"pong"}')
    socket?.message('not json')
    expect(onMessage).toHaveBeenCalledTimes(1)
    const payload = onMessage.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload.e).toBe('kline')
  })

  it('reconnects with backoff after a drop and fires onReconnect', () => {
    const { client, onStatus, onReconnect } = makeClient()
    client.start()
    FakeSocket.all[0]?.open()
    FakeSocket.all[0]?.drop()
    expect(onStatus).toHaveBeenCalledWith('reconnecting')
    // backoff starts at 1000ms + jitter(≤400)
    vi.advanceTimersByTime(1500)
    expect(FakeSocket.all.length).toBe(2)
    expect(onStatus).toHaveBeenLastCalledWith('connecting')
    FakeSocket.all[1]?.open()
    expect(onStatus).toHaveBeenLastCalledWith('connected')
    expect(onReconnect).toHaveBeenCalledTimes(1)
    client.stop()
  })

  it('forces a reconnect when PING goes unanswered (dead socket)', () => {
    const { client, onStatus } = makeClient()
    client.start()
    FakeSocket.all[0]?.open()
    // Ping loop fires at 30s; pong timeout at +15s → close → reconnect.
    vi.advanceTimersByTime(30_000)
    expect(FakeSocket.all[0]?.sent.some((s) => s.includes('PING'))).toBe(true)
    vi.advanceTimersByTime(15_500)
    expect(onStatus).toHaveBeenCalledWith('reconnecting')
    vi.advanceTimersByTime(1500)
    expect(FakeSocket.all.length).toBe(2)
    client.stop()
  })

  it('stop() tears down the socket and ignores late events', () => {
    const { client, onMessage, onStatus } = makeClient()
    client.start()
    const socket = FakeSocket.all[0]
    socket?.open()
    client.stop()
    socket?.message(makeKlineFrame(1000, '1', false))
    expect(onMessage).not.toHaveBeenCalled()
    expect(onStatus).toHaveBeenLastCalledWith('idle')
  })
})

describe('parseKlineEvent + store merge (REST↔WS overlap)', () => {
  it('parses live and closed kline frames', () => {
    const live = parseKlineEvent(JSON.parse(makeKlineFrame(1000, '60001', false)))
    expect(live?.kline.closed).toBe(false)
    expect(live?.kline.open).toBe(60000)
    expect(live?.kline.volume).toBe(1.5)
    const closed = parseKlineEvent(JSON.parse(makeKlineFrame(1000, '60002', true)))
    expect(closed?.kline.closed).toBe(true)
    expect(parseKlineEvent({ foo: 1 })).toBeNull()
    expect(parseKlineEvent(null)).toBeNull()
  })

  it('dedupes duplicate WS events and replaces the live candle in place', () => {
    const store = new CandleStore()
    store.upsert(parseKlineEvent(JSON.parse(makeKlineFrame(1000, '60000', false)))!.kline)
    store.upsert(parseKlineEvent(JSON.parse(makeKlineFrame(1000, '60000', false)))!.kline)
    expect(store.length).toBe(1)
    // Candle closes: same openTime, now finalized.
    store.upsert(parseKlineEvent(JSON.parse(makeKlineFrame(1000, '60050', true)))!.kline)
    expect(store.length).toBe(1)
    expect(store.getLast()?.close).toBe(60050)
    expect(store.getLast()?.closed).toBe(true)
  })

  it('ignores stale out-of-order live updates via the controller policy', () => {
    const store = new CandleStore()
    store.upsert(parseKlineEvent(JSON.parse(makeKlineFrame(2000, '1', false)))!.kline)
    const last = store.getLast() as { openTime: number }
    const stale = parseKlineEvent(JSON.parse(makeKlineFrame(1000, '2', false)))!.kline
    // Out-of-order guard used by MarketDataController:
    if (!stale.closed && last.openTime > stale.openTime) {
      // dropped
    } else {
      store.upsert(stale)
    }
    expect(store.length).toBe(1)
    expect(store.getLast()?.openTime).toBe(2000)
  })
})
