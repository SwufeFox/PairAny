/** Terminal layout: toolbar / chart (drawings, zoom, context menu) / status
 * bar, plus dialog orchestration, fullscreen, data window and shortcuts. */
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@appica/ui-react/context-menu'
import { Kbd } from '@appica/ui-react/kbd'
import { Alert, AlertIcon, AlertTitle, AlertDescription, AlertAction } from '@appica/ui-react/alert'
import { Button } from '@appica/ui-react/button'
import { InfoCircleFilled } from '@appica/icons-react'
import { ChartToolbar } from '../components/toolbar/ChartToolbar'
import { DrawingToolbar } from '../components/toolbar/DrawingToolbar'
import { ChartCanvas } from '../components/chart/ChartCanvas'
import { ZoomControls } from '../components/chart/ZoomControls'
import { StatusBar } from '../components/status/StatusBar'
import { STRINGS, format as fmt } from '../lib/i18n'
import { useController, useControllerState } from './use-controller'
import { installShortcuts } from './shortcuts'
import { getChartEngine } from './chart-ref'
import { formatPrice } from '../lib/format'

// Dialogs are code-split: each pulls a different slice of the base-ui
// component tree (Combobox ≈ 45K, Select/NumberField…), and none is needed
// until the user opens it.
const SymbolSelectorDialog = lazy(() =>
  import('../components/symbol-selector/SymbolSelectorDialog').then((m) => ({ default: m.SymbolSelectorDialog })),
)
const IndicatorDialog = lazy(() =>
  import('../components/indicators/IndicatorDialog').then((m) => ({ default: m.IndicatorDialog })),
)
const SettingsDialog = lazy(() =>
  import('../components/settings/SettingsDialog').then((m) => ({ default: m.SettingsDialog })),
)
const CompareDialog = lazy(() => import('../components/compare/CompareDialog').then((m) => ({ default: m.CompareDialog })))

type DialogState =
  | { kind: 'symbols'; focus: 'base' | 'quote' }
  | { kind: 'indicators' }
  | { kind: 'settings' }
  | { kind: 'compare' }
  | null

export function Terminal() {
  const controller = useController()
  useControllerState()
  const t = STRINGS[controller.getLocale()]
  const [dialog, setDialog] = useState<DialogState>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [dataWindowOpen, setDataWindowOpen] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)

  const openSymbols = (focus: 'base' | 'quote' = 'base') => setDialog({ kind: 'symbols', focus })
  const openIndicators = () => setDialog({ kind: 'indicators' })
  const openSettings = () => setDialog({ kind: 'settings' })
  const openCompare = () => setDialog({ kind: 'compare' })

  const toggleFullscreen = (): void => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void rootRef.current?.requestFullscreen()
    }
  }

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(
    () =>
      installShortcuts(controller, {
        openSymbols,
        openIndicators,
        openSettings,
        openCompare,
        toggleFullscreen,
        toggleDataWindow: () => setDataWindowOpen((open) => !open),
      }),
    [controller],
  )

  const copyPrice = (): void => {
    const engine = getChartEngine()
    const hovered = engine?.getLastCrosshair()?.candle?.close
    const price = hovered ?? controller.market.getLeg(controller.getStatuses()[0]?.symbol ?? '')?.getLast()?.close
    if (price !== null && price !== undefined && navigator.clipboard) {
      void navigator.clipboard.writeText(formatPrice(price, 8))
    }
  }

  const removeLastIndicator = (): void => {
    const instances = controller.listInstances()
    const removable = [...instances].reverse().find((i) => i.definitionId !== 'volume')
    if (removable) controller.removeIndicator(removable.uid)
  }

  const pairError = controller.getPairError()
  const pairErrorText = pairError.key ? fmt(t.symbolDialog[pairError.key], pairError.params) : null

  return (
    <div ref={rootRef} className="bg-background text-foreground flex h-full flex-col overflow-hidden">
      <ChartToolbar
        actions={{
          openSymbols,
          openIndicators,
          openCompare,
          openSettings,
          toggleFullscreen,
          toggleDataWindow: () => setDataWindowOpen((open) => !open),
          isFullscreen,
          dataWindowOpen,
        }}
      />

      {controller.exchangeLoadError && (
        <Alert variant="error" className="mx-2 mt-2">
          <AlertIcon>
            <InfoCircleFilled />
          </AlertIcon>
          <AlertTitle>{t.errors.exchangeFailed}</AlertTitle>
          <AlertDescription>{controller.exchangeLoadError}</AlertDescription>
          <AlertAction>
            <Button size="sm" onClick={() => controller.retryExchange()}>
              {t.errors.retry}
            </Button>
          </AlertAction>
        </Alert>
      )}

      {!controller.exchangeLoadError && pairErrorText && (
        <Alert variant="warning" className="mx-2 mt-2">
          <AlertIcon>
            <InfoCircleFilled />
          </AlertIcon>
          <AlertTitle>{t.errors.pairUnavailable}</AlertTitle>
          <AlertDescription>{pairErrorText}</AlertDescription>
          <AlertAction>
            <Button size="sm" onClick={() => openSymbols('base')}>
              {t.errors.choosePair}
            </Button>
          </AlertAction>
        </Alert>
      )}

      <main className="relative min-h-0 flex-1">
        <ContextMenu>
          <ContextMenuTrigger className="relative block h-full w-full">
            <ChartCanvas dataWindowOpen={dataWindowOpen} />
            <DrawingToolbar />
            <ZoomControls />
          </ContextMenuTrigger>
          <ContextMenuContent className="min-w-56">
            <ContextMenuItem onClick={() => getChartEngine()?.resetChart()}>
              {t.contextMenu.resetChart}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => getChartEngine()?.fit()}>
              {t.contextMenu.fitContent}
              <Kbd size="sm" className="ms-auto">
                F
              </Kbd>
            </ContextMenuItem>
            <ContextMenuItem onClick={copyPrice}>{t.contextMenu.copyPrice}</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={openIndicators}>{t.contextMenu.addIndicator}</ContextMenuItem>
            <ContextMenuItem
              onClick={removeLastIndicator}
              disabled={controller.listInstances().filter((i) => i.definitionId !== 'volume').length === 0}
            >
              {t.contextMenu.removeIndicator}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => controller.setChartPrefs({ logScale: !controller.chartPrefs.logScale })}>
              {t.contextMenu.toggleLog}
              <Kbd size="sm" className="ms-auto">
                L
              </Kbd>
            </ContextMenuItem>
            <ContextMenuItem onClick={toggleFullscreen}>{t.contextMenu.fullscreen}</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </main>

      <StatusBar />

      <Suspense fallback={null}>
        <SymbolSelectorDialog
          open={dialog?.kind === 'symbols'}
          onOpenChange={(open) => setDialog(open ? { kind: 'symbols', focus: 'base' } : null)}
          focusSlot={dialog?.kind === 'symbols' ? dialog.focus : 'base'}
        />
        <IndicatorDialog open={dialog?.kind === 'indicators'} onOpenChange={(open) => setDialog(open ? { kind: 'indicators' } : null)} />
        <SettingsDialog open={dialog?.kind === 'settings'} onOpenChange={(open) => setDialog(open ? { kind: 'settings' } : null)} />
        <CompareDialog open={dialog?.kind === 'compare'} onOpenChange={(open) => setDialog(open ? { kind: 'compare' } : null)} />
      </Suspense>
    </div>
  )
}
