import { useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { useProxyStore } from '@/store/proxy'
import { useFlowsStore } from '@/store/flows'
import { useConsoleStore } from '@/store/console'
import { useTeamStore } from '@/store/team'
import { useOrganizerStore } from '@/store/organizer'
import { api } from '@/api/client'
import type { Request, Replay, Response, ProxyStatus, WebSocketFrame, TeamMember, OrganizerFolder, OrganizerItem } from '@/api/client'

interface WSEvent {
  type: string
  data: unknown
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const { prependRequest, updateRequest, removeRequest, clearRequests, setStatus, syncProject, setRequests, setSelectedRequestId, appendWsFrame, addToReplay, hydrateReplayQueue } = useProxyStore()
  const setFlows = useFlowsStore((s) => s.setFlows)
  const { upsertMember, removeMember, setMembers, setSyncStatus } = useTeamStore()
  const { upsertFolder, removeFolder, setFolders, upsertItem, removeItem, setItemsForFolder } = useOrganizerStore()

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected')
    }

    ws.onmessage = (e) => {
      try {
        const evt: WSEvent = JSON.parse(e.data as string)
        handleEvent(evt)
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      console.log('[WS] Disconnected, reconnecting in 2s...')
      reconnectTimer.current = setTimeout(connect, 2000)
    }

    ws.onerror = () => ws.close()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleEvent(evt: WSEvent) {
    if (evt.type === 'request.captured') {
      const req = evt.data as Request
      if (req?.id) {
        prependRequest(req)
      }
    } else if (evt.type === 'response.received') {
      const response = evt.data as Response
      if (response?.request_id) {
        const current = useProxyStore.getState().requests
        const index = current.findIndex((req) => req.id === response.request_id)
        if (index >= 0) {
          const updated = [...current]
          updated[index] = { ...updated[index], response }
          setRequests(updated)
        }
      }
    } else if (evt.type === 'proxy.status') {
      const status = evt.data as ProxyStatus
      setStatus(status)
    } else if (evt.type === 'project.updated') {
      const project = evt.data as import('@/api/client').ProjectInfo
      syncProject(project)
      setFlows(project.flows ?? [])
    } else if (evt.type === 'project.switched') {
      // Capture path before the async fetch so we can detect a real project change.
      const prevPath = useProxyStore.getState().project?.path
      api.project.get().then((p) => {
        syncProject(p)
        // Only clear history + selection when the project path actually changed
        // (avoids a race where sidebar already repopulated the list via useRequests).
        if (prevPath !== p.path) {
          setRequests([])
          setSelectedRequestId(null)
        }
        setFlows(p.flows ?? [])
        api.replay.list({ limit: 100, offset: 0 })
          .then((result) => hydrateReplayQueue(result.replays ?? []))
          .catch(console.error)
      }).catch(console.error)
    } else if (evt.type === 'websocket.frame') {
      appendWsFrame(evt.data as WebSocketFrame)
    } else if (evt.type === 'request.deleted') {
      const data = evt.data as { id?: number }
      if (typeof data?.id === 'number') {
        removeRequest(data.id)
      }
    } else if (evt.type === 'request.updated') {
      const req = evt.data as Request
      if (req?.id) {
        updateRequest(req)
      }
    } else if (evt.type === 'requests.cleared') {
      clearRequests()
    } else if (evt.type === 'replay.created') {
      const replay = evt.data as Replay
      if (replay?.request?.id) {
        addToReplay(replay.request, replay)
      }
    } else if (evt.type === 'console.output') {
      useConsoleStore.getState().append(evt.data as { source: 'middleware' | 'flow'; text: string; timestamp: string })

    // ── Team collaboration events ─────────────────────────────────────────────
    } else if (evt.type === 'team.member.joined') {
      const member = evt.data as TeamMember
      if (member?.user_id) {
        upsertMember({ ...member, online: true })
        toast.success(`${member.display_name || member.user_id} joined the team`)
      }
    } else if (evt.type === 'team.member.left') {
      const data = evt.data as { user_id?: string; display_name?: string }
      if (data?.user_id) {
        removeMember(data.user_id)
        toast(`${data.display_name || data.user_id} left the team`)
      }
    } else if (evt.type === 'team.members.update') {
      const members = evt.data as TeamMember[]
      if (Array.isArray(members)) {
        setMembers(members)
      }
    } else if (evt.type === 'team.sync.status') {
      const data = evt.data as { status?: string }
      if (data?.status) {
        setSyncStatus(data.status as 'connected' | 'connecting' | 'disconnected')
      }

    // ── Organizer events ──────────────────────────────────────────────────────
    } else if (evt.type === 'organizer.folder.created') {
      upsertFolder(evt.data as OrganizerFolder)
    } else if (evt.type === 'organizer.folder.updated') {
      upsertFolder(evt.data as OrganizerFolder)
    } else if (evt.type === 'organizer.folder.deleted') {
      const data = evt.data as { id?: number }
      if (typeof data?.id === 'number') removeFolder(data.id)
    } else if (evt.type === 'organizer.folders.reordered') {
      api.organizer.listFolders().then((r) => setFolders(r.flat)).catch(console.error)
    } else if (evt.type === 'organizer.item.added') {
      upsertItem(evt.data as OrganizerItem)
    } else if (evt.type === 'organizer.item.updated') {
      upsertItem(evt.data as OrganizerItem)
    } else if (evt.type === 'organizer.item.removed') {
      const data = evt.data as { id?: number }
      if (typeof data?.id === 'number') removeItem(data.id)
    } else if (evt.type === 'organizer.items.reordered') {
      const data = evt.data as { folder_id?: number }
      if (typeof data?.folder_id === 'number') {
        api.organizer.listItems(data.folder_id)
          .then((r) => setItemsForFolder(data.folder_id!, r.items))
          .catch(console.error)
      }
    }
  }

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])
}
