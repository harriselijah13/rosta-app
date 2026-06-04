'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, verificationApprovedEmail, verificationRejectedEmail } from '@/lib/resend'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) throw new Error('Forbidden')
  return { admin, userId: user.id }
}

export async function approveVerification(requestId: string) {
  const { admin, userId } = await requireAdmin()

  // Get request + pricing
  const { data: req } = await admin
    .from('verification_requests')
    .select('id, user_id, price_id_used')
    .eq('id', requestId)
    .single()

  if (!req) throw new Error('Request not found')

  const { data: pricing } = await admin
    .from('verification_pricing')
    .select('tier, price_aed')
    .eq('stripe_price_id', req.price_id_used ?? '')
    .maybeSingle()

  // Update request
  await admin.from('verification_requests').update({
    status:       'approved',
    reviewed_at:  new Date().toISOString(),
    reviewed_by:  userId,
  }).eq('id', requestId)

  // Update profile
  await admin.from('profiles')
    .update({ verification_status: 'approved' })
    .eq('id', req.user_id)

  // Send approval email
  const [{ data: profile }, authResult] = await Promise.all([
    admin.from('profiles').select('first_name').eq('id', req.user_id).single(),
    admin.auth.admin.getUserById(req.user_id),
  ])
  const email = authResult.data.user?.email
  if (email) {
    await sendEmail(
      email,
      'Your ROSTA verification has been approved',
      verificationApprovedEmail(
        profile?.first_name ?? 'there',
        Number(pricing?.price_aed ?? 0),
        pricing?.tier ?? 'standard',
      ),
    )
  }

  revalidatePath('/admin/verification')
}

export async function rejectVerification(requestId: string, reason: string) {
  const { admin, userId } = await requireAdmin()

  const { data: req } = await admin
    .from('verification_requests')
    .select('id, user_id')
    .eq('id', requestId)
    .single()

  if (!req) throw new Error('Request not found')

  await admin.from('verification_requests').update({
    status:           'rejected',
    reviewed_at:      new Date().toISOString(),
    reviewed_by:      userId,
    rejection_reason: reason.trim(),
  }).eq('id', requestId)

  await admin.from('profiles')
    .update({ verification_status: 'rejected' })
    .eq('id', req.user_id)

  const [{ data: profile }, authResult] = await Promise.all([
    admin.from('profiles').select('first_name').eq('id', req.user_id).single(),
    admin.auth.admin.getUserById(req.user_id),
  ])
  const email = authResult.data.user?.email
  if (email) {
    await sendEmail(
      email,
      'Your ROSTA verification request',
      verificationRejectedEmail(profile?.first_name ?? 'there', reason.trim()),
    )
  }

  revalidatePath('/admin/verification')
}

export async function updatePricing(tier: string, priceAed: number) {
  const { admin } = await requireAdmin()
  await admin
    .from('verification_pricing')
    .update({ price_aed: priceAed })
    .eq('tier', tier)
  revalidatePath('/admin/verification')
}
