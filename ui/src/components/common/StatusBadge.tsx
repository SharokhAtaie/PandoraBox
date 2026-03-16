import { cn } from '@/lib/utils'

function statusColor(code: number): string {
  if (code >= 500) return 'bg-red-500/15 text-red-400 border-red-500/30'
  if (code >= 400) return 'bg-orange-500/15 text-orange-400 border-orange-500/30'
  if (code >= 300) return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
  if (code >= 200) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  return 'bg-slate-500/15 text-slate-400 border-slate-500/30'
}

export function StatusBadge({ code }: { code: number }) {
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-semibold border', statusColor(code))}>
      {code}
    </span>
  )
}
