'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateInviteToken } from '@/lib/invite'
import { sendEmail, adminVerificationGrantedEmail } from '@/lib/resend'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) throw new Error('Forbidden')
  return admin
}

export async function setFoundingMember(userId: string, value: boolean) {
  const admin = await requireAdmin()
  await admin.from('profiles').update({ founding_member: value }).eq('id', userId)
  revalidatePath('/admin/members')
}

export async function generateInviteCode(userId: string): Promise<string> {
  const admin = await requireAdmin()
  const token = generateInviteToken()
  await admin.from('invite_codes').insert({ owner_id: userId, token, type: 'founding_invite' })
  revalidatePath('/admin/members')
  return token
}

export async function grantVerification(userId: string) {
  const admin = await requireAdmin()

  // Update profile
  await admin.from('profiles').update({
    is_verified:         true,
    verification_status: 'approved',
  }).eq('id', userId)

  // Upsert verification_requests — update existing pending row if present, else insert
  const { data: existing } = await admin
    .from('verification_requests')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    await admin.from('verification_requests').update({
      status:               'approved',
      stripe_payment_status: 'admin_granted',
    }).eq('id', existing.id)
  } else {
    await admin.from('verification_requests').insert({
      user_id:               userId,
      status:                'approved',
      stripe_payment_status: 'admin_granted',
    })
  }

  // Send email
  const [{ data: profile }, authResult] = await Promise.all([
    admin.from('profiles').select('first_name').eq('id', userId).single(),
    admin.auth.admin.getUserById(userId),
  ])
  const email = authResult.data.user?.email
  const name  = profile?.first_name ?? 'there'
  if (email) {
    await sendEmail(email, "You're now a Verified ROSTA member", adminVerificationGrantedEmail(name))
  }

  revalidatePath('/admin/members')
  revalidatePath('/admin/verification')
}

export async function removeMember(userId: string) {
  const admin = await requireAdmin()
  // Delete profile first (other tables cascade from profiles)
  await admin.from('profiles').delete().eq('id', userId)
  // Delete auth user
  await admin.auth.admin.deleteUser(userId)
  revalidatePath('/admin/members')
}
