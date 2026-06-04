'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeConnectorScore } from '@/lib/connector-score'

export async function submitVerificationRequest(statement: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  // Check not already verified or pending
  const { data: profile } = await admin
    .from('profiles')
    .select('is_verified, verification_status, founding_member, building_now, first_name, last_name, what_i_do, where_i_operate, profile_mode, created_at')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'Profile not found' }
  if (profile.is_verified) return { error: 'Already verified' }
  if (profile.verification_status === 'pending') return { error: 'Request already pending' }

  // Requirements check
  const ageMs = Date.now() - new Date(profile.created_at).getTime()
  const agedays = ageMs / (1000 * 60 * 60 * 24)
  if (agedays < 7) return { error: 'Account must be at least 7 days old' }

  const isComplete = !!(profile.first_name && profile.building_now && profile.what_i_do)
  if (!isComplete) return { error: 'Profile must be complete before applying' }

  // Determine price tier
  let tier = 'standard'
  if (profile.founding_member) {
    tier = 'founding'
  } else {
    const score = await computeConnectorScore(user.id)
    if (score.total >= 50) tier = 'connector'
  }

  const { data: pricing } = await admin
    .from('verification_pricing')
    .select('stripe_price_id')
    .eq('tier', tier)
    .eq('is_active', true)
    .single()

  const { error: insertError } = await admin
    .from('verification_requests')
    .insert({
      user_id:       user.id,
      statement:     statement.trim(),
      price_id_used: pricing?.stripe_price_id ?? null,
    })

  if (insertError) {
    if (insertError.code === '23505') return { error: 'You already have a pending request' }
    return { error: insertError.message }
  }

  // Update profile verification_status
  await admin
    .from('profiles')
    .update({ verification_status: 'pending' })
    .eq('id', user.id)

  revalidatePath('/verify')
  revalidatePath(`/profile/${user.id}`)
  return {}
}
