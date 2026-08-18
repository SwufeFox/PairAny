/**
 * IndicatorEngine — the runtime for indicator instances.
 *
 * - Owns the indicator instances the user added (params, visibility,
 *   placement, palette offset).
 * - Incrementally (re)computes each instance when the series changes:
 *   a WS tick recomputes only the tail after `computedTo`, using the
 *   definition's `lookback` window; a structural change (pair/interval
 *   switch, history prepend) recomputes from zero.
 * - Emits a single notification per change so the chart can redraw once.
 */
import type {
  IndicatorCache,
  IndicatorDefinition,
  IndicatorInstance,
  IndicatorParams,
} from '../types/indicators'
import type { Candle } from '../types/market'
import type { RenderedIndicator } from '../types/chart'
import { Emitter } from '../lib/events'

interface Entry {
  instance: IndicatorInstance
  cache: IndicatorCache
}

let uidCounter = 0

export class IndicatorEngine {
  private defs = new Map<string, IndicatorDefinition>()
  private entries = new Map<string, Entry>()
  private data: readonly Candle[] = []
  private dataVersion = -1
  private changeEmitter = new Emitter<void>()
  private dataEmitter = new Emitter<void>()

  register(def: IndicatorDefinition): void {
    this.defs.set(def.id, def)
  }

  getDefinition(id: string): IndicatorDefinition | undefined {
    return this.defs.get(id)
  }

  listDefinitions(): IndicatorDefinition[] {
    return [...this.defs.values()]
  }

  add(
    definitionId: string,
    params?: Partial<IndicatorParams>,
    placement?: IndicatorInstance['placement'],
  ): IndicatorInstance | null {
    const def = this.defs.get(definitionId)
    if (!def) return null
    const merged: IndicatorParams = { ...def.defaultParams }
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) merged[key] = value
      }
    }
    const instance: IndicatorInstance = {
      uid: `ind-${++uidCounter}`,
      definitionId,
      params: merged,
      visible: true,
      placement: placement ?? def.defaultPlacement,
      colorOffset: this.nextColorOffset(definitionId),
    }
    const warmup: IndicatorCache = {
      outputs: def.outputs.map(() => new Float64Array(this.data.length).fill(NaN)),
      state: null,
      computedTo: -1,
      dataVersion: -1,
    }
    this.entries.set(instance.uid, { instance, cache: warmup })
    this.recomputeEntry(this.entries.get(instance.uid) as Entry, true)
    this.emitChange()
    return instance
  }

  remove(uid: string): void {
    this.entries.delete(uid)
    this.emitChange()
  }

  update(instance: IndicatorInstance): void {
    const entry = this.entries.get(instance.uid)
    if (!entry) return
    entry.instance = instance
    // Params changed — windowed values may shift; recompute from scratch.
    this.recomputeEntry(entry, true)
    this.emitChange()
  }

  setData(candles: readonly Candle[], version: number, structural: boolean): void {
    const changed = version !== this.dataVersion
    this.data = candles
    this.dataVersion = version
    if (!changed) return
    for (const entry of this.entries.values()) {
      this.recomputeEntry(entry, structural)
    }
    // Data recompute: chart-only signal (never a React re-render trigger).
    this.emitData()
  }

  /** Full recompute of every instance (pair/interval switch, history prepend). */
  reset(): void {
    for (const entry of this.entries.values()) {
      this.recomputeEntry(entry, true)
    }
    this.emitData()
  }

  listInstances(): IndicatorInstance[] {
    return [...this.entries.values()].map((e) => e.instance)
  }

  getRendered(): RenderedIndicator[] {
    const out: RenderedIndicator[] = []
    for (const entry of this.entries.values()) {
      const { instance, cache } = entry
      if (!instance.visible) continue
      const def = this.defs.get(instance.definitionId)
      if (!def) continue
      out.push({
        uid: instance.uid,
        definitionId: instance.definitionId,
        label: def.name,
        placement: instance.placement,
        colorOffset: instance.colorOffset,
        outputs: cache.outputs,
        outputMeta: def.outputs,
        kind: def.paneKind ?? 'line',
        format: def.paneFormat ?? 'price',
      })
    }
    return out
  }

  /** Definitions whose pane the chart should allocate (pane-placed, visible). */
  hasPanes(): boolean {
    for (const entry of this.entries.values()) {
      if (entry.instance.visible && entry.instance.placement === 'pane') return true
    }
    return false
  }

  /** Instance-structure changes (add/remove/update) — React-visible. */
  subscribe(fn: () => void): () => void {
    return this.changeEmitter.subscribe(fn)
  }

  /** Data recomputes (per tick) — chart-only. */
  subscribeData(fn: () => void): () => void {
    return this.dataEmitter.subscribe(fn)
  }

  private emitChange(): void {
    this.changeEmitter.emit()
    this.dataEmitter.emit()
  }

  private emitData(): void {
    this.dataEmitter.emit()
  }

  private nextColorOffset(definitionId: string): number {
    let max = 0
    for (const entry of this.entries.values()) {
      if (entry.instance.definitionId === definitionId) {
        max = Math.max(max, entry.instance.colorOffset + 1)
      }
    }
    return max
  }

  private recomputeEntry(entry: Entry, structural: boolean): void {
    const def = this.defs.get(entry.instance.definitionId)
    if (!def) return
    const n = this.data.length
    if (n === 0) {
      entry.cache = { outputs: [], state: null, computedTo: -1, dataVersion: this.dataVersion }
      return
    }
    const currentLen = entry.cache.outputs[0]?.length ?? -1
    if (currentLen !== n) {
      // Series grew (append) or was replaced (prepend/switch). Preserve the
      // old values at their indices for appends; structural recompute below
      // overwrites everything anyway.
      const old = entry.cache.outputs
      entry.cache.outputs = def.outputs.map((_, k) => {
        const arr = new Float64Array(n).fill(NaN)
        const src = old[k]
        if (src) arr.set(src.subarray(0, Math.min(src.length, n)))
        return arr
      })
    }
    let from: number
    let state: unknown
    if (structural || entry.cache.computedTo < 0) {
      from = 0
      state = null
      entry.cache.outputs = def.outputs.map(() => new Float64Array(n).fill(NaN))
    } else {
      from = Math.max(0, entry.cache.computedTo + 1 - def.lookback(entry.instance.params))
      state = entry.cache.state
    }
    const result = def.compute(this.data, entry.instance.params, state, from)
    const outputs = entry.cache.outputs
    if (result.outputs.length !== outputs.length) {
      // Definition changed output arity (shouldn't happen at runtime); rebuild.
      entry.cache.outputs = result.outputs.map((o) => o.slice())
      entry.cache.computedTo = n - 1
      entry.cache.state = result.state
      entry.cache.dataVersion = this.dataVersion
      return
    }
    for (let k = 0; k < outputs.length; k++) {
      const src = result.outputs[k]
      const dst = outputs[k]
      if (dst === undefined || src === undefined) continue
      for (let i = from; i < n; i++) dst[i] = src[i] ?? NaN
    }
    entry.cache.computedTo = n - 1
    entry.cache.state = result.state
    entry.cache.dataVersion = this.dataVersion
  }
}
