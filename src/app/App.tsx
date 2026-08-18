/** App root: owns the TerminalController lifecycle and provides it. */
import { useEffect, useRef, useState } from 'react'
import { ControllerContext } from './use-controller'
import { TerminalController } from './terminal-controller'
import { Terminal } from './Terminal'

export function App() {
  const controllerRef = useRef<TerminalController | null>(null)
  if (!controllerRef.current) controllerRef.current = new TerminalController()
  const controller = controllerRef.current
  const [, setTick] = useState(0)

  useEffect(() => {
    void controller.init()
    const un = controller.subscribe(() => setTick((t) => t + 1))
    return () => {
      un()
      controller.dispose()
    }
  }, [controller])

  return (
    <ControllerContext.Provider value={controller}>
      <Terminal />
    </ControllerContext.Provider>
  )
}
