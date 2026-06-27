import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { retryQuery } from '../lib/query'
import type { Game } from '../types'

// Unique per hook instance — prevents realtime channel-name collisions when two
// useLiveGame() callers subscribe to the same game id in the same millisecond.
let channelSeq = 0

export function useLiveGame(gameId: string | null) {
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [chanId] = useState(() => ++channelSeq)

  const fetchGame = useCallback(async (id: string | null) => {
    try {
      if (id) {
        const { data } = await retryQuery(() =>
          supabase.from('games').select('*').eq('id', id).maybeSingle(),
        )
        setGame((data as Game) ?? null)
      } else {
        // No session active — show in-progress game, then most recent finished game.
        const { data: live } = await retryQuery(() =>
          supabase
            .from('games')
            .select('*')
            .eq('state', 'in')
            .order('start_time', { ascending: false })
            .limit(1)
            .maybeSingle(),
        )
        if (live) {
          setGame(live as Game)
          return
        }
        const { data: recent } = await retryQuery(() =>
          supabase
            .from('games')
            .select('*')
            .neq('state', 'pre')
            .order('start_time', { ascending: false })
            .limit(1)
            .maybeSingle(),
        )
        setGame((recent as Game) ?? null)
      }
    } catch (err) {
      console.error('[useLiveGame] fetch failed:', err)
      // Keep any previously loaded game rather than blanking the screen.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGame(gameId)
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchGame(gameId)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [gameId, fetchGame])

  // Realtime: when a session is active we know the exact game — subscribe to it.
  // Without a session, Realtime is skipped; visibility-change re-fetches instead.
  useEffect(() => {
    if (!gameId) return
    const channel = supabase
      .channel(`game-${gameId}-${chanId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => setGame(payload.new as Game),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [gameId])

  return { game, loading }
}
