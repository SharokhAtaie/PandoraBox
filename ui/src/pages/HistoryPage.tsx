import { useState, useRef, useCallback } from 'react'
import { RequestTable } from '@/components/history/RequestTable'
import { RequestInspector } from '@/components/inspector/RequestInspector'
import { useProxyStore } from '@/store/proxy'

export function HistoryPage() {
  const selectedId = useProxyStore((s) => s.selectedRequestId)
  const [splitPct, setSplitPct] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const onMouseDown = useCallback(() => {
    dragging.current = true
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pct = Math.min(80, Math.max(20, ((e.clientX - rect.left) / rect.width) * 100))
    setSplitPct(pct)
  }, [])

  const onMouseUp = useCallback(() => {
    dragging.current = false
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex h-full"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div style={{ width: selectedId ? `${splitPct}%` : '100%' }} className="min-w-0 overflow-hidden">
        <RequestTable />
      </div>
      {selectedId && (
        <>
          <div
            className="w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors flex-shrink-0"
            onMouseDown={onMouseDown}
          />
          <div style={{ width: `${100 - splitPct}%` }} className="min-w-0 overflow-hidden">
            <RequestInspector />
          </div>
        </>
      )}
    </div>
  )
}
