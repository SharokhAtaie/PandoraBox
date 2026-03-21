import { useState } from 'react'
import { Crosshair } from 'lucide-react'
import { useIntruderStore } from '@/store/intruder'
import { parseMarkers } from '@/lib/intruderAttack'
import { SessionTabs } from '@/components/intruder/SessionTabs'
import { RawEditor } from '@/components/intruder/RawEditor'
import { AttackControls } from '@/components/intruder/AttackControls'
import { AttackConfigModal } from '@/components/intruder/AttackConfigModal'
import { ResultsTable } from '@/components/intruder/ResultsTable'
import type { AttackType, PayloadConfig } from '@/store/intruder'

export function IntruderPage() {
  const {
    sessions, activeSessionId,
    addSession, removeSession, setActiveSession,
    updateSession, startAttack, stopAttack, clearResults,
  } = useIntruderStore()

  const [configOpen, setConfigOpen] = useState(false)

  const session = sessions.find((s) => s.id === activeSessionId) ?? null
  const markers = session ? parseMarkers(session.raw) : []

  function handleAddEmpty() {
    const id = crypto.randomUUID()
    const name = `Session ${sessions.length + 1}`
    useIntruderStore.setState((s) => ({
      sessions: [...s.sessions, {
        id, name, raw: '', requestId: 0,
        attackType: 'sniper' as AttackType,
        payloadSets: [],
        concurrency: 5,
        delay: 0,
        results: [],
        status: 'idle',
        progress: { done: 0, total: 0 },
      }],
      activeSessionId: id,
    }))
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <Crosshair size={48} className="opacity-20" />
        <div className="text-center">
          <p className="text-base font-medium text-foreground">Intruder</p>
          <p className="text-sm mt-1">Right-click any request and select "Send to Intruder" to get started.</p>
        </div>
        <button
          onClick={handleAddEmpty}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/80 transition-colors"
        >
          New Empty Session
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Session tabs */}
      <SessionTabs
        sessions={sessions}
        activeId={activeSessionId}
        onSelect={setActiveSession}
        onAdd={handleAddEmpty}
        onClose={removeSession}
      />

      {session && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* LEFT panel: raw editor only */}
          <div className="w-[480px] shrink-0 flex flex-col border-r border-border overflow-hidden">
            <div className="flex-1 min-h-0 p-3">
              <RawEditor
                value={session.raw}
                onChange={(raw) => updateSession(session.id, { raw })}
              />
            </div>
          </div>

          {/* RIGHT panel: controls + results */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Attack controls bar */}
            <div className="p-3 border-b border-border shrink-0">
              <AttackControls
                session={session}
                onStart={() => startAttack(session.id)}
                onStop={() => stopAttack(session.id)}
                onClear={() => clearResults(session.id)}
                onConfigure={() => setConfigOpen(true)}
              />
            </div>

            {/* Results */}
            <div className="flex-1 min-h-0 p-3">
              <ResultsTable
                results={session.results}
                markerCount={Math.max(markers.length, 1)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Config modal */}
      {session && (
        <AttackConfigModal
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          attackType={session.attackType}
          payloadSets={session.payloadSets}
          markerCount={markers.length}
          concurrency={session.concurrency}
          delay={session.delay}
          onSave={(patch) => updateSession(session.id, patch)}
        />
      )}
    </div>
  )
}
