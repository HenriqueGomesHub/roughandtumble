import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from './AuthProvider'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'

export function AdminGate({ children }: { children: ReactNode }) {
  const { isAdminUnlocked, setAdminUnlocked } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAdminUnlocked) return <>{children}</>

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: rpcError } = await supabase.rpc('verify_admin_password', {
      p_password: password,
    })

    setLoading(false)

    if (rpcError || !data) {
      setError('Incorrect password.')
      setPassword('')
      return
    }

    setAdminUnlocked(true)
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6"
        aria-label="Admin access"
      >
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-navy">
            Admin Access
          </h1>
          <p className="font-body text-sm text-muted-navy mt-1">Staff only.</p>
        </div>

        <Input
          label="Admin Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
          autoComplete="current-password"
          autoFocus
        />

        <Button type="submit" className="w-full" disabled={loading || !password}>
          {loading ? 'VERIFYING…' : 'UNLOCK'}
        </Button>
      </form>
    </div>
  )
}
