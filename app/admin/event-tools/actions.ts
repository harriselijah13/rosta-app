'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateInviteToken } from '@/lib/invite'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) throw new Error('Forbidden')
  return { admin, userId: user.id }
}

export async function createEventQR(label: string, expiryDays: number): Promise<{ token: string }> {
  const { admin, userId } = await requireAdmin()
  const token     = generateInviteToken()
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
  await admin.from('invite_codes').insert({
    owner_id:   userId,
    token,
    type:       'guest_qr',
    expires_at: expiresAt,
    label:      label.trim() || null,
  })
  revalidatePath('/admin/event-tools')
  return { token }
}

export async function revokeEventCode(codeId: string) {
  const { admin } = await requireAdmin()
  await admin.from('invite_codes').delete().eq('id', codeId)
  revalidatePath('/admin/event-tools')
}
