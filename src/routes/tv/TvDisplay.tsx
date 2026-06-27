import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../hooks/useSession'
import { useLiveGame } from '../../hooks/useLiveGame'
import { useLeaderboard } from '../../hooks/useLeaderboard'
import { formatCountdown } from '../../lib/time'
import type { Game, VotingSession } from '../../types'
import type { LeaderRow } from '../../hooks/useLeaderboard'

// SVG noise texture for vintage paper/grit effect
const NOISE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E`

interface Standing {
  team_id: string
  team_abbr: string
  wins: number
  losses: number
  seed: number | null
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function TvTeamLogo({ logo, color, abbr }: { logo: string | null; color: string | null; abbr: string | null }) {
  const [err, setErr] = useState(false)
  if (!logo || err) {
    return (
      <div
        className="size-24 flex items-center justify-center font-display font-bold text-white text-3xl shadow-card"
        style={{ backgroundColor: color ?? '#232F49' }}
      >
        {abbr ?? '?'}
      </div>
    )
  }
  return (
    <img
      src={logo}
      alt={abbr ?? ''}
      className="size-28 lg:size-36 object-contain drop-shadow-2xl"
      onError={() => setErr(true)}
    />
  )
}

function Scoreboard({ game }: { game: Game | null }) {
  if (!game) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-16 relative">
        <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-50" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />
        <h2 className="font-display text-5xl lg:text-7xl font-bold uppercase tracking-[0.2em] text-navy/30 text-center">
          No Game<br/>Tonight
        </h2>
        <div className="h-2 w-32 bg-persimmon mt-8"></div>
      </div>
    )
  }

  const status =
    game.state === 'in'
      ? `Q${game.period ?? ''}${game.clock ? `  ${game.clock}` : ''}`
      : game.state === 'post'
      ? `Final${game.status_detail && game.status_detail.toLowerCase() !== 'final' ? ` — ${game.status_detail}` : ''}`
      : game.start_time
      ? new Date(game.start_time).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles',
        })
      : 'Upcoming'

  return (
    <div className="flex flex-col flex-1" aria-label="Live score">
      <div className="flex items-center justify-between mb-8">
         <div className="bg-navy text-white px-6 py-2 font-display text-xl uppercase tracking-[0.2em] font-bold shadow-[8px_8px_0_0_#E96630]">
           Matchup
         </div>
         <div className="flex items-center gap-3">
          {game.state === 'in' && (
            <>
              <span className="size-4 bg-persimmon animate-pulse shadow-[0_0_15px_rgba(233,102,48,0.8)]" aria-hidden="true" />
              <span className="font-display text-2xl font-bold uppercase tracking-widest text-persimmon">
                Live
              </span>
            </>
          )}
          <span className="font-display text-2xl font-bold text-navy/60 tracking-wider">
            {status}
          </span>
         </div>
      </div>

      <div className="flex items-center justify-between gap-6 flex-1 px-8 lg:px-16 relative">
        {/* Background 'VS' watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
           <span className="font-display font-bold text-[300px] text-navy">VS</span>
        </div>

        <div className="flex flex-col items-center gap-6 flex-1 z-10">
          <TvTeamLogo logo={game.away_logo} color={game.away_color} abbr={game.away_abbr} />
          <p className="font-display font-bold text-2xl lg:text-4xl uppercase tracking-wide text-navy text-center leading-tight">
            {game.away_name ?? game.away_abbr}
          </p>
          <p className="font-display font-bold text-8xl lg:text-[160px] text-navy tabular-nums leading-none">
            {game.away_score}
          </p>
        </div>

        <div className="w-1.5 h-64 bg-persimmon/20 shrink-0 z-10" />

        <div className="flex flex-col items-center gap-6 flex-1 z-10">
          <TvTeamLogo logo={game.home_logo} color={game.home_color} abbr={game.home_abbr} />
          <p className="font-display font-bold text-2xl lg:text-4xl uppercase tracking-wide text-navy text-center leading-tight">
            {game.home_name ?? game.home_abbr}
          </p>
          <p className="font-display font-bold text-8xl lg:text-[160px] text-navy tabular-nums leading-none">
            {game.home_score}
          </p>
        </div>
      </div>
    </div>
  )
}

function VoteBar({ session, game, secondsLeft }: { session: VotingSession; game: Game; secondsLeft: number | null }) {
  const total = session.total_votes
  const awayPct = total > 0 ? Math.round((session.away_votes / total) * 100) : 50
  const homePct = 100 - awayPct

  return (
    <div className="bg-navy p-8 lg:p-12 shadow-[16px_16px_0_0_#E96630] relative overflow-hidden mt-8">
      {/* Texture inside the vote bar */}
      <div className="absolute inset-0 pointer-events-none mix-blend-overlay" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />

      <div className="flex items-baseline justify-between mb-8 relative z-10">
        <div className="flex items-baseline gap-6">
          <span className="font-display text-3xl lg:text-5xl font-bold uppercase tracking-widest text-paper">
            Pick'em
          </span>
          <span className="font-display text-xl lg:text-2xl text-paper/70 tracking-widest uppercase">
            Code: <span className="text-persimmon text-4xl lg:text-5xl ml-2 font-bold">{session.code}</span>
          </span>
        </div>
        {secondsLeft != null && secondsLeft > 0 && (
          <div className="flex items-center gap-4">
             <span className="font-display text-xl text-paper/50 uppercase tracking-widest">Ends in</span>
            <span
              className="font-display text-5xl lg:text-6xl font-bold text-persimmon tabular-nums drop-shadow-md"
              aria-live="polite"
            >
              {formatCountdown(secondsLeft)}
            </span>
          </div>
        )}
      </div>

      <div className="relative h-16 lg:h-20 flex overflow-hidden border-4 border-paper/10 z-10 shadow-inner">
        <div
          className="bg-persimmon flex items-center justify-end pr-6 transition-all duration-1000 ease-out"
          style={{ width: `${awayPct}%` }}
        >
          {awayPct >= 10 && (
            <span className="font-display font-bold text-2xl lg:text-4xl text-white drop-shadow-md">{awayPct}%</span>
          )}
        </div>
        <div className="flex-1 bg-paper flex items-center justify-start pl-6 transition-all duration-1000 ease-out">
          {homePct >= 10 && (
            <span className="font-display font-bold text-2xl lg:text-4xl text-navy drop-shadow-md">{homePct}%</span>
          )}
        </div>
      </div>

      <div className="flex justify-between font-display text-xl lg:text-2xl font-bold uppercase tracking-widest mt-4 text-paper z-10 relative">
        <span>{game.away_name ?? game.away_abbr ?? 'Away'}</span>
        <span className="text-paper/40 font-body tracking-normal normal-case font-normal text-lg">
          {total} {total === 1 ? 'pick' : 'picks'}
        </span>
        <span className="text-paper">{game.home_name ?? game.home_abbr ?? 'Home'}</span>
      </div>
    </div>
  )
}

function Sidebar({ league, standings, leaders }: { league: string | null; standings: Standing[]; leaders: LeaderRow[] }) {
  return (
    <div className="space-y-12 h-full flex flex-col pl-10 border-l-[3px] border-navy/10 relative">
      <div className="absolute top-0 -left-[3px] w-[3px] h-32 bg-persimmon" />

      {standings.length > 0 && (
        <section aria-labelledby="tv-standings" className="flex-1 min-h-0 flex flex-col">
          <h2 id="tv-standings" className="font-display text-2xl font-bold uppercase tracking-[0.2em] text-navy mb-6 border-b-2 border-navy pb-4 inline-block self-start">
            {league ? `${league} Standings` : 'Standings'}
          </h2>
          <div className="overflow-hidden flex-1 flex flex-col space-y-3">
            {standings.slice(0, 7).map((s) => (
              <div key={s.team_id} className="flex items-center gap-4 bg-white p-3 shadow-sm border border-paper-deep">
                {s.seed != null && (
                  <span className="w-8 text-center font-display text-xl font-bold text-navy/40 shrink-0 tabular-nums">
                    {s.seed}
                  </span>
                )}
                <span className="font-display font-bold text-xl uppercase tracking-wider text-navy flex-1 truncate">{s.team_abbr}</span>
                <span className="font-display text-xl font-bold text-persimmon tabular-nums shrink-0">
                  {s.wins}–{s.losses}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {leaders.length > 0 && (
        <section aria-labelledby="tv-leaderboard" className="shrink-0">
          <h2 id="tv-leaderboard" className="font-display text-2xl font-bold uppercase tracking-[0.2em] text-navy mb-6 border-b-2 border-navy pb-4 inline-block self-start">
            Top Pickers
          </h2>
          <div className="space-y-3">
            {leaders.slice(0, 5).map((row, i) => (
              <div key={row.id} className={`flex items-center gap-4 p-4 border border-navy/10 shadow-sm ${i === 0 ? 'bg-navy text-white shadow-[6px_6px_0_0_#E96630] -translate-y-1' : 'bg-paper-deep'}`}>
                <span className={`w-8 text-center font-display text-2xl font-bold shrink-0 tabular-nums ${i === 0 ? 'text-persimmon' : 'text-navy/40'}`}>
                  #{row.rank}
                </span>
                <span className={`font-display font-bold text-xl uppercase tracking-wider flex-1 truncate ${i === 0 ? 'text-white' : 'text-navy'}`}>
                  {row.display_name ?? 'Anonymous'}
                </span>
                <div className="flex items-center gap-2">
                   <span className={`font-display font-bold text-2xl tabular-nums shrink-0 ${i === 0 ? 'text-white' : 'text-navy'}`}>
                     {row.total_points}
                   </span>
                   <span className={`font-display text-sm tracking-widest uppercase ${i === 0 ? 'text-white/50' : 'text-navy/50'}`}>Pts</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export function TvDisplay() {
  const { session, secondsLeft } = useSession()
  const { game } = useLiveGame(session?.game_id ?? null)
  const { rows: leaders } = useLeaderboard('week')
  const [standings, setStandings] = useState<Standing[]>([])
  const now = useClock()

  useEffect(() => {
    if (!game?.league) return
    supabase
      .from('standings_cache')
      .select('team_id, team_abbr, wins, losses, seed')
      .eq('league', game.league)
      .order('seed', { ascending: true, nullsFirst: false })
      .order('win_pct', { ascending: false })
      .limit(14)
      .then(({ data }) => setStandings((data as Standing[]) ?? []))
  }, [game?.league])

  const clockStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  })

  return (
    <div className="min-h-screen bg-paper flex flex-col relative overflow-hidden">
      {/* Background grit overlay */}
      <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-[0.85] z-0" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />

      <header className="bg-navy px-10 py-6 flex items-center shrink-0 z-10 shadow-xl relative">
        <img src="/RoughTumbleLogo.png" alt="Rough & Tumble Pick'em" className="h-16 w-auto drop-shadow-md" />
        {/* Diagonal cut decoration */}
        <div className="absolute right-[400px] top-0 bottom-0 w-16 bg-persimmon -skew-x-[25deg] hidden lg:block" />
        <span className="ml-auto font-display font-bold text-2xl text-paper tracking-widest uppercase tabular-nums">
          {clockStr}
        </span>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[2fr_1fr] min-h-0 z-10">
        <div className="p-12 lg:p-16 flex flex-col overflow-y-auto">
          <Scoreboard game={game} />
          {session && game ? (
            <VoteBar session={session} game={game} secondsLeft={secondsLeft} />
          ) : (
            <div className="mt-8 border-4 border-navy border-dashed p-8 flex items-center justify-center">
               <p className="font-display text-3xl font-bold uppercase tracking-[0.3em] text-navy/40 text-center">
                 Voting Closed
               </p>
            </div>
          )}
        </div>

        <div className="p-12 lg:p-16 overflow-y-auto bg-white/50 backdrop-blur-sm shadow-[-20px_0_40px_-20px_rgba(26,35,54,0.1)]">
          <Sidebar league={game?.league ?? null} standings={standings} leaders={leaders} />
        </div>
      </main>

      <footer className="bg-navy px-10 py-4 flex items-center justify-center gap-8 shrink-0 z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.2)]">
        <span className="font-display font-bold text-xl text-paper uppercase tracking-[0.25em]">
          Vote on your phone
        </span>
        {session && (
          <>
            <span className="w-1.5 h-6 bg-persimmon" aria-hidden="true" />
            <span className="font-display font-bold text-2xl text-persimmon uppercase tracking-[0.2em] drop-shadow-md">
              Code: {session.code}
            </span>
          </>
        )}
      </footer>
    </div>
  )
}
