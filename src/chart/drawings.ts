/** Canvas drawing primitives for the chart. All coordinates in CSS px;
 * the context transform already accounts for devicePixelRatio. */
import type { Candle } from '../types/market'

export interface CandleColors {
  up: string
  down: string
  background: string
}

export function drawCandleBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  yOpen: number,
  yClose: number,
  yHigh: number,
  yLow: number,
  bodyW: number,
  colors: CandleColors,
  hollow: boolean,
): void {
  const rising = yClose <= yOpen
  const color = rising ? colors.up : colors.down
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1
  // Wick
  ctx.beginPath()
  ctx.moveTo(x, yHigh)
  ctx.lineTo(x, yLow)
  ctx.stroke()
  // Body
  const top = Math.min(yOpen, yClose)
  const h = Math.max(1, Math.abs(yClose - yOpen))
  ctx.beginPath()
  if (hollow && rising) {
    // Hollow candle: unfilled body, outline only.
    ctx.fillStyle = colors.background
    ctx.fillRect(x - bodyW / 2, top, bodyW, h)
    ctx.strokeRect(x - bodyW / 2, top, bodyW, h)
  } else {
    ctx.fillRect(x - bodyW / 2, top, bodyW, h)
  }
}

export function drawOhlcBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  yOpen: number,
  yClose: number,
  yHigh: number,
  yLow: number,
  tickW: number,
  color: string,
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, yHigh)
  ctx.lineTo(x, yLow)
  ctx.moveTo(x - tickW, yOpen)
  ctx.lineTo(x + tickW, yOpen)
  ctx.moveTo(x - tickW, yClose)
  ctx.lineTo(x + tickW, yClose)
  ctx.stroke()
}

/**
 * Trace a line path over values[start..start+count). Returns true if any
 * finite value was plotted. NaN values break the path (gaps).
 */
export function traceLine(
  ctx: CanvasRenderingContext2D,
  values: Float64Array,
  start: number,
  count: number,
  xFor: (i: number) => number,
  yFor: (v: number) => number,
): boolean {
  let penDown = false
  let any = false
  for (let k = 0; k < count; k++) {
    const i = start + k
    const v = values[i]
    if (v === undefined || !Number.isFinite(v)) {
      penDown = false
      continue
    }
    const x = xFor(i)
    const y = yFor(v)
    if (penDown) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
    penDown = true
    any = true
  }
  return any
}

/** Stroke a traced path with color/dash; call traceLine first. */
export function strokePath(ctx: CanvasRenderingContext2D, color: string, width: number, dash?: string): void {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.setLineDash(dash === 'dashed' ? [4, 3] : [])
  ctx.stroke()
  ctx.setLineDash([])
}

/** Area path: traceLine then close down to `baselineY`. */
export function traceArea(
  ctx: CanvasRenderingContext2D,
  values: Float64Array,
  start: number,
  count: number,
  xFor: (i: number) => number,
  yFor: (v: number) => number,
  baselineY: number,
): boolean {
  const any = traceLine(ctx, values, start, count, xFor, yFor)
  if (any) {
    const lastX = xFor(start + count - 1)
    const firstX = xFor(start)
    ctx.lineTo(lastX, baselineY)
    ctx.lineTo(firstX, baselineY)
    ctx.closePath()
  }
  return any
}

export function traceVolumeBars(
  ctx: CanvasRenderingContext2D,
  volumes: Float64Array,
  candles: readonly Candle[],
  start: number,
  count: number,
  xFor: (i: number) => number,
  yFor: (v: number) => number,
  bottomY: number,
  barW: number,
  up: string,
  down: string,
): void {
  ctx.fillStyle = up
  for (let k = 0; k < count; k++) {
    const i = start + k
    const v = volumes[i]
    if (v === undefined || !Number.isFinite(v) || v <= 0) continue
    const c = candles[i]
    if (!c) continue
    const x = xFor(i)
    const y = yFor(v)
    ctx.fillStyle = c.close >= c.open ? up : down
    ctx.globalAlpha = 0.55
    ctx.fillRect(x - barW / 2, y, barW, Math.max(0.5, bottomY - y))
    ctx.globalAlpha = 1
  }
}
