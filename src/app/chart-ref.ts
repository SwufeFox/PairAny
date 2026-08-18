/** Module-level chart engine handle so shortcuts / context menu can drive it
 * without threading the engine through React props. */
import type { ChartEngine } from '../chart/chart-engine'

let engine: ChartEngine | null = null

export function setChartEngine(e: ChartEngine | null): void {
  engine = e
}

export function getChartEngine(): ChartEngine | null {
  return engine
}
