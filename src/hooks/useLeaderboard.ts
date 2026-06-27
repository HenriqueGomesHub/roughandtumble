import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { retryQuery } from '../lib/query'

export type LeaderTab = 'week' | 'season'

export interface LeaderRow {
  id: string
  display_name: string | null
  current_streak: number
  total_points: number
  rank: number
}

export function useLeaderboard(tab: LeaderTab) {
  const [rows, setRows] = useState<LeaderRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const view = tab === 'week' ? 'weekly_leaderboard' : 'season_leaderboard'
    try {
      const { data } = await retryQuery(() =>
        supabase
          .from(view)
          .select('id, display_name, current_streak, total_points, rank')
          .order('rank', { ascending: true })
          .limit(50),
      )
      setRows((data as LeaderRow[]) ?? [])
    } catch (err) {
      console.error('[useLeaderboard] fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    fetch()
    const onVisible = () => { if (document.visibilityState === 'visible') fetch() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetch])

  return { rows, loading }
}
