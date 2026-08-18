/** Settings: language, theme, color-blind mode, volume, grid + advanced info. */
import { useTheme } from '@appica/ui-react/hooks/use-theme'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@appica/ui-react/dialog'
import { RadioGroup } from '@appica/ui-react/radio-group'
import { Radio } from '@appica/ui-react/radio'
import { Switch } from '@appica/ui-react/switch'
import { Separator } from '@appica/ui-react/separator'
import { ScrollArea } from '@appica/ui-react/scroll-area'
import { Kbd } from '@appica/ui-react/kbd'
import { SunHigh, MoonStars } from '@appica/icons-react'
import { COLOR_BLIND_OPTIONS } from '../../settings/color-blind'
import type { ColorBlindMode } from '../../settings/color-blind'
import { STRINGS } from '../../lib/i18n'
import type { Locale } from '../../lib/i18n'
import { REST_BASE_URL, WS_BASE_URL } from '../../market/config'
import { useController, useControllerState } from '../../app/use-controller'

const LANGUAGES: Array<{ id: 'auto' | Locale; label: string }> = [
  { id: 'auto', label: 'auto' },
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
]

export interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const controller = useController()
  useControllerState()
  const t = STRINGS[controller.getLocale()]
  const { resolvedTheme, setTheme, mounted } = useTheme()
  const settings = controller.getSettings()
  const stats = controller.getSyncStats()
  const ratioMode = controller.getRatioMode()
  const volumeMode = controller.getVolumeMode()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-135 sm:w-120">
        <DialogHeader>
          <DialogTitle>{t.settings.title}</DialogTitle>
          <DialogDescription>{t.settings.description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 px-6 py-4">
          <section className="flex flex-col gap-2">
            <h3 className="text-foreground-intense text-sm font-medium">{t.settings.language}</h3>
            <RadioGroup
              orientation="horizontal"
              value={settings.language}
              onValueChange={(v) => controller.setLanguage(v as 'auto' | Locale)}
              aria-label={t.settings.language}
            >
              {LANGUAGES.map((lang) => (
                <label key={lang.id} className="flex items-center gap-2 text-sm select-none">
                  <Radio value={lang.id} />
                  {lang.id === 'auto' ? t.settings.auto : lang.label}
                </label>
              ))}
            </RadioGroup>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <h3 className="text-foreground-intense text-sm font-medium">{t.settings.theme}</h3>
            <RadioGroup
              orientation="horizontal"
              value={mounted ? (resolvedTheme as string) : 'dark'}
              onValueChange={(v) => setTheme(v as 'light' | 'dark')}
              aria-label={t.settings.theme}
            >
              <label className="flex items-center gap-2 text-sm select-none">
                <Radio value="dark" />
                <MoonStars data-icon="end" />
                {t.settings.dark}
              </label>
              <label className="flex items-center gap-2 text-sm select-none">
                <Radio value="light" />
                <SunHigh data-icon="end" />
                {t.settings.light}
              </label>
            </RadioGroup>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <h3 className="text-foreground-intense text-sm font-medium">{t.settings.colorBlind}</h3>
            <RadioGroup
              value={settings.colorBlind}
              onValueChange={(v) => controller.setColorBlind(v as ColorBlindMode)}
              aria-label={t.settings.colorBlind}
            >
              {COLOR_BLIND_OPTIONS.map((option) => (
                <label key={option.id} className="flex items-start gap-2.5 text-sm select-none">
                  <Radio value={option.id} className="mt-0.5" />
                  <span className="flex flex-col">
                    <span className="text-foreground-intense font-medium">{t.colorBlind[option.id].label}</span>
                    <span className="text-foreground-muted text-xs">{t.colorBlind[option.id].description}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <h3 className="text-foreground-intense text-sm font-medium">{t.settings.chart}</h3>
            <label className="flex items-center justify-between gap-4 text-sm select-none">
              <span className="flex flex-col">
                <span>{t.settings.showGrid}</span>
              </span>
              <Switch
                checked={settings.showGrid}
                onCheckedChange={(v) => controller.setChartPrefs({ showGrid: v })}
              />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm select-none">
              <span className="flex flex-col">
                <span>{t.settings.volume}</span>
                <span className="text-foreground-muted text-xs">{t.settings.volumeHint}</span>
              </span>
              <Switch
                checked={settings.volumeMode !== 'hidden'}
                onCheckedChange={(v) => controller.setVolumeMode(v ? 'auto' : 'hidden')}
              />
            </label>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <h3 className="text-foreground-intense text-sm font-medium">{t.settings.advanced}</h3>
            <InfoRow label={t.settings.dataSource} value={`Binance · ${t.statusBar.live}`} />
            <InfoRow label={t.settings.ratioMode} value={ratioMode === 'approximate' ? t.settings.approximate : t.settings.tickAccurate} />
            <InfoRow label={t.settings.alignedCandles} value={String(stats.aligned)} />
            {stats.missingA + stats.missingB > 0 && <InfoRow label={t.settings.missingCandles} value={String(stats.missingA + stats.missingB)} />}
            <InfoRow
              label={t.settings.volumeMode}
              value={volumeMode === 'hidden' ? t.settings.hidden : volumeMode === 'synthetic' ? t.settings.estimated : t.settings.volume}
            />
            <InfoRow label={t.settings.restEndpoint} value={REST_BASE_URL} mono />
            <InfoRow label={t.settings.wsEndpoint} value={WS_BASE_URL} mono />
            <p className="text-foreground-subtle text-xs">{t.settings.endpointNote}</p>
          </section>

          <p className="text-foreground-subtle text-xs">
            <Kbd size="sm">F</Kbd> {t.contextMenu.fitContent} · <Kbd size="sm">L</Kbd> {t.contextMenu.toggleLog} · <Kbd size="sm">Ctrl</Kbd> <Kbd size="sm">K</Kbd>{' '}
            {t.toolbar.changePair} · <Kbd size="sm">Ctrl</Kbd> <Kbd size="sm">Shift</Kbd> <Kbd size="sm">D</Kbd> {t.toolbar.dataWindow}
          </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-foreground-muted text-xs">{label}</span>
      <span className={`text-foreground-intense text-xs ${mono ? 'tnum' : ''}`}>{value}</span>
    </div>
  )
}
