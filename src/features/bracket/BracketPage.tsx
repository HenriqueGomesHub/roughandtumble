import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const NOISE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E`

interface Matchup {
  id: string
  round: number
  round_label: string
  position: number
  team_a_id: string | null
  team_a_name: string | null
  team_a_logo: string | null
  team_b_id: string | null
  team_b_name: string | null
  team_b_logo: string | null
  winner_team_id: string | null
}

function nameAbbr(name: string | null): string {
  if (!name) return '?'
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase()
}

// ── Preview bracket ─────────────────────────────────────────────────────────
// When no real bracket has been set, synthesize an in-progress playoff bracket
// from live standings (real WNBA teams) so the app can be demoed populated.
interface StandingTeam { team_id: string; team_name: string; team_abbr: string }

// ESPN logo CDN — same pattern the poller stores on games.
function deriveLogo(abbr: string): string {
  return `https://a.espncdn.com/i/teamlogos/wnba/500/${abbr.toLowerCase()}.png`
}

function buildSampleBracket(seeds: StandingTeam[]): Matchup[] {
  const [s1, s2, s3, s4, s5, s6, s7, s8] = seeds
  const mk = (
    round: number, round_label: string, position: number,
    a: StandingTeam | null, b: StandingTeam | null, winner_team_id: string | null,
  ): Matchup => ({
    id: `sample-${round}-${position}`,
    round, round_label, position,
    team_a_id: a?.team_id ?? null, team_a_name: a?.team_name ?? null, team_a_logo: a ? deriveLogo(a.team_abbr) : null,
    team_b_id: b?.team_id ?? null, team_b_name: b?.team_name ?? null, team_b_logo: b ? deriveLogo(b.team_abbr) : null,
    winner_team_id,
  })
  return [
    // Quarterfinals — all decided (note the 4v5 upset).
    mk(1, 'Quarterfinals', 1, s1, s8, s1.team_id),
    mk(1, 'Quarterfinals', 2, s4, s5, s5.team_id),
    mk(1, 'Quarterfinals', 3, s2, s7, s2.team_id),
    mk(1, 'Quarterfinals', 4, s3, s6, s3.team_id),
    // Semifinals — one decided, one still underway.
    mk(2, 'Semifinals', 1, s1, s5, s1.team_id),
    mk(2, 'Semifinals', 2, s2, s3, null),
    // Final — top seed through, opponent TBD.
    mk(3, 'Final', 1, s1, null, null),
  ]
}

function TeamSlot({
  id, name, logo, winnerTeamId, hasBorder,
}: {
  id: string | null; name: string | null; logo: string | null
  winnerTeamId: string | null; hasBorder: boolean
}) {
  const [err, setErr] = useState(false)
  const isWinner = id != null && id === winnerTeamId
  const isLoser  = winnerTeamId != null && id != null && !isWinner

  return (
    <div className={[
      'flex items-center gap-4 px-4 h-14 md:h-16 transition-opacity relative z-10',
      isWinner ? 'bg-persimmon/10' : 'bg-transparent',
      isLoser  ? 'opacity-40 grayscale-[0.5]' : '',
      hasBorder ? 'border-b-2 border-navy/10' : '',
    ].join(' ')}>
      {isWinner && <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-persimmon" />}
      {id ? (
        <>
          {logo && !err ? (
            <img src={logo} alt={name ?? ''} className="size-8 md:size-10 object-contain shrink-0 drop-shadow-md" onError={() => setErr(true)} />
          ) : (
            <div className="size-8 md:size-10 bg-navy flex items-center justify-center font-display font-bold text-[10px] text-white shrink-0 shadow-[2px_2px_0_0_#E96630]">
              {nameAbbr(name)}
            </div>
          )}
          <span className={`font-display uppercase tracking-widest text-sm md:text-base truncate flex-1 ${isWinner ? 'font-bold text-navy' : 'font-bold text-navy/70'}`}>
            {name ?? 'TBD'}
          </span>
          {isWinner && <Trophy size={16} className="text-persimmon shrink-0 drop-shadow-sm" strokeWidth={2.5} />}
        </>
      ) : (
        <>
          <div className="size-8 md:size-10 bg-navy/10 shrink-0 border border-navy/10" />
          <span className="font-display font-bold uppercase tracking-widest text-sm md:text-base text-navy/30">TBD</span>
        </>
      )}
    </div>
  )
}

function MatchupCard({ matchup }: { matchup: Matchup }) {
  return (
    <div className="bg-white border-2 border-navy shadow-[4px_4px_0_0_#232F49] overflow-hidden relative transition-transform hover:-translate-y-0.5">
      <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-[0.03] z-0" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />
      <TeamSlot id={matchup.team_a_id} name={matchup.team_a_name} logo={matchup.team_a_logo} winnerTeamId={matchup.winner_team_id} hasBorder={true} />
      <TeamSlot id={matchup.team_b_id} name={matchup.team_b_name} logo={matchup.team_b_logo} winnerTeamId={matchup.winner_team_id} hasBorder={false} />
    </div>
  )
}

// Persimmon elbow joining a matchup to its slot in the next round. `upper` is
// the top feeder of a pair (line runs down to the midpoint); otherwise it runs up.
function Connector({ upper }: { upper: boolean }) {
  return (
    <div className="relative self-stretch w-5 md:w-8 shrink-0" aria-hidden="true">
      {/* stub from the card out to the vertical line, at the card's centre */}
      <div className="absolute top-1/2 left-0 right-1/2 border-t-2 border-persimmon" />
      {/* vertical line: centre → midpoint (down for upper, up for lower) */}
      <div className={`absolute right-1/2 border-r-2 border-persimmon ${upper ? 'top-1/2 bottom-0' : 'top-0 bottom-1/2'}`} />
      {/* stub from the midpoint out to the next round */}
      <div className={`absolute left-1/2 right-0 border-t-2 border-persimmon ${upper ? 'bottom-0' : 'top-0'}`} />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="px-2 py-12 md:py-20 flex justify-center">
      <div className="w-full max-w-md py-16 px-8 flex flex-col items-center gap-6 bg-white border-4 border-navy border-dashed relative overflow-hidden shadow-[8px_8px_0_0_#232F49]">
        <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-10" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />
        <Trophy size={56} className="text-navy/20 relative z-10" strokeWidth={2} />
        <div className="text-center relative z-10">
          <p className="font-display text-2xl font-bold uppercase tracking-[0.2em] text-navy">Bracket not set yet</p>
          <p className="font-display font-bold text-[10px] uppercase tracking-widest text-navy/40 max-w-[280px] mx-auto mt-3 leading-relaxed">
            The playoff bracket will appear here once the season gets underway.
          </p>
        </div>
      </div>
    </div>
  )
}

export function BracketPage() {
  const [matchups, setMatchups] = useState<Matchup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: seasonData } = await supabase
        .from('seasons').select('id, league').eq('is_active', true).limit(1).single()
      const season = seasonData as { id: string; league: string } | null
      if (!season) { setLoading(false); return }
      const { data } = await supabase
        .from('bracket_matchups')
        .select('id, round, round_label, position, team_a_id, team_a_name, team_a_logo, team_b_id, team_b_name, team_b_logo, winner_team_id')
        .eq('season_id', season.id)
        .order('round', { ascending: true })
        .order('position', { ascending: true })
      const real = (data as Matchup[]) ?? []
      if (real.length > 0) { setMatchups(real); setLoading(false); return }

      // No real bracket yet — build a preview from live standings.
      const { data: standingsData } = await supabase
        .from('standings_cache')
        .select('team_id, team_name, team_abbr')
        .eq('league', season.league)
        .order('seed', { ascending: true, nullsFirst: false })
        .limit(8)
      const seeds = (standingsData as StandingTeam[]) ?? []
      setMatchups(seeds.length >= 8 ? buildSampleBracket(seeds) : [])
      setLoading(false)
    }
    load()
  }, [])

  const roundMap = new Map<number, { label: string; items: Matchup[] }>()
  for (const m of matchups) {
    const entry = roundMap.get(m.round) ?? { label: m.round_label, items: [] }
    entry.items.push(m)
    roundMap.set(m.round, entry)
  }
  const rounds = [...roundMap.values()]

  return (
    <div style={{ animation: 'fade-up 0.25s ease-out' }} className="relative min-h-full">

      {/* ── Compact section header ────────────────────────────────────────── */}
      <div className="bg-navy px-4 md:px-8 lg:px-12 py-4 md:py-6 flex items-center gap-4 border-b-4 border-persimmon relative overflow-hidden shadow-md">
        <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30 z-0" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />
        <div className="bg-persimmon p-1.5 shadow-[2px_2px_0_0_#FFF] relative z-10">
          <Trophy size={16} className="text-white shrink-0" strokeWidth={2.5} />
        </div>
        <h1 className="font-display font-bold text-lg md:text-xl uppercase tracking-[0.2em] text-white relative z-10">
          Bracket
        </h1>
      </div>

      {/* ── Rounds ────────────────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 lg:px-12 py-8 md:py-12 overflow-x-auto relative z-10">
        {loading ? (
          <div className="flex gap-10 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-64 md:w-72 shrink-0 space-y-4">
                <div className="h-6 bg-navy/15 w-36 mb-6" />
                {[1, 2, 3].map(j => <div key={j} className="h-28 bg-navy/10 border-2 border-navy/5" />)}
              </div>
            ))}
          </div>
        ) : rounds.length === 0 ? (
          <EmptyState />
        ) : (
          /*
           * Connected bracket tree: rounds left-to-right, each round a column of
           * equal height so later rounds centre between their feeder matchups,
           * joined by persimmon connector elbows. `w-max mx-auto` centres the
           * whole tree when it fits and scrolls horizontally when it doesn't.
           */
          <div className="flex w-max mx-auto items-stretch">
            {rounds.map(({ label, items }, ri) => {
              const isLast = ri === rounds.length - 1
              return (
                <div key={label} className="flex flex-col shrink-0">
                  <div className="flex items-center gap-3 mb-6 pb-2 border-b-2 border-navy self-start">
                    <div className="w-2 h-2 bg-persimmon shrink-0" />
                    <h2 className="font-display font-bold text-sm md:text-base uppercase tracking-[0.2em] text-navy whitespace-nowrap">{label}</h2>
                  </div>
                  <div className="flex-1 flex flex-col">
                    {items.map((m, i) => (
                      <div key={m.id} className="flex-1 flex items-center">
                        <div className="w-40 md:w-56 lg:w-64 shrink-0 my-2 md:my-3">
                          <MatchupCard matchup={m} />
                        </div>
                        {!isLast && <Connector upper={i % 2 === 0} />}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
