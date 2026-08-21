/** Chart canvas host: owns the ChartEngine lifecycle and the detail data
 * window — both imperative, so mousemove never re-renders React. Market
 * ticks never touch React: the controller pushes inputs to the engine. */
import { useEffect, useRef } from 'react'
import { ChartEngine } from '../../chart/chart-engine'
import { renderDataWindow } from '../../chart/data-window'
import type { CrosshairSnapshot } from '../../types/chart'
import { STRINGS } from '../../lib/i18n'
import { useController } from '../../app/use-controller'
import { setChartEngine } from '../../app/chart-ref'
import type { TerminalController } from '../../app/terminal-controller'

export interface ChartCanvasProps {
  dataWindowOpen: boolean
}

export function ChartCanvas({ dataWindowOpen }: ChartCanvasProps) {
  const controller = useController()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dataWindowRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<ChartEngine | null>(null)
  const lastEpochRef = useRef(controller.getChartEpoch())
  const hasDataRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const engine = new ChartEngine(canvas, {
      onCrosshair: (snapshot) => updateDataWindow(controller, dataWindowRef.current, snapshot),
      onNeedHistory: () => {
        void controller.loadMoreHistory()
      },
    })
    engineRef.current = engine
    setChartEngine(engine)
    lastEpochRef.current = controller.getChartEpoch()
    engine.setInput(controller.getChartInput())
    engine.resize(container.clientWidth, container.clientHeight)

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) engine.resize(rect.width, rect.height)
    })
    ro.observe(container)

    return () => {
      ro.disconnect()
      engine.destroy()
      engineRef.current = null
      setChartEngine(null)
    }
  }, [controller])

  useEffect(
    () =>
      controller.subscribeChart(() => {
        const engine = engineRef.current
        if (!engine) return
        const input = controller.getChartInput()
        engine.setInput(input)
        const epoch = controller.getChartEpoch()
        if (!hasDataRef.current && input.data.candles.length > 0) {
          // First real data: fit the whole series once.
          hasDataRef.current = true
          engine.fit()
        } else if (epoch !== lastEpochRef.current) {
          // Pair/interval switch: reset view, drop stale drawings and scales.
          lastEpochRef.current = epoch
          engine.clearDrawings()
          engine.clearPriceOverrides()
          engine.fit()
        }
      }),
    [controller],
  )

  useEffect(() => {
    const root = dataWindowRef.current
    if (root) root.style.display = dataWindowOpen ? 'block' : 'none'
  }, [dataWindowOpen])

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="chart-surface absolute inset-0" />
      <div
        ref={dataWindowRef}
        className="pointer-events-none absolute top-8 left-12 z-10 hidden w-64 rounded-lg border border-border bg-background-inverse/75 px-2.5 py-2 shadow-xl backdrop-blur-sm"
      />
    </div>
  )
}

/** Imperatively render the fixed-position detail window (no React state). */
function updateDataWindow(
  controller: TerminalController,
  root: HTMLElement | null,
  snapshot: CrosshairSnapshot | null,
): void {
  if (!root || root.style.display === 'none') return
  const t = STRINGS[controller.getLocale()]
  if (!snapshot || !snapshot.candle) {
    renderDataWindow(root, null)
    return
  }
  const input = controller.getChartInput()
  const data = input.data
  const legs = controller.getLegClosesAt(snapshot.candle.openTime)
  const volumeLabel =
    data.volumeMode === 'hidden' ? t.tooltip.hidden : data.volumeMode === 'synthetic' ? t.tooltip.syntheticVolume : t.tooltip.volume
  renderDataWindow(root, {
    pairLabel: controller.getPairLabel(),
    openTime: snapshot.candle.openTime,
    candle: snapshot.candle,
    currentClose: data.candles[data.candles.length - 1]?.close ?? null,
    volumeLabel,
    legs,
    isSynthetic: data.isSynthetic,
    labels: {
      open: t.tooltip.open,
      high: t.tooltip.high,
      low: t.tooltip.low,
      close: t.tooltip.close,
      change: t.tooltip.change,
      changePct: t.tooltip.changePct,
      vsNow: t.tooltip.vsNow,
      syntheticClose: t.tooltip.syntheticClose,
      closeSuffix: t.tooltip.close,
    },
  })
}
