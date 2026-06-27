export interface Profile {
  id: string
  phone: string
  display_name: string
  is_admin: boolean
  total_points: number
  current_streak: number
  best_streak: number
  total_wins: number
  created_at: string
}

export interface GameLeader {
  teamId: string
  category: string        // 'points' | 'rebounds' | 'assists' (ESPN name field)
  value: string           // display value, e.g. '24' or '7 AST'
  athlete: {
    shortName: string
    headshot: string      // URL — may be empty
  }
}

export interface Game {
  id: string
  espn_event_id: string
  season_id: string
  league: string
  is_playoff: boolean
  state: 'pre' | 'in' | 'post'
  status_detail: string | null
  period: number | null
  clock: string | null
  start_time: string | null
  home_team_id: string
  home_name: string | null
  home_abbr: string | null
  home_logo: string | null
  home_color: string | null
  home_score: number
  away_team_id: string
  away_name: string | null
  away_abbr: string | null
  away_logo: string | null
  away_color: string | null
  away_score: number
  winner_team_id: string | null
  stats: { leaders?: GameLeader[]; [key: string]: unknown }
  updated_at: string
}

export interface VotingSession {
  id: string
  game_id: string
  code: string
  duration_seconds: number
  opens_at: string
  closes_at: string
  status: 'open' | 'closed' | 'settled' | 'cancelled'
  home_votes: number
  away_votes: number
  total_votes: number
  created_at: string
}
