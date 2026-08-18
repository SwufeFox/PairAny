/** Price/time scaling: linear + logarithmic price transforms, nice tick steps. */

const NICE = [1, 2, 2.5, 5, 10]

/** Smallest "nice" step ≥ raw (1/2/2.5/5 × 10^k). */
export function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1
  const e = Math.floor(Math.log10(raw))
  const base = Math.pow(10, e)
  const frac = raw / base
  let pick = NICE[0] as number
  for (const n of NICE) {
    pick = n
    if (n >= frac) break
  }
  return pick * base
}

function roundToStep(v: number, step: number): number {
  const digits = Math.max(0, -Math.floor(Math.log10(step)) + 1)
  return Number(v.toFixed(digits))
}

/** Linear ticks in [lo, hi], ≤ maxTicks. */
export function niceTicks(lo: number, hi: number, maxTicks: number): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo || maxTicks <= 0) return []
  const step = niceStep((hi - lo) / maxTicks)
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) {
    ticks.push(roundToStep(v, step))
    if (ticks.length > 64) break
  }
  return ticks
}

/** Logarithmic ticks at 1/2/5 × 10^k inside [lo, hi]. */
export function logTicks(lo: number, hi: number): number[] {
  const ticks: number[] = []
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0 || hi <= 0) return ticks
  let e = Math.floor(Math.log10(lo))
  let guard = 0
  while (guard++ < 64) {
    const base = Math.pow(10, e)
    for (const m of [1, 2, 5]) {
      const v = m * base
      if (v > hi) return ticks
      if (v >= lo) ticks.push(v)
    }
    e++
  }
  return ticks
}

/** Nice candle-count step for the time axis (1,2,3,5,10,15,30,60,…). */
export function timeTickStep(rawStep: number): number {
  const N = [1, 2, 3, 5, 10, 15, 30, 60, 120, 180, 300, 360, 600, 720, 900, 1200, 1800, 3600, 7200, 10800, 14400, 28800, 43200, 86400]
  for (const n of N) {
    if (n >= rawStep) return n
  }
  return Math.ceil(rawStep / 86400) * 86400
}

export class PriceScale {
  lo = 0
  hi = 1
  private top = 0
  private bottom = 1
  logMode = false

  setDomain(lo: number, hi: number, top: number, bottom: number): void {
    this.lo = lo
    this.hi = hi
    this.top = top
    this.bottom = bottom
  }

  yFor(v: number): number {
    if (this.logMode) {
      if (v <= 0 || this.lo <= 0 || this.hi <= 0) return this.bottom
      const lv = Math.log(v)
      const llo = Math.log(this.lo)
      const lhi = Math.log(this.hi)
      if (lhi === llo) return (this.top + this.bottom) / 2
      return this.bottom - ((lv - llo) / (lhi - llo)) * (this.bottom - this.top)
    }
    if (this.hi === this.lo) return (this.top + this.bottom) / 2
    return this.bottom - ((v - this.lo) / (this.hi - this.lo)) * (this.bottom - this.top)
  }

  valueAt(y: number): number {
    const t = (this.bottom - y) / (this.bottom - this.top)
    if (this.logMode) {
      const llo = Math.log(Math.max(this.lo, 1e-12))
      const lhi = Math.log(Math.max(this.hi, this.lo))
      return Math.exp(llo + t * (lhi - llo))
    }
    return this.lo + t * (this.hi - this.lo)
  }
}
