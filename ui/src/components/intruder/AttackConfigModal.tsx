import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Settings2 } from 'lucide-react'
import { AttackTypeSelector } from './AttackTypeSelector'
import { PayloadSetPanel } from './PayloadSetPanel'
import type { AttackType, PayloadConfig } from '@/store/intruder'

interface Props {
  open: boolean
  onClose: () => void
  attackType: AttackType
  payloadSets: PayloadConfig[]
  markerCount: number
  concurrency: number
  delay: number
  onSave: (patch: {
    attackType: AttackType
    payloadSets: PayloadConfig[]
    concurrency: number
    delay: number
  }) => void
}

export function AttackConfigModal({
  open, onClose,
  attackType: initAttackType,
  payloadSets: initPayloadSets,
  markerCount,
  concurrency: initConcurrency,
  delay: initDelay,
  onSave,
}: Props) {
  const [attackType, setAttackType] = useState<AttackType>(initAttackType)
  const [payloadSets, setPayloadSets] = useState<PayloadConfig[]>(initPayloadSets)
  const [concurrency, setConcurrency] = useState(initConcurrency)
  const [delay, setDelay] = useState(initDelay)
  const [activeMarker, setActiveMarker] = useState(0)

  // Reset local state when modal opens with fresh props
  function handleOpenChange(next: boolean) {
    if (next) {
      setAttackType(initAttackType)
      setPayloadSets(initPayloadSets)
      setConcurrency(initConcurrency)
      setDelay(initDelay)
      setActiveMarker(0)
    } else {
      onClose()
    }
  }

  function handleSave() {
    onSave({ attackType, payloadSets, concurrency, delay })
    onClose()
  }

  function handlePayloadChange(index: number, cfg: PayloadConfig) {
    setPayloadSets((prev) => {
      const next = [...prev]
      next[index] = cfg
      return next
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[680px] max-w-[calc(100vw-2rem)] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <Settings2 size={18} className="text-primary" />
              <Dialog.Title className="text-base font-semibold text-foreground">Attack Configuration</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-6">

            {/* Attack Type */}
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Attack Type</p>
              <AttackTypeSelector value={attackType} onChange={setAttackType} />
            </section>

            {/* Payload Sets */}
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Payload Sets
                {markerCount > 0 && (
                  <span className="ml-1.5 text-primary font-normal normal-case">
                    {markerCount} marker{markerCount !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
              <PayloadSetPanel
                markerCount={markerCount}
                payloadSets={payloadSets}
                activeMarker={activeMarker}
                onSelectMarker={setActiveMarker}
                onChange={handlePayloadChange}
              />
            </section>

            {/* Performance */}
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Performance</p>
              <div className="grid grid-cols-2 gap-4">

                {/* Concurrency */}
                <div className="rounded-lg border border-border bg-background/50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Concurrency</span>
                    <span className="text-sm font-mono text-primary">{concurrency}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={concurrency}
                    onChange={(e) => setConcurrency(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {concurrency === 1
                      ? 'Sequential — one request at a time'
                      : `${concurrency} requests in parallel`}
                  </p>
                </div>

                {/* Delay */}
                <div className="rounded-lg border border-border bg-background/50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Delay between requests</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={60000}
                      step={50}
                      value={delay}
                      onChange={(e) => setDelay(Math.max(0, Number(e.target.value)))}
                      className="w-24 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-sm text-muted-foreground">ms</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {delay === 0
                      ? 'No delay — full speed'
                      : delay < 1000
                        ? `${delay}ms pause between each request`
                        : `${(delay / 1000).toFixed(1)}s pause between each request`}
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
