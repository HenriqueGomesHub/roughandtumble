import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AdminGate } from '../../features/onboarding/AdminGate'
import { useAuth } from '../../features/onboarding/AuthProvider'
import { useSession } from '../../hooks/useSession'
import { useLiveGame } from '../../hooks/useLiveGame'
import { formatCountdown } from '../../lib/time'
import type { VotingSession } from '../../types'

const DURATIONS = [60, 90, 120, 180, 300] as const

interface GameRow {
  id: string
  league: string
  state: string
  period: number | null
  start_time: string | null
  home_name: string | null
  home_abbr: string | null
  home_team_id: string
  away_name: string | null
  away_abbr: string | null
  away_team_id: string
  home_score: number
  away_score: number
  winner_team_id: string | null
}

function teamLabel(g: GameRow, teamId: string): string {
  if (teamId === g.home_team_id) return g.home_abbr ?? g.home_name ?? 'Home'
  return g.away_abbr ?? g.away_name ?? 'Away'
}

function durationLabel(d: number): string {
  return d % 60 === 0 ? `${d / 60}m` : `${d}s`
}

function AdminPanel() {
  const { session: liveSession, secondsLeft } = useSession()
  const [closedSession, setClosedSession] = useState<VotingSession | null>(null)
  const activeSession = liveSession ?? closedSession
  const { game } = useLiveGame(activeSession?.game_id ?? null)
  const [games, setGames] = useState<GameRow[]>([])
  const [openingFor, setOpeningFor] = useState<string | null>(null)
  const [duration, setDuration] = useState(120)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadGames = useCallback(async () => {
    const { data } = await supabase
      .from('games')
      .select('id, league, state, period, start_time, home_name, home_abbr, home_team_id, away_name, away_abbr, away_team_id, home_score, away_score, winner_team_id')
      .order('start_time', { ascending: false })
      .limit(10)
    setGames((data as GameRow[]) ?? [])
  }, [])

  const loadClosedSession = useCallback(async () => {
    if (liveSession) { setClosedSession(null); return }
    const { data } = await supabase
      .from('voting_sessions')
      .select('*')
      .eq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setClosedSession(data as VotingSession | null)
  }, [liveSession])

  useEffect(() => { loadGames() }, [loadGames])
  useEffect(() => { loadClosedSession() }, [loadClosedSession])

  function flash(msg: string) {
    setNotice(msg)
    setTimeout(() => setNotice(null), 4000)
  }

  async function handleOpenSession(gameId: string) {
    setBusy('open')
    setError(null)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code = Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')
    const opensAt = new Date()
    const closesAt = new Date(opensAt.getTime() + duration * 1000)
    const { error: err } = await supabase.from('voting_sessions').insert({
      game_id: gameId,
      code,
      duration_seconds: duration,
      opens_at: opensAt.toISOString(),
      closes_at: closesAt.toISOString(),
    })
    setBusy(null)
    if (err) { setError(err.message); return }
    setOpeningFor(null)
  }

  async function closeVoting() {
    if (!activeSession) return
    setBusy('close')
    const { error: err } = await supabase
      .from('voting_sessions')
      .update({ status: 'closed' })
      .eq('id', activeSession.id)
    setBusy(null)
    if (err) setError(err.message)
  }

  async function cancelSession() {
    if (!activeSession) return
    setBusy('cancel')
    const { error: err } = await supabase
      .from('voting_sessions')
      .update({ status: 'cancelled' })
      .eq('id', activeSession.id)
    setBusy(null)
    if (err) { setError(err.message); return }
    setClosedSession(null)
  }

  async function setWinner(teamId: string) {
    if (!game) return
    setBusy('winner')
    setError(null)
    const { error: err } = await supabase
      .from('games')
      .update({ winner_team_id: teamId })
      .eq('id', game.id)
    setBusy(null)
    if (err) { setError(err.message); return }
    loadGames()
  }

  async function settle() {
    if (!activeSession) return
    setBusy('settle')
    setError(null)
    const { data, error: fnErr } = await supabase.functions.invoke('settle-session', {
      body: { session_id: activeSession.id },
    })
    setBusy(null)
    if (fnErr) { setError(fnErr.message); return }
    const result = data as { ok?: boolean; picks_settled?: number; error?: string }
    if (result?.error) { setError(result.error); return }
    flash(`Settled — ${result.picks_settled ?? 0} picks awarded points.`)
    setClosedSession(null)
    loadGames()
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy px-6 py-4 shrink-0">
        <h1 className="font-display text-xl font-bold uppercase tracking-wide text-white">
          Rough & Tumble — Admin
        </h1>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {notice && (
          <div className="bg-navy text-white font-body text-sm px-4 py-3" role="status">
            {notice}
          </div>
        )}
        {error && (
          <div
            className="bg-persimmon/10 border border-persimmon font-body text-sm px-4 py-3 text-navy"
            role="alert"
          >
            Error: {error}
          </div>
        )}

        {/* ── Active session ─────────────────────────────────────── */}
        <section aria-labelledby="session-hd">
          <h2
            id="session-hd"
            className="font-display text-xs font-bold uppercase tracking-widest text-muted-navy mb-2"
          >
            Session
          </h2>

          {activeSession ? (
            <div className="bg-white border border-navy/10 p-4 space-y-4">
              {/* Code + status + countdown */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-display text-3xl font-bold tracking-widest text-navy">
                    {activeSession.code}
                  </span>
                  <span
                    className={
                      'font-display text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 ' +
                      (activeSession.status === 'open'
                        ? 'bg-navy text-white'
                        : 'bg-navy/10 text-muted-navy')
                    }
                  >
                    {activeSession.status}
                  </span>
                </div>
                {activeSession.status === 'open' && secondsLeft != null && (
                  <span className="font-display font-bold text-sm text-persimmon tabular-nums">
                    {formatCountdown(secondsLeft)}
                  </span>
                )}
              </div>

              {/* Game line */}
              {game && (
                <p className="font-body text-sm text-navy">
                  {game.away_abbr ?? game.away_name} @ {game.home_abbr ?? game.home_name}
                  <span className="text-muted-navy ml-2 text-xs">
                    {game.state === 'in'
                      ? `Live · Q${game.period ?? ''} · ${game.away_score}–${game.home_score}`
                      : game.state === 'post'
                      ? `Final · ${game.away_score}–${game.home_score}`
                      : 'Pre-game'}
                  </span>
                </p>
              )}

              {/* Vote counts */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-navy/5 py-3 text-center">
                  <p className="font-display font-bold text-2xl text-navy tabular-nums">
                    {activeSession.away_votes}
                  </p>
                  <p className="font-body text-xs text-muted-navy mt-0.5">
                    {game?.away_abbr ?? 'Away'}
                  </p>
                </div>
                <div className="bg-navy/5 py-3 text-center">
                  <p className="font-display font-bold text-2xl text-navy tabular-nums">
                    {activeSession.home_votes}
                  </p>
                  <p className="font-body text-xs text-muted-navy mt-0.5">
                    {game?.home_abbr ?? 'Home'}
                  </p>
                </div>
              </div>

              {/* Winner selector */}
              {game && (
                <div>
                  <p className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-navy mb-1.5">
                    Winner
                  </p>
                  <div className="flex gap-2">
                    {[
                      { id: game.away_team_id, label: game.away_abbr ?? game.away_name ?? 'Away' },
                      { id: game.home_team_id, label: game.home_abbr ?? game.home_name ?? 'Home' },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => setWinner(id)}
                        disabled={!!busy}
                        className={
                          'flex-1 py-2 font-display font-bold text-sm uppercase tracking-wide border-2 transition-colors disabled:opacity-50 ' +
                          (game.winner_team_id === id
                            ? 'bg-navy text-white border-navy'
                            : 'bg-paper text-navy border-navy/30 hover:border-navy')
                        }
                      >
                        {label}{game.winner_team_id === id ? ' ✓' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-navy/10">
                {activeSession.status === 'open' && (
                  <button
                    onClick={closeVoting}
                    disabled={!!busy}
                    className="flex-1 py-2.5 font-display font-bold text-sm uppercase tracking-wide bg-navy text-white disabled:opacity-50 hover:bg-navy/80"
                  >
                    {busy === 'close' ? 'Closing…' : 'Close Voting'}
                  </button>
                )}
                <button
                  onClick={settle}
                  disabled={!!busy || !game?.winner_team_id}
                  title={!game?.winner_team_id ? 'Set winner before settling' : undefined}
                  className="flex-1 py-2.5 font-display font-bold text-sm uppercase tracking-wide bg-persimmon text-white disabled:opacity-50 hover:bg-persimmon/80"
                >
                  {busy === 'settle' ? 'Settling…' : 'Settle'}
                </button>
                <button
                  onClick={cancelSession}
                  disabled={!!busy}
                  className="px-4 py-2.5 font-display font-bold text-xs uppercase tracking-wide border border-navy/30 text-muted-navy disabled:opacity-50 hover:border-navy hover:text-navy"
                >
                  {busy === 'cancel' ? '…' : 'Cancel'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-navy/10 px-4 py-6 text-center">
              <p className="font-body text-sm text-muted-navy">No active session — open one below.</p>
            </div>
          )}
        </section>

        {/* ── Game list ─────────────────────────────────────────── */}
        <section aria-labelledby="games-hd">
          <h2
            id="games-hd"
            className="font-display text-xs font-bold uppercase tracking-widest text-muted-navy mb-2"
          >
            Games
          </h2>
          <div className="space-y-1">
            {games.length === 0 && (
              <p className="font-body text-sm text-muted-navy px-1">No games found.</p>
            )}
            {games.map((g) => (
              <div key={g.id} className="bg-white border border-navy/10 px-4 py-3">
                {openingFor === g.id ? (
                  <div className="space-y-3">
                    <p className="font-body text-sm font-semibold text-navy">
                      {g.away_abbr ?? g.away_name} @ {g.home_abbr ?? g.home_name}
                    </p>
                    <div>
                      <p className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-navy mb-1.5">
                        Duration
                      </p>
                      <div className="flex gap-1">
                        {DURATIONS.map((d) => (
                          <button
                            key={d}
                            onClick={() => setDuration(d)}
                            className={
                              'flex-1 py-1.5 font-display font-bold text-xs uppercase transition-colors ' +
                              (duration === d
                                ? 'bg-navy text-white'
                                : 'bg-navy/5 text-navy hover:bg-navy/10')
                            }
                          >
                            {durationLabel(d)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenSession(g.id)}
                        disabled={!!busy}
                        className="flex-1 py-2.5 font-display font-bold text-sm uppercase tracking-wide bg-navy text-white disabled:opacity-50 hover:bg-navy/80"
                      >
                        {busy === 'open' ? 'Opening…' : 'Open Session'}
                      </button>
                      <button
                        onClick={() => setOpeningFor(null)}
                        className="px-4 py-2.5 font-body text-sm text-muted-navy hover:text-navy"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-body text-sm font-semibold text-navy truncate">
                        {g.away_abbr ?? g.away_name} @ {g.home_abbr ?? g.home_name}
                      </p>
                      <p className="font-body text-xs text-muted-navy truncate">
                        {g.state === 'in'
                          ? `Live · Q${g.period ?? ''}`
                          : g.state === 'post'
                          ? 'Final'
                          : 'Pre-game'}
                        {' '}· {g.away_score}–{g.home_score}
                        {g.winner_team_id && (
                          <span className="text-persimmon ml-1">
                            W: {teamLabel(g, g.winner_team_id)}
                          </span>
                        )}
                      </p>
                    </div>
                    {!activeSession && (
                      <button
                        onClick={() => { setOpeningFor(g.id); setDuration(120) }}
                        className="shrink-0 px-3 py-1.5 font-display font-bold text-xs uppercase tracking-wide border border-navy text-navy hover:bg-navy hover:text-white transition-colors"
                      >
                        Open
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export function AdminApp() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="font-body text-muted-navy animate-pulse">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-8 text-center">
        <div className="space-y-3">
          <h1 className="font-display text-2xl font-bold uppercase text-navy">Admin</h1>
          <p className="font-body text-sm text-muted-navy">Sign in to access the admin panel.</p>
        </div>
      </div>
    )
  }

  if (!profile?.is_admin) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="font-body text-sm text-muted-navy">Access denied.</p>
      </div>
    )
  }

  return (
    <AdminGate>
      <AdminPanel />
    </AdminGate>
  )
}
