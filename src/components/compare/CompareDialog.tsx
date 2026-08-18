/** Compare: overlay another symbol's close, %-normalized per visible window. */
import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from '@appica/ui-react/dialog'
import { Button } from '@appica/ui-react/button'
import { Field, FieldLabel } from '@appica/ui-react/field'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from '@appica/ui-react/combobox'
import { ScrollArea } from '@appica/ui-react/scroll-area'
import { X } from '@appica/icons-react'
import { listUsdtQuoteSymbols } from '../../market/exchange-info'
import { STRINGS } from '../../lib/i18n'
import { useController, useControllerState } from '../../app/use-controller'

export interface CompareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CompareDialog({ open, onOpenChange }: CompareDialogProps) {
  const controller = useController()
  useControllerState()
  const t = STRINGS[controller.getLocale()]
  const [draft, setDraft] = useState('')
  const info = controller.exchange.get()
  const symbols = useMemo(() => (info ? listUsdtQuoteSymbols(info) : []), [info])

  const current = controller.compareSymbol

  const apply = (): void => {
    const symbol = draft.toUpperCase()
    if (symbols.includes(symbol)) {
      controller.setCompareSymbol(symbol)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:w-110">
        <DialogHeader>
          <DialogTitle>{t.toolbar.compare}</DialogTitle>
          <DialogDescription>{t.toolbar.compareDescription}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Symbol</FieldLabel>
            <Combobox items={symbols} value={draft} onValueChange={(v) => typeof v === 'string' && setDraft(v)}>
              <ComboboxInput placeholder="ETHUSDT" aria-label="Compare symbol" />
              <ComboboxContent>
                <ComboboxEmpty>{t.symbolDialog.noMatch}</ComboboxEmpty>
                <ScrollArea className="max-h-60">
                  <ComboboxList>
                    {(item: string) => (
                      <ComboboxItem key={item} value={item}>
                        {item}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ScrollArea>
              </ComboboxContent>
            </Combobox>
          </Field>
          {current && (
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-foreground-intense text-sm font-medium">{current}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t.toolbar.compare}
                onClick={() => controller.setCompareSymbol(null)}
              >
                <X />
              </Button>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="soft">{t.symbolDialog.cancel}</Button>} />
          <Button disabled={!symbols.includes(draft.toUpperCase())} onClick={apply}>
            {t.toolbar.compare}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
