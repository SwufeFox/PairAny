/**
 * Color-blind friendly chart palettes. The actual colors live in CSS
 * (`--chart-up` / `--chart-down` overridden by `.cb-*` classes on <html>);
 * this module only maps modes to classes and labels.
 */

export type ColorBlindMode = 'normal' | 'rg-safe' | 'deuteranopia' | 'protanopia' | 'tritanopia'

export interface ColorBlindOption {
  id: ColorBlindMode
  label: string
  description: string
}

export const COLOR_BLIND_OPTIONS: ColorBlindOption[] = [
  { id: 'normal', label: 'Normal', description: 'Traditional green-up / red-down.' },
  { id: 'rg-safe', label: 'Red-Green Safe', description: 'Blue-up / amber-down; discriminable without red-green vision.' },
  { id: 'deuteranopia', label: 'Deuteranopia', description: 'Tuned for green-blind (most common) deficiency.' },
  { id: 'protanopia', label: 'Protanopia', description: 'Tuned for red-blind deficiency.' },
  { id: 'tritanopia', label: 'Tritanopia', description: 'Tuned for blue-yellow deficiency.' },
]

const CLASS_BY_MODE: Record<ColorBlindMode, string | null> = {
  normal: null,
  'rg-safe': 'cb-rg-safe',
  deuteranopia: 'cb-deuteranopia',
  protanopia: 'cb-protanopia',
  tritanopia: 'cb-tritanopia',
}

/** Apply the mode by toggling the matching class on <html>. */
export function applyColorBlindMode(mode: ColorBlindMode): void {
  const root = document.documentElement
  for (const option of COLOR_BLIND_OPTIONS) {
    const cls = CLASS_BY_MODE[option.id]
    if (cls) root.classList.toggle(cls, option.id === mode)
  }
}
