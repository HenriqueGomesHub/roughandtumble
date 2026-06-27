import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { checkPhoneKnown, isValidE164, normalizePhone } from '../../lib/auth'
import { useAuth } from './AuthProvider'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'

const NOISE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E`

type Step = 'phone' | 'otp' | 'name'

interface Props {
  onClose: () => void
}

export function OnboardingModal({ onClose }: Props) {
  const { reloadProfile } = useAuth()

  const [step, setStep] = useState<Step>('phone')
  const [rawPhone, setRawPhone] = useState('')
  const [e164, setE164] = useState('')
  const [nameRevealed, setNameRevealed] = useState(false)
  const [isWelcomeBack, setIsWelcomeBack] = useState(false)
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const modalRef = useRef<HTMLDivElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const nameRevealRef = useRef<HTMLInputElement>(null)
  const otpRef = useRef<HTMLInputElement>(null)
  const nameStepRef = useRef<HTMLInputElement>(null)

  // Move focus when step or name-reveal state changes.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === 'phone') {
        if (nameRevealed) nameRevealRef.current?.focus()
        else phoneRef.current?.focus()
      } else if (step === 'otp') {
        otpRef.current?.focus()
      } else {
        nameStepRef.current?.focus()
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [step, nameRevealed])

  function trapFocus(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key !== 'Tab') return

    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled])',
    )
    if (!focusable?.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  async function handlePhoneSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const normalized = normalizePhone(rawPhone)
    if (!isValidE164(normalized)) {
      setError('Please enter a valid phone number (e.g. 206 555 0100).')
      return
    }

    setLoading(true)

    if (!nameRevealed) {
      const known = await checkPhoneKnown(normalized)
      if (!known) {
        // Reveal name field; don't send OTP yet.
        setNameRevealed(true)
        setE164(normalized)
        setLoading(false)
        return
      }
      setIsWelcomeBack(true)
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: normalized })
    setLoading(false)

    if (otpError) {
      setError(otpError.message)
      return
    }

    setE164(normalized)
    setStep('otp')
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      phone: e164,
      token: otp,
      type: 'sms',
    })

    if (verifyError) {
      setLoading(false)
      setError(verifyError.message)
      return
    }

    // New user with a name entered on phone step: save it now.
    if (!isWelcomeBack && name.trim() && data.user) {
      await supabase
        .from('profiles')
        .update({ display_name: name.trim() })
        .eq('id', data.user.id)
      await reloadProfile()
      setLoading(false)
      onClose()
      return
    }

    // Edge case: new user but name was never filled (shouldn't happen
    // with the nameRevealed flow, but handle gracefully).
    if (!isWelcomeBack && !name.trim()) {
      setLoading(false)
      setStep('name')
      return
    }

    await reloadProfile()
    setLoading(false)
    onClose()
  }

  async function handleNameSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Please enter your name.')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      await supabase
        .from('profiles')
        .update({ display_name: name.trim() })
        .eq('id', user.id)
    }

    await reloadProfile()
    setLoading(false)
    onClose()
  }

  const title =
    step === 'otp'  ? 'Check Your Texts' :
    step === 'name' ? "What's Your Name?" :
    isWelcomeBack   ? 'Welcome Back' :
    nameRevealed    ? 'Sign Up' :
    "Let's Go"

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={modalRef}
        tabIndex={-1}
        className="bg-paper w-full max-w-sm border-[4px] border-navy shadow-[16px_16px_0_0_#E96630] relative focus:outline-none"
        onKeyDown={trapFocus}
      >
        <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-[0.05]" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />

        <div className="bg-navy px-6 py-4 flex items-center justify-between border-b-4 border-persimmon relative z-10">
          <h2 id="modal-title" className="font-display font-bold text-lg uppercase tracking-[0.2em] text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-white/50 font-display font-bold text-xl px-1 hover:text-white transition-colors"
            aria-label="Close sign-in"
          >
            ✕
          </button>
        </div>

        <div className="p-8 relative z-10">
          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-6" noValidate>
              <Input
                ref={phoneRef}
                label="Phone Number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+1 (206) 555-0100"
                value={rawPhone}
                onChange={(e) => {
                  setRawPhone(e.target.value)
                  // Reset name reveal if user edits the phone.
                  if (nameRevealed) setNameRevealed(false)
                }}
                disabled={loading}
                error={!nameRevealed ? error : undefined}
              />

              {nameRevealed && (
                <Input
                  ref={nameRevealRef}
                  label="Your Name"
                  type="text"
                  autoComplete="name"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  error={error || undefined}
                />
              )}

              <Button type="submit" className="w-full text-base py-5" disabled={loading}>
                {loading ? 'CHECKING…' : nameRevealed ? 'SIGN ME UP' : "LET'S GO"}
              </Button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="space-y-6" noValidate>
              <p className="font-display font-bold text-[10px] uppercase tracking-widest text-navy/60 leading-relaxed -mt-2">
                We sent a 6-digit code to <span className="text-navy">{e164}</span>.
              </p>
              <Input
                ref={otpRef}
                label="Verification Code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="123456"
                className="font-display font-bold text-3xl tracking-[0.3em] text-center"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                disabled={loading}
                error={error || undefined}
              />
              <Button type="submit" className="w-full text-base py-5" disabled={loading || otp.length < 6}>
                {loading ? 'VERIFYING…' : 'VERIFY'}
              </Button>
              <button
                type="button"
                onClick={() => { setStep('phone'); setOtp(''); setError('') }}
                className="font-display font-bold text-[10px] uppercase tracking-widest text-navy/40 hover:text-persimmon w-full text-center transition-colors"
              >
                Wrong number? Go back
              </button>
            </form>
          )}

          {step === 'name' && (
            <form onSubmit={handleNameSubmit} className="space-y-6" noValidate>
              <Input
                ref={nameStepRef}
                label="Your Name"
                type="text"
                autoComplete="name"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                error={error || undefined}
              />
              <Button type="submit" className="w-full text-base py-5" disabled={loading}>
                {loading ? 'SAVING…' : "LET'S GO"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
