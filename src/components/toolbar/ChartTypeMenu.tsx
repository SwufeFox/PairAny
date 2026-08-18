/** Chart type menu: candles / hollow / OHLC / line / area. */
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@appica/ui-react/dropdown-menu'
import { Button } from '@appica/ui-react/button'
import { Candle, ChartLine, ChartArea, ChartArrowsVertical, ChevronDown } from '@appica/icons-react'
import type { ChartType } from '../../types/chart'
import { STRINGS } from '../../lib/i18n'
import { useController } from '../../app/use-controller'

const TYPES: Array<{ id: ChartType; Icon: typeof Candle }> = [
  { id: 'candles', Icon: Candle },
  { id: 'hollow', Icon: Candle },
  { id: 'ohlc', Icon: ChartArrowsVertical },
  { id: 'line', Icon: ChartLine },
  { id: 'area', Icon: ChartArea },
]

export function ChartTypeMenu() {
  const controller = useController()
  const t = STRINGS[controller.getLocale()]
  const current = controller.chartPrefs.chartType
  const CurrentIcon = TYPES.find((x) => x.id === current)?.Icon ?? Candle

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="group/type"
        render={
          <Button variant="ghost" size="sm" aria-label={t.toolbar.chartType}>
            <CurrentIcon />
            {t.chartTypes[current] ?? current}
            <ChevronDown data-icon="end" className="group-data-popup-open/type:rotate-180" />
          </Button>
        }
      />
      <DropdownMenuContent className="min-w-44">
        <DropdownMenuGroup>
          {TYPES.map(({ id, Icon }) => (
            <DropdownMenuItem key={id} onClick={() => controller.setChartPrefs({ chartType: id })}>
              <Icon data-icon="start" />
              {t.chartTypes[id] ?? id}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
