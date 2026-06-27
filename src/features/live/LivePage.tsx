import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Radio, Tv, Minimize2 } from 'lucide-react'
import { useSession } from '../../hooks/useSession'
import { useLiveGame } from '../../hooks/useLiveGame'
import { formatCountdown } from '../../lib/time'
import { supabase } from '../../lib/supabase'
import type { LiveLayout } from '../../routes/PhoneApp'
import type { Game, VotingSession } from '../../types'

// SVG noise texture for vintage paper/grit effect
const NOISE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E`

// ── Shared types ──────────────────────────────────────────────────────────────

interface GameSummary {
  id: string
  away_abbr: string | null; away_name: string | null; away_score: number; away_color: string | null; away_logo: string | null; away_team_id: string
  home_abbr: string | null; home_name: string | null; home_score: number; home_color: string | null; home_logo: string | null; home_team_id: string
  winner_team_id: string | null; start_time: string | null; league: string; state: 'pre' | 'in' | 'post'; period: number | null
}

const GAME_BASE = 'id, away_abbr, away_name, away_score, away_color, away_logo, away_team_id, home_abbr, home_name, home_score, home_color, home_logo, home_team_id, winner_team_id, start_time, league, state, period'

// A matchup as displayed — common to the full Game row and the lighter GameSummary.
type Matchup = Game | GameSummary

function fmtDateTime(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }),
  }
}

// ── Scoreboard (navy) ───────────────────────────────────────────────────────

function TeamLogo({ logo, color, abbr, sizeClass }: {
  logo: string | null; color: string | null; abbr: string | null; sizeClass: string
}) {
  const [errored, setErrored] = useState(false)
  if (!logo || errored) {
    return (
      <div
        className={`${sizeClass} flex items-center justify-center font-display font-bold text-white shrink-0 text-[10px] md:text-base shadow-[2px_2px_0_0_rgba(0,0,0,0.25)]`}
        style={{ backgroundColor: color ?? '#232F49' }}
      >
        {abbr ?? '?'}
      </div>
    )
  }
  return (
    <img src={logo} alt={abbr ?? ''} className={`${sizeClass} object-contain shrink-0 drop-shadow-lg`} onError={() => setErrored(true)} />
  )
}

// Logo above the team name, used on the big scoreboard.
function TeamColumn({ m, side, logoSize, nameSize, winnerTeamId }: {
  m: Matchup; side: 'home' | 'away'; logoSize: string; nameSize: string; winnerTeamId?: string | null
}) {
  const logo = side === 'home' ? m.home_logo : m.away_logo
  const color = side === 'home' ? m.home_color : m.away_color
  const abbr = side === 'home' ? m.home_abbr : m.away_abbr
  const name = side === 'home' ? m.home_name : m.away_name
  const teamId = side === 'home' ? m.home_team_id : m.away_team_id
  const isWinner = winnerTeamId != null && winnerTeamId === teamId
  return (
    <div className="flex flex-col items-center gap-2.5 md:gap-3 flex-1 min-w-0">
      <TeamLogo logo={logo} color={color} abbr={abbr} sizeClass={logoSize} />
      <p className={`font-display font-bold ${nameSize} uppercase tracking-wide text-center leading-tight line-clamp-2 w-full ${isWinner ? 'text-persimmon' : 'text-white'}`}>
        {name ?? abbr ?? ''}
      </p>
    </div>
  )
}

// The big top-of-page scoreboard. Live/final shows scores; otherwise the next
// game in the same navy style (tip-off time instead of scores).
function Scoreboard({ game, nextGame }: { game: Game | null; nextGame: GameSummary | null }) {
  const isLive = game?.state === 'in'
  const isFinal = game?.state === 'post'

  if (game && (isLive || isFinal)) {
    const winner = isFinal ? game.winner_team_id : null
    const awayWins = winner != null && winner === game.away_team_id
    const homeWins = winner != null && winner === game.home_team_id
    return (
      <section aria-label="Live scoreboard" className="relative overflow-hidden bg-navy border-4 border-navy shadow-[8px_8px_0_0_#E96630]">
        <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30 z-0" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />
        <div className="relative z-10 px-5 md:px-10 py-6 md:py-9 lg:py-10">
          <div className="flex items-center justify-center gap-2.5 mb-5 md:mb-8">
            {isLive ? (
              <>
                <span className="size-3 bg-persimmon animate-pulse shadow-[0_0_12px_rgba(233,102,48,0.9)] shrink-0" aria-hidden="true" />
                <span className="font-display font-bold text-sm md:text-base uppercase tracking-[0.35em] text-white">Live</span>
                {(game.period || game.clock) && (
                  <span className="font-display font-bold text-xs md:text-sm uppercase tracking-widest text-white/45">
                    · {game.period ? `Q${game.period}` : ''}{game.clock ? ` ${game.clock}` : ''}
                  </span>
                )}
              </>
            ) : (
              <span className="font-display font-bold text-sm md:text-base uppercase tracking-[0.35em] text-white/55">Final</span>
            )}
          </div>
          <div className="flex items-center justify-center gap-3 md:gap-6">
            <TeamColumn m={game} side="away" logoSize="size-16 md:size-24 lg:size-28" nameSize="text-sm md:text-2xl" winnerTeamId={winner} />
            <span className={`font-display font-bold tabular-nums leading-none text-5xl md:text-7xl lg:text-8xl shrink-0 ${awayWins ? 'text-persimmon drop-shadow-md' : 'text-white'}`}>
              {game.away_score}
            </span>
            <span className="w-[2px] md:w-[3px] h-12 md:h-16 lg:h-20 bg-persimmon shrink-0" aria-hidden="true" />
            <span className={`font-display font-bold tabular-nums leading-none text-5xl md:text-7xl lg:text-8xl shrink-0 ${homeWins ? 'text-persimmon drop-shadow-md' : 'text-white'}`}>
              {game.home_score}
            </span>
            <TeamColumn m={game} side="home" logoSize="size-16 md:size-24 lg:size-28" nameSize="text-sm md:text-2xl" winnerTeamId={winner} />
          </div>
        </div>
      </section>
    )
  }

  const upcoming: Matchup | null = game?.state === 'pre' ? game : nextGame
  if (upcoming) {
    const { date, time } = fmtDateTime(upcoming.start_time)
    return (
      <section aria-label="Next game" className="relative overflow-hidden bg-navy border-4 border-navy shadow-[8px_8px_0_0_#E96630]">
        <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30 z-0" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />
        <div className="relative z-10 px-5 md:px-10 py-6 md:py-9 lg:py-10">
          <div className="flex items-center justify-center mb-5 md:mb-8">
            <span className="font-display font-bold text-sm md:text-base uppercase tracking-[0.35em] text-persimmon">Up Next</span>
          </div>
          <div className="flex items-center justify-center gap-3 md:gap-8">
            <TeamColumn m={upcoming} side="away" logoSize="size-16 md:size-24 lg:size-28" nameSize="text-sm md:text-2xl" />
            <div className="flex flex-col items-center gap-3 shrink-0">
              <span className="font-display font-bold text-2xl md:text-4xl text-white/30 leading-none">✕</span>
              {(date || time) && (
                <div className="bg-paper px-3 md:px-4 py-1.5 shadow-[3px_3px_0_0_#E96630] text-center">
                  <p className="font-display font-bold text-navy text-[11px] md:text-sm uppercase tracking-widest whitespace-nowrap">{date}</p>
                  {time && <p className="font-display font-bold text-persimmon text-base md:text-xl tabular-nums leading-none mt-0.5">{time}</p>}
                </div>
              )}
            </div>
            <TeamColumn m={upcoming} side="home" logoSize="size-16 md:size-24 lg:size-28" nameSize="text-sm md:text-2xl" />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section aria-label="No game" className="relative overflow-hidden bg-navy border-4 border-navy shadow-[8px_8px_0_0_#E96630]">
      <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30 z-0" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />
      <div className="relative z-10 px-6 py-12 md:py-20 flex flex-col items-center text-center gap-5">
        <div className="w-14 h-1 bg-persimmon" />
        <p className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tight text-white/80 leading-none">No Game<br />On Air</p>
        <div className="w-14 h-1 bg-persimmon" />
      </div>
    </section>
  )
}

// ── Upcoming games — small, flat navy cards (clearly secondary to the scoreboard) ──

function UpcomingCard({ g }: { g: GameSummary }) {
  const { date, time } = fmtDateTime(g.start_time)
  return (
    <div className="relative overflow-hidden bg-navy border border-white/15 px-2.5 py-2.5">
      <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-20" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />
      <div className="relative z-10 flex items-center justify-center gap-2">
        <TeamLogo logo={g.away_logo} color={g.away_color} abbr={g.away_abbr} sizeClass="size-6" />
        <span className="font-display font-bold text-[11px] uppercase tracking-wide text-white whitespace-nowrap">{g.away_abbr ?? '?'}</span>
        <span className="font-display font-bold text-[11px] text-white/30 px-0.5">✕</span>
        <span className="font-display font-bold text-[11px] uppercase tracking-wide text-white whitespace-nowrap">{g.home_abbr ?? '?'}</span>
        <TeamLogo logo={g.home_logo} color={g.home_color} abbr={g.home_abbr} sizeClass="size-6" />
      </div>
      {(date || time) && (
        <p className="relative z-10 mt-1.5 text-center font-display font-bold text-[9px] uppercase tracking-[0.2em] text-persimmon whitespace-nowrap">
          {date}{time ? ` · ${time}` : ''}
        </p>
      )}
    </div>
  )
}

function UpcomingGames({ games }: { games: GameSummary[] }) {
  if (games.length === 0) return null
  return (
    <div>
      <p className="font-display font-bold text-[10px] uppercase tracking-[0.3em] text-navy/50 mb-2">Next Games</p>
      <div className="grid grid-cols-2 gap-3">
        {games.map(g => <UpcomingCard key={g.id} g={g} />)}
      </div>
    </div>
  )
}

// ── Recent results ─────────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-4 px-4 md:px-5 py-3 bg-navy text-white shrink-0">
      <h2 className="font-display text-[11px] font-bold uppercase tracking-[0.25em] shrink-0">{title}</h2>
      <div className="flex-1 h-[2px] bg-white/10" />
      {count != null && (
        <span className="font-display font-bold text-[11px] text-persimmon tabular-nums shrink-0">{count}</span>
      )}
    </div>
  )
}

function ResultRow({ g }: { g: GameSummary }) {
  const homeWins = g.winner_team_id === g.home_team_id
  const awayWins = g.winner_team_id === g.away_team_id
  const date = g.start_time ? new Date(g.start_time) : null
  const dateStr = date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })
  const dimAway = !awayWins && g.winner_team_id
  const dimHome = !homeWins && g.winner_team_id

  return (
    <div className="bg-white px-4 md:px-5 py-3 border-b border-navy/10">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-persimmon">Final</span>
        <span className="font-display font-bold text-[10px] text-navy/40 uppercase tracking-widest">{dateStr}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-2 flex-1 min-w-0 ${dimAway ? 'opacity-40' : ''}`}>
          <TeamLogo logo={g.away_logo} color={g.away_color} abbr={g.away_abbr} sizeClass="size-7" />
          <span className="font-display font-bold text-sm text-navy uppercase truncate">{g.away_abbr ?? g.away_name}</span>
          <span className={`font-display text-xl font-bold tabular-nums leading-none ml-auto ${awayWins ? 'text-navy' : 'text-navy/30'}`}>{g.away_score}</span>
        </div>
        <span className="font-display text-xs font-bold text-navy/20 shrink-0">·</span>
        <div className={`flex items-center gap-2 flex-1 min-w-0 ${dimHome ? 'opacity-40' : ''}`}>
          <span className={`font-display text-xl font-bold tabular-nums leading-none ${homeWins ? 'text-navy' : 'text-navy/30'}`}>{g.home_score}</span>
          <span className="font-display font-bold text-sm text-navy uppercase truncate ml-auto text-right">{g.home_abbr ?? g.home_name}</span>
          <TeamLogo logo={g.home_logo} color={g.home_color} abbr={g.home_abbr} sizeClass="size-7" />
        </div>
      </div>
    </div>
  )
}

function RecentResults({ games }: { games: GameSummary[] }) {
  return (
    <section aria-label="Recent results" className="border-2 border-navy shadow-[6px_6px_0_0_#232F49] overflow-hidden flex flex-col lg:h-full">
      <SectionHeader title="Recent Results" count={games.length} />
      {games.length > 0 ? (
        <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto bg-white">
          {games.map(g => <ResultRow key={g.id} g={g} />)}
        </div>
      ) : (
        <div className="bg-white px-5 py-10 text-center">
          <p className="font-display font-bold text-[11px] uppercase tracking-widest text-navy/40">Results show up here<br />after game day.</p>
        </div>
      )}
    </section>
  )
}

// ── Pick'em panel ─────────────────────────────────────────────────────────────
// Hidden until the admin opens voting; then it emerges (covering Recent Results
// on desktop) with the join code + countdown to create urgency.

function PickemPanel({ session, game, secondsLeft }: { session: VotingSession; game: Game; secondsLeft: number | null }) {
  const total = session.total_votes
  const homePct = total > 0 ? Math.round((session.home_votes / total) * 100) : 50
  const awayPct = 100 - homePct
  const urgent = secondsLeft !== null && secondsLeft <= 15

  return (
    <section
      aria-label="Pick'em open"
      className="relative overflow-hidden bg-navy border-4 border-persimmon shadow-[8px_8px_0_0_#E96630] h-full flex flex-col"
      style={{ animation: 'emerge 0.35s ease-out' }}
    >
      <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />

      {/* Urgent banner */}
      <div className="relative z-10 bg-persimmon px-4 py-2.5 flex items-center justify-center gap-2 shrink-0">
        <span className="size-2.5 bg-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.9)] shrink-0" aria-hidden="true" />
        <span className="font-display font-bold text-sm uppercase tracking-[0.3em] text-white">Pick'em Open</span>
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center gap-5 md:gap-6 px-5 py-6 text-center">
        {/* Matchup */}
        <p className="font-display font-bold text-[11px] uppercase tracking-[0.25em] text-white/50">
          {game.away_abbr ?? 'AWAY'} <span className="text-white/30">@</span> {game.home_abbr ?? 'HOME'}
        </p>

        {/* Join code */}
        <div>
          <p className="font-display font-bold text-[10px] uppercase tracking-[0.3em] text-white/50 mb-1.5">Enter code to vote</p>
          <p className="font-display font-bold text-5xl md:text-6xl tabular-nums tracking-[0.15em] text-persimmon leading-none drop-shadow-md">
            {session.code}
          </p>
        </div>

        {/* Countdown */}
        {secondsLeft !== null && (
          <div>
            <p className="font-display font-bold text-[10px] uppercase tracking-[0.3em] text-white/50 mb-1">Closes in</p>
            <p
              className={`font-display font-bold text-3xl md:text-4xl tabular-nums leading-none ${urgent ? 'text-persimmon animate-pulse' : 'text-white'}`}
              aria-live="polite"
            >
              {formatCountdown(secondsLeft)}
            </p>
          </div>
        )}

        {/* Live vote split */}
        <div>
          <div className="h-8 flex overflow-hidden border-2 border-white/10" role="meter" aria-label={`Home ${homePct}%, Away ${awayPct}%`} aria-valuenow={homePct} aria-valuemin={0} aria-valuemax={100}>
            <div className="bg-persimmon flex items-center justify-start px-2 transition-all duration-700 ease-out" style={{ width: `${homePct}%` }}>
              {homePct >= 22 && <span className="font-display text-[11px] font-bold text-white">{homePct}%</span>}
            </div>
            <div className="flex-1 bg-paper flex items-center justify-end px-2">
              {awayPct >= 22 && <span className="font-display text-[11px] font-bold text-navy">{awayPct}%</span>}
            </div>
          </div>
          <div className="flex justify-between mt-1.5 font-display font-bold text-[10px] uppercase tracking-widest">
            <span className="text-white">{game.home_abbr ?? 'HOME'}</span>
            <span className="text-white/50">{game.away_abbr ?? 'AWAY'}</span>
          </div>
        </div>

        <p className="font-display font-bold text-[10px] uppercase tracking-[0.25em] text-white/40">
          {total === 0 ? 'Be the first to call it!' : `${total} ${total === 1 ? 'pick' : 'picks'} in`}
        </p>
      </div>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function LivePage() {
  const { tvMode, enterTv, exitTv } = useOutletContext<LiveLayout>()
  const { session, secondsLeft } = useSession()
  const { game, loading } = useLiveGame(session?.game_id ?? null)
  const [pastGames, setPastGames] = useState<GameSummary[]>([])
  const [upcomingGames, setUpcomingGames] = useState<GameSummary[]>([])

  useEffect(() => {
    Promise.all([
      supabase.from('games').select(GAME_BASE).eq('state', 'post').order('updated_at', { ascending: false }).limit(8),
      supabase.from('games').select(GAME_BASE).eq('state', 'pre').order('start_time', { ascending: true }).limit(4),
    ]).then(([{ data: past }, { data: next }]) => {
      const allPast = (past ?? []) as GameSummary[]
      setPastGames(game?.id ? allPast.filter(g => g.id !== game.id) : allPast)
      setUpcomingGames((next ?? []) as GameSummary[])
    })
  }, [game?.id])

  const nextGame = upcomingGames[0] ?? null
  const featuredUpcomingId =
    game && (game.state === 'in' || game.state === 'post') ? null
    : game?.state === 'pre' ? game.id
    : nextGame?.id ?? null
  const upcomingCards = upcomingGames.filter(g => g.id !== featuredUpcomingId).slice(0, 2)
  // useSession only returns an open session, so its presence means voting is live.
  const pickemOpen = !!(session && game)

  return (
    <div style={{ animation: 'fade-up 0.25s ease-out' }} className="flex flex-col lg:h-full">

      {/* ── Section header ────────────────────────────────────────────────── */}
      <div className="bg-navy px-4 md:px-8 lg:px-12 py-4 flex items-center justify-between border-b-4 border-persimmon relative overflow-hidden shrink-0">
        <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />
        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-persimmon p-1.5 shadow-[2px_2px_0_0_#FFF]">
             <Radio size={16} className="text-white shrink-0" strokeWidth={2.5} />
          </div>
          <h1 className="font-display font-bold text-lg md:text-xl uppercase tracking-[0.2em] text-white">Live</h1>
          {!loading && game?.state === 'in' && (
            <span className="flex items-center gap-2 ml-2 bg-white/10 px-2 py-1">
              <span className="size-2.5 bg-persimmon animate-pulse shadow-[0_0_8px_rgba(233,102,48,0.8)]" />
              <span className="font-display font-bold text-[10px] uppercase tracking-widest text-persimmon">On Air</span>
            </span>
          )}
        </div>
        {/* TV Mode — desktop only (topic 5 keeps it off mobile) */}
        <button
          onClick={tvMode ? exitTv : enterTv}
          className="hidden lg:flex items-center gap-2 px-4 py-2 font-display font-bold text-[10px] uppercase tracking-[0.2em] text-navy bg-paper border-2 border-transparent hover:border-persimmon transition-colors relative z-10 shadow-[3px_3px_0_0_#E96630]"
        >
          {tvMode ? <Minimize2 size={14} strokeWidth={2.5} /> : <Tv size={14} strokeWidth={2.5} />}
          {tvMode ? 'Normal Mode' : 'TV Mode'}
        </button>
      </div>

      {loading ? (
        <div className="flex-1 px-4 md:px-8 py-6 max-w-5xl mx-auto w-full space-y-5 animate-pulse" aria-busy="true">
          <div className="h-56 md:h-64 bg-navy/10 border-2 border-navy/5" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2].map(i => <div key={i} className="h-14 bg-navy/10 border border-navy/5" />)}
          </div>
        </div>
      ) : (
        <div className="flex-1 lg:min-h-0 lg:overflow-hidden flex flex-col lg:flex-row gap-4 lg:gap-6 p-4 md:p-6 lg:p-6 max-w-none lg:max-w-7xl lg:mx-auto w-full">

          {/* ── Left — bigger live section + small next games ───────────── */}
          <div className="lg:flex-[7] flex flex-col gap-4 md:gap-5 min-w-0 lg:min-h-0">
            <Scoreboard game={game} nextGame={nextGame} />
            {/* Mobile: the Pick'em panel emerges right under the scoreboard. */}
            {pickemOpen && (
              <div className="lg:hidden">
                <PickemPanel session={session!} game={game!} secondsLeft={secondsLeft} />
              </div>
            )}
            <UpcomingGames games={upcomingCards} />
          </div>

          {/* ── Right — Pick'em panel (when voting is open) covers Recent Results ── */}
          <div className="lg:flex-[3] min-w-0 lg:min-h-0 flex">
            <div className="w-full lg:h-full">
              {/* Desktop: swap Recent Results for the Pick'em panel while voting is open. */}
              <div className="hidden lg:block lg:h-full">
                {pickemOpen
                  ? <PickemPanel session={session!} game={game!} secondsLeft={secondsLeft} />
                  : <RecentResults games={pastGames} />}
              </div>
              {/* Mobile: Recent Results always lists here (Pick'em shows up top). */}
              <div className="lg:hidden">
                <RecentResults games={pastGames} />
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
