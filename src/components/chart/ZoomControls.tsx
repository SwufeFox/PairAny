/** Floating zoom controls (bottom-right of the chart). */
import { Button } from '@appica/ui-react/button'
import { ZoomIn, ZoomOut, Focus } from '@appica/icons-react'
import { STRINGS } from '../../lib/i18n'
import { getChartEngine } from '../../app/chart-ref'
import { useController } from '../../app/use-controller'

export function ZoomControls() {
  const controller = useController()
  const t = STRINGS[controller.getLocale()]
  return (
    <div className="absolute right-2 bottom-1 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-background/90 p-0.5 shadow-md backdrop-blur-sm">
      <Button variant="ghost" size="icon-sm" aria-label={t.zoom.zoomIn} onClick={() => getChartEngine()?.zoomBy(1 / 1.3)}>
        <ZoomIn />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={t.zoom.zoomOut} onClick={() => getChartEngine()?.zoomBy(1.3)}>
        <ZoomOut />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={t.zoom.fit} onClick={() => getChartEngine()?.fit()}>
        <Focus />
      </Button>
      <Button variant="ghost" size="sm" className="text-xs" onClick={() => getChartEngine()?.resetChart()}>
        {t.zoom.reset}
      </Button>
    </div>
  )
}
