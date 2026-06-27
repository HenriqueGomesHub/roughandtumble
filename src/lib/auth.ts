import { supabase } from './supabase'

export function normalizePhone(raw: string): string {
  const digits = raw.trim().replace(/\D/g, '')
  if (raw.trim().startsWith('+')) return '+' + digits
  if (digits.length === 10) return '+1' + digits
  if (digits.length === 11 && digits[0] === '1') return '+' + digits
  return '+' + digits
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone)
}

export async function checkPhoneKnown(e164: string): Promise<boolean> {
  const { data } = await supabase.rpc('phone_has_profile', { p_phone: e164 })
  return Boolean(data)
}
