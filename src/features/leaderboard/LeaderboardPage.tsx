import { useState } from 'react'
import { Flame, Trophy, Medal, BarChart2 } from 'lucide-react'
import { useAuth } from '../onboarding/AuthProvider'
import { useLeaderboard } from '../../hooks/useLeaderboard'
import type { LeaderRow, LeaderTab } from '../../hooks/useLeaderboard'

// Noise SVG
const NOISE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E`

// ── Preview placeholders ────────────────────────────────────────────────────
// Shown only when there is no real leaderboard data yet, so the app can be
// demoed with a populated board. One row is flagged as the viewer ("You").
const SAMPLE_YOU_ID = '__sample_you__'

const SAMPLE_WEEK: LeaderRow[] = [
  { id: 's1',          rank: 1,  display_name: 'Maya Bennett',  total_points: 47, current_streak: 5 },
  { id: 's2',          rank: 2,  display_name: 'Sofia Reyes',   total_points: 43, current_streak: 3 },
  { id: 's3',          rank: 3,  display_name: 'Jordan Lee',     total_points: 41, current_streak: 2 },
  { id: SAMPLE_YOU_ID, rank: 4,  display_name: 'You',            total_points: 38, current_streak: 4 },
  { id: 's5',          rank: 5,  display_name: 'Priya Nair',     total_points: 35, current_streak: 0 },
  { id: 's6',          rank: 6,  display_name: 'Tasha Brooks',   total_points: 31, current_streak: 2 },
  { id: 's7',          rank: 7,  display_name: 'Dani Klein',     total_points: 28, current_streak: 0 },
  { id: 's8',          rank: 8,  display_name: 'Robin Vega',     total_points: 24, current_streak: 0 },
  { id: 's9',          rank: 9,  display_name: 'Casey Monroe',   total_points: 19, current_streak: 0 },
  { id: 's10',         rank: 10, display_name: 'Alex Iverson',   total_points: 14, current_streak: 0 },
]

const SAMPLE_SEASON: LeaderRow[] = [
  { id: 's2',          rank: 1,  display_name: 'Sofia Reyes',   total_points: 312, current_streak: 5 },
  { id: 's1',          rank: 2,  display_name: 'Maya Bennett',  total_points: 305, current_streak: 2 },
  { id: 's3',          rank: 3,  display_name: 'Jordan Lee',     total_points: 288, current_streak: 3 },
  { id: 's5',          rank: 4,  display_name: 'Priya Nair',     total_points: 270, current_streak: 0 },
  { id: 's6',          rank: 5,  display_name: 'Tasha Brooks',   total_points: 245, current_streak: 2 },
  { id: SAMPLE_YOU_ID, rank: 6,  display_name: 'You',            total_points: 231, current_streak: 4 },
  { id: 's7',          rank: 7,  display_name: 'Dani Klein',     total_points: 210, current_streak: 0 },
  { id: 's8',          rank: 8,  display_name: 'Robin Vega',     total_points: 188, current_streak: 0 },
  { id: 's9',          rank: 9,  display_name: 'Casey Monroe',   total_points: 162, current_streak: 0 },
  { id: 's10',         rank: 10, display_name: 'Alex Iverson',   total_points: 140, current_streak: 0 },
]

function initials(name: string | null): string {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy size={20} className="text-white drop-shadow-md" strokeWidth={2.5} />
  if (rank === 2) return <Medal size={20} className="text-white drop-shadow-md" strokeWidth={2.5} />
  if (rank === 3) return <Medal size={20} className="text-navy drop-shadow-sm" strokeWidth={2.5} />
  return <span className="font-display font-bold text-sm md:text-xl text-navy/40 tabular-nums">{rank}</span>
}

export function LeaderboardPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<LeaderTab>('week')
  const { rows, loading } = useLeaderboard(tab)

  // Fall back to preview data when there is no real board yet.
  const isSample = rows.length === 0
  const displayRows = isSample ? (tab === 'week' ? SAMPLE_WEEK : SAMPLE_SEASON) : rows

  return (
    <div style={{ animation: 'fade-up 0.25s ease-out' }} className="relative min-h-full">

      {/* ── Compact section header ─────────────────────────────────────────── */}
      <div className="bg-navy px-4 md:px-8 lg:px-12 py-4 md:py-6 flex items-center justify-between border-b-4 border-persimmon relative overflow-hidden shadow-md">
        <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30 z-0" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />
        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-persimmon p-1.5 shadow-[2px_2px_0_0_#FFF]">
             <BarChart2 size={16} className="text-white shrink-0" strokeWidth={2.5} />
          </div>
          <h1 className="font-display font-bold text-lg md:text-xl uppercase tracking-[0.2em] text-white">
            Leaderboard
          </h1>
        </div>
        {/* Period toggle */}
        <div className="flex bg-navy-deep border-2 border-navy relative z-10 shadow-[3px_3px_0_0_#E96630]" role="tablist" aria-label="Leaderboard period">
          {(['week', 'season'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={
                'px-5 md:px-6 py-2.5 font-display font-bold text-[11px] uppercase tracking-[0.2em] transition-all duration-150 border-r-2 border-navy last:border-r-0 ' +
                (tab === t ? 'bg-persimmon text-white' : 'text-white/40 hover:text-white hover:bg-white/5')
              }
            >
              {t === 'week' ? 'Week' : 'Season'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Ranked list ───────────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 lg:px-12 py-8 relative z-10 max-w-4xl mx-auto">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 bg-navy/10 border-2 border-navy/5" />
            ))}
          </div>
        ) : (
          <ol aria-label={tab === 'week' ? 'Weekly leaderboard' : 'Season leaderboard'} className="space-y-4">
            {displayRows.map((row) => {
              const isMe = isSample ? row.id === SAMPLE_YOU_ID : user?.id === row.id
              const isTop3 = row.rank <= 3

              return (
                <li
                  key={row.id}
                  className={[
                    'flex items-center gap-4 md:gap-6 px-4 md:px-6 h-20 md:h-24 border-2 transition-transform shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]',
                    isMe            ? 'bg-persimmon/10 border-persimmon shadow-[4px_4px_0_0_#E96630] -translate-y-1' :
                    row.rank === 1  ? 'bg-navy border-navy shadow-[6px_6px_0_0_#E96630]' :
                    row.rank === 2  ? 'bg-navy-deep border-navy-deep' :
                    row.rank === 3  ? 'bg-paper-deep border-navy' :
                                      'bg-white border-navy/20 hover:border-navy hover:-translate-y-0.5',
                  ].join(' ')}
                  aria-label={isMe ? `${row.display_name ?? 'Anonymous'} — your position` : undefined}
                >
                  <div className="w-8 md:w-12 flex items-center justify-center shrink-0">
                    <RankBadge rank={row.rank} />
                  </div>

                  <div className={`size-10 md:size-14 flex items-center justify-center font-display font-bold text-xs md:text-sm text-white shrink-0 border-2 shadow-sm ${isTop3 ? 'bg-persimmon border-white/20' : 'bg-navy border-transparent'}`}>
                    {initials(row.display_name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`font-display font-bold text-base md:text-2xl uppercase tracking-wide truncate leading-tight ${row.rank === 1 || row.rank === 2 ? 'text-white' : 'text-navy'}`}>
                      {row.display_name ?? 'Anonymous'}
                    </p>
                    {row.current_streak >= 2 && (
                      <p className="flex items-center gap-1.5 font-display font-bold text-[10px] md:text-xs uppercase tracking-widest text-persimmon mt-1">
                        <Flame size={12} strokeWidth={2.5} />
                        {row.current_streak} streak
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0 flex items-baseline gap-1.5 bg-white/10 px-3 py-1.5 border border-white/5">
                    <span className={`font-display font-bold text-3xl md:text-4xl tabular-nums ${row.rank === 1 || row.rank === 2 ? 'text-white drop-shadow-md' : 'text-navy'}`}>
                      {row.total_points}
                    </span>
                    <span className={`font-display font-bold text-[9px] md:text-[10px] uppercase tracking-widest ${row.rank === 1 || row.rank === 2 ? 'text-white/60' : 'text-navy/50'}`}>pts</span>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
