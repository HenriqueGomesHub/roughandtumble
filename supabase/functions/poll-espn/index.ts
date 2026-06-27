import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  fetchWnbaScoreboard,
  fetchWnbaStandings,
  fetchWnbaSummary,
} from './lib/espn.ts'
import type { EspnGame, EspnStanding } from './lib/espn.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

const LEAGUE = 'WNBA'

Deno.serve(async (req) => {
  const secret = Deno.env.get('POLL_ESPN_SECRET') ?? ''
  if (!secret || req.headers.get('x-shared-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    return Response.json(await poll())
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[poll-espn]', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
})

async function poll(): Promise<Record<string, unknown>> {
  // Case-insensitive league match: the season may be seeded as 'wnba' while the
  // poller's constant is 'WNBA'. ilike (no wildcards) compares case-insensitively.
  // Take the earliest active season via limit(1) rather than single()/maybeSingle()
  // so a duplicate active season never errors the whole poll.
  const { data: seasons } = await supabase
    .from('seasons')
    .select('id')
    .eq('is_active', true)
    .ilike('league', LEAGUE)
    .order('created_at', { ascending: true })
    .limit(1)

  const season = seasons?.[0]
  if (!season) return { games: 0, standings: 0, msg: 'no active season' }

  // Always fetch the scoreboard — this is how we detect state transitions.
  const games = await fetchWnbaScoreboard()
  let upserted = 0

  for (const game of games) {
    const { error } = await supabase.rpc('upsert_espn_game', {
      game: buildGamePayload(game, season.id),
    })
    if (error) console.warn('[poll-espn] game upsert:', error.message)
    else upserted++
  }

  // For each in-progress game, fetch summary stats and merge into the row.
  // Skipping per-game failures keeps the rest of the poll alive.
  const liveGames = games.filter((g) => g.state === 'in')
  for (const game of liveGames) {
    try {
      const stats = await fetchWnbaSummary(game.espnEventId)
      await supabase
        .from('games')
        .update({ stats, updated_at: new Date().toISOString() })
        .eq('espn_event_id', game.espnEventId)
    } catch (err) {
      console.warn(
        `[poll-espn] summary ${game.espnEventId}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  // Standings are low-frequency data: skip when a game is live to keep
  // the poll latency tight during the action.
  let standingsUpserted = 0
  if (liveGames.length === 0) {
    try {
      const standings = await fetchWnbaStandings()
      standingsUpserted = await upsertStandings(standings)
    } catch (err) {
      console.warn('[poll-espn] standings:', err instanceof Error ? err.message : err)
    }
  }

  return { games: upserted, liveGames: liveGames.length, standings: standingsUpserted }
}

async function upsertStandings(standings: EspnStanding[]): Promise<number> {
  let count = 0
  for (const s of standings) {
    const { error } = await supabase.from('standings_cache').upsert(
      {
        league:     LEAGUE,
        team_id:    s.teamId,
        team_name:  s.teamName,
        team_abbr:  s.teamAbbr,
        team_logo:  s.teamLogo,
        team_color: s.teamColor,
        wins:       s.wins,
        losses:     s.losses,
        win_pct:    s.winPct,
        seed:       s.seed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'league,team_id' },
    )
    if (error) console.warn('[poll-espn] standings upsert:', error.message)
    else count++
  }
  return count
}

function buildGamePayload(game: EspnGame, seasonId: string): Record<string, unknown> {
  return {
    espn_event_id:  game.espnEventId,
    season_id:      seasonId,
    league:         LEAGUE,
    state:          game.state,
    status_detail:  game.statusDetail,
    period:         game.period,
    clock:          game.clock,
    start_time:     game.startTime,
    home_team_id:   game.homeTeam.id,
    away_team_id:   game.awayTeam.id,
    home_name:      game.homeTeam.displayName,
    away_name:      game.awayTeam.displayName,
    home_abbr:      game.homeTeam.abbreviation,
    away_abbr:      game.awayTeam.abbreviation,
    home_logo:      game.homeTeam.logo,
    away_logo:      game.awayTeam.logo,
    home_color:     game.homeTeam.color,
    away_color:     game.awayTeam.color,
    home_score:     game.homeScore,
    away_score:     game.awayScore,
    winner_team_id: game.winnerTeamId,
    stats:          game.stats,
  }
}
