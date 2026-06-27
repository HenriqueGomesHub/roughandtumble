import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Service-role client for all DB writes.
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // ── Auth gate ────────────────────────────────────────────────
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '')
  if (!jwt) return new Response('Unauthorized', { status: 401 })

  // Verify the JWT via an anon-key client that passes it as the auth header.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return new Response('Unauthorized', { status: 401 })

  // Confirm admin flag — service-role bypasses RLS so this is always accurate.
  const { data: profile } = await db
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return new Response('Forbidden', { status: 403 })

  // ── Parse body ───────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const sessionId = body.session_id
  if (typeof sessionId !== 'string' || !sessionId) {
    return Response.json({ error: 'session_id required' }, { status: 400 })
  }

  // ── Settle ───────────────────────────────────────────────────
  const { data, error } = await db.rpc('settle_session', { p_session_id: sessionId })

  if (error) {
    console.error('[settle-session]', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  const result = data as { ok?: boolean; error?: string; picks_settled?: number }

  // DB-level errors (no_winner_set, session_cancelled, etc.) come back as ok objects.
  if (result?.error) {
    return Response.json(result, { status: 422 })
  }

  return Response.json(result)
})
