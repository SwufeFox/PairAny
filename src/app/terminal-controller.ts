/**
 * TerminalController — the non-React orchestrator.
 *
 * Wires: ExchangeInfoStore → pair resolution → MarketDataController (REST+WS
 * per leg) → SyntheticPairEngine → IndicatorEngine → chart input snapshots.
 *
 * React renders chrome only. Market ticks flow through plain subscriptions:
 * store → refreshData() → indicator tail recompute → chart push. React is
 * notified only for human-frequency changes (pair, interval, indicators,
 * settings, connection status).
 */
import { MarketDataController } from '../market/market-data'
import { ExchangeInfoStore } from '../market/exchange-info'
import { SyntheticPairEngine } from '../synthetic/synthetic-pair-engine'
import type { SyntheticSeries } from '../synthetic/synthetic-pair-engine'
import { IndicatorEngine } from '../indicators/indicator-engine'
import { registerAllIndicators } from '../indicators/registry'
import type { CandleStore } from '../market/candle-store'
import { Emitter } from '../lib/events'
import { loadSettings, saveSettings } from '../settings/persistence'
import type { PairMode, PersistedSettings } from '../settings/persistence'
import { applyColorBlindMode } from '../settings/color-blind'
import type { ColorBlindMode } from '../settings/color-blind'
import type {
  ChartEngineInput,
  ChartPrefs,
  ChartStrings,
  CompareSeries,
  RenderedIndicator,
  SeriesSnapshot,
  VolumeMode,
} from '../types/chart'
import type { ConnectionStatus, KlineInterval } from '../types/market'
import type { IndicatorInstance } from '../types/indicators'
import { resolveLocale, STRINGS } from '../lib/i18n'
import type { LanguagePref, Locale } from '../lib/i18n'

export type PairErrorKey = 'sameAsset' | 'noDirect' | 'noCommonQuote' | 'notTradable'

export interface PairValidation {
  ok: boolean
  errorKey: PairErrorKey | null
  errorParams: Record<string, string>
  mode: 'direct' | 'synthetic'
  symbols: string[]
}

export interface LegStatus {
  symbol: string
  status: ConnectionStatus
}

const OK: PairValidation = { ok: true, errorKey: null, errorParams: {}, mode: 'synthetic', symbols: [] }

export class TerminalController {
  readonly market = new MarketDataController()
  readonly exchange = new ExchangeInfoStore()
  readonly indicators = new IndicatorEngine()

  private settings: PersistedSettings
  private syntheticEngine: SyntheticPairEngine | null = null
  private seriesMode: 'direct' | 'synthetic' = 'synthetic'
  private activeSymbols: string[] = []
  private storeUnsubs: Array<() => void> = []
  private volumeIndicatorUid: string | null = null
  private compareSymbolValue: string | null = null
  private compareStore: CandleStore | null = null
  private compareUnsub: (() => void) | null = null
  private structuralPending = true
  private chartEpoch = 0
  private snapshot: SeriesSnapshot | null = null
  private chartInput: ChartEngineInput | null = null
  private exchangeError: string | null = null
  private pairErrorKey: PairErrorKey | null = null
  private pairErrorParams: Record<string, string> = {}
  private initialized = false
  private initPromise: Promise<void> | null = null
  private reactEmitter = new Emitter<void>()
  private chartEmitter = new Emitter<void>()
  private reactVersionCounter = 0

  private notifyReact(): void {
    this.reactVersionCounter++
    this.reactEmitter.emit()
  }

  /** Monotonic counter for useSyncExternalStore. */
  getReactVersion(): number {
    return this.reactVersionCounter
  }

  constructor() {
    this.settings = loadSettings()
    applyColorBlindMode(this.settings.colorBlind)
    registerAllIndicators(this.indicators)
    // Connection transitions (not per-tick data) are React-visible.
    this.market.subscribeStatus('*', () => this.notifyReact())
    // Indicator instance changes (add/remove/update/params) are React-visible.
    this.indicators.subscribe(() => {
      this.pushChartInput()
      this.notifyReact()
    })
  }

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise
    this.initPromise = this.doInit().finally(() => {
      this.initPromise = null
    })
    return this.initPromise
  }

  private async doInit(): Promise<void> {
    if (this.initialized) return // idempotent under StrictMode double-mount
    this.exchangeError = null
    try {
      await this.exchange.load()
    } catch (err) {
      this.exchangeError = err instanceof Error ? err.message : 'Failed to load exchange info'
      this.notifyReact()
      return
    }
    // Restore indicators first so pair wiring's ensureVolumeIndicator finds them.
    this.restoreIndicators()
    // Persisted interval must drive the market layer (WS streams + REST).
    this.market.setInterval(this.settings.interval)
    this.applyStoredPair()
    if (this.settings.compareSymbol) this.setCompareSymbol(this.settings.compareSymbol)
    this.initialized = true
    this.notifyReact()
  }

  get isInitialized(): boolean {
    return this.initialized
  }

  get exchangeLoadError(): string | null {
    return this.exchangeError
  }

  retryExchange(): void {
    void this.init()
  }

  getPairError(): { key: PairErrorKey | null; params: Record<string, string> } {
    return { key: this.pairErrorKey, params: this.pairErrorParams }
  }

  // ---- subscriptions ----

  subscribe(fn: () => void): () => void {
    return this.reactEmitter.subscribe(fn)
  }

  /** High-frequency market-data changes; the chart canvas listens to this. */
  subscribeChart(fn: () => void): () => void {
    return this.chartEmitter.subscribe(fn)
  }

  getChartInput(): ChartEngineInput {
    if (!this.chartInput) {
      this.pushChartInput()
    }
    return this.chartInput as ChartEngineInput
  }

  /** Bumped on pair/interval switches; the canvas calls engine.fit() then. */
  getChartEpoch(): number {
    return this.chartEpoch
  }

  // ---- pair resolution ----

  /**
   * Common quotes for synthetic legs, by preference. Both legs must be quoted
   * in the SAME asset so the ratio A/B = (A/Q) / (B/Q) is consistent —
   * "统一两种资产". USDT first, then deep books (FDUSD/USDC), then BTC/ETH.
   */
  private static readonly COMMON_QUOTES = ['USDT', 'FDUSD', 'USDC', 'BTC', 'ETH', 'BNB', 'TRY', 'EUR', 'BRL'] as const

  /** Validate a base/quote/mode combination against live exchange info. */
  validatePair(base: string, quote: string, mode: PairMode): PairValidation {
    const b = base.toUpperCase()
    const q = quote.toUpperCase()
    if (b === q) return { ...OK, ok: false, errorKey: 'sameAsset', errorParams: {} }
    const direct = this.exchange.getDirectPair(b, q)

    if (mode === 'direct') {
      if (!direct) {
        return { ...OK, ok: false, errorKey: 'noDirect', errorParams: { pair: `${b}${q}` }, mode: 'direct' }
      }
      return { ...OK, ok: true, mode: 'direct', symbols: [direct] }
    }

    if (mode === 'synthetic') {
      if (q === 'USDT') {
        // Synthetic with a USDT leg is meaningless — it equals the direct pair.
        if (direct) return { ...OK, ok: true, mode: 'direct', symbols: [direct] }
        return { ...OK, ok: false, errorKey: 'notTradable', errorParams: { pair: `${b}${q}` }, mode: 'synthetic' }
      }
      const legs = this.commonQuoteLegs(b, q)
      if (!legs) {
        return { ...OK, ok: false, errorKey: 'noCommonQuote', errorParams: { base: b, quote: q }, mode: 'synthetic' }
      }
      return { ...OK, ok: true, mode: 'synthetic', symbols: legs }
    }

    // mode 'auto': prefer the real market when it exists.
    if (direct) return { ...OK, ok: true, mode: 'direct', symbols: [direct] }
    if (q === 'USDT') return { ...OK, ok: false, errorKey: 'notTradable', errorParams: { pair: `${b}${q}` }, mode: 'direct' }
    const legs = this.commonQuoteLegs(b, q)
    if (!legs) {
      return { ...OK, ok: false, errorKey: 'noCommonQuote', errorParams: { base: b, quote: q }, mode: 'synthetic' }
    }
    return { ...OK, ok: true, mode: 'synthetic', symbols: legs }
  }

  /**
   * Find the best common quote Q with tradable baseQ and quoteQ legs, and
   * return [baseQ, quoteQ]. The ratio A/B is then (A/Q) / (B/Q).
   */
  private commonQuoteLegs(base: string, quote: string): [string, string] | null {
    for (const c of TerminalController.COMMON_QUOTES) {
      if (this.exchange.hasPair(base, c) && this.exchange.hasPair(quote, c)) {
        return [`${base}${c}`, `${quote}${c}`]
      }
    }
    return null
  }

  setPair(base: string, quote: string, mode: PairMode): boolean {
    const v = this.validatePair(base, quote, mode)
    if (!v.ok) {
      this.pairErrorKey = v.errorKey
      this.pairErrorParams = v.errorParams
      this.notifyReact()
      return false
    }
    this.pairErrorKey = null
    this.pairErrorParams = {}
    const b = base.toUpperCase()
    const q = quote.toUpperCase()
    this.settings.pair = { base: b, quote: q, mode }
    this.pushRecent(`${b}/${q}`)
    this.save()
    this.wireSeries(v.mode, v.symbols)
    return true
  }

  private pushRecent(pair: string): void {
    const recents = this.settings.recentPairs.filter((p) => p !== pair)
    recents.unshift(pair)
    this.settings.recentPairs = recents.slice(0, 8)
  }

  setInterval(interval: KlineInterval): void {
    if (interval === this.settings.interval) return
    this.settings.interval = interval
    this.save()
    // Restart the market legs AND rebuild the series wiring: restartLeg
    // replaces each leg's CandleStore, so the synthetic engine / direct
    // subscription must be re-created against the NEW stores — otherwise the
    // chart keeps serving the previous interval's candles forever.
    this.market.setInterval(interval)
    this.wireSeries(this.seriesMode, this.activeSymbols)
    this.structuralPending = true
    this.chartEpoch++
    this.notifyReact()
    this.pushChartInput()
  }

  /** Quick switch: BTC/ETH ⇄ ETH/BTC ⇄ BTC/USDT ⇄ ETH/USDT. */
  switchTo(base: string, quote: string): boolean {
    return this.setPair(base, quote, 'auto')
  }

  // ---- chart settings ----

  get chartPrefs(): ChartPrefs {
    return {
      chartType: this.settings.chartType,
      logScale: this.settings.logScale,
      showGrid: this.settings.showGrid,
    }
  }

  setChartPrefs(patch: Partial<ChartPrefs>): void {
    this.settings = { ...this.settings, ...patch }
    this.save()
    this.notifyReact()
    this.pushChartInput()
  }

  setColorBlind(mode: ColorBlindMode): void {
    this.settings.colorBlind = mode
    applyColorBlindMode(mode)
    this.save()
    this.notifyReact()
  }

  getLocale(): Locale {
    return resolveLocale(this.settings.language, typeof navigator !== 'undefined' ? navigator.language : 'en')
  }

  get languagePref(): LanguagePref {
    return this.settings.language
  }

  setLanguage(pref: LanguagePref): void {
    this.settings.language = pref
    this.save()
    this.notifyReact()
    this.pushChartInput()
  }

  getRecentPairs(): string[] {
    return this.settings.recentPairs
  }

  setVolumeMode(mode: 'auto' | 'hidden'): void {
    this.settings.volumeMode = mode
    this.save()
    this.ensureVolumeIndicator()
    this.notifyReact()
    this.pushChartInput()
  }

  // ---- indicators ----

  listDefinitions() {
    return this.indicators.listDefinitions()
  }

  listInstances(): IndicatorInstance[] {
    return this.indicators.listInstances()
  }

  addIndicator(definitionId: string): IndicatorInstance | null {
    return this.indicators.add(definitionId)
  }

  removeIndicator(uid: string): void {
    if (uid === this.volumeIndicatorUid) this.volumeIndicatorUid = null
    this.indicators.remove(uid)
  }

  updateIndicator(uid: string, patch: Partial<Pick<IndicatorInstance, 'params' | 'visible' | 'placement'>>): void {
    const inst = this.indicators.listInstances().find((i) => i.uid === uid)
    if (!inst) return
    this.indicators.update({ ...inst, ...patch, params: { ...inst.params, ...patch.params } })
  }

  // ---- compare ----

  setCompareSymbol(symbol: string | null): void {
    if (this.compareUnsub) {
      this.compareUnsub()
      this.compareUnsub = null
    }
    this.compareSymbolValue = symbol
    this.settings.compareSymbol = symbol
    this.save()
    if (symbol) {
      this.market.attach(symbol)
      const store = this.market.getLeg(symbol)
      this.compareStore = store ?? null
      if (store) {
        this.compareUnsub = store.subscribe(() => this.pushChartInput())
      }
    } else {
      this.compareStore = null
    }
    this.notifyReact()
    this.pushChartInput()
  }

  get compareSymbol(): string | null {
    return this.compareSymbolValue
  }

  // ---- data access for React ----

  getStatuses(): LegStatus[] {
    return this.activeSymbols
      .map((symbol) => {
        const status = this.market.getStatus(symbol)
        return status ? { symbol, status } : null
      })
      .filter((s): s is LegStatus => s !== null)
  }

  getPairLabel(): string {
    const { base, quote } = this.settings.pair
    return `${base}/${quote}`
  }

  getSeriesMode(): 'direct' | 'synthetic' {
    return this.seriesMode
  }

  getInterval(): KlineInterval {
    return this.settings.interval
  }

  getSettings(): PersistedSettings {
    return this.settings
  }

  /** Leg closes at a candle openTime for the crosshair tooltip. */
  getLegClosesAt(openTime: number): Array<{ symbol: string; close: number | null }> {
    return this.activeSymbols.map((symbol) => {
      const c = this.market.getLeg(symbol)?.getByTime(openTime)
      return { symbol, close: c?.close ?? null }
    })
  }

  getLegLastClose(symbol: string): number | null {
    return this.market.getLeg(symbol)?.getLast()?.close ?? null
  }

  getVolumeMode(): VolumeMode {
    if (this.settings.volumeMode === 'hidden') return 'hidden'
    return this.seriesMode === 'synthetic' ? 'synthetic' : 'volume'
  }

  getSyncStats(): { aligned: number; missingA: number; missingB: number } {
    return this.snapshot?.syncStats ?? { aligned: 0, missingA: 0, missingB: 0 }
  }

  getRatioMode(): 'tick-accurate' | 'approximate' {
    return this.snapshot?.ratioMode ?? 'tick-accurate'
  }

  /** Load one older REST batch for every active leg (drag-to-history). */
  async loadMoreHistory(): Promise<void> {
    if (this.activeSymbols.length === 0) return
    this.structuralPending = true
    const results = await Promise.all(this.activeSymbols.map((s) => this.market.loadOlder(s)))
    // Merges may have fired refreshData mid-flight; make sure the final
    // state is structurally consistent (prepended indices shift everything).
    this.structuralPending = true
    this.refreshData()
    if (!results.some((r) => r)) {
      this.notifyReact()
    }
  }

  refreshLeg(symbol: string): void {
    this.market.refresh(symbol)
  }

  dispose(): void {
    for (const un of this.storeUnsubs) un()
    this.storeUnsubs = []
    this.compareUnsub?.()
    this.syntheticEngine?.dispose()
    this.syntheticEngine = null
    this.market.dispose()
    for (const inst of this.indicators.listInstances()) this.indicators.remove(inst.uid)
    this.volumeIndicatorUid = null
    this.initialized = false
  }

  // ---- internals ----

  private applyStoredPair(): void {
    const { base, quote, mode } = this.settings.pair
    this.setPair(base, quote, mode)
  }

  private restoreIndicators(): void {
    let volumeUid: string | null = null
    let sawVolume = false
    for (const saved of this.settings.indicators) {
      if (saved.definitionId === 'volume') {
        if (sawVolume) continue // never restore duplicate volume instances
        sawVolume = true
      }
      const inst = this.indicators.add(saved.definitionId, saved.params, saved.placement)
      if (inst && saved.definitionId === 'volume') volumeUid = inst.uid
      if (inst && !saved.visible) this.indicators.update({ ...inst, visible: false })
    }
    if (volumeUid) this.volumeIndicatorUid = volumeUid
    this.ensureVolumeIndicator()
  }

  private ensureVolumeIndicator(): void {
    const byUid = this.indicators.listInstances().find((i) => i.uid === this.volumeIndicatorUid)
    const volumeInst = byUid ?? this.indicators.listInstances().find((i) => i.definitionId === 'volume')
    const inst = volumeInst ?? this.indicators.add('volume')
    if (!inst) return
    this.volumeIndicatorUid = inst.uid
    const visible = this.settings.volumeMode !== 'hidden'
    if (inst.visible !== visible) {
      this.indicators.update({ ...inst, visible })
    }
  }

  private wireSeries(mode: 'direct' | 'synthetic', symbols: string[]): void {
    // Detach legs no longer used.
    for (const symbol of this.activeSymbols) {
      if (!symbols.includes(symbol)) this.market.detach(symbol)
    }
    for (const un of this.storeUnsubs) un()
    this.storeUnsubs = []
    this.syntheticEngine?.dispose()
    this.syntheticEngine = null

    this.seriesMode = mode
    this.activeSymbols = symbols
    for (const symbol of symbols) {
      // Attach only when the leg does not exist yet — interval switches
      // already restarted the legs with fresh stores.
      if (!this.market.getLeg(symbol)) this.market.attach(symbol)
    }

    if (mode === 'synthetic') {
      const a = this.market.getLeg(symbols[0] as string)
      const b = this.market.getLeg(symbols[1] as string)
      if (a && b) {
        const engine = new SyntheticPairEngine({ a, b })
        this.syntheticEngine = engine
        this.storeUnsubs.push(engine.subscribe(() => this.refreshData()))
      }
    } else {
      const store = this.market.getLeg(symbols[0] as string)
      if (store) this.storeUnsubs.push(store.subscribe(() => this.refreshData()))
    }

    // Keep the compare store aligned with the new interval.
    if (this.compareSymbolValue) {
      this.market.detach(this.compareSymbolValue)
      this.compareStore = null
      this.market.attach(this.compareSymbolValue)
      this.compareStore = this.market.getLeg(this.compareSymbolValue) ?? null
      if (this.compareStore && !this.compareUnsub) {
        this.compareUnsub = this.compareStore.subscribe(() => this.pushChartInput())
      }
    }

    this.structuralPending = true
    this.chartEpoch++
    this.ensureVolumeIndicator()
    this.refreshData()
    this.notifyReact()
  }

  private refreshData(): void {
    this.snapshot = this.buildSnapshot()
    this.indicators.setData(this.snapshot.candles, this.snapshot.version, this.structuralPending)
    this.structuralPending = false
    this.pushChartInput()
  }

  private buildSnapshot(): SeriesSnapshot {
    const first = this.activeSymbols[0]
    if (!first) {
      return {
        candles: [], version: 0, isSynthetic: false, volumeMode: 'volume', legs: [],
        ratioMode: 'tick-accurate', syncStats: { aligned: 0, missingA: 0, missingB: 0 },
        moreHistoryAvailable: true, oldestLoaded: null,
      }
    }
    if (this.seriesMode === 'direct') {
      const store = this.market.getLeg(first)
      if (!store) {
        return {
          candles: [], version: 0, isSynthetic: false, volumeMode: 'volume', legs: [],
          ratioMode: 'tick-accurate', syncStats: { aligned: 0, missingA: 0, missingB: 0 },
          moreHistoryAvailable: true, oldestLoaded: null,
        }
      }
      const candles = store.getCandles()
      const last = candles[candles.length - 1]
      return {
        candles,
        version: store.version,
        isSynthetic: false,
        volumeMode: this.getVolumeMode(),
        legs: [{ symbol: first, close: last?.close ?? null }],
        ratioMode: 'tick-accurate',
        syncStats: { aligned: candles.length, missingA: 0, missingB: 0 },
        moreHistoryAvailable: store.moreHistoryAvailable,
        oldestLoaded: candles[0]?.openTime ?? null,
      }
    }
    const series: SyntheticSeries = this.syntheticEngine
      ? this.syntheticEngine.getSeries()
      : { candles: [], version: 0, mode: 'approximate', stats: { aligned: 0, missingA: 0, missingB: 0 }, moreHistoryAvailable: true, oldestLoaded: null }
    const second = this.activeSymbols[1]
    const a = this.market.getLeg(first)?.getLast()
    const b = second ? this.market.getLeg(second)?.getLast() : undefined
    return {
      candles: series.candles,
      version: series.version,
      isSynthetic: true,
      volumeMode: this.getVolumeMode(),
      legs: [
        { symbol: first, close: a?.close ?? null },
        { symbol: second ?? '', close: b?.close ?? null },
      ],
      ratioMode: series.mode,
      syncStats: series.stats,
      moreHistoryAvailable: series.moreHistoryAvailable,
      oldestLoaded: series.oldestLoaded,
    }
  }

  private buildCompareSeries(): CompareSeries | null {
    if (!this.compareSymbolValue || !this.compareStore) return null
    const compareCandles = this.compareStore.getCandles()
    if (compareCandles.length === 0) return null
    const map = new Map<number, number>()
    for (const c of compareCandles) map.set(c.openTime, c.close)
    const candles = this.snapshot?.candles ?? []
    const values = new Float64Array(candles.length).fill(NaN)
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i]
      if (!c) continue
      const v = map.get(c.openTime)
      if (v !== undefined) values[i] = v
    }
    return { label: this.compareSymbolValue, values, colorIndex: 7 }
  }

  private getRenderedIndicators(): RenderedIndicator[] {
    const t = STRINGS[this.getLocale()]
    const list = this.indicators.getRendered()
    for (const ind of list) {
      const localized = t.indicators[ind.definitionId]
      if (ind.uid === this.volumeIndicatorUid) {
        ind.label = this.getVolumeMode() === 'synthetic' ? t.tooltip.syntheticVolume : localized ?? 'Volume'
      } else if (localized) {
        ind.label = localized
      }
    }
    return list
  }

  private chartStrings(): ChartStrings {
    const t = STRINGS[this.getLocale()]
    return {
      headerO: t.canvas.o,
      headerH: t.canvas.h,
      headerL: t.canvas.l,
      headerC: t.canvas.c,
      loading: t.canvas.loading,
      paneVolume: t.indicators.volume ?? 'Volume',
      paneSyntheticVolume: t.tooltip.syntheticVolume,
    }
  }

  private pushChartInput(): void {
    this.chartInput = {
      data: this.snapshot ?? this.buildSnapshot(),
      indicators: this.getRenderedIndicators(),
      compare: this.buildCompareSeries(),
      prefs: this.chartPrefs,
      interval: this.settings.interval,
      i18n: this.chartStrings(),
    }
    this.chartEmitter.emit()
  }

  private save(): void {
    const s = this.settings
    saveSettings({
      ...s,
      indicators: this.indicators.listInstances().map((i) => ({
        definitionId: i.definitionId,
        params: i.params,
        visible: i.visible,
        placement: i.placement,
      })),
    })
  }
}
