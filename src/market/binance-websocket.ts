/**
 * BinanceWebSocketClient — one socket for one kline stream.
 *
 * Responsibilities:
 *  - connect with automatic exponential backoff + jitter reconnect,
 *  - app-level PING/PONG heartbeat with a watchdog that force-reconnects
 *    a socket that stopped answering (silent network drop),
 *  - surface connection state and forward parsed payloads.
 *
 * Protocol-level ping frames are answered by the browser automatically;
 * the JSON PING here is an extra liveness probe the app can time out.
 */
import type { ConnectionState } from '../types/market'
import { WS_MAX_BACKOFF_MS, WS_PING_INTERVAL_MS, WS_PONG_TIMEOUT_MS } from './config'

/** Structural subset of the browser WebSocket API (also satisfied by test doubles). */
export interface WebSocketLike {
  readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  onopen: ((event: unknown) => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onerror: ((event: unknown) => void) | null
  onclose: ((event: { code?: number; reason?: string }) => void) | null
}

/** Adapts the browser WebSocket to WebSocketLike. */
export class BrowserWebSocketAdapter implements WebSocketLike {
  private ws: WebSocket
  onopen: ((event: unknown) => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onclose: ((event: { code?: number; reason?: string }) => void) | null = null

  constructor(url: string) {
    this.ws = new WebSocket(url)
    this.ws.onopen = () => this.onopen?.(null)
    this.ws.onmessage = (ev) => this.onmessage?.({ data: ev.data })
    this.ws.onerror = () => this.onerror?.(null)
    this.ws.onclose = (ev) => this.onclose?.({ code: ev.code, reason: ev.reason })
  }

  get readyState(): number {
    return this.ws.readyState
  }

  send(data: string): void {
    this.ws.send(data)
  }

  close(code?: number, reason?: string): void {
    this.ws.close(code, reason)
  }
}

export type WebSocketFactory = (url: string) => WebSocketLike

export interface BinanceWebSocketOptions {
  url: string
  /** Test seam; defaults to the browser WebSocket. */
  socketFactory?: WebSocketFactory
  /** Every non-protocol payload (parsed JSON) is forwarded here. */
  onMessage: (payload: unknown) => void
  onStatus: (state: ConnectionState) => void
  /** Fired once after a connection that follows a previous one (re-sync hook). */
  onReconnect?: () => void
}

export class BinanceWebSocketClient {
  private socket: WebSocketLike | null = null
  private stopped = false
  private hadConnection = false
  private state: ConnectionState = 'idle'
  private backoff = 1_000
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private pongTimer: ReturnType<typeof setTimeout> | null = null
  private nextPingId = 1

  constructor(private readonly options: BinanceWebSocketOptions) {}

  get currentState(): ConnectionState {
    return this.state
  }

  start(): void {
    if (this.state === 'connecting' || this.state === 'connected') return
    this.stopped = false
    this.open()
  }

  stop(): void {
    this.stopped = true
    this.clearTimers()
    const ws = this.socket
    this.socket = null
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      try {
        ws.close(1000, 'client stop')
      } catch {
        // already closed
      }
    }
    this.setState('idle')
  }

  private open(): void {
    if (this.stopped) return
    this.setState('connecting')
    const factory = this.options.socketFactory ?? ((url: string) => new BrowserWebSocketAdapter(url))
    const ws = factory(this.options.url)
    this.socket = ws

    ws.onopen = () => {
      if (this.stopped || ws !== this.socket) return
      this.backoff = 1_000
      this.setState('connected')
      this.startPingLoop()
      if (this.hadConnection) this.options.onReconnect?.()
      this.hadConnection = true
    }

    ws.onmessage = (event) => {
      if (this.stopped || ws !== this.socket) return
      const payload = parsePayload(event.data)
      if (payload === null) return // ping/pong or unparseable — handled below
      this.options.onMessage(payload)
    }

    ws.onerror = () => {
      // The close event always follows an error; reconnect logic lives there.
    }

    ws.onclose = () => {
      if (this.stopped || ws !== this.socket) return
      this.teardownSocket()
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return
    this.setState('reconnecting')
    const delay = this.backoff + Math.floor(Math.random() * 400)
    this.backoff = Math.min(this.backoff * 2, WS_MAX_BACKOFF_MS)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.open()
    }, delay)
  }

  private startPingLoop(): void {
    this.clearPingTimers()
    this.pingTimer = setInterval(() => {
      const ws = this.socket
      if (!ws || this.stopped) return
      const id = this.nextPingId++
      try {
        ws.send(JSON.stringify({ method: 'PING', id }))
      } catch {
        this.forceClose()
        return
      }
      this.pongTimer = setTimeout(() => {
        // No PONG in time — the socket is not answering. Reconnect.
        this.forceClose()
      }, WS_PONG_TIMEOUT_MS)
    }, WS_PING_INTERVAL_MS)
  }

  private forceClose(): void {
    const ws = this.socket
    if (ws) {
      try {
        ws.close(4000, 'pong timeout')
      } catch {
        // ignore
      }
    }
  }

  private clearPingTimers(): void {
    if (this.pingTimer !== null) clearInterval(this.pingTimer)
    if (this.pongTimer !== null) clearTimeout(this.pongTimer)
    this.pingTimer = null
    this.pongTimer = null
  }

  private clearTimers(): void {
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.clearPingTimers()
  }

  private teardownSocket(): void {
    this.clearPingTimers()
    const ws = this.socket
    this.socket = null
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      try {
        ws.close(1000, 'teardown')
      } catch {
        // already closed
      }
    }
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return
    this.state = state
    this.options.onStatus(state)
  }
}

/**
 * Parse a WS frame. Returns null for protocol traffic (JSON PING/PONG
 * responses) so callers only ever see market-data payloads.
 */
function parsePayload(data: unknown): unknown {
  if (typeof data !== 'string') return null
  let obj: unknown
  try {
    obj = JSON.parse(data)
  } catch {
    return null
  }
  if (!isRecord(obj)) return null
  // A market-data frame always carries an event type `e`.
  if (typeof obj.e === 'string') return obj
  // Protocol responses (e.g. {"id":1,"result":"pong"}) — liveness only.
  return null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}
