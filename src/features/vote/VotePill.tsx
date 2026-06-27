import { formatCountdown } from '../../lib/time'
import type { Game, VotingSession } from '../../types'

interface Props {
  session: VotingSession
  game: Game | null
  secondsLeft: number | null
  myPick: string | null
  onOpen: () => void
}

function teamAbbr(game: Game, teamId: string): string {
  if (teamId === game.home_team_id) return game.home_abbr ?? 'HOME'
  if (teamId === game.away_team_id) return game.away_abbr ?? 'AWAY'
  return '?'
}

export function VotePill({ session, game, secondsLeft, myPick, onOpen }: Props) {
  if (session.status !== 'open') return null

  const pickedAbbr = myPick && game ? teamAbbr(game, myPick) : null

  return (
    <button
      onClick={onOpen}
      className="fixed inset-x-4 z-40 h-16 bg-persimmon flex items-center justify-between px-6 border-[3px] border-navy shadow-[4px_4px_0_0_#232F49] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0_0_#232F49]"
      style={{ bottom: 'calc(5.5rem + var(--sab))' }}
      aria-label={pickedAbbr ? `Your pick: ${pickedAbbr}. Tap to manage.` : 'Tap to vote'}
    >
      <span className="font-display font-bold text-base md:text-lg uppercase tracking-[0.2em] text-white drop-shadow-md">
        {pickedAbbr ? `✓ ${pickedAbbr}` : 'Vote Now'}
      </span>
      {secondsLeft !== null && (
        <span className="font-display text-2xl font-bold tabular-nums text-white drop-shadow-md bg-white/20 px-2 py-0.5 border border-white/40">
          {formatCountdown(secondsLeft)}
        </span>
      )}
    </button>
  )
}
