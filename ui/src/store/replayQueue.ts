import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Replay, Request } from '@/api/client'
import { getRawRequestText } from '@/lib/rawHttp'

// One slot in a queue entry's packet history: the raw packet that was sent and
// the response it produced (a full Replay, which carries either a response or a
// server-side error). `result` is null for the initial, never-sent packet.
export interface ReplayHistoryEntry {
  packet: string
  result: Replay | null
}

// One entry in the Replay/Repeater queue. Self-contained: it carries the source
// request snapshot (for the label and "in replay?" checks), the current
// editable raw packet, the chosen transport scheme, and the per-entry packet
// history. Nothing here depends on a server row, so the queue survives reloads.
export interface ReplayQueueItem {
  queueId: number
  request: Request
  packet: string
  scheme: string // "http" | "https"
  history: { entries: ReplayHistoryEntry[]; index: number }
}

const MAX_QUEUE = 100
const MAX_HISTORY = 25

function schemeOf(req: Request): string {
  return req.scheme === 'https' ? 'https' : 'http'
}

function newItem(queueId: number, req: Request): ReplayQueueItem {
  const packet = getRawRequestText(req)
  return {
    queueId,
    request: req,
    packet,
    scheme: schemeOf(req),
    history: { entries: [{ packet, result: null }], index: 0 },
  }
}

// Response bodies are large, so they are never written to localStorage. Strip
// every stored result before persisting; they live only in the in-memory state.
function stripResults(byProject: Record<string, ReplayQueueItem[]>): Record<string, ReplayQueueItem[]> {
  const out: Record<string, ReplayQueueItem[]> = {}
  for (const [path, items] of Object.entries(byProject)) {
    out[path] = items.map((it) => ({
      ...it,
      history: {
        index: it.history.index,
        entries: it.history.entries.map((e) => ({ packet: e.packet, result: null })),
      },
    }))
  }
  return out
}

interface ReplayQueueState {
  // Active project's queue (derived from byProject[activeProject]).
  replayQueue: ReplayQueueItem[]
  // Persisted per-project queues + the running id counter.
  byProject: Record<string, ReplayQueueItem[]>
  activeProject: string
  nextId: number
  attentionTick: number

  // Transient per-entry send error for client-side failures (thrown fetch,
  // cancellation) where no Replay object exists. Server-side errors live on the
  // history entry's Replay instead. In memory only.
  errors: Record<number, string>
  // Currently open queue entry. In memory (NOT persisted) so leaving the Replay
  // page and returning re-opens the same request — together with its response.
  selectedQueueId: number | null

  setActiveProject: (path: string) => void
  setSelectedQueueId: (queueId: number | null) => void
  addToReplay: (req: Request) => void
  removeFromReplay: (queueId: number) => void
  removeRequestFromReplay: (requestId: number) => void
  duplicateReplayItem: (queueId: number) => void
  clearReplay: () => void

  setError: (queueId: number, message: string) => void
  clearError: (queueId: number) => void

  updatePacket: (queueId: number, packet: string) => void
  setScheme: (queueId: number, scheme: string) => void
  recordSend: (queueId: number, packet: string, result: Replay) => void
  setHistoryIndex: (queueId: number, index: number) => void
}

export const useReplayQueueStore = create<ReplayQueueState>()(
  persist(
    (set, get) => {
      // Write `items` back to both the active array and the per-project map so
      // persistence always reflects the latest queue.
      const commit = (items: ReplayQueueItem[]) => {
        const { activeProject, byProject } = get()
        set({
          replayQueue: items,
          byProject: { ...byProject, [activeProject]: items },
        })
      }
      const mapItems = (fn: (it: ReplayQueueItem) => ReplayQueueItem) =>
        commit(get().replayQueue.map(fn))

      // Drop the transient error for one entry (or all when no id).
      const dropError = (queueId?: number) => {
        const { errors } = get()
        if (queueId == null) {
          if (Object.keys(errors).length) set({ errors: {} })
          return
        }
        if (queueId in errors) {
          const e = { ...errors }; delete e[queueId]
          set({ errors: e })
        }
      }

      return {
        replayQueue: [],
        byProject: {},
        activeProject: '',
        nextId: 1,
        attentionTick: 0,
        errors: {},
        selectedQueueId: null,

        setActiveProject: (path) => {
          const { activeProject, byProject } = get()
          if (path === activeProject) return
          // Switching projects swaps the queue, so the open entry and any live
          // errors no longer apply.
          set({
            activeProject: path,
            replayQueue: byProject[path] ?? [],
            selectedQueueId: null,
            errors: {},
          })
        },

        setSelectedQueueId: (queueId) => set({ selectedQueueId: queueId }),

        addToReplay: (req) =>
          set((state) => {
            // Dedup by the source request id — re-adding bumps attention only.
            if (state.replayQueue.some((e) => e.request.id === req.id)) {
              return { attentionTick: state.attentionTick + 1 }
            }
            const item = newItem(state.nextId, req)
            const items = [item, ...state.replayQueue].slice(0, MAX_QUEUE)
            return {
              replayQueue: items,
              byProject: { ...state.byProject, [state.activeProject]: items },
              nextId: state.nextId + 1,
              attentionTick: state.attentionTick + 1,
            }
          }),

        removeFromReplay: (queueId) => {
          commit(get().replayQueue.filter((e) => e.queueId !== queueId))
          dropError(queueId)
          if (get().selectedQueueId === queueId) set({ selectedQueueId: null })
        },

        removeRequestFromReplay: (requestId) => {
          const removed = get().replayQueue.filter((e) => e.request.id === requestId)
          commit(get().replayQueue.filter((e) => e.request.id !== requestId))
          removed.forEach((e) => dropError(e.queueId))
          if (removed.some((e) => e.queueId === get().selectedQueueId)) set({ selectedQueueId: null })
        },

        duplicateReplayItem: (queueId) =>
          set((state) => {
            const src = state.replayQueue.find((e) => e.queueId === queueId)
            if (!src) return state
            const clone: ReplayQueueItem = {
              ...src,
              queueId: state.nextId,
              history: { entries: [...src.history.entries], index: src.history.index },
            }
            const items = [clone, ...state.replayQueue].slice(0, MAX_QUEUE)
            return {
              replayQueue: items,
              byProject: { ...state.byProject, [state.activeProject]: items },
              nextId: state.nextId + 1,
              attentionTick: state.attentionTick + 1,
            }
          }),

        clearReplay: () => {
          commit([])
          dropError()
          set({ selectedQueueId: null })
        },

        setError: (queueId, message) =>
          set((state) => ({ errors: { ...state.errors, [queueId]: message } })),

        clearError: (queueId) =>
          set((state) => { const e = { ...state.errors }; delete e[queueId]; return { errors: e } }),

        updatePacket: (queueId, packet) =>
          mapItems((it) => (it.queueId === queueId ? { ...it, packet } : it)),

        setScheme: (queueId, scheme) =>
          mapItems((it) => (it.queueId === queueId ? { ...it, scheme } : it)),

        // Record a sent packet and its response in the per-entry history. The
        // response travels with the packet, so the back/forward arrows restore
        // both. Forward entries past the current index are discarded (undo
        // stack); re-sending the current packet refreshes its response in place.
        recordSend: (queueId, packet, result) =>
          mapItems((it) => {
            if (it.queueId !== queueId) return it
            const visible = it.history.entries.slice(0, it.history.index + 1)
            const last = visible[visible.length - 1]
            const entries = (
              last && last.packet === packet
                ? [...visible.slice(0, -1), { packet, result }]
                : [...visible, { packet, result }]
            ).slice(-MAX_HISTORY)
            return { ...it, packet, history: { entries, index: entries.length - 1 } }
          }),

        setHistoryIndex: (queueId, index) => {
          const it = get().replayQueue.find((e) => e.queueId === queueId)
          if (!it || index < 0 || index >= it.history.entries.length) return
          mapItems((entry) =>
            entry.queueId === queueId
              ? { ...entry, packet: entry.history.entries[index].packet, history: { ...entry.history, index } }
              : entry,
          )
          // The viewed entry carries its own response/error, so clear any live
          // client-side error from the latest attempt.
          dropError(queueId)
        },
      }
    },
    {
      name: 'pandora-replay-queue',
      version: 1,
      // Only the per-project map + id counter are persisted (with response
      // bodies stripped). The active array is re-derived via setActiveProject
      // after rehydration.
      partialize: (s) => ({ byProject: stripResults(s.byProject), nextId: s.nextId }),
      // v0 stored history.entries as a bare string[]; v1 stores
      // { packet, result } objects. Convert old entries on load.
      migrate: (persisted) => {
        const p = persisted as { byProject?: Record<string, unknown[]>; nextId?: number } | undefined
        if (p?.byProject) {
          for (const path of Object.keys(p.byProject)) {
            p.byProject[path] = (p.byProject[path] as Record<string, unknown>[]).map((it) => {
              const history = (it.history ?? {}) as { entries?: unknown[]; index?: number }
              return {
                ...it,
                history: {
                  index: history.index ?? 0,
                  entries: (history.entries ?? []).map((e) =>
                    typeof e === 'string' ? { packet: e, result: null } : { ...(e as object), result: null },
                  ),
                },
              }
            })
          }
        }
        return p as unknown
      },
    },
  ),
)
