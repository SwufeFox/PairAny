/** Safe read of a numeric array slot: undefined (noUncheckedIndexedAccess)
 * becomes NaN. In-bounds reads are a no-op. */
export function at(arr: ArrayLike<number>, i: number): number {
  return arr[i] ?? NaN
}

/** Safe read that falls back to a default for the warmup boundary. */
export function atOr(arr: ArrayLike<number>, i: number, fallback: number): number {
  const v = arr[i]
  return v === undefined || Number.isNaN(v) ? fallback : v
}
