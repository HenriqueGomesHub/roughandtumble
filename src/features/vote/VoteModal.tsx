import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Game, VotingSession } from '../../types'

type Step = 'loading' | 'code' | 'pick' | 'confirmed'

interface Props {
  session: VotingSession
  game: Game
  onClose: () => void
  onPickSubmit: (teamId: string) => void
}

const NOISE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E`

function TeamLogo({
  logo,
  color,
  abbr,
}: {
  logo: string | null
  color: string | null
  abbr: string | null
}) {
  const [err, setErr] = useState(false)

  if (!logo || err) {
    return (
      <div
        className="size-20 flex items-center justify-center font-display font-bold text-white text-xl shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]"
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
      className="size-20 object-contain drop-shadow-md"
      onError={() => setErr(true)}
    />
  )
}

export function VoteModal({ session, game, onClose, onPickSubmit }: Props) {
  const [step, setStep] = useState<Step>('loading')
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')
  const [pickedTeam, setPickedTeam] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  // Resolve starting step: skip code entry if user already has a pick.
  useEffect(() => {
    supabase
      .from('picks')
      .select('picked_team_id')
      .eq('session_id', session.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPickedTeam((data as { picked_team_id: string }).picked_team_id)
          setStep('confirmed')
        } else {
          setStep('code')
        }
      })
  }, [session.id])

  useEffect(() => {
    if (step === 'code') setTimeout(() => codeRef.current?.focus(), 50)
  }, [step])

  // Close on Escape.
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (codeInput.trim() !== session.code) {
      setCodeError('Wrong code. Try again.')
      return
    }
    setCodeError('')
    setStep('pick')
  }

  async function handlePick(teamId: string) {
    if (submitting) return
    setSubmitting(true)
    const { data } = await supabase.rpc('submit_pick', {
      p_code: session.code,
      p_team_id: teamId,
    })
    const result = data as { ok?: boolean; error?: string } | null
    setSubmitting(false)

    if (result?.error) {
      // Session closed mid-vote.
      if (result.error === 'Invalid or expired code') {
        setCodeError('Voting has closed.')
        setStep('code')
      }
      return
    }

    setPickedTeam(teamId)
    setStep('confirmed')
    onPickSubmit(teamId)
  }

  const teamName = (teamId: string) =>
    teamId === game.home_team_id
      ? (game.home_name ?? game.home_abbr ?? 'Home')
      : (game.away_name ?? game.away_abbr ?? 'Away')

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative bg-paper w-full max-w-sm shadow-[16px_16px_0_0_#E96630] border-4 border-navy overflow-hidden">
        <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-[0.05]" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />
        {/* Header */}
        <div className="bg-navy px-6 py-5 flex items-center justify-between border-b-4 border-persimmon relative z-10">
          <h2 className="font-display font-bold text-base md:text-lg uppercase tracking-[0.2em] text-white">
            {step === 'code' && 'Pub Code'}
            {step === 'pick' && 'Who Wins?'}
            {step === 'confirmed' && 'Locked In'}
            {step === 'loading' && ''}
          </h2>
          <button
            onClick={onClose}
            className="text-white/50 font-display font-bold text-xl px-1 hover:text-white transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        {step === 'loading' && (
          <div className="p-12 flex justify-center animate-pulse relative z-10">
            <div className="size-10 border-4 border-navy border-t-persimmon rounded-full animate-spin" />
          </div>
        )}

        {step === 'code' && (
          <form onSubmit={handleCodeSubmit} className="p-6 md:p-8 space-y-6 relative z-10">
            <p className="font-display font-bold text-[10px] uppercase tracking-widest text-navy/60 text-center leading-relaxed">
              Look for the 4-digit code displayed on the screen above the bar.
            </p>
            <div className="flex flex-col gap-2">
              <input
                ref={codeRef}
                id="pub-code"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value.replace(/\D/g, ''))
                  setCodeError('')
                }}
                className={`border-[4px] ${codeError ? 'border-persimmon' : 'border-navy'} bg-white text-navy px-4 py-6 font-display font-bold text-4xl tracking-[0.4em] focus:outline-none focus:border-persimmon text-center shadow-inner`}
                placeholder="····"
              />
              {codeError && (
                <p role="alert" className="font-display font-bold text-[11px] uppercase tracking-widest text-persimmon mt-2 text-center">
                  {codeError}
                </p>
              )}
            </div>
            <button
              type="submit"
              className="w-full bg-persimmon text-white font-display font-bold text-base uppercase tracking-[0.2em] py-5 hover:bg-persimmon-deep hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_#232F49] transition-all border-2 border-persimmon"
            >
              Enter Code
            </button>
          </form>
        )}

        {step === 'pick' && (
          <div className="p-6 md:p-8 space-y-5 relative z-10">
            <div className="flex flex-col gap-4">
              {[
                { teamId: game.away_team_id, name: game.away_name, abbr: game.away_abbr, logo: game.away_logo, color: game.away_color },
                { teamId: game.home_team_id, name: game.home_name, abbr: game.home_abbr, logo: game.home_logo, color: game.home_color },
              ].map(({ teamId, name, abbr, logo, color }) => (
                <button
                  key={teamId}
                  onClick={() => handlePick(teamId)}
                  disabled={submitting}
                  className="w-full flex items-center justify-between p-4 border-[3px] border-navy bg-white hover:bg-navy hover:text-white group transition-colors duration-150 disabled:opacity-50 shadow-[3px_3px_0_0_#232F49] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#E96630]"
                >
                  <TeamLogo logo={logo} color={color} abbr={abbr} />
                  <span className="font-display font-bold text-lg md:text-xl uppercase tracking-widest text-navy group-hover:text-white text-right flex-1 truncate ml-4">
                    {name ?? abbr ?? '?'}
                  </span>
                </button>
              ))}
            </div>
            {submitting && (
              <p className="font-display font-bold text-[10px] uppercase tracking-[0.2em] text-center text-navy/50 animate-pulse mt-4">
                Locking in…
              </p>
            )}
          </div>
        )}

        {step === 'confirmed' && pickedTeam && (
          <div className="p-6 md:p-8 space-y-6 relative z-10">
            <div className="flex flex-col items-center gap-4 py-6">
              <TeamLogo
                logo={pickedTeam === game.home_team_id ? game.home_logo : game.away_logo}
                color={pickedTeam === game.home_team_id ? game.home_color : game.away_color}
                abbr={pickedTeam === game.home_team_id ? game.home_abbr : game.away_abbr}
              />
              <p className="font-display font-bold text-3xl uppercase tracking-widest text-navy text-center leading-tight">
                {teamName(pickedTeam)}
              </p>
              <div className="flex items-center gap-3 bg-persimmon px-4 py-2 shadow-[2px_2px_0_0_#232F49]">
                <span className="font-display font-bold text-[11px] uppercase tracking-[0.2em] text-white">
                  ✓ Pick Locked
                </span>
              </div>
            </div>
            {session.status === 'open' && (
              <button
                onClick={() => setStep('pick')}
                className="w-full border-[3px] border-navy bg-transparent text-navy font-display font-bold text-sm uppercase tracking-[0.2em] py-4 hover:bg-navy hover:text-white hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_#E96630] transition-all"
              >
                Change Pick
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
