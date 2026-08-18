/** Compact trading-terminal toolbar: pair selector, intervals, chart type,
 * indicators, compare, scale, data window, settings, fullscreen, status. */
import { Button } from '@appica/ui-react/button'
import { Badge } from '@appica/ui-react/badge'
import { Separator } from '@appica/ui-react/separator'
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@appica/ui-react/tooltip'
import { ChevronDown, ChartCandle, GitCompare, Scales, Maximize, Minimize, Settings as SettingsIcon, LayoutBottombar, ArrowLeftRight } from '@appica/icons-react'
import { STRINGS } from '../../lib/i18n'
import type { I18n } from '../../lib/i18n'
import { useController, useControllerState } from '../../app/use-controller'
import { IntervalPicker } from './IntervalPicker'
import { ChartTypeMenu } from './ChartTypeMenu'

export interface ToolbarActions {
  openSymbols: () => void
  openIndicators: () => void
  openCompare: () => void
  openSettings: () => void
  toggleFullscreen: () => void
  toggleDataWindow: () => void
  isFullscreen: boolean
  dataWindowOpen: boolean
}

const STATE_COLOR: Record<string, string> = {
  connected: 'bg-success',
  connecting: 'bg-info',
  reconnecting: 'bg-warning',
  disconnected: 'bg-error',
  idle: 'bg-foreground-subtle',
}

export function ChartToolbar({ actions }: { actions: ToolbarActions }) {
  const controller = useController()
  useControllerState()
  const t = STRINGS[controller.getLocale()]
  const pair = controller.getSettings().pair
  const mode = controller.getSeriesMode()
  const statuses = controller.getStatuses()
  const prefs = controller.chartPrefs

  return (
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label={t.toolbar.changePair}
        className="bg-background-subtle border-border flex h-10 shrink-0 items-center gap-1 border-b px-2"
      >
        <Button variant="ghost" size="sm" onClick={actions.openSymbols} aria-label={t.toolbar.changePair}>
          <span className="text-foreground-intense font-medium">{pair.base}</span>
          <span className="text-foreground-subtle">/</span>
          <span className="text-foreground-intense font-medium">{pair.quote}</span>
          <ChevronDown data-icon="end" className="text-foreground-subtle" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t.toolbar.swap}
          title={t.toolbar.swap}
          onClick={() => controller.switchTo(pair.quote, pair.base)}
        >
          <ArrowLeftRight />
        </Button>
        <Badge variant={mode === 'synthetic' ? 'info' : 'secondary'} size="sm">
          {mode === 'synthetic' ? t.toolbar.synthetic : t.toolbar.direct}
        </Badge>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <IntervalPicker />

        <Separator orientation="vertical" className="mx-1 h-5" />

        <ChartTypeMenu />

        <Button variant="ghost" size="sm" onClick={actions.openIndicators}>
          <ChartCandle data-icon="start" />
          {t.toolbar.indicators}
        </Button>
        <Button variant="ghost" size="sm" onClick={actions.openCompare}>
          <GitCompare data-icon="start" />
          {t.toolbar.compare}
        </Button>
        <Button
          variant={prefs.logScale ? 'soft' : 'ghost'}
          size="sm"
          className={prefs.logScale ? 'text-foreground-intense' : undefined}
          onClick={() => controller.setChartPrefs({ logScale: !prefs.logScale })}
        >
          <Scales data-icon="start" />
          {prefs.logScale ? t.toolbar.log : t.toolbar.linear}
        </Button>
        <Button
          variant={actions.dataWindowOpen ? 'soft' : 'ghost'}
          size="sm"
          className={actions.dataWindowOpen ? 'text-foreground-intense' : undefined}
          onClick={actions.toggleDataWindow}
          aria-label={actions.dataWindowOpen ? t.toolbar.hideDataWindow : t.toolbar.dataWindow}
        >
          <LayoutBottombar data-icon="start" />
          {t.toolbar.dataWindow}
        </Button>

        <div className="ms-auto flex items-center gap-1">
          {statuses.map(({ symbol, status }) => (
            <Tooltip key={symbol}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-foreground-muted hover:bg-background-muted"
                  >
                    <span className={`size-1.5 rounded-full ${STATE_COLOR[status.state] ?? 'bg-foreground-subtle'}`} />
                    {symbol.replace('USDT', '')}
                  </button>
                }
              />
              <TooltipContent>
                {symbol} · {statusText(t, status.state)}
                {status.detail ? ` — ${status.detail}` : ''}
              </TooltipContent>
            </Tooltip>
          ))}
          <Button variant="ghost" size="sm" onClick={actions.openSettings} aria-label={t.toolbar.settings}>
            <SettingsIcon />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={actions.toggleFullscreen}
            aria-label={actions.isFullscreen ? t.toolbar.exitFullscreen : t.toolbar.fullscreen}
          >
            {actions.isFullscreen ? <Minimize /> : <Maximize />}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}

export function statusText(t: I18n, state: string): string {
  const map: Record<string, string> = {
    connected: t.statusBar.connected,
    connecting: t.statusBar.connecting,
    reconnecting: t.statusBar.reconnecting,
    disconnected: t.statusBar.disconnected,
    idle: t.statusBar.idle,
  }
  return map[state] ?? state
}
