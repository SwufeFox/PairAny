/** Bottom status bar: pair/mode, data source, per-leg connection health.
 * (Ratio precision, sync stats and volume detail live in Settings → Advanced.) */
import { Badge } from '@appica/ui-react/badge'
import { Button } from '@appica/ui-react/button'
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@appica/ui-react/tooltip'
import { intervalLabel } from '../../lib/interval'
import { STRINGS } from '../../lib/i18n'
import { statusText } from '../toolbar/ChartToolbar'
import { useController, useControllerState } from '../../app/use-controller'

const STATE_COLOR: Record<string, string> = {
  connected: 'bg-success',
  connecting: 'bg-info',
  reconnecting: 'bg-warning',
  disconnected: 'bg-error',
  idle: 'bg-foreground-subtle',
}

export function StatusBar() {
  const controller = useController()
  useControllerState()
  const t = STRINGS[controller.getLocale()]
  const statuses = controller.getStatuses()
  const mode = controller.getSeriesMode()
  const compare = controller.compareSymbol

  return (
    <TooltipProvider>
      <div className="bg-background-subtle border-border text-foreground-muted flex h-7 shrink-0 items-center gap-3 overflow-x-auto border-t px-2 text-[11px] whitespace-nowrap">
        <span className="text-foreground-intense tnum font-medium">{controller.getPairLabel()}</span>
        <Badge variant={mode === 'synthetic' ? 'info' : 'secondary'} size="xs">
          {mode === 'synthetic' ? t.statusBar.syntheticPair : t.statusBar.directPair}
        </Badge>
        <Badge variant="soft" size="xs">
          {intervalLabel(controller.getInterval())}
        </Badge>
        <span>
          Binance · <span className="text-success-emphasis">{t.statusBar.live}</span>
        </span>
        {compare && (
          <span>
            {t.toolbar.compare}: <span className="text-foreground-intense tnum">{compare}</span>
          </span>
        )}

        <div className="ms-auto flex items-center gap-3">
          {statuses.map(({ symbol, status }) => (
            <Tooltip key={symbol}>
              <TooltipTrigger
                render={
                  <button type="button" className="flex items-center gap-1.5 text-[11px] text-foreground-muted">
                    <span className={`size-1.5 rounded-full ${STATE_COLOR[status.state] ?? 'bg-foreground-subtle'}`} />
                    <span className="tnum font-medium">{symbol}</span>
                    <span>{statusText(t, status.state)}</span>
                  </button>
                }
              />
              <TooltipContent>
                {symbol} · {statusText(t, status.state)}
                {status.detail ? ` — ${status.detail}` : ''}
                {status.state === 'disconnected' && (
                  <Button
                    variant="soft"
                    size="sm"
                    className="mt-1.5"
                    onClick={() => controller.refreshLeg(symbol)}
                  >
                    {t.statusBar.retry}
                  </Button>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}
