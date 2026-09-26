'use client'
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createBrowserClient } from '@/lib/supabase/client'
import type { DirectorySnapshot } from '@/lib/directory/live-directory'

export const DIRECTORY_LIVE_KEY = ['directory-live-v1'] as const
export function useLiveDirectory() {
  const queryClient = useQueryClient()
  const [online, setOnline] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const query = useQuery<DirectorySnapshot>({
    queryKey: DIRECTORY_LIVE_KEY,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/directory-live', { cache: 'no-store', signal })
      if (!response.ok) throw new Error('Refresh unavailable')
      return response.json()
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
  })
  useEffect(() => {
    const sync = () => { setOnline(navigator.onLine); setNow(Date.now()) }
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    const clock = setInterval(sync, 15_000)
    // Realtime invalidates the same snapshot; polling remains the guarantee
    // when the table is not enabled for Postgres change subscriptions.
    const db = createBrowserClient()
    let debounce: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      if (debounce) return
      debounce = setTimeout(() => {
        debounce = undefined
        void queryClient.invalidateQueries({ queryKey: DIRECTORY_LIVE_KEY })
      }, 1000)
    }
    const channel = db.channel('directory-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'directory_web_checks' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'practice_locations' }, refresh)
      .subscribe()
    return () => {
      clearInterval(clock); clearTimeout(debounce)
      window.removeEventListener('online', sync); window.removeEventListener('offline', sync)
      void db.removeChannel(channel)
    }
  }, [queryClient])
  return { ...query, stale: !online || query.isError || Boolean(query.data && now - new Date(query.data.fetchedAt).getTime() > 60_000) }
}
