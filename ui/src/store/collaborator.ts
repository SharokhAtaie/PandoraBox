import { create } from 'zustand'
import {
  createSession, register, poll, deregister, generateTestUrl,
  PUBLIC_SERVERS,
} from '@/lib/interactsh'
import type { Interaction, InteractshSession } from '@/lib/interactsh'
import type { ServerCollaboratorSession } from '@/api/client'

export type { Interaction }
export { PUBLIC_SERVERS }

/**
 * ServerSession is a server-side Collaborator session (started by an MCP agent
 * or other PandoraBox instance). Its interactions arrive via WebSocket events
 * — the browser does not own the crypto material and does not poll directly.
 */
export interface ServerSession extends ServerCollaboratorSession {
  interactions: Interaction[]
}

// ─── Module-level state (holds non-serializable crypto objects) ───────────────
let _session: InteractshSession | null = null
let _pollTimer: ReturnType<typeof setInterval> | null = null

// ─── Store ────────────────────────────────────────────────────────────────────

interface CollaboratorStore {
  // Session display state
  currentUrl: string | null    // corrId(20)+nonce(13).server — what to use for testing
  server: string
  status: 'idle' | 'connecting' | 'active' | 'error'
  error: string | null

  // Interactions — newest first
  interactions: Interaction[]
  lastPollAt: string | null     // ISO timestamp
  collaboratorAttentionTick: number

  // Actions
  start: (server?: string) => Promise<void>
  stop: () => Promise<void>
  clear: () => void
  setServer: (s: string) => void
  regenerateUrl: () => void     // generate a fresh nonce URL (same session)

  // Server-side (MCP-started) sessions — synced via REST + WebSocket events.
  serverSessions: ServerSession[]
  setServerSessions: (sessions: ServerCollaboratorSession[]) => void
  upsertServerSession: (session: ServerCollaboratorSession) => void
  removeServerSession: (sessionId: string) => void
  appendServerInteraction: (sessionId: string, interaction: Interaction) => void
}

const POLL_INTERVAL_MS = 5_000

export const useCollaboratorStore = create<CollaboratorStore>((set, get) => ({
  currentUrl: null,
  server: 'oast.pro',
  status: 'idle',
  error: null,
  interactions: [],
  lastPollAt: null,
  collaboratorAttentionTick: 0,

  setServer: (server) => set({ server }),

  regenerateUrl: () => {
    if (!_session) return
    set({ currentUrl: generateTestUrl(_session.correlationId, _session.server) })
  },

  start: async (serverArg) => {
    const server = serverArg ?? get().server

    // Tear down any existing session
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null }
    if (_session) { await deregister(_session); _session = null }

    set({ status: 'connecting', error: null, currentUrl: null, interactions: [] })

    try {
      const { session, publicKeyB64 } = await createSession(server)
      await register(session, publicKeyB64)
      _session = session
      set({ status: 'active', currentUrl: session.currentUrl, server })

      // ── Poll immediately, then on interval ───────────────────────────────
      const doPoll = async () => {
        if (!_session) return
        try {
          const results = await poll(_session)
          if (results.length > 0) {
            set((s) => ({
              // Prepend new interactions (newest first)
              interactions: [...results, ...s.interactions],
              lastPollAt: new Date().toISOString(),
              collaboratorAttentionTick: s.collaboratorAttentionTick + results.length,
            }))
          } else {
            set({ lastPollAt: new Date().toISOString() })
          }
        } catch (e) {
          console.error('[collaborator] poll error:', e)
        }
      }

      await doPoll()
      _pollTimer = setInterval(doPoll, POLL_INTERVAL_MS)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ status: 'error', error: msg })
    }
  },

  stop: async () => {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null }
    if (_session) { await deregister(_session); _session = null }
    set({ status: 'idle', currentUrl: null })
  },

  clear: () => set({ interactions: [] }),

  // ── Server-side sessions ────────────────────────────────────────────────
  serverSessions: [],
  setServerSessions: (sessions) => set({
    serverSessions: sessions.map((s) => {
      const existing = get().serverSessions.find((p) => p.session_id === s.session_id)
      return { ...s, interactions: existing?.interactions ?? [] }
    }),
  }),
  upsertServerSession: (session) => set((s) => {
    const idx = s.serverSessions.findIndex((p) => p.session_id === session.session_id)
    if (idx >= 0) {
      const next = [...s.serverSessions]
      next[idx] = { ...next[idx], ...session }
      return { serverSessions: next }
    }
    return { serverSessions: [{ ...session, interactions: [] }, ...s.serverSessions] }
  }),
  removeServerSession: (sessionId) => set((s) => ({
    serverSessions: s.serverSessions.filter((p) => p.session_id !== sessionId),
  })),
  appendServerInteraction: (sessionId, interaction) => set((s) => {
    const idx = s.serverSessions.findIndex((p) => p.session_id === sessionId)
    if (idx < 0) return s
    const next = [...s.serverSessions]
    const sess = next[idx]
    next[idx] = {
      ...sess,
      interactions: [interaction, ...sess.interactions].slice(0, 1000),
      interaction_count: sess.interaction_count + 1,
    }
    // Attention tick so the page can flash the bell, like the browser path does.
    return { serverSessions: next, collaboratorAttentionTick: s.collaboratorAttentionTick + 1 }
  }),
}))

export const POLL_INTERVAL = POLL_INTERVAL_MS
