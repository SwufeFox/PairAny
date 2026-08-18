/** Indicators panel: add from the catalog, edit/remove active instances. */
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@appica/ui-react/dialog'
import { Button } from '@appica/ui-react/button'
import { Switch } from '@appica/ui-react/switch'
import { NumberField } from '@appica/ui-react/number-field'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@appica/ui-react/select'
import { Separator } from '@appica/ui-react/separator'
import { ScrollArea } from '@appica/ui-react/scroll-area'
import { Kbd } from '@appica/ui-react/kbd'
import { Plus, Trash, Eye, EyeOff } from '@appica/icons-react'
import { indicatorsByCategory } from '../../indicators/registry'
import { STRINGS } from '../../lib/i18n'
import type { IndicatorInstance, IndicatorPlacement, ParamSchema, ParamValue } from '../../types/indicators'
import { useController, useControllerState } from '../../app/use-controller'

export interface IndicatorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IndicatorDialog({ open, onOpenChange }: IndicatorDialogProps) {
  const controller = useController()
  useControllerState()
  const t = STRINGS[controller.getLocale()]
  const categories = indicatorsByCategory()
  const instances = controller.listInstances()
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-135 sm:w-140">
        <DialogHeader>
          <DialogTitle>{t.indicatorDialog.title}</DialogTitle>
          <DialogDescription>{t.indicatorDialog.description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 px-6 py-4">
            <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 pr-2">
              {[...categories.entries()].map(([category, defs]) => (
                <section key={category}>
                  <h3 className="text-foreground-subtle mb-1.5 text-[11px] font-semibold tracking-wide uppercase">
                    {t.indicatorDialog[category]}
                  </h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    {defs.map((def) => {
                      const already = instances.filter((i) => i.definitionId === def.id).length
                      return (
                        <Button
                          key={def.id}
                          variant="outline"
                          size="sm"
                          className="justify-start"
                          onClick={() => {
                            const inst = controller.addIndicator(def.id)
                            if (inst) setExpanded(inst.uid)
                          }}
                        >
                          <Plus data-icon="start" className="text-foreground-subtle" />
                          {t.indicators[def.id] ?? def.name}
                          {already > 0 && <span className="text-foreground-subtle ms-auto text-xs">×{already}</span>}
                        </Button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
            </div>

            <Separator />

            <div className="flex flex-col">
              <h3 className="text-foreground-subtle mb-1.5 text-[11px] font-semibold tracking-wide uppercase">
                {t.indicatorDialog.active} ({instances.length})
              </h3>
              {instances.length === 0 && (
                <p className="text-foreground-muted py-2 text-sm">{t.indicatorDialog.none}</p>
              )}
              <div className="flex flex-col pr-2">
                {instances.map((instance) => (
                  <IndicatorRow
                    key={instance.uid}
                    instance={instance}
                    expanded={expanded === instance.uid}
                    onToggleExpand={() => setExpanded(expanded === instance.uid ? null : instance.uid)}
                  />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function IndicatorRow({
  instance,
  expanded,
  onToggleExpand,
}: {
  instance: IndicatorInstance
  expanded: boolean
  onToggleExpand: () => void
}) {
  const controller = useController()
  const t = STRINGS[controller.getLocale()]
  const def = controller.indicators.getDefinition(instance.definitionId)
  if (!def) return null
  const label = instance.definitionId === 'volume' ? t.indicators.volume : (t.indicators[instance.definitionId] ?? def.name)
  const paramText = Object.entries(instance.params)
    .map(([k, v]) => `${t.params[k] ?? k} ${String(v)}`)
    .join(' · ')

  return (
    <div className="border-border-muted flex flex-col border-b py-2 last:border-b-0">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 rounded-md px-1 py-1 text-left text-sm hover:bg-background-muted"
          onClick={onToggleExpand}
        >
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: `var(--chart-ind-${((instance.colorOffset % 8) + 1) as 1})` }}
          />
          <span className="text-foreground-intense font-medium">{label}</span>
          <span className="text-foreground-subtle text-xs">{paramText}</span>
          <Kbd size="sm" className="ms-auto">
            {t.indicatorDialog[instance.placement]}
          </Kbd>
        </button>
        <label className="flex items-center gap-1.5 text-xs select-none" title={instance.visible ? t.indicatorDialog.hide : t.indicatorDialog.show}>
          <Switch
            size="sm"
            checked={instance.visible}
            onCheckedChange={(v) => controller.updateIndicator(instance.uid, { visible: v })}
          />
          {instance.visible ? <Eye className="text-foreground-subtle size-3.5" /> : <EyeOff className="text-foreground-subtle size-3.5" />}
        </label>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${t.indicatorDialog.delete} ${label}`}
          onClick={() => controller.removeIndicator(instance.uid)}
        >
          <Trash />
        </Button>
      </div>
      {expanded && (
        <div className="mt-2 flex flex-wrap items-end gap-3 rounded-md bg-background-muted/50 p-2.5">
          {def.paramSchema.map((schema) => (
            <ParamEditor
              key={schema.key}
              schema={schema}
              value={instance.params[schema.key]}
              onChange={(v) => controller.updateIndicator(instance.uid, { params: { [schema.key]: v } })}
            />
          ))}
          <div className="flex flex-col gap-1">
            <span className="text-foreground-subtle text-xs">{t.indicatorDialog.position}</span>
            <Select
              value={instance.placement}
              onValueChange={(v) => controller.updateIndicator(instance.uid, { placement: v as IndicatorPlacement })}
              size="sm"
            >
              <SelectTrigger aria-label={t.indicatorDialog.position}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overlay">{t.indicatorDialog.overlay}</SelectItem>
                <SelectItem value="pane">{t.indicatorDialog.pane}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}

function ParamEditor({
  schema,
  value,
  onChange,
}: {
  schema: ParamSchema
  value: ParamValue | undefined
  onChange: (v: ParamValue) => void
}) {
  const controller = useController()
  const t = STRINGS[controller.getLocale()]
  const label = t.params[schema.key] ?? schema.label
  if (schema.type === 'select') {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-foreground-subtle text-xs">{label}</span>
        <Select value={String(value ?? '')} onValueChange={(v) => onChange(String(v))} size="sm">
          <SelectTrigger aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {schema.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t.sources[opt.value] ?? opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }
  if (schema.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-xs select-none">
        <Switch
          size="sm"
          checked={value === true}
          onCheckedChange={(v) => onChange(v)}
        />
        {label}
      </label>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-foreground-subtle text-xs">{label}</span>
      <NumberField
        size="sm"
        className="w-24"
        value={typeof value === 'number' ? value : Number(schema.min ?? 1)}
        min={schema.min}
        max={schema.max}
        step={schema.step ?? 1}
        onValueChange={(v) => v !== null && onChange(v)}
        aria-label={label}
      />
    </div>
  )
}
