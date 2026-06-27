import { supabase } from './supabase'

// Module-level offset: local clock + offsetMs ≈ server clock (ms).
// Populated by calibrateServerTime(); defaults to 0 (local time) if never called.
let offsetMs = 0

// Call once at app boot — fire-and-forget.
// Measures round-trip latency and estimates the local↔server skew.
export async function calibrateServerTime(): Promise<void> {
  const before = Date.now()
  const { data } = await supabase.rpc('server_time')
  const after = Date.now()
  if (data == null) return
  const serverMs = (data as number) * 1000
  offsetMs = serverMs - Math.round(before + (after - before) / 2)
}

export function serverNow(): number {
  return Date.now() + offsetMs
}

export function msUntil(isoDatetime: string): number {
  return new Date(isoDatetime).getTime() - serverNow()
}

export function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0:00'
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
