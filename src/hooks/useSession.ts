import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { retryQuery } from '../lib/query'
import { msUntil } from '../lib/time'
import type { VotingSession } from '../types'

// Unique per hook instance so multiple useSession() callers (e.g. PhoneApp +
// LivePage) never collide on a realtime channel name — a same-millisecond
// Date.now() collision makes Supabase throw on the second .subscribe().
let channelSeq = 0

export function useSession() {
  const [session, setSession] = useState<VotingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [chanId] = useState(() => ++channelSeq)

  const fetchOpen = useCallback(async () => {
    try {
      const { data } = await retryQuery(() =>
        supabase
          .from('voting_sessions')
          .select('*')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      )
      setSession((data as VotingSession) ?? null)
    } catch (err) {
      console.error('[useSession] fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch; re-fetch when tab becomes visible (recover from background).
  useEffect(() => {
    fetchOpen()
    const onVisible = () => { if (document.visibilityState === 'visible') fetchOpen() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchOpen])

  // Realtime: keep the session row in sync for both vote-count updates
  // and status transitions (open → closed).
  useEffect(() => {
    const channel = supabase
      .channel(`voting-sessions-live-${chanId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'voting_sessions' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const gone = (payload.old as Partial<VotingSession>).id
            setSession((prev) => (prev?.id === gone ? null : prev))
            return
          }
          const row = payload.new as VotingSession
          if (row.status === 'open') {
            setSession(row)
          } else {
            setSession((prev) => (prev?.id === row.id ? null : prev))
          }
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Server-authoritative countdown — ticks at 4 Hz for smooth display.
  useEffect(() => {
    if (!session?.closes_at || session.status !== 'open') {
      setSecondsLeft(null)
      return
    }
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.floor(msUntil(session.closes_at) / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [session?.closes_at, session?.status])

  return { session, loading, secondsLeft }
}
