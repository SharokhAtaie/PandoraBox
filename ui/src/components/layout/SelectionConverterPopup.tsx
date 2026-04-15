import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import type { ConverterAlgorithm } from '@/api/client'
import { useProxyStore } from '@/store/proxy'
import { useConverterStore } from '@/store/converter'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/Select'

type PopupState = {
  text: string
  x: number
  y: number
}

export function SelectionConverterPopup() {
  const navigate = useNavigate()
  const project = useProxyStore((s) => s.project)
  const sendToConverter = useConverterStore((s) => s.sendToConverter)
  const [popup, setPopup] = useState<PopupState | null>(null)
  const [algorithm, setAlgorithm] = useState('base64_decode')
  const [stackId, setStackId] = useState('')
  const [preview, setPreview] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [algorithms, setAlgorithms] = useState<ConverterAlgorithm[]>([])
  const holdPopupUntilRef = useRef(0)
  const popupRef = useRef<HTMLDivElement | null>(null)
  const popupOpenRef = useRef(false)

  const stacks = project?.converter?.stacks ?? []
  const hasStacks = stacks.length > 0

  useEffect(() => {
    if (!hasStacks) {
      setStackId('')
      return
    }
    if (!stackId || !stacks.some((s) => s.id === stackId)) {
      setStackId(stacks[0].id)
    }
  }, [hasStacks, stackId, stacks])

  useEffect(() => {
    api.converter.get().then((r) => {
      setAlgorithms(r.algorithms ?? [])
      if ((r.algorithms ?? []).length > 0) {
        setAlgorithm((r.algorithms ?? [])[0].id)
      }
    }).catch(console.error)
  }, [])

  useEffect(() => {
    popupOpenRef.current = Boolean(popup)
  }, [popup])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!popupOpenRef.current) return
      const target = event.target as Element | null
      if (!target) return
      const insidePopup = Boolean(popupRef.current?.contains(target))
      const insideRadixMenu = Boolean(target.closest('[data-radix-popper-content-wrapper]'))
      if (!insidePopup && !insideRadixMenu) {
        setPopup(null)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPopup(null)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    const onCodeViewerSelection = (event: Event) => {
      const custom = event as CustomEvent<{ text: string; x: number; y: number } | null>
      const detail = custom.detail
      if (!detail || !detail.text?.trim()) {
        return
      }
      holdPopupUntilRef.current = Date.now() + 600
      setPreview('')
      setShowPreview(false)
      setPopup({
        text: detail.text.slice(0, 25000),
        x: Math.min(window.innerWidth - 360, Math.max(12, detail.x)),
        y: Math.min(window.innerHeight - 220, Math.max(12, detail.y)),
      })
    }

    const onSelection = () => {
      if (Date.now() < holdPopupUntilRef.current) {
        return
      }
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) {
        // Keep popup stable while user interacts with popup/dropdowns;
        // outside click / Escape handles closing.
        if (!popupOpenRef.current) setPopup(null)
        return
      }
      const text = sel.toString()
      if (!text.trim()) {
        setPopup(null)
        return
      }
      const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null
      if (!range) return
      const rect = range.getBoundingClientRect()
      if (!rect || (rect.width === 0 && rect.height === 0)) return

      const anchor = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement
      const isMonaco = Boolean(anchor?.closest('.monaco-editor'))
      if (!isMonaco && anchor && (anchor.closest('input, textarea, [contenteditable="true"]'))) {
        setPopup(null)
        return
      }
      holdPopupUntilRef.current = 0

      setPreview('')
      setShowPreview(false)
      setPopup({
        text: text.slice(0, 25000),
        x: Math.min(window.innerWidth - 360, Math.max(12, rect.left)),
        y: Math.min(window.innerHeight - 220, Math.max(12, rect.bottom + 8)),
      })
    }

    document.addEventListener('mouseup', onSelection)
    document.addEventListener('keyup', onSelection)
    document.addEventListener('selectionchange', onSelection)
    window.addEventListener('pandora:converter-selection', onCodeViewerSelection as EventListener)
    return () => {
      document.removeEventListener('mouseup', onSelection)
      document.removeEventListener('keyup', onSelection)
      document.removeEventListener('selectionchange', onSelection)
      window.removeEventListener('pandora:converter-selection', onCodeViewerSelection as EventListener)
    }
  }, [])

  const selectedSummary = useMemo(() => {
    if (!popup) return ''
    const s = popup.text.replace(/\s+/g, ' ').trim()
    return s.length > 96 ? `${s.slice(0, 96)}…` : s
  }, [popup])

  if (!popup) return null
  const selectedText = popup.text

  async function runQuickPreview() {
    setBusy(true)
    try {
      const r = await api.converter.transform({ input: selectedText, algorithm })
      setPreview(r.output)
      setShowPreview(true)
    } catch (e) {
      setPreview(e instanceof Error ? e.message : 'Failed')
      setShowPreview(true)
    } finally {
      setBusy(false)
    }
  }

  async function runStackPreview() {
    if (!stackId) return
    setBusy(true)
    try {
      const r = await api.converter.runStack({ input: selectedText, stack_id: stackId })
      setPreview(r.output)
      setShowPreview(true)
    } catch (e) {
      setPreview(e instanceof Error ? e.message : 'Failed')
      setShowPreview(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      ref={popupRef}
      className="fixed z-[80] w-[340px] rounded-xl border border-border bg-card shadow-2xl p-3 space-y-2"
      style={{ left: popup.x, top: popup.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="text-[11px] text-muted-foreground">Selected text</div>
      <div className="text-xs font-mono text-foreground/90 bg-muted/30 border border-border/60 rounded-md p-2 break-all">{selectedSummary}</div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            sendToConverter(selectedText, algorithm)
            navigate('/converter')
            setPopup(null)
          }}
          className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Send to Converter
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Select
          value={algorithm}
          onChange={setAlgorithm}
          options={algorithms.map((a) => ({ value: a.id, label: a.label }))}
          className="h-[30px]"
          searchable
          searchPlaceholder="Search algorithms..."
        />
        <button
          onClick={() => runQuickPreview().catch(console.error)}
          disabled={busy}
          className={cn('px-2.5 py-1.5 rounded-md text-xs border border-border text-muted-foreground hover:text-foreground', busy && 'opacity-60')}
        >
          Run
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Select
          value={stackId}
          onChange={setStackId}
          options={
            hasStacks
              ? stacks.map((s) => ({ value: s.id, label: s.name }))
              : [{ value: '', label: 'No ConvertStacks' }]
          }
          placeholder="Select stack"
          className="h-[30px]"
          disabled={!hasStacks}
        />
        <button
          onClick={() => runStackPreview().catch(console.error)}
          disabled={busy || !stackId}
          className={cn('px-2.5 py-1.5 rounded-md text-xs border border-border text-muted-foreground hover:text-foreground', (busy || !stackId) && 'opacity-60')}
        >
          Stack
        </button>
      </div>

      {showPreview && (
        <textarea
          value={preview}
          readOnly
          className="w-full h-24 bg-background border border-border rounded-md p-2 text-xs font-mono resize-none"
        />
      )}
    </div>
  )
}
