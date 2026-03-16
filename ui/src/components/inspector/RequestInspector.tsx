import { useEffect, useState } from 'react'
import { useProxyStore } from '@/store/proxy'
import { api } from '@/api/client'
import type { Request } from '@/api/client'
import { MethodBadge } from '@/components/common/MethodBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import { X, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'request' | 'response'

export function RequestInspector() {
  const { selectedRequestId, setSelectedRequestId } = useProxyStore()
  const [req, setReq] = useState<Request | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('request')
  const [copiedMsg, setCopiedMsg] = useState('')

  useEffect(() => {
    if (!selectedRequestId) {
      setReq(null)
      return
    }
    api.requests.get(selectedRequestId).then(setReq).catch(console.error)
  }, [selectedRequestId])

  if (!req) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a request to inspect
      </div>
    )
  }

  const headers = tryParseHeaders(req.headers)
  const respHeaders = req.response ? tryParseHeaders(req.response.headers) : {}
  const bodyText = req.body ? bytesToText(req.body) : ''
  const respBodyText = req.response?.body ? bytesToText(req.response.body) : ''

  function copyRaw() {
    const raw = buildRawRequest(req!)
    navigator.clipboard.writeText(raw).catch(console.error)
    setCopiedMsg('Copied!')
    setTimeout(() => setCopiedMsg(''), 2000)
  }

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <MethodBadge method={req.method} />
        <span className="font-mono text-xs text-muted-foreground flex-1 truncate">
          {req.scheme}://{req.host}{req.path}
          {req.query ? <span className="text-muted-foreground/60">?{req.query}</span> : null}
        </span>
        <button
          onClick={copyRaw}
          title="Copy raw request"
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Copy size={14} />
        </button>
        {copiedMsg && <span className="text-xs text-primary">{copiedMsg}</span>}
        <button
          onClick={() => setSelectedRequestId(null)}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['request', 'response'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-xs font-medium capitalize transition-colors',
              activeTab === tab
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab}
            {tab === 'response' && req.response && (
              <StatusBadge code={req.response.status_code} />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {activeTab === 'request' ? (
          <>
            <HeadersPanel headers={headers} />
            {bodyText && <BodySection title="Body" content={bodyText} />}
          </>
        ) : req.response ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <StatusBadge code={req.response.status_code} />
              <span className="text-muted-foreground font-mono text-xs">{req.response.status_text}</span>
              <span className="ml-auto text-muted-foreground text-xs">{req.response.duration_ms}ms · {formatBytes(req.response.size_bytes)}</span>
            </div>
            <HeadersPanel headers={respHeaders} />
            {respBodyText && <BodySection title="Body" content={respBodyText} />}
          </>
        ) : (
          <div className="text-muted-foreground text-sm">No response</div>
        )}
      </div>
    </div>
  )
}

function HeadersPanel({ headers }: { headers: Record<string, string[]> }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Headers</div>
      <div className="space-y-1">
        {Object.entries(headers).map(([k, vs]) => (
          <div key={k} className="font-mono text-xs">
            <span className="text-primary">{k}</span>
            <span className="text-muted-foreground">: </span>
            <span className="text-foreground">{vs.join(', ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BodySection({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">{title}</div>
      <pre className="font-mono text-xs bg-background rounded-md p-3 overflow-auto max-h-80 text-foreground whitespace-pre-wrap break-all">
        {content}
      </pre>
    </div>
  )
}

function tryParseHeaders(h: string): Record<string, string[]> {
  try { return JSON.parse(h) as Record<string, string[]> } catch { return {} }
}

function bytesToText(b: number[]): string {
  try { return new TextDecoder().decode(new Uint8Array(b)) } catch { return '' }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}

function buildRawRequest(req: Request): string {
  const headers = tryParseHeaders(req.headers)
  let raw = `${req.method} ${req.path}${req.query ? '?' + req.query : ''} HTTP/1.1\r\n`
  raw += `Host: ${req.host}\r\n`
  for (const [k, vs] of Object.entries(headers)) {
    if (k.toLowerCase() === 'host') continue
    for (const v of vs) raw += `${k}: ${v}\r\n`
  }
  raw += '\r\n'
  if (req.body) raw += bytesToText(req.body)
  return raw
}
