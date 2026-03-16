import { cn } from '@/lib/utils'

const colors: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  PUT: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  PATCH: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
  OPTIONS: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  HEAD: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
}

export function MethodBadge({ method }: { method: string }) {
  const cls = colors[method?.toUpperCase()] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/30'
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-semibold border', cls)}>
      {method}
    </span>
  )
}
