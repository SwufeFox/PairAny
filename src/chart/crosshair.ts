/** Crosshair geometry helpers: pane hit-testing and view clamping. */

export interface PaneRect {
  id: string
  top: number
  height: number
}

export interface CrosshairState {
  x: number
  y: number
  /** Clamped candle index under the pointer. */
  index: number
  paneId: string
  /** Price at the pointer inside the hovered pane (for the legend pill). */
  price: number | null
}

/** Index of the pane containing y, or null. */
export function paneAt(y: number, panes: PaneRect[]): PaneRect | null {
  for (const p of panes) {
    if (y >= p.top && y < p.top + p.height) return p
  }
  return null
}

export function clampIndex(index: number, len: number): number {
  if (len <= 0) return 0
  return Math.max(0, Math.min(len - 1, Math.floor(index)))
}

export function clampView(start: number, count: number, len: number): { start: number; count: number } {
  if (len <= 0) return { start: 0, count: 1 }
  const clampedCount = Math.max(1, Math.min(count, len))
  const maxStart = Math.max(0, len - clampedCount)
  return { start: Math.min(Math.max(0, start), maxStart), count: clampedCount }
}
