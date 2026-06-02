import { createAdminClient } from '@/lib/supabase/admin'

export async function getOrCreateMemberQR(userId: string): Promise<string | null> {
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('invite_codes')
    .select('token')
    .eq('owner_id', userId)
    .eq('type', 'member_qr')
    .single()

  if (existing?.token) return existing.token

  const { data: created } = await admin
    .from('invite_codes')
    .insert({ owner_id: userId, type: 'member_qr', expires_at: null })
    .select('token')
    .single()

  return created?.token ?? null
}

export function qrUrl(token: string) {
  return `https://app.onrosta.com/connect/qr/${token}`
}

export async function getOrCreateGuestQR(
  userId: string,
): Promise<{ token: string; expiresAt: string } | null> {
  const admin = createAdminClient()

  // Reuse any non-expired guest QR for this member
  const { data: existing } = await admin
    .from('invite_codes')
    .select('token, expires_at')
    .eq('owner_id', userId)
    .eq('type', 'guest_qr')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.token) return { token: existing.token, expiresAt: existing.expires_at }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: created } = await admin
    .from('invite_codes')
    .insert({ owner_id: userId, type: 'guest_qr', expires_at: expiresAt })
    .select('token, expires_at')
    .single()

  if (!created?.token) return null
  return { token: created.token, expiresAt: created.expires_at }
}

export function guestQrUrl(token: string) {
  return `https://app.onrosta.com/connect/${token}`
}
