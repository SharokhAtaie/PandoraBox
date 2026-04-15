import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useMemo, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  className?: string
  placeholder?: string
  disabled?: boolean
  searchable?: boolean
  searchPlaceholder?: string
}

export function Select({
  value,
  onChange,
  options,
  className,
  placeholder,
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Search...',
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const current = options.find((o) => o.value === value)
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) => opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q))
  }, [options, query])

  return (
    <DropdownMenu.Root
      modal={false}
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex items-center justify-between gap-1.5 bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/50 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed',
            className
          )}
        >
          <span className="truncate">{current?.label ?? placeholder ?? value}</span>
          <ChevronDown size={11} className="text-muted-foreground flex-shrink-0" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-[200] min-w-[8rem] max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-xl py-1 text-xs animate-in fade-in-0 zoom-in-95"
          sideOffset={4}
          align="start"
          avoidCollisions
        >
          {searchable && (
            <div className="sticky top-0 z-10 border-b border-border/80 bg-card px-2 py-1.5">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
            </div>
          )}
          {filteredOptions.map((opt) => (
            <DropdownMenu.Item
              key={opt.value}
              onSelect={() => onChange(opt.value)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none outline-none transition-colors',
                opt.value === value
                  ? 'text-primary bg-primary/10'
                  : 'text-foreground hover:bg-muted focus:bg-muted'
              )}
            >
              <span className="flex-1">{opt.label}</span>
              {opt.value === value && (
                <Check size={11} className="text-primary flex-shrink-0" />
              )}
            </DropdownMenu.Item>
          ))}
          {filteredOptions.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No results</div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
