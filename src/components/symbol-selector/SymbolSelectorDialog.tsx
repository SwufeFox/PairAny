/** Symbol selector: search base/quote assets from live exchangeInfo, choose
 * Direct vs Synthetic when a direct pair exists, and quick-apply recents. */
import { useEffect, useMemo, useState } from 'react'
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
import { Badge } from '@appica/ui-react/badge'
import { RadioGroup } from '@appica/ui-react/radio-group'
import { Radio } from '@appica/ui-react/radio'
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
import { Spinner } from '@appica/ui-react/spinner'
import { Alert, AlertIcon, AlertTitle } from '@appica/ui-react/alert'
import { AlertTriangleFilled, ArrowLeftRight } from '@appica/icons-react'
import { listBaseAssets, listQuoteAssets } from '../../market/exchange-info'
import { STRINGS, format as fmt } from '../../lib/i18n'
import { useController, useControllerState } from '../../app/use-controller'
import type { PairMode } from '../../settings/persistence'

export interface SymbolSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the search opens focused on this asset slot. */
  focusSlot: 'base' | 'quote'
}

export function SymbolSelectorDialog({ open, onOpenChange, focusSlot }: SymbolSelectorProps) {
  const controller = useController()
  useControllerState()
  const t = STRINGS[controller.getLocale()]
  const settings = controller.getSettings()
  const [base, setBase] = useState(settings.pair.base)
  const [quote, setQuote] = useState(settings.pair.quote)
  const [mode, setMode] = useState<PairMode>(settings.pair.mode)

  useEffect(() => {
    if (open) {
      const p = controller.getSettings().pair
      setBase(p.base)
      setQuote(p.quote)
      setMode(p.mode)
    }
  }, [open, controller])

  const info = controller.exchange.get()
  const baseAssets = useMemo(() => (info ? listBaseAssets(info) : []), [info])
  const quoteAssets = useMemo(() => (info ? listQuoteAssets(info) : []), [info])
  // The denominator of a synthetic pair can be ANY asset (e.g. BNB/DOGE) —
  // it does not need to be a quote asset on Binance.
  const allAssets = useMemo(() => {
    const set = new Set<string>()
    for (const a of baseAssets) set.add(a.asset)
    for (const a of quoteAssets) set.add(a)
    return [...set].sort()
  }, [baseAssets, quoteAssets])
  const baseSymbols = useMemo(() => baseAssets.map((a) => a.asset), [baseAssets])
  const quoteSymbols = allAssets

  const validation = controller.validatePair(base, quote, mode)
  const hasDirect = controller.exchange.getDirectPair(base, quote) !== null
  const syntheticValidation = controller.validatePair(base, quote, 'synthetic')
  const legSymbols = validation.ok ? validation.symbols : syntheticValidation.symbols
  const recents = controller.getRecentPairs()
  const loaded = controller.exchange.get() !== null

  const apply = (b = base, q = quote, m = mode): void => {
    if (!validation.ok && b === base && q === quote) return
    const v = controller.validatePair(b, q, m)
    if (!v.ok) return
    controller.setPair(b, q, v.mode === 'synthetic' && m === 'synthetic' ? 'synthetic' : 'auto')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:w-130">
        <DialogHeader>
          <DialogTitle>{t.symbolDialog.title}</DialogTitle>
          <DialogDescription>{t.symbolDialog.description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {!loaded && (
            <div className="flex h-32 items-center justify-center gap-2 text-foreground-muted text-sm">
              <Spinner variant="dots" className="text-lg" />
              {t.symbolDialog.loadingMarkets}
            </div>
          )}
          {loaded && (
            <>
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <Field>
                  <FieldLabel>{t.symbolDialog.baseAsset}</FieldLabel>
                  <AssetCombobox
                    assets={baseSymbols}
                    value={base}
                    onValueChange={setBase}
                    placeholder="BTC"
                    autoFocus={open && focusSlot === 'base'}
                  />
                </Field>
                <Button
                  variant="ghost"
                  size="icon-md"
                  aria-label={t.toolbar.swap}
                  title={t.toolbar.swap}
                  onClick={() => {
                    setBase(quote)
                    setQuote(base)
                  }}
                >
                  <ArrowLeftRight />
                </Button>
                <Field>
                  <FieldLabel>{t.symbolDialog.quoteAsset}</FieldLabel>
                  <AssetCombobox
                    assets={quoteSymbols}
                    value={quote}
                    onValueChange={setQuote}
                    placeholder="ETH"
                    autoFocus={open && focusSlot === 'quote'}
                  />
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
                {legSymbols.length === 2 && base !== quote && (
                  <span>
                    {t.symbolDialog.syntheticLegs}: <span className="tnum font-medium">{legSymbols[0]}</span> /{' '}
                    <span className="tnum font-medium">{legSymbols[1]}</span>
                  </span>
                )}
                {hasDirect && (
                  <Badge variant="secondary" size="sm">
                    {t.symbolDialog.directExists} {controller.exchange.getDirectPair(base, quote)}
                  </Badge>
                )}
              </div>

              {hasDirect && (
                <Field>
                  <FieldLabel>{t.symbolDialog.pairType}</FieldLabel>
                  <RadioGroup value={mode} onValueChange={(v) => setMode(v as PairMode)} orientation="horizontal">
                    <label className="flex items-center gap-2 text-sm select-none">
                      <Radio value="direct" />
                      {t.symbolDialog.directPair}
                    </label>
                    {syntheticValidation.ok && (
                      <label className="flex items-center gap-2 text-sm select-none">
                        <Radio value="synthetic" />
                        {t.symbolDialog.syntheticPair}
                      </label>
                    )}
                  </RadioGroup>
                </Field>
              )}

              {!validation.ok && validation.errorKey && (
                <Alert variant="warning">
                  <AlertIcon>
                    <AlertTriangleFilled />
                  </AlertIcon>
                  <AlertTitle>{fmt(t.symbolDialog[validation.errorKey], validation.errorParams)}</AlertTitle>
                </Alert>
              )}

              {recents.length > 0 && (
                <Field>
                  <FieldLabel>{t.symbolDialog.recent}</FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {recents.map((pair) => {
                      const [b, q] = pair.split('/') as [string, string]
                      return (
                        <Button key={pair} variant="soft" size="sm" onClick={() => apply(b, q, 'auto')}>
                          {pair}
                        </Button>
                      )
                    })}
                  </div>
                </Field>
              )}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="soft">{t.symbolDialog.cancel}</Button>} />
          <Button disabled={!loaded || !validation.ok} onClick={() => apply()}>
            {t.symbolDialog.apply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssetCombobox({
  assets,
  value,
  onValueChange,
  placeholder,
  autoFocus,
}: {
  assets: string[]
  value: string
  onValueChange: (v: string) => void
  placeholder: string
  autoFocus?: boolean
}) {
  const controller = useController()
  const t = STRINGS[controller.getLocale()]
  return (
    <Combobox items={assets} value={value} onValueChange={(v) => typeof v === 'string' && onValueChange(v)}>
      <ComboboxInput placeholder={placeholder} aria-label={placeholder} autoFocus={autoFocus} />
      <ComboboxContent>
        <ComboboxEmpty>{t.symbolDialog.noMatch}</ComboboxEmpty>
        <ScrollArea className="max-h-72">
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
  )
}
