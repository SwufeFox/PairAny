/** Interval picker: quick buttons + full-select for every Binance interval. */
import { Button } from '@appica/ui-react/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@appica/ui-react/select'
import { QUICK_INTERVALS, ALL_INTERVALS, intervalLabel, intervalLongLabel } from '../../lib/interval'
import { STRINGS } from '../../lib/i18n'
import type { KlineInterval } from '../../types/market'
import { useController } from '../../app/use-controller'

export function IntervalPicker() {
  const controller = useController()
  const t = STRINGS[controller.getLocale()]
  const current = controller.getInterval()

  return (
    <div className="flex items-center gap-0.5">
      {QUICK_INTERVALS.map((interval) => {
        const active = interval === current
        return (
          <Button
            key={interval}
            variant={active ? 'soft' : 'ghost'}
            size="sm"
            className={active ? 'text-foreground-intense' : 'text-foreground-muted'}
            onClick={() => controller.setInterval(interval)}
          >
            {intervalLabel(interval)}
          </Button>
        )
      })}
      <Select value={current} onValueChange={(v) => controller.setInterval(v as KlineInterval)} size="sm">
        <SelectTrigger aria-label={t.toolbar.allIntervals} className="ms-0.5 w-auto">
          <SelectValue>{() => t.intervals[current] ?? intervalLongLabel(current)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ALL_INTERVALS.map((interval) => (
            <SelectItem key={interval} value={interval}>
              {t.intervals[interval] ?? intervalLongLabel(interval)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
