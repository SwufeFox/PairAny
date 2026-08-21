/**
 * ChartEngine — canvas renderer + interaction for the terminal.
 *
 * Owns: the viewport (pan/zoom), pane layout, price/time scales, crosshair
 * state, and all drawing. Market data never touches React: the app pushes a
 * ChartEngineInput (series snapshot + computed indicators + prefs) and the
 * engine redraws on its own rAF loop. Panning left to the history edge emits
 * onNeedHistory so the app can fetch older candles.
 */
import type {
  ChartEngineInput,
  ChartThemeTokens,
  CompareSeries,
  CrosshairSnapshot,
  Drawing,
  DrawingTool,
  RenderedIndicator,
} from '../types/chart'
import type { Candle } from '../types/market'
import { clampIndex, clampView, paneAt } from './crosshair'
import type { CrosshairState, PaneRect } from './crosshair'
import { logTicks, niceTicks, PriceScale, timeTickStep } from './scale'
import { readChartTokens } from './theme-tokens'
import { drawCandleBody, drawOhlcBar, strokePath, traceArea, traceLine, traceVolumeBars } from './drawings'
import { formatAxisTime, formatChange, formatCompact, formatPercent, formatPrice } from '../lib/format'

export interface ChartEngineCallbacks {
  /** Emitted when the hovered candle changes; null when the pointer leaves. */
  onCrosshair: (snapshot: CrosshairSnapshot | null) => void
  /** User panned/zoomed to the oldest loaded candle. */
  onNeedHistory: () => void
}

const RIGHT_AXIS_W = 78
const TIME_AXIS_H = 22
const PAD_TOP = 8
const PAD_BOTTOM = 6
const SUB_PANE_H = 112
const VOL_PANE_H = 88
const HEADER_H = 18
const MIN_MAIN_H = 140

interface Pane extends PaneRect {
  kind: 'main' | 'indicator'
  indicator: RenderedIndicator | null
  scale: PriceScale
  domain: { lo: number; hi: number }
}

export class ChartEngine {
  private ctx: CanvasRenderingContext2D
  private input: ChartEngineInput | null = null
  private width = 0
  private height = 0
  private view = { start: 0, count: 120 }
  private followLatest = true
  private panning = false
  private panStartX = 0
  private panStartY = 0
  private panStartView = 0
  /** 'x' | 'y' | null — locked once the dominant axis wins (4px dead-zone). */
  private panAxis: 'x' | 'y' | null = null
  /** Vertical price-pan state (drag on the plot pans the price scale). */
  private priceDrag: { startY: number; lo: number; hi: number; span: number; paneH: number } | null = null
  private crosshair: CrosshairState | null = null
  private renderPending = false
  private historyRequested = false
  private lastVersion = -1
  private disposed = false
  private lastCrosshair: CrosshairSnapshot | null = null
  private drawingTool: DrawingTool | null = null
  private drawings: Drawing[] = []
  private activeDrawing: Drawing | null = null
  private nextDrawingId = 1
  /** Cached per-pane scales so handlers read the rendered domain. */
  private paneScales = new Map<string, PriceScale>()
  /** Manual price-range overrides per pane (right-axis drag/wheel). */
  private priceOverrides = new Map<string, { lo: number; hi: number }>()
  private pricePanning: { paneId: string; startY: number; lo: number; hi: number; span: number } | null = null
  /** Cached from the latest input — drawing anchors map time↔index with it. */
  private intervalMs = 60_000

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly callbacks: ChartEngineCallbacks,
  ) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    this.ctx = ctx
    this.attachEvents()
  }

  setInput(input: ChartEngineInput): void {
    const versionChanged = input.data.version !== this.lastVersion
    this.lastVersion = input.data.version
    if (versionChanged) this.historyRequested = false
    this.intervalMs = input.intervalMs
    const prevLen = this.input?.data.candles.length ?? 0
    const len = input.data.candles.length
    this.input = input
    if (versionChanged && this.followLatest && len > prevLen && len > 0) {
      this.view.start = Math.max(0, len - this.view.count)
    }
    if (len > 0) this.view = clampView(this.view.start, this.view.count, len)
    this.requestRender()
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.applyBackingStore()
    this.requestRender()
  }

  /**
   * Size the backing store and set the transform so CSS-pixel drawing maps
   * 1:1 to the raster grid: the transform is derived from the ACTUAL backing
   * ratio (canvas.width / css width), never from window.devicePixelRatio
   * directly — that is what keeps the pointer and the canvas in the same
   * proportion at any display scale (125%/150%/200%…).
   *
   * The CSS size is pinned via inline style: on an absolutely-positioned
   * `inset-0` element the `width`/`height` ATTRIBUTES act as CSS width
   * (over-constrained → `right:0` is dropped), which would inflate the
   * element to `backingWidth` px and skew every pointer coordinate.
   */
  private applyBackingStore(): void {
    const target = Math.min(3, window.devicePixelRatio || 1)
    this.canvas.width = Math.max(1, Math.round(this.width * target))
    this.canvas.height = Math.max(1, Math.round(this.height * target))
    this.canvas.style.width = `${this.width}px`
    this.canvas.style.height = `${this.height}px`
    const ratioX = this.width > 0 ? this.canvas.width / this.width : target
    const ratioY = this.height > 0 ? this.canvas.height / this.height : target
    this.ctx.setTransform(ratioX, 0, 0, ratioY, 0, 0)
  }

  fit(): void {
    const len = this.input?.data.candles.length ?? 0
    if (len > 0) this.setView({ start: 0, count: len })
    // Fit Content = reset both axes to auto.
    this.priceOverrides.clear()
  }

  home(): void {
    const len = this.input?.data.candles.length ?? 0
    if (len > 0) {
      this.followLatest = true
      this.setView({ start: Math.max(0, len - this.view.count), count: this.view.count })
    }
  }

  zoomBy(factor: number): void {
    this.setView({ start: this.view.start, count: this.view.count * factor })
  }

  panBy(deltaCandles: number): void {
    this.setView({ start: this.view.start + deltaCandles, count: this.view.count })
  }

  get visibleCount(): number {
    return this.view.count
  }

  setDrawingTool(tool: DrawingTool | null): void {
    this.drawingTool = tool
    if (!tool) this.activeDrawing = null
    this.requestRender()
  }

  get activeDrawingTool(): DrawingTool | null {
    return this.drawingTool
  }

  clearDrawings(): void {
    this.drawings = []
    this.activeDrawing = null
    this.requestRender()
  }

  /** Drop manual price-scale overrides (pair/interval switch, reset). */
  clearPriceOverrides(): void {
    this.priceOverrides.clear()
    this.pricePanning = null
  }

  getDrawingCount(): number {
    return this.drawings.length
  }

  requestRender(): void {
    if (this.renderPending || this.disposed) return
    this.renderPending = true
    requestAnimationFrame(() => {
      this.renderPending = false
      if (this.disposed) return
      this.draw()
    })
  }

  destroy(): void {
    this.disposed = true
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.removeEventListener('dblclick', this.onDblClick)
  }

  // ---- view management ----

  private setView(v: { start: number; count: number }): void {
    const len = this.input?.data.candles.length ?? 0
    this.view = clampView(v.start, v.count, len)
    this.followLatest = this.view.start + this.view.count >= len - 1
    this.checkHistoryEdge()
    this.requestRender()
  }

  private checkHistoryEdge(): void {
    const input = this.input
    if (!input) return
    if (this.view.start <= 0.5 && input.data.moreHistoryAvailable && !this.historyRequested) {
      this.historyRequested = true
      this.callbacks.onNeedHistory()
    }
  }

  // ---- events ----

  /** Pointer position in canvas CSS pixels — derived from clientX/Y and the
   * element rect, never from offsetX, so it stays exact at any DPR. */
  private localPoint(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return
    const pt = this.localPoint(e)
    // Drag on the right price axis pans that pane's price scale manually.
    if (pt.x > this.width - RIGHT_AXIS_W) {
      const input = this.input
      if (input) {
        const pane = paneAt(pt.y, this.computeLayout(input).panes)
        if (pane) {
          const p = pane as Pane
          this.pricePanning = { paneId: pane.id, startY: pt.y, lo: p.scale.lo, hi: p.scale.hi, span: p.scale.hi - p.scale.lo }
          this.canvas.setPointerCapture(e.pointerId)
          return
        }
      }
    }
    if (this.drawingTool) {
      const anchor = this.anchorAt(pt.x, pt.y)
      if (anchor) {
        this.activeDrawing = { id: 0, type: this.drawingTool, t1: anchor.t, p1: anchor.p, t2: anchor.t, p2: anchor.p }
        this.canvas.setPointerCapture(e.pointerId)
      }
      return
    }
    this.panning = true
    this.panStartX = pt.x
    this.panStartY = pt.y
    this.panStartView = this.view.start
    this.panAxis = null
    // Vertical drag pans the main pane's price scale (like the right axis).
    const input = this.input
    if (input && pt.x <= this.width - RIGHT_AXIS_W) {
      const main = this.computeLayout(input).panes[0]
      if (main) {
        const p = main as Pane
        this.priceDrag = { startY: pt.y, lo: p.scale.lo, hi: p.scale.hi, span: p.scale.hi - p.scale.lo, paneH: Math.max(1, p.height - 8) }
      }
    }
    this.canvas.setPointerCapture(e.pointerId)
  }

  private onPointerMove = (e: PointerEvent): void => {
    const input = this.input
    if (!input) return
    const len = input.data.candles.length
    const pt = this.localPoint(e)
    if (this.activeDrawing) {
      const anchor = this.anchorAt(pt.x, pt.y)
      if (anchor && this.activeDrawing) {
        this.activeDrawing = { ...this.activeDrawing, t2: anchor.t, p2: anchor.p }
        this.requestRender()
      }
      return
    }
    if (this.pricePanning) {
      const pp = this.pricePanning
      const dy = pt.y - pp.startY
      const shift = (dy / Math.max(1, this.height - TIME_AXIS_H)) * pp.span
      this.priceOverrides.set(pp.paneId, { lo: pp.lo + shift, hi: pp.hi + shift })
      this.requestRender()
      return
    }
    if (this.panning) {
      const dx = pt.x - this.panStartX
      const dy = pt.y - this.panStartY
      if (this.panAxis === null) {
        // Lock the axis once the gesture clearly moves one way; until then
        // do nothing so a horizontal pan never disturbs the price scale.
        if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) + 4) this.panAxis = 'x'
        else if (Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx) + 4) this.panAxis = 'y'
      }
      if (this.panAxis === 'x') {
        const count = this.view.count
        const plotW = this.plotWidth()
        const delta = (-dx / Math.max(1, plotW)) * count
        this.setView({ start: this.panStartView + delta, count })
      } else if (this.panAxis === 'y') {
        // Content follows the cursor: dragging down shifts the domain up so
        // the same prices move down on screen.
        const pd = this.priceDrag
        if (pd && pd.span > 0) {
          const shift = ((pt.y - pd.startY) / pd.paneH) * pd.span
          this.priceOverrides.set('main', { lo: pd.lo + shift, hi: pd.hi + shift })
          this.requestRender()
        }
      }
      return
    }
    // Crosshair (the right price-axis strip is excluded)
    const plotRightEdge = this.width - RIGHT_AXIS_W
    if (pt.x <= plotRightEdge) {
      const layout = this.computeLayout(input)
      const paneRect = paneAt(pt.y, layout.panes)
      const plotLeft = layout.left
      const plotW = this.plotWidth()
      const idx = clampIndex((pt.x - plotLeft) / Math.max(1, plotW) * this.view.count + this.view.start, len)
      const candle = len > 0 ? input.data.candles[idx] : undefined
      const slotW = this.view.count > 0 ? plotW / this.view.count : 0
      const candleX = len > 0 ? plotLeft + (idx - this.view.start) * slotW + slotW / 2 : null
      let price: number | null = null
      let paneId = 'main'
      if (paneRect && len > 0) {
        paneId = paneRect.id
        price = (paneRect as Pane).scale.valueAt(pt.y)
      }
      this.crosshair = { x: pt.x, y: pt.y, index: idx, paneId, price }
      const snapshot: CrosshairSnapshot = {
        index: idx,
        candle: candle ?? null,
        hoverPrice: price,
        x: pt.x,
        y: pt.y,
        paneId,
        candleX,
        slotW,
      }
      this.lastCrosshair = snapshot
      this.callbacks.onCrosshair(snapshot)
    }
    this.requestRender()
  }

  private onPointerUp = (e: PointerEvent): void => {
    if (this.activeDrawing) {
      const d = this.activeDrawing
      // Commit only when the gesture has real extent.
      const moved = Math.abs(d.t2 - d.t1) > 1 || Math.abs(d.p2 - d.p1) > 0
      if (moved) {
        this.drawings.push({ ...d, id: this.nextDrawingId++ })
      }
      this.activeDrawing = null
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId)
      this.requestRender()
      return
    }
    if (this.pricePanning) {
      this.pricePanning = null
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId)
      return
    }
    this.panning = false
    this.panAxis = null
    this.priceDrag = null
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId)
  }

  private onPointerLeave = (): void => {
    this.crosshair = null
    this.lastCrosshair = null
    this.callbacks.onCrosshair(null)
    this.requestRender()
  }

  /** Last hovered candle (used by Copy Price / context menu). */
  getLastCrosshair(): CrosshairSnapshot | null {
    return this.lastCrosshair
  }

  /** Reset view to fit, drop the crosshair and manual scales (Reset Chart). */
  resetChart(): void {
    this.crosshair = null
    this.lastCrosshair = null
    this.callbacks.onCrosshair(null)
    this.clearPriceOverrides()
    this.fit()
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    const input = this.input
    if (!input || input.data.candles.length === 0) return
    const pt = this.localPoint(e)
    const layout = this.computeLayout(input)
    // Wheel over the right price axis zooms that pane's price scale instead
    // of the time axis.
    if (pt.x > this.width - RIGHT_AXIS_W) {
      const pane = paneAt(pt.y, layout.panes)
      if (pane) {
        const p = pane as Pane
        const factor = Math.exp(e.deltaY * 0.002)
        const y = pt.y
        const lo = p.scale.lo
        const hi = p.scale.hi
        const v = p.scale.valueAt(y)
        const newLo = v + (lo - v) * factor
        const newHi = v + (hi - v) * factor
        this.priceOverrides.set(pane.id, { lo: newLo, hi: newHi })
        this.requestRender()
      }
      return
    }
    const factor = Math.exp(e.deltaY * 0.0016)
    const newCount = Math.min(Math.max(8, this.view.count * factor), input.data.candles.length)
    const plotW = this.plotWidth()
    const plotLeft = layout.left
    const anchorFrac = (pt.x - plotLeft) / Math.max(1, plotW)
    const anchorIndex = this.view.start + anchorFrac * this.view.count
    const newStart = anchorIndex - anchorFrac * newCount
    this.setView({ start: newStart, count: newCount })
  }

  private onDblClick = (e: MouseEvent): void => {
    const pt = this.localPoint(e)
    // Double-click on the price axis resets its manual scale.
    if (pt.x > this.width - RIGHT_AXIS_W) {
      const input = this.input
      if (input) {
        const pane = paneAt(pt.y, this.computeLayout(input).panes)
        if (pane && this.priceOverrides.delete(pane.id)) {
          this.requestRender()
          return
        }
      }
    }
    // Double-click on the plot resets a manually panned price scale too.
    this.priceOverrides.delete('main')
    this.fit()
  }

  private plotWidth(): number {
    // Fixed margins: 6px left, RIGHT_AXIS_W right.
    return Math.max(1, this.width - 6 - RIGHT_AXIS_W)
  }

  /** Pixel → (openTime, price) anchor in the main pane (drawing tools).
   * Time is interpolated off the view so off-grid clicks stay stable. */
  private anchorAt(x: number, y: number): { t: number; p: number } | null {
    const input = this.input
    if (!input || input.data.candles.length === 0) return null
    const layout = this.computeLayout(input)
    const main = layout.panes[0]
    if (!main || y < main.top || y > main.top + main.height) return null
    const vStart = Math.max(0, Math.floor(this.view.start) - 2)
    const vEnd = Math.min(input.data.candles.length, Math.ceil(this.view.start + this.view.count) + 2)
    this.computeMainDomain(input, main, vStart, vEnd)
    main.scale.setDomain(main.domain.lo, main.domain.hi, main.top + 4, main.top + main.height - 4)
    main.scale.logMode = input.prefs.logScale
    const plotW = this.plotWidth()
    const idxF = ((x - layout.left) / Math.max(1, plotW)) * this.view.count + this.view.start
    // Index → openTime via the interval grid; clamp to loaded range so a
    // click past the newest candle still lands on the last candle's grid.
    const len = input.data.candles.length
    const step = input.intervalMs
    const clampedI = Math.max(0, Math.min(len - 1, idxF))
    const baseT = input.data.candles[Math.round(clampedI)]?.openTime
    const t = baseT !== undefined ? baseT + (idxF - Math.round(clampedI)) * step : 0
    return { t, p: main.scale.valueAt(y) }
  }

  // ---- layout ----

  private computeLayout(input: ChartEngineInput): { left: number; top: number; bottom: number; right: number; panes: Pane[] } {
    const panes: Pane[] = []
    const indicators = input.indicators
    const fixedH = indicators.filter((ind) => ind.placement === 'pane').length * SUB_PANE_H
    const volumeCount = indicators.filter((ind) => ind.kind === 'bars').length
    const volumeH = volumeCount * VOL_PANE_H
    const axisH = TIME_AXIS_H + PAD_BOTTOM
    const mainH = Math.max(MIN_MAIN_H, this.height - axisH - HEADER_H - fixedH - volumeH - PAD_TOP)
    let top = HEADER_H + PAD_TOP
    // Scales are cached per pane id so their rendered domain (lo/hi) is
    // readable by pointer/wheel handlers between frames.
    const scaleFor = (id: string): PriceScale => {
      let s = this.paneScales.get(id)
      if (!s) {
        s = new PriceScale()
        this.paneScales.set(id, s)
      }
      return s
    }

    panes.push({
      id: 'main',
      kind: 'main',
      top,
      height: mainH,
      indicator: null,
      scale: scaleFor('main'),
      domain: { lo: 0, hi: 1 },
    })
    top += mainH

    for (const ind of indicators) {
      if (ind.placement !== 'pane') continue
      const h = ind.kind === 'bars' ? VOL_PANE_H : SUB_PANE_H
      // If space ran out, sub-panes share what is left.
      const available = this.height - axisH - top
      const height = Math.max(40, Math.min(h, available))
      const id = `ind:${ind.uid}`
      panes.push({
        id,
        kind: 'indicator',
        top,
        height,
        indicator: ind,
        scale: scaleFor(id),
        domain: { lo: 0, hi: 1 },
      })
      top += height
    }
    return { left: 6, top: 0, bottom: axisH, right: RIGHT_AXIS_W, panes }
  }

  // ---- drawing ----

  private draw(): void {
    const input = this.input
    if (!input) return
    const ctx = this.ctx
    const tokens = readChartTokens()
    const candles = input.data.candles
    const len = candles.length
    const layout = this.computeLayout(input)
    const plotLeft = layout.left
    const plotRight = this.width - layout.right
    const plotW = plotRight - plotLeft
    const axisTop = this.height - layout.bottom

    ctx.fillStyle = tokens.background
    ctx.fillRect(0, 0, this.width, this.height)

    if (len === 0) {
      this.drawPlaceholder(ctx, tokens, input.i18n.loading, plotLeft, plotRight, HEADER_H + PAD_TOP, axisTop)
      return
    }

    const start = this.view.start
    const count = this.view.count
    const slotW = plotW / count
    const vStart = Math.max(0, Math.floor(start) - 2)
    const vEnd = Math.min(len, Math.ceil(start + count) + 2)

    // Per-pane price domains
    const mainPane = layout.panes[0]
    if (!mainPane) return
    this.computeMainDomain(input, mainPane, vStart, vEnd)
    for (const pane of layout.panes) {
      if (pane.kind === 'indicator' && pane.indicator) {
        this.computeIndicatorDomain(pane.indicator, vStart, vEnd, pane)
      }
    }

    // Time ticks
    const rawTickStep = 96 / Math.max(1, slotW)
    const tickStep = timeTickStep(rawTickStep)
    const firstTick = Math.ceil(start / tickStep) * tickStep

    // Grid
    ctx.strokeStyle = tokens.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let t = firstTick; t < start + count; t += tickStep) {
      const x = plotLeft + (t - start) * slotW + slotW / 2
      ctx.moveTo(x, HEADER_H + PAD_TOP)
      ctx.lineTo(x, axisTop)
    }
    ctx.stroke()

    for (const pane of layout.panes) {
      const pTop = pane.top
      const pBottom = pane.top + pane.height
      const manual = this.priceOverrides.get(pane.id)
      if (manual && manual.hi > manual.lo) {
        pane.domain = { lo: manual.lo, hi: manual.hi }
      }
      pane.scale.setDomain(pane.domain.lo, pane.domain.hi, pTop + 4, pBottom - 4)
      pane.scale.logMode = pane.kind === 'main' && input.prefs.logScale

      // horizontal grid
      const ticks = pane.scale.logMode ? logTicks(pane.domain.lo, pane.domain.hi) : niceTicks(pane.domain.lo, pane.domain.hi, 5)
      ctx.strokeStyle = tokens.grid
      ctx.beginPath()
      for (const t of ticks) {
        const y = pane.scale.yFor(t)
        ctx.moveTo(plotLeft, y)
        ctx.lineTo(plotRight, y)
      }
      ctx.stroke()

      if (pane.kind === 'main') {
        this.drawMainPane(input, pane, ctx, tokens, plotLeft, slotW, vStart, vEnd, start)
      } else if (pane.indicator) {
        this.drawIndicatorPane(input, pane, ctx, tokens, plotLeft, slotW, vEnd, start)
      }

      // pane separator
      ctx.strokeStyle = tokens.border
      ctx.beginPath()
      ctx.moveTo(0, pBottom - 0.5)
      ctx.lineTo(this.width, pBottom - 0.5)
      ctx.stroke()
    }

    // Time axis labels
    ctx.fillStyle = tokens.axisText
    ctx.font = `10px ${tokens.fontMono}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let t = firstTick; t < start + count; t += tickStep) {
      const i = Math.floor(t)
      const c = candles[i]
      if (!c) continue
      const x = plotLeft + (t - start) * slotW + slotW / 2
      ctx.fillText(formatAxisTime(c.openTime, input.interval), x, axisTop + 5)
    }

    // Price axis labels per pane
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = `12px ${tokens.fontMono}`
    for (const pane of layout.panes) {
      const ticks = pane.scale.logMode ? logTicks(pane.domain.lo, pane.domain.hi) : niceTicks(pane.domain.lo, pane.domain.hi, 8)
      for (const t of ticks) {
        const y = pane.scale.yFor(t)
        ctx.fillText(formatPrice(t, pane.kind === 'main' ? 6 : 5), plotRight + 6, y)
      }
    }

    this.drawCrosshair(input, ctx, tokens, layout, plotLeft, plotRight, axisTop)
  }

  private drawMainPane(
    input: ChartEngineInput,
    pane: Pane,
    ctx: CanvasRenderingContext2D,
    tokens: ChartThemeTokens,
    plotLeft: number,
    slotW: number,
    vStart: number,
    vEnd: number,
    start: number,
  ): void {
    const candles = input.data.candles
    const scale = pane.scale
    const xFor = (i: number): number => plotLeft + (i - start) * slotW + slotW / 2
    const yFor = (v: number): number => scale.yFor(v)
    const plotRight = this.width - RIGHT_AXIS_W
    const colors = { up: tokens.up, down: tokens.down, background: tokens.background }
    const type = input.prefs.chartType
    const bodyW = Math.max(1, Math.min(slotW * 0.72, 14))

    // Draw visible candles (culled to the viewport)
    const i0 = vStart
    const i1 = Math.min(vEnd, candles.length)
    if (type === 'line' || type === 'area') {
      const values = closeSeries(candles, i0, i1)
      ctx.beginPath()
      if (type === 'area') {
        const ok = traceArea(ctx, values, 0, i1 - i0, (k) => xFor(i0 + k), yFor, pane.top + pane.height - 4)
        if (ok) {
          ctx.globalAlpha = 0.12
          ctx.fillStyle = tokens.up
          ctx.fill()
          ctx.globalAlpha = 1
        }
        ctx.beginPath()
        traceLine(ctx, values, 0, i1 - i0, (k) => xFor(i0 + k), yFor)
        strokePath(ctx, tokens.up, 1.5)
      } else {
        if (traceLine(ctx, values, 0, i1 - i0, (k) => xFor(i0 + k), yFor)) {
          strokePath(ctx, tokens.up, 1.5)
        }
      }
    } else {
      for (let i = i0; i < i1; i++) {
        const c = candles[i]
        if (!c) continue
        const x = xFor(i)
        const yO = yFor(c.open)
        const yC = yFor(c.close)
        const yH = yFor(c.high)
        const yL = yFor(c.low)
        if (type === 'ohlc') {
          drawOhlcBar(ctx, x, yO, yC, yH, yL, Math.max(1, slotW * 0.25), c.close >= c.open ? tokens.up : tokens.down)
        } else {
          drawCandleBody(ctx, x, yO, yC, yH, yL, bodyW, colors, type === 'hollow')
        }
      }
    }

    // Overlay indicators
    for (const ind of input.indicators) {
      if (ind.placement !== 'overlay') continue
      this.drawOverlayIndicator(ind, ctx, tokens, start, xFor, scale, vEnd)
    }

    // Compare series (% normalized)
    if (input.compare) {
      this.drawCompare(input.compare, candles, ctx, tokens, plotLeft, slotW, start, vStart, vEnd, pane)
    }

    // Current price line (latest close) + right-axis pill
    const latest = candles[candles.length - 1]
    if (latest) {
      const prevCandle = candles[candles.length - 2]
      const priceColor = prevCandle && latest.close >= prevCandle.close ? tokens.up : tokens.down
      const y = scale.yFor(latest.close)
      const px = Math.min(xFor(candles.length - 1), plotRight)
      ctx.save()
      ctx.globalAlpha = 0.85
      ctx.strokeStyle = priceColor
      ctx.lineWidth = 1
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(plotLeft, y)
      ctx.lineTo(px, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
      // Price pill on the right axis
      const label = formatPrice(latest.close, 6)
      ctx.font = `10px ${tokens.fontMono}`
      const w = ctx.measureText(label).width + 10
      ctx.fillStyle = tokens.backgroundInverse
      ctx.fillRect(plotRight + 1, y - 8, w, 16)
      ctx.fillStyle = priceColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, plotRight + 1 + w / 2, y + 0.5)
    }

    // User drawings
    for (const d of this.drawings) {
      this.drawDrawing(d, ctx, tokens, xFor, scale, plotLeft, plotRight)
    }
    if (this.activeDrawing) {
      this.drawDrawing(this.activeDrawing, ctx, tokens, xFor, scale, plotLeft, plotRight)
    }

    // Main header: colored OHLC readout of the last visible candle
    const lastVisible = candles[Math.min(vEnd, candles.length) - 1]
    if (lastVisible) {
      const i18n = input.i18n
      ctx.font = `12px ${tokens.fontMono}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      const change = lastVisible.close - lastVisible.open
      const pct = lastVisible.open !== 0 ? (change / lastVisible.open) * 100 : 0
      const dirColor = change >= 0 ? tokens.up : tokens.down
      let cx = plotLeft + 2
      const seg = (label: string, value: string, color: string): void => {
        ctx.fillStyle = tokens.axisText
        ctx.fillText(label, cx, 3)
        cx += ctx.measureText(label).width + 5
        ctx.fillStyle = color
        ctx.fillText(value, cx, 3)
        cx += ctx.measureText(value).width + 14
      }
      seg(`${i18n.headerO} `, formatPrice(lastVisible.open), tokens.axisText)
      seg(`${i18n.headerH} `, formatPrice(lastVisible.high), tokens.axisText)
      seg(`${i18n.headerL} `, formatPrice(lastVisible.low), tokens.axisText)
      seg(`${i18n.headerC} `, formatPrice(lastVisible.close), tokens.foregroundInverse)
      // restore axisText for the change prefix, then colored change/pct
      ctx.fillStyle = dirColor
      ctx.fillText(`${formatChange(change)}  ${formatPercent(pct)}`, cx, 3)
    }
  }

  private drawOverlayIndicator(
    ind: RenderedIndicator,
    ctx: CanvasRenderingContext2D,
    tokens: ChartThemeTokens,
    start: number,
    xFor: (i: number) => number,
    scale: PriceScale,
    vEnd: number,
  ): void {
    const meta = ind.outputMeta
    for (let k = 0; k < ind.outputs.length; k++) {
      const out = ind.outputs[k]
      if (!out) continue
      const m = meta[k]
      if (!m) continue
      const color = this.outputColor(m, ind, tokens)
      // Cloud fill between senkouA and senkouB
      if (m.cloudWith) {
        const otherIdx = meta.findIndex((o) => o.id === m.cloudWith)
        const other = otherIdx >= 0 ? ind.outputs[otherIdx] : undefined
        if (other) {
          ctx.beginPath()
          const okA = traceLine(ctx, out, Math.floor(start), Math.ceil(vEnd) - Math.floor(start), xFor, (v) => scale.yFor(v))
          const okB = other && traceLine(ctx, other, Math.floor(start), Math.ceil(vEnd) - Math.floor(start), xFor, (v) => scale.yFor(v))
          if (okA && okB) {
            ctx.closePath()
            ctx.globalAlpha = 0.1
            ctx.fillStyle = color
            ctx.fill()
            ctx.globalAlpha = 1
          }
        }
      }
      // Directional coloring (Supertrend): segment color by close vs line.
      if (m.directional) {
        this.drawDirectionalLine(out, ctx, tokens, xFor, scale, start, vEnd)
        continue
      }
      ctx.beginPath()
      const ok = traceLine(ctx, out, Math.floor(start), Math.ceil(vEnd) - Math.floor(start), xFor, (v) => scale.yFor(v))
      if (ok) strokePath(ctx, color, m.width ?? 1.5, m.dash)
    }
  }

  private drawDirectionalLine(
    out: Float64Array,
    ctx: CanvasRenderingContext2D,
    tokens: ChartThemeTokens,
    xFor: (i: number) => number,
    scale: PriceScale,
    start: number,
    vEnd: number,
  ): void {
    const candles = this.input?.data.candles ?? []
    let i = Math.max(0, Math.floor(start))
    const end = Math.min(candles.length, Math.ceil(vEnd))
    ctx.lineWidth = 1.5
    while (i < end - 1) {
      const v = out[i]
      const vn = out[i + 1]
      if (v === undefined || vn === undefined || !Number.isFinite(v) || !Number.isFinite(vn)) {
        i++
        continue
      }
      const c = candles[i + 1]
      const color = c && c.close >= vn ? tokens.up : tokens.down
      ctx.strokeStyle = color
      ctx.beginPath()
      ctx.moveTo(xFor(i), scale.yFor(v))
      ctx.lineTo(xFor(i + 1), scale.yFor(vn))
      ctx.stroke()
      i++
    }
  }

  private drawCompare(
    compare: CompareSeries,
    candles: readonly Candle[],
    ctx: CanvasRenderingContext2D,
    tokens: ChartThemeTokens,
    plotLeft: number,
    slotW: number,
    start: number,
    vStart: number,
    vEnd: number,
    pane: Pane,
  ): void {
    // Normalize against the first visible value → % change.
    const i0 = vStart
    const i1 = Math.min(vEnd, candles.length)
    let base = NaN
    for (let i = i0; i < i1; i++) {
      const v = compare.values[i]
      if (v !== undefined && Number.isFinite(v)) {
        base = v
        break
      }
    }
    if (!Number.isFinite(base)) return
    let lo = Infinity
    let hi = -Infinity
    for (let i = i0; i < i1; i++) {
      const v = compare.values[i]
      if (v === undefined || !Number.isFinite(v)) continue
      const pct = ((v - base) / base) * 100
      if (pct < lo) lo = pct
      if (pct > hi) hi = pct
    }
    if (!Number.isFinite(lo)) return
    if (lo === hi) {
      lo -= 1
      hi += 1
    } else {
      const pad = (hi - lo) * 0.1
      lo -= pad
      hi += pad
    }
    const pTop = pane.top + 4
    const pBottom = pane.top + pane.height - 4
    const yForPct = (pct: number): number => pBottom - ((pct - lo) / (hi - lo)) * (pBottom - pTop)
    const xFor = (i: number): number => plotLeft + (i - start) * slotW + slotW / 2
    ctx.beginPath()
    let pen = false
    for (let i = i0; i < i1; i++) {
      const v = compare.values[i]
      if (v === undefined || !Number.isFinite(v)) {
        pen = false
        continue
      }
      const pct = ((v - base) / base) * 100
      const x = xFor(i)
      const y = yForPct(pct)
      if (pen) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
      pen = true
    }
    strokePath(ctx, tokens.ind[compare.colorIndex % tokens.ind.length] ?? tokens.up, 1.5)
    // header label with current % change
    const last = compare.values[i1 - 1]
    if (last !== undefined && Number.isFinite(last)) {
      const pct = ((last - base) / base) * 100
      ctx.font = `11px ${tokens.fontMono}`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillStyle = tokens.ind[compare.colorIndex % tokens.ind.length] ?? tokens.up
      ctx.fillText(`${compare.label} ${formatPercent(pct)}`, this.width - 4, 4)
    }
  }

  private drawIndicatorPane(
    input: ChartEngineInput,
    pane: Pane,
    ctx: CanvasRenderingContext2D,
    tokens: ChartThemeTokens,
    plotLeft: number,
    slotW: number,
    vEnd: number,
    start: number,
  ): void {
    const ind = pane.indicator
    if (!ind) return
    const scale = pane.scale
    const xFor = (i: number): number => plotLeft + (i - start) * slotW + slotW / 2

    if (ind.kind === 'bars') {
      const vols = ind.outputs[0]
      if (vols) {
        traceVolumeBars(
          ctx,
          vols,
          input.data.candles,
          Math.floor(start),
          Math.ceil(vEnd) - Math.floor(start),
          xFor,
          (v) => scale.yFor(v),
          pane.top + pane.height - 4,
          Math.max(1, slotW * 0.7),
          tokens.up,
          tokens.down,
        )
      }
    } else {
      for (let k = 0; k < ind.outputs.length; k++) {
        const out = ind.outputs[k]
        if (!out) continue
        const m = ind.outputMeta[k]
        if (!m) continue
        const color = this.outputColor(m, ind, tokens)
        ctx.beginPath()
        const ok = traceLine(ctx, out, Math.floor(start), Math.ceil(vEnd) - Math.floor(start), xFor, (v) => scale.yFor(v))
        if (ok) strokePath(ctx, color, m.width ?? 1.5, m.dash)
      }
    }

    // Pane header: label + latest values, each colored by its output palette.
    ctx.font = `10px ${tokens.fontMono}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    const lastIdx = Math.min(vEnd, ind.outputs[0]?.length ?? 0) - 1
    let cx = plotLeft + 2
    ctx.fillStyle = tokens.axisText
    ctx.fillText(ind.label, cx, pane.top + 2)
    cx += ctx.measureText(ind.label).width
    for (let k = 0; k < ind.outputs.length; k++) {
      const v = lastIdx >= 0 ? ind.outputs[k]?.[lastIdx] : NaN
      const m = ind.outputMeta[k]
      if (v === undefined || !Number.isFinite(v) || !m) continue
      const color = this.outputColor(m, ind, tokens)
      const text = ind.format === 'compact' ? formatCompact(v) : formatPrice(v, 5)
      const segment = `  ${m.label} ${text}`
      ctx.fillStyle = color
      ctx.fillText(segment, cx, pane.top + 2)
      cx += ctx.measureText(segment).width
    }
  }

  private drawCrosshair(
    input: ChartEngineInput,
    ctx: CanvasRenderingContext2D,
    tokens: ChartThemeTokens,
    layout: { left: number; bottom: number; panes: Pane[] },
    plotLeft: number,
    plotRight: number,
    axisTop: number,
  ): void {
    const ch = this.crosshair
    if (!ch) return
    // The vertical line follows the pointer exactly (no candle snapping).
    // A wider translucent under-stroke keeps it readable over dense candles.
    const x = Math.max(plotLeft, Math.min(plotRight, ch.x))
    ctx.strokeStyle = tokens.crosshair
    ctx.setLineDash([4, 3])
    ctx.lineWidth = 3
    ctx.globalAlpha = 0.25
    ctx.beginPath()
    ctx.moveTo(x, HEADER_H + PAD_TOP)
    ctx.lineTo(x, this.height - layout.bottom)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.lineWidth = 1
    const hoveredPane = paneAt(ch.y, layout.panes)
    if (hoveredPane) {
      ctx.beginPath()
      ctx.moveTo(plotLeft, ch.y)
      ctx.lineTo(plotRight, ch.y)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // Time pill
    const candle = input.data.candles[ch.index]
    if (candle) {
      const label = formatAxisTime(candle.openTime, input.interval)
      ctx.font = `10px ${tokens.fontMono}`
      const w = ctx.measureText(label).width + 10
      const px = Math.max(plotLeft, Math.min(plotRight - w, x - w / 2))
      ctx.fillStyle = tokens.backgroundInverse
      ctx.fillRect(px, axisTop + 1, w, 16)
      ctx.fillStyle = tokens.foregroundInverse
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, px + w / 2, axisTop + 9)
    }

    // Price pill (hovered pane's scale). On the main pane it stacks the
    // hovered price over its change % RELATIVE TO THE CURRENT PRICE
    // (last close), colored by direction — so the readout answers "where is
    // this level versus now", not "what did that candle do".
    if (hoveredPane && ch.price !== null && Number.isFinite(ch.price)) {
      const isMain = (hoveredPane as Pane).kind === 'main'
      const priceLabel = formatPrice(ch.price, isMain ? 6 : 5)
      let pctLabel = ''
      let textColor = tokens.foregroundInverse
      if (isMain) {
        const candles = input.data.candles
        const current = candles[candles.length - 1]?.close
        if (current !== undefined && current > 0) {
          const pct = ((ch.price - current) / current) * 100
          pctLabel = formatPercent(pct)
          textColor = pct >= 0 ? tokens.up : tokens.down
        }
      }
      ctx.font = `10px ${tokens.fontMono}`
      const w = Math.max(ctx.measureText(priceLabel).width, pctLabel ? ctx.measureText(pctLabel).width : 0) + 10
      const h = pctLabel ? 28 : 16
      const py = Math.max(HEADER_H + PAD_TOP + 1, Math.min(this.height - layout.bottom - h - 2, ch.y - h / 2))
      ctx.fillStyle = tokens.backgroundInverse
      ctx.fillRect(plotRight + 2, py, w, h)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = tokens.foregroundInverse
      ctx.fillText(priceLabel, plotRight + 2 + w / 2, py + (pctLabel ? 8 : 8))
      if (pctLabel) {
        ctx.fillStyle = textColor
        ctx.fillText(pctLabel, plotRight + 2 + w / 2, py + 20)
      }
    }
  }
  private drawDrawing(
    d: Drawing,
    ctx: CanvasRenderingContext2D,
    tokens: ChartThemeTokens,
    xFor: (i: number) => number,
    scale: PriceScale,
    plotLeft: number,
    plotRight: number,
  ): void {
    const color = tokens.crosshair
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 1.2
    const xForTime = (t: number): number => xFor(this.timeToIndex(t))
    const x1 = Math.max(plotLeft, Math.min(plotRight, xForTime(d.t1)))
    const y1 = scale.yFor(d.p1)
    ctx.beginPath()
    if (d.type === 'horizontal') {
      ctx.moveTo(plotLeft, y1)
      ctx.lineTo(plotRight, y1)
      ctx.stroke()
      return
    }
    const x2 = Math.max(plotLeft, Math.min(plotRight, xForTime(d.t2)))
    const y2 = scale.yFor(d.p2)
    if (d.type === 'rectangle') {
      ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
      ctx.stroke()
      return
    }
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    if (d.type === 'arrow') {
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const head = 9
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - head * Math.cos(angle - 0.4), y2 - head * Math.sin(angle - 0.4))
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - head * Math.cos(angle + 0.4), y2 - head * Math.sin(angle + 0.4))
      ctx.stroke()
    }
  }

  /** openTime → fractional candle index via the interval grid anchored at
   * the first loaded candle. Stable across history loads (indices shift,
   * the time grid does not). */
  private timeToIndex(t: number): number {
    const candles = this.input?.data.candles
    if (!candles || candles.length === 0 || this.intervalMs <= 0) return 0
    return (t - (candles[0] as Candle).openTime) / this.intervalMs
  }

  private drawPlaceholder(
    ctx: CanvasRenderingContext2D,
    tokens: ChartThemeTokens,
    message: string,
    plotLeft: number,
    plotRight: number,
    top: number,
    bottom: number,
  ): void {
    ctx.fillStyle = tokens.axisText
    ctx.font = `12px ${tokens.fontSans}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(message, (plotLeft + plotRight) / 2, (top + bottom) / 2)
  }

  // ---- domains ----

  private computeMainDomain(input: ChartEngineInput, pane: Pane, vStart: number, vEnd: number): void {
    const candles = input.data.candles
    let lo = Infinity
    let hi = -Infinity
    for (let i = vStart; i < vEnd; i++) {
      const c = candles[i]
      if (!c) continue
      if (c.low < lo) lo = c.low
      if (c.high > hi) hi = c.high
    }
    for (const ind of input.indicators) {
      if (ind.placement !== 'overlay') continue
      for (const out of ind.outputs) {
        for (let i = vStart; i < vEnd; i++) {
          const v = out?.[i]
          if (v !== undefined && Number.isFinite(v)) {
            if (v < lo) lo = v
            if (v > hi) hi = v
          }
        }
      }
    }
    if (!Number.isFinite(lo)) {
      lo = 0
      hi = 1
    } else if (hi === lo) {
      const pad = Math.max(Math.abs(hi) * 0.01, 1e-12)
      lo -= pad
      hi += pad
    } else {
      const pad = (hi - lo) * 0.08
      lo -= pad
      hi += pad
    }
    if (input.prefs.logScale && lo <= 0) lo = Math.max(hi * 1e-6, 1e-12)
    pane.domain = { lo, hi }
  }

  private computeIndicatorDomain(ind: RenderedIndicator, vStart: number, vEnd: number, pane: Pane): void {
    let lo = Infinity
    let hi = -Infinity
    for (const out of ind.outputs) {
      if (!out) continue
      for (let i = vStart; i < vEnd; i++) {
        const v = out[i]
        if (v === undefined || !Number.isFinite(v)) continue
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
    }
    if (!Number.isFinite(lo)) {
      pane.domain = { lo: 0, hi: 1 }
      return
    }
    if (ind.kind === 'bars') {
      // volume: from zero
      pane.domain = { lo: 0, hi: hi * 1.05 }
      return
    }
    if (lo === hi) {
      lo -= 1
      hi += 1
    } else {
      const pad = (hi - lo) * 0.1
      lo -= pad
      hi += pad
    }
    pane.domain = { lo, hi }
  }

  private outputColor(m: { colorIndex: number }, ind: RenderedIndicator, tokens: ChartThemeTokens): string {
    const palette = tokens.ind
    const idx = m.colorIndex >= 0 ? m.colorIndex : ind.colorOffset
    return palette[(idx + (ind.colorOffset % palette.length)) % palette.length] ?? tokens.up
  }

  private attachEvents(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointerleave', this.onPointerLeave)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    this.canvas.addEventListener('dblclick', this.onDblClick)
  }
}

/** Close values for line/area rendering over a viewport slice. */
function closeSeries(candles: readonly Candle[], i0: number, i1: number): Float64Array {
  const arr = new Float64Array(i1 - i0)
  for (let i = i0; i < i1; i++) {
    const c = candles[i]
    arr[i - i0] = c ? c.close : NaN
  }
  return arr
}
