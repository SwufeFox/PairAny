/** Controller access for the React tree: context + useSyncExternalStore. */
import { createContext, useContext, useSyncExternalStore } from 'react'
import type { TerminalController } from './terminal-controller'

export const ControllerContext = createContext<TerminalController | null>(null)

export function useController(): TerminalController {
  const controller = useContext(ControllerContext)
  if (!controller) throw new Error('TerminalController missing from context')
  return controller
}

/** Re-render on human-frequency controller changes (not per WS tick). */
export function useControllerState(): number {
  const controller = useController()
  return useSyncExternalStore(controller.subscribe.bind(controller), controller.getReactVersion.bind(controller))
}
