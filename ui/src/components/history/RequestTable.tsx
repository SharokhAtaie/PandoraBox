import { useProxyStore } from '@/store/proxy'
import { useRequests } from '@/hooks/useRequests'
import { MethodBadge } from '@/components/common/MethodBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import { cn } from '@/lib/utils'
import type { Request } from '@/api/client'
import { Search, Globe } from 'lucide-react'

export function RequestTable() {
  useRequests()

  const { requests, selectedRequestId, setSelectedRequestId, filters, setFilters } = useProxyStore()

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-input border border-border rounded-md font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Search host, path, query..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
          />
        </div>
        <select
          className="text-sm bg-input border border-border rounded-md px-2 py-1.5 text-foreground focus:outline-none"
          value={filters.method}
          onChange={(e) => setFilters({ method: e.target.value })}
        >
          <option value="">All Methods</option>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground px-2">
          {requests.length} requests
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-card border-b border-border text-muted-foreground text-xs font-medium">
              <th className="text-left px-3 py-2 w-8">#</th>
              <th className="text-left px-3 py-2 w-20">Method</th>
              <th className="text-left px-3 py-2 w-12">Status</th>
              <th className="text-left px-3 py-2 min-w-0 w-[160px]">Host</th>
              <th className="text-left px-3 py-2 min-w-0">Path</th>
              <th className="text-right px-3 py-2 w-20 hidden min-[900px]:table-cell">Size</th>
              <th className="text-right px-3 py-2 w-20 hidden min-[900px]:table-cell">Time</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <RequestRow
                key={req.id}
                req={req}
                selected={req.id === selectedRequestId}
                onClick={() => setSelectedRequestId(req.id === selectedRequestId ? null : req.id)}
              />
            ))}
          </tbody>
        </table>
        {requests.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Globe className="mb-2 opacity-30" size={32} />
            <p className="text-sm">No requests captured yet</p>
            <p className="text-xs mt-1">Configure your browser to use proxy on port 8080</p>
          </div>
        )}
      </div>
    </div>
  )
}

function RequestRow({
  req,
  selected,
  onClick,
}: {
  req: Request
  selected: boolean
  onClick: () => void
}) {
  const resp = req.response
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-b border-border/50 cursor-pointer transition-colors',
        selected
          ? 'bg-primary/10 border-primary/30'
          : 'hover:bg-muted/30'
      )}
    >
      <td className="px-3 py-1.5 text-muted-foreground font-mono text-xs">{req.id}</td>
      <td className="px-3 py-1.5">
        <MethodBadge method={req.method} />
      </td>
      <td className="px-3 py-1.5">
        {resp ? <StatusBadge code={resp.status_code} /> : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground min-w-0 w-[160px] max-w-[160px]">
        <div className="truncate"><span className="text-foreground">{req.scheme}://</span>{req.host}</div>
      </td>
      <td className="px-3 py-1.5 font-mono text-xs min-w-0">
        <div className="truncate">
          {req.path}{req.query ? <span className="text-muted-foreground">?{req.query}</span> : null}
        </div>
      </td>
      <td className="px-3 py-1.5 text-right font-mono text-xs text-muted-foreground hidden min-[900px]:table-cell">
        {resp ? formatBytes(resp.size_bytes) : '—'}
      </td>
      <td className="px-3 py-1.5 text-right font-mono text-xs text-muted-foreground hidden min-[900px]:table-cell">
        {resp ? `${resp.duration_ms}ms` : '—'}
      </td>
    </tr>
  )
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}
