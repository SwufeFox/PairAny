/** Global keyboard shortcuts. Guarded against typing targets and open
 * dialogs (Appica dialogs own their Escape handling). */
import type { TerminalController } from './terminal-controller'
import { getChartEngine } from './chart-ref'

export interface ShortcutActions {
  openSymbols: (focusSlot: 'base' | 'quote') => void
  openIndicators: () => void
  openSettings: () => void
  openCompare: () => void
  toggleFullscreen: () => void
  toggleDataWindow: () => void
}

export function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target
  if (!(t instanceof HTMLElement)) return false
  return (
    t.tagName === 'INPUT' ||
    t.tagName === 'TEXTAREA' ||
    t.tagName === 'SELECT' ||
    t.isContentEditable ||
    t.closest('[role="combobox"], [role="dialog"]') !== null
  )
}

export function anyDialogOpen(): boolean {
  return document.querySelector('[role="dialog"]') !== null
}

export function installShortcuts(controller: TerminalController, actions: ShortcutActions): () => void {
  const onKeyDown = (e: KeyboardEvent): void => {
    const engine = getChartEngine()
    const ctrl = e.ctrlKey || e.metaKey

    if (ctrl && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      actions.openSymbols('base')
      return
    }
    if (ctrl && e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault()
      actions.toggleDataWindow()
      return
    }
    if (anyDialogOpen()) return
    if (isTypingTarget(e)) return

    switch (e.key) {
      case '+':
      case '=':
        e.preventDefault()
        engine?.zoomBy(1 / 1.15)
        break
      case '-':
      case '_':
        e.preventDefault()
        engine?.zoomBy(1.15)
        break
      case 'ArrowLeft':
        e.preventDefault()
        engine?.panBy(-Math.max(1, engine.visibleCount * 0.1))
        break
      case 'ArrowRight':
        e.preventDefault()
        engine?.panBy(Math.max(1, engine.visibleCount * 0.1))
        break
      case 'Home':
        e.preventDefault()
        engine?.home()
        break
      case 'End':
        e.preventDefault()
        engine?.home()
        break
      case 'f':
      case 'F':
        e.preventDefault()
        engine?.fit()
        break
      case 'l':
      case 'L':
        e.preventDefault()
        controller.setChartPrefs({ logScale: !controller.chartPrefs.logScale })
        break
      case 'Escape':
        // Nothing app-owned is open; Appica popups handle their own Esc.
        break
    }
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}
