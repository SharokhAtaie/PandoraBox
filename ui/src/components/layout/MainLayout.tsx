import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useEffect } from 'react'
import { api } from '@/api/client'
import { useProxyStore } from '@/store/proxy'

export function MainLayout() {
  useWebSocket()
  const setStatus = useProxyStore((s) => s.setStatus)

  useEffect(() => {
    api.proxy.status().then(setStatus).catch(console.error)
    const t = setInterval(() => {
      api.proxy.status().then(setStatus).catch(console.error)
    }, 5000)
    return () => clearInterval(t)
  }, [setStatus])

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
