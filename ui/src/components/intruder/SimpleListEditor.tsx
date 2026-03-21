import { useRef, useState } from 'react'
import { ChevronDown, FolderOpen } from 'lucide-react'
import { BUILTIN_LISTS } from '@/lib/builtinPayloads'

interface Props {
  values: string[]
  onChange: (values: string[]) => void
}

export function SimpleListEditor({ values, onChange }: Props) {
  const [showBuiltins, setShowBuiltins] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const text = values.join('\n')
  const count = values.filter((v) => v.trim()).length

  function handleFileLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      onChange(content.split(/\r?\n/))
    }
    reader.readAsText(file)
    // Reset input so same file can be re-loaded
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground flex-1">
          {count} payload{count !== 1 ? 's' : ''} — one per line
        </span>

        {/* Load from file */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:border-zinc-500 hover:text-foreground text-muted-foreground transition-colors"
        >
          <FolderOpen size={11} />
          Load from file
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv,.wordlist,text/plain"
          className="hidden"
          onChange={handleFileLoad}
        />

        {/* Load built-in */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowBuiltins((v) => !v)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:border-zinc-500 hover:text-foreground text-muted-foreground transition-colors"
          >
            Built-in lists <ChevronDown size={11} />
          </button>
          {showBuiltins && (
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg border border-border bg-card shadow-lg py-1">
              {BUILTIN_LISTS.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => {
                    onChange(list.values)
                    setShowBuiltins(false)
                  }}
                  className="flex w-full items-center justify-between gap-4 px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
                >
                  <span>{list.label}</span>
                  <span className="text-xs text-muted-foreground">{list.values.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <textarea
        className="w-full rounded-md border border-border bg-background font-mono text-xs px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary h-48"
        placeholder="Enter one payload per line…"
        value={text}
        onChange={(e) => onChange(e.target.value.split('\n'))}
        spellCheck={false}
      />
    </div>
  )
}
