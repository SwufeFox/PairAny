/** Minimal typed event emitter for the non-React data layer. */

export type Listener<T> = (payload: T) => void

export class Emitter<T> {
  private listeners = new Set<Listener<T>>()

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(payload: T): void {
    for (const listener of this.listeners) listener(payload)
  }

  get size(): number {
    return this.listeners.size
  }

  clear(): void {
    this.listeners.clear()
  }
}
