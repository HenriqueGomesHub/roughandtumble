import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Radio, BarChart2, Trophy, Gift, type LucideIcon } from 'lucide-react'
import { useAuth } from '../features/onboarding/AuthProvider'
import { OnboardingModal } from '../features/onboarding/OnboardingModal'
import { VotePill } from '../features/vote/VotePill'
import { VoteModal } from '../features/vote/VoteModal'
import { useSession } from '../hooks/useSession'
import { useLiveGame } from '../hooks/useLiveGame'
import { supabase } from '../lib/supabase'
import { Avatar } from '../ui/Avatar'
import type { Profile } from '../types'

const NOISE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E`

function getInitials(profile: Profile | null): string {
  const name = profile?.display_name.trim() ?? ''
  if (!name) return profile?.phone.slice(-2) ?? '??'
  const parts = name.split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: 'live',        label: 'Live',    icon: Radio },
  { to: 'leaderboard', label: 'Board',   icon: BarChart2 },
  { to: 'bracket',     label: 'Bracket', icon: Trophy },
  { to: 'prizes',      label: 'Prizes',  icon: Gift },
]

const BOTTOM_NAV_H = '4.5rem'

// Passed to the Live route via <Outlet context> so its TV Mode button can toggle
// fullscreen state that this shell owns (it hides the nav/header chrome).
export interface LiveLayout {
  tvMode: boolean
  enterTv: () => void
  exitTv: () => void
}

export function PhoneApp() {
  const { user, profile } = useAuth()
  const { session: openSession, secondsLeft } = useSession()
  const { game } = useLiveGame(openSession?.game_id ?? null)
  const location = useLocation()
  const isLive = location.pathname.startsWith('/live')
  const [loginOpen, setLoginOpen] = useState(false)
  const [voteOpen, setVoteOpen] = useState(false)
  const [myPick, setMyPick] = useState<string | null>(null)
  const [winToast, setWinToast] = useState(false)
  const [tvMode, setTvMode] = useState(false)
  const loginBtnRef = useRef<HTMLButtonElement>(null)
  const prevWinnerRef = useRef<string | null | undefined>(undefined)

  function enterTv() {
    setTvMode(true)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }
  function exitTv() {
    setTvMode(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }

  // Sync if the user exits fullscreen via Esc / the browser chrome.
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setTvMode(false) }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // Leave TV mode automatically when navigating away from Live.
  useEffect(() => {
    if (!isLive && tvMode) exitTv()
  }, [isLive, tvMode])

  useEffect(() => {
    if (openSession && !user) setLoginOpen(true)
  }, [openSession, user])

  useEffect(() => {
    if (!openSession || !user) { setMyPick(null); return }
    supabase
      .from('picks')
      .select('picked_team_id')
      .eq('session_id', openSession.id)
      .maybeSingle()
      .then(({ data }) => {
        setMyPick((data as { picked_team_id: string } | null)?.picked_team_id ?? null)
      })
  }, [openSession?.id, user?.id])

  useEffect(() => {
    const prev = prevWinnerRef.current
    const curr = game?.winner_team_id ?? null
    prevWinnerRef.current = curr

    if (prev !== undefined && prev === null && curr !== null && myPick === curr) {
      setWinToast(true)
      const t = setTimeout(() => setWinToast(false), 5000)
      return () => clearTimeout(t)
    }
  }, [game?.winner_team_id, myPick])

  function openLogin() { setLoginOpen(true) }
  function closeLogin() {
    setLoginOpen(false)
    setTimeout(() => loginBtnRef.current?.focus(), 50)
  }

  return (
    <div className={`flex flex-col bg-paper relative ${
      tvMode ? 'h-dvh overflow-hidden'
      : isLive ? 'min-h-dvh lg:h-dvh lg:overflow-hidden'
      : 'min-h-dvh'
    }`}>
      <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-[0.3] z-0" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />

      {winToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-0 inset-x-0 z-50 bg-persimmon px-6 py-6 flex flex-col items-center justify-center border-b-4 border-navy shadow-[0_8px_0_0_#1A2336]"
          style={{ animation: 'slide-down 0.3s ease-out' }}
        >
          <p className="font-display font-bold text-3xl uppercase tracking-widest text-white drop-shadow-md">You called it!</p>
          <p className="font-display font-bold text-sm uppercase tracking-[0.2em] text-white/80 mt-1">Your pick was right</p>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 shrink-0 bg-navy border-b-4 border-navy shadow-[0_4px_20px_rgba(0,0,0,0.3)] relative"
      >
        <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-50 z-0" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />
        {/* Logo row */}
        <div
          className="relative flex items-center justify-center px-4 h-24 md:h-32 z-10"
        >
          <img
            src="/RoughTumbleLogo.png"
            alt="Rough &amp; Tumble Pick'em"
            className="h-16 md:h-24 w-auto drop-shadow-lg"
          />

          {/* Right actions — hidden in TV mode for a clean display */}
          <div className={`absolute right-4 md:right-8 top-1/2 -translate-y-1/2 flex items-center gap-3 ${tvMode ? 'hidden' : ''}`}>
            {openSession && user && (
              <button
                onClick={() => setVoteOpen(true)}
                className="hidden md:flex items-center gap-2 h-12 px-6 bg-persimmon text-white font-display font-bold text-[13px] uppercase tracking-widest hover:-translate-y-0.5 transition-transform shrink-0 shadow-[3px_3px_0_0_#FFFFFF] border-2 border-persimmon"
              >
                <Radio size={14} strokeWidth={2.5} aria-hidden="true" />
                {myPick ? '✓ Pick Locked' : 'Vote Now'}
              </button>
            )}
            {user ? (
              <div className="border-2 border-persimmon shadow-[2px_2px_0_0_#E96630]">
                <Avatar initials={getInitials(profile)} size="sm" />
              </div>
            ) : (
              <button
                ref={loginBtnRef}
                onClick={openLogin}
                className="font-display font-bold text-[11px] uppercase tracking-[0.2em] bg-paper text-navy px-5 py-3 hover:-translate-y-0.5 transition-transform shadow-[3px_3px_0_0_#E96630] border-2 border-navy"
              >
                LOG IN
              </button>
            )}
          </div>
        </div>

        {/* Desktop nav — hidden on mobile, and hidden entirely in TV mode. */}
        <nav aria-label="Main navigation" className={`${tvMode ? 'hidden' : 'hidden md:flex'} bg-paper border-t-4 border-navy relative z-10`}>
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                'flex-1 flex items-center justify-center gap-3 py-5 font-display font-bold text-sm uppercase tracking-[0.25em] transition-all duration-200 border-r-2 border-navy/10 last:border-r-0 ' +
                (isActive
                  ? 'bg-persimmon text-white shadow-inner'
                  : 'text-navy/60 hover:bg-white hover:text-navy')
              }
            >
              <Icon size={16} strokeWidth={2.5} />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* ── Content — no max-width; each page owns its layout ─────────────── */}
      <main className={
        tvMode ? 'flex-1 relative z-10 min-h-0 overflow-hidden'
        : `flex-1 relative z-10 ${openSession && user ? 'main-pad-pill' : 'main-pad'}${isLive ? ' lg:min-h-0 lg:overflow-hidden lg:pb-0' : ''}`
      }>
        <Outlet context={{ tvMode, enterTv, exitTv } satisfies LiveLayout} />
      </main>

      {/* ── Mobile vote pill ────────────────────────────────────────────────── */}
      <div className="md:hidden">
        {openSession && user && !tvMode && (
          <VotePill
            session={openSession}
            game={game}
            secondsLeft={secondsLeft}
            myPick={myPick}
            onOpen={() => setVoteOpen(true)}
          />
        )}
      </div>

      {/* ── Mobile bottom nav ───────────────────────────────────────────────── */}
      {!tvMode && (
        <nav
          aria-label="Main navigation"
          className="md:hidden fixed bottom-0 inset-x-0 bg-navy flex border-t-4 border-persimmon shadow-[0_-4px_20px_rgba(0,0,0,0.3)] z-30 overflow-hidden"
          style={{ minHeight: BOTTOM_NAV_H, paddingBottom: 'var(--sab)' }}
        >
          <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30 z-0" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                'flex-1 flex flex-col items-center justify-center gap-1.5 font-display text-[10px] font-bold uppercase tracking-widest transition-all z-10 ' +
                (isActive ? 'text-white bg-white/10 shadow-inner' : 'text-paper/40 hover:text-white/80')
              }
              style={{ height: BOTTOM_NAV_H }}
            >
              <Icon size={20} strokeWidth={2.5} />
              {label}
            </NavLink>
          ))}
        </nav>
      )}

      {loginOpen && <OnboardingModal onClose={closeLogin} />}

      {voteOpen && openSession && game && (
        <VoteModal
          session={openSession}
          game={game}
          onClose={() => setVoteOpen(false)}
          onPickSubmit={(teamId) => setMyPick(teamId)}
        />
      )}
    </div>
  )
}
