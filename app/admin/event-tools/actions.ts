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

export type CreateEventInput = {
  eventName:      string
  eventDate:      string   // ISO date string YYYY-MM-DD
  eventLocation:  string
  organiserName:  string
  organiserEmail: string
  eventNotes:     string
  expiryDays:     number
}

export async function createEventQR(input: CreateEventInput): Promise<{ token: string }> {
  const { admin, userId } = await requireAdmin()
  const token     = generateInviteToken()
  const expiresAt = new Date(Date.now() + input.expiryDays * 24 * 60 * 60 * 1000).toISOString()

  await admin.from('invite_codes').insert({
    owner_id:        userId,
    token,
    type:            'guest_qr',
    expires_at:      expiresAt,
    label:           input.eventName.trim(),
    event_name:      input.eventName.trim(),
    event_date:      input.eventDate || null,
    event_location:  input.eventLocation.trim() || null,
    organiser_name:  input.organiserName.trim() || null,
    organiser_email: input.organiserEmail.trim() || null,
    event_notes:     input.eventNotes.trim() || null,
  })

  revalidatePath('/admin/event-tools')
  return { token }
}

export async function revokeEventCode(codeId: string) {
  const { admin } = await requireAdmin()
  await admin.from('invite_codes').delete().eq('id', codeId)
  revalidatePath('/admin/event-tools')
}
