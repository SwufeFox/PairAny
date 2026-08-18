/** Floating drawing toolbar (left edge of the chart). */
import { useEffect, useState } from 'react'
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@appica/ui-react/tooltip'
import { Line, Minus, SquareRounded, ArrowUpRight, Eraser, Pointer } from '@appica/icons-react'
import { STRINGS } from '../../lib/i18n'
import { getChartEngine } from '../../app/chart-ref'
import type { DrawingTool } from '../../types/chart'
import { useController } from '../../app/use-controller'

const TOOLS: Array<{ id: DrawingTool; Icon: typeof Line }> = [
  { id: 'trendline', Icon: Line },
  { id: 'horizontal', Icon: Minus },
  { id: 'rectangle', Icon: SquareRounded },
  { id: 'arrow', Icon: ArrowUpRight },
]

export function DrawingToolbar() {
  const controller = useController()
  const t = STRINGS[controller.getLocale()]
  const [tool, setTool] = useState<DrawingTool | null>(null)
  const epoch = controller.getChartEpoch()

  // Pair/interval switches clear drawings; reset the active tool.
  useEffect(() => {
    setTool(null)
  }, [epoch])

  const select = (next: DrawingTool | null): void => {
    setTool(next)
    getChartEngine()?.setDrawingTool(next)
  }

  return (
    <TooltipProvider>
      <div className="absolute top-1 left-1 z-10 flex flex-col gap-0.5 rounded-lg border border-border bg-background/90 p-0.5 shadow-md backdrop-blur-sm">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className={`flex size-7 items-center justify-center rounded-md hover:bg-background-muted ${tool === null ? 'bg-background-muted text-foreground-intense' : 'text-foreground-muted'}`}
                onClick={() => select(null)}
                aria-label={t.drawings.pan}
              >
                <Pointer />
              </button>
            }
          />
          <TooltipContent side="right">{t.drawings.pan}</TooltipContent>
        </Tooltip>
        {TOOLS.map(({ id, Icon }) => (
          <Tooltip key={id}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className={`flex size-7 items-center justify-center rounded-md hover:bg-background-muted ${tool === id ? 'bg-background-muted text-foreground-intense' : 'text-foreground-muted'}`}
                  onClick={() => select(tool === id ? null : id)}
                  aria-label={t.drawings[id]}
                >
                  <Icon />
                </button>
              }
            />
            <TooltipContent side="right">{t.drawings[id]}</TooltipContent>
          </Tooltip>
        ))}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-md text-foreground-muted hover:bg-background-muted"
                onClick={() => getChartEngine()?.clearDrawings()}
                aria-label={t.drawings.clear}
              >
                <Eraser />
              </button>
            }
          />
          <TooltipContent side="right">{t.drawings.clear}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
