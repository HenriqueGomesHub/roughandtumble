// Isolation boundary for the ESPN unofficial API.
// All ESPN-specific field paths, types, and defensive parsing live here.
// To swap data sources, replace this file only — nothing else references ESPN.

export type GameState = 'pre' | 'in' | 'post'

export interface EspnTeam {
  id: string
  displayName: string
  abbreviation: string
  logo: string    // URL (may be empty string)
  color: string   // '#rrggbb' always prefixed
}

export interface EspnGame {
  espnEventId: string
  startTime: string   // ISO datetime
  state: GameState
  statusDetail: string
  period: number
  clock: string
  homeTeam: EspnTeam
  awayTeam: EspnTeam
  homeScore: number
  awayScore: number
  winnerTeamId: string  // '' when unknown
  stats: Record<string, unknown>
}

export interface EspnStanding {
  teamId: string
  teamName: string
  teamAbbr: string
  teamLogo: string
  teamColor: string   // '#rrggbb'
  wins: number
  losses: number
  winPct: number
  seed: number | null
}

const ESPN_BASE = 'https://site.api.espn.com/apis'

// ESPN sits behind a CDN that aggressively caches and can serve days-old data
// (and silently strips query params). We defeat that two ways: send no-store so
// nothing is cached on our side, and append a unique cache-buster so the CDN
// can't hand back a stale edge copy. Always read the freshest slate.
async function espnFetch(path: string): Promise<unknown> {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${ESPN_BASE}${path}${sep}_=${Date.now()}`
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'rough-and-tumble-pickem/1.0',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
  })
  if (!res.ok) throw new Error(`ESPN HTTP ${res.status} ${path}`)
  return res.json()
}

// team.color from ESPN never has a '#'. Validate and prefix.
function safeHex(color: unknown): string {
  if (typeof color !== 'string') return '000000'
  const c = color.replace(/^#/, '')
  return /^[0-9a-fA-F]{3,6}$/.test(c) ? c : '000000'
}

function safeScore(score: unknown): number {
  const n = parseInt(String(score ?? '0'), 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function parseTeam(t: Record<string, unknown>): EspnTeam {
  return {
    id:           String(t.id ?? ''),
    displayName:  String(t.displayName ?? ''),
    abbreviation: String(t.abbreviation ?? ''),
    logo:         typeof t.logo === 'string' ? t.logo : '',
    color:        '#' + safeHex(t.color),
  }
}

// ── Scoreboard ────────────────────────────────────────────────────────────────

export async function fetchWnbaScoreboard(): Promise<EspnGame[]> {
  const data = await espnFetch('/site/v2/sports/basketball/wnba/scoreboard')
  const root = data as Record<string, unknown>
  const events = Array.isArray(root.events) ? root.events as unknown[] : []

  // Freshness check (per ESPN-stale-data guidance): log what day we actually
  // received so a stale/empty response is obvious in the function logs.
  const day = (Array.isArray(root.day) ? undefined : (root.day as Record<string, unknown> | undefined))
  console.log(
    `[espn] scoreboard: ${events.length} events`,
    `day=${day?.date ?? 'n/a'}`,
    `first=${(events[0] as Record<string, unknown> | undefined)?.date ?? 'n/a'}`,
  )

  return events.flatMap((event) => {
    try {
      return [parseEvent(event as Record<string, unknown>)]
    } catch {
      // Bad/incomplete events are skipped rather than crashing the poller.
      return []
    }
  })
}

function parseEvent(e: Record<string, unknown>): EspnGame {
  const comps = Array.isArray(e.competitions) ? e.competitions as unknown[] : []
  if (!comps.length) throw new Error('no competitions')

  const comp   = comps[0] as Record<string, unknown>
  const status = (comp.status ?? {}) as Record<string, unknown>
  const stype  = (status.type ?? {}) as Record<string, unknown>

  // ESPN state field is already 'pre'|'in'|'post'.
  const state = (['pre', 'in', 'post'].includes(String(stype.state ?? ''))
    ? stype.state : 'pre') as GameState

  const competitors = Array.isArray(comp.competitors)
    ? comp.competitors as unknown[]
    : []

  let homeTeam: EspnTeam | null = null
  let awayTeam: EspnTeam | null = null
  let homeScore = 0
  let awayScore = 0
  let winnerTeamId = ''

  for (const raw of competitors) {
    const c    = raw as Record<string, unknown>
    const team = parseTeam((c.team ?? {}) as Record<string, unknown>)
    const score = safeScore(c.score)

    if (c.homeAway === 'home') {
      homeTeam  = team
      homeScore = score
    } else {
      awayTeam  = team
      awayScore = score
    }
    if (c.winner === true && team.id) winnerTeamId = team.id
  }

  if (!homeTeam || !awayTeam) throw new Error('missing home/away team')

  return {
    espnEventId: String(e.id ?? ''),
    startTime:   String(e.date ?? ''),
    state,
    statusDetail: String(stype.shortDetail ?? ''),
    period:       Number(status.period ?? 0),
    clock:        String(status.displayClock ?? ''),
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    winnerTeamId,
    stats: {},
  }
}

// ── Summary (leaders / box score for live games) ───────────────────────────

export async function fetchWnbaSummary(eventId: string): Promise<Record<string, unknown>> {
  const data = await espnFetch(`/site/v2/sports/basketball/wnba/summary?event=${eventId}`)
  return extractSummaryStats(data as Record<string, unknown>)
}

function extractSummaryStats(data: Record<string, unknown>): Record<string, unknown> {
  const leaders: unknown[] = []

  try {
    const competitions = Array.isArray(data.competitions) ? data.competitions as unknown[] : []
    for (const raw of competitions) {
      const comp       = raw as Record<string, unknown>
      const competitors = Array.isArray(comp.competitors) ? comp.competitors as unknown[] : []
      for (const cr of competitors) {
        const c      = cr as Record<string, unknown>
        const teamId = String(((c.team ?? {}) as Record<string, unknown>).id ?? '')
        const cLeaders = Array.isArray(c.leaders) ? c.leaders as unknown[] : []
        for (const l of cLeaders) {
          const leader     = l as Record<string, unknown>
          const topLeaders = Array.isArray(leader.leaders) ? leader.leaders as unknown[] : []
          const top        = topLeaders[0] as Record<string, unknown> | undefined
          if (!top) continue
          const athlete = (top.athlete ?? {}) as Record<string, unknown>
          const headshot = (athlete.headshot ?? {}) as Record<string, unknown>
          leaders.push({
            teamId,
            category:  String(leader.name ?? ''),
            value:     String(top.displayValue ?? ''),
            athlete: {
              shortName: String(athlete.shortName ?? ''),
              headshot:  String(headshot.href ?? ''),
            },
          })
        }
      }
    }
  } catch {
    // Extraction failure returns partial stats rather than crashing the poller.
  }

  return { leaders }
}

// ── Standings ─────────────────────────────────────────────────────────────

// Note: standings uses /apis/v2, not /site/v2 (per spec warning).
export async function fetchWnbaStandings(): Promise<EspnStanding[]> {
  const data = await espnFetch('/v2/sports/basketball/wnba/standings')

  // The standings JSON shape is unstable; walk the tree collecting any object
  // that has both a 'team' field and a 'stats' array — then de-dupe by teamId.
  const found = collectStandingEntries(data)

  const seen = new Set<string>()
  return found
    .filter((e) => {
      if (!e.teamId || seen.has(e.teamId)) return false
      seen.add(e.teamId)
      return true
    })
    .sort((a, b) => b.winPct - a.winPct)
    .map((e, i) => ({ ...e, seed: e.seed ?? (i + 1) }))
}

function collectStandingEntries(
  node: unknown,
  out: EspnStanding[] = [],
  depth = 0,
): EspnStanding[] {
  if (!node || typeof node !== 'object' || depth > 12) return out

  if (Array.isArray(node)) {
    for (const item of node) collectStandingEntries(item, out, depth + 1)
    return out
  }

  const o = node as Record<string, unknown>

  if (o.team && Array.isArray(o.stats)) {
    const team  = o.team as Record<string, unknown>
    const stats = o.stats as Array<Record<string, unknown>>

    const getStat = (name: string): number => {
      const s = stats.find((s) => s.name === name || s.abbreviation === name)
      return s ? Number(s.value ?? 0) : 0
    }

    out.push({
      teamId:    String(team.id ?? ''),
      teamName:  String(team.displayName ?? ''),
      teamAbbr:  String(team.abbreviation ?? ''),
      teamLogo:  typeof team.logo === 'string' ? team.logo : '',
      teamColor: '#' + safeHex(team.color),
      wins:      getStat('wins'),
      losses:    getStat('losses'),
      winPct:    getStat('winPercent'),
      seed:      getStat('rank') || null,
    })
    // Don't recurse further into this entry — avoids duplicating nested objects.
    return out
  }

  for (const val of Object.values(o)) {
    collectStandingEntries(val, out, depth + 1)
  }
  return out
}
