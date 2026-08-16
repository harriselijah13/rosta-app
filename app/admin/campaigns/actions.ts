'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) throw new Error('Forbidden')
  return { admin, userId: user.id }
}

export type NewPromoScreen = {
  headline:    string
  body:        string
  mascot_pose: string
  cta_label:   string
  cta_action:  string
  expires_at:  string
}

export type CreateCampaignInput = {
  title:            string
  message:          string
  recipient_mode:   'all' | 'specific'
  recipient_ids:    string[]
  send_mode:        'immediate' | 'scheduled' | 'recurring'
  scheduled_at:     string
  recurrence_rule:  'daily' | 'weekly' | 'monthly' | ''
  recurrence_end:   string
  destination_type: 'route' | 'promo_screen'
  destination_route: string
  promo_screen_id:  string          // existing screen id, or '' if creating new
  new_promo:        NewPromoScreen | null
}

export async function createCampaign(
  input: CreateCampaignInput,
): Promise<{ ok: boolean; error?: string }> {
  const { admin, userId } = await requireAdmin()

  let promoScreenId: string | null = input.promo_screen_id || null

  // If destination is a new promo screen, create it first
  if (input.destination_type === 'promo_screen' && !promoScreenId && input.new_promo) {
    const { data: screen, error: screenErr } = await admin
      .from('temporary_screens')
      .insert({
        headline:    input.new_promo.headline,
        body:        input.new_promo.body,
        mascot_pose: input.new_promo.mascot_pose || null,
        cta_label:   input.new_promo.cta_label   || 'Got it',
        cta_action:  input.new_promo.cta_action   || null,
        expires_at:  input.new_promo.expires_at   || null,
      })
      .select('id')
      .single()

    if (screenErr) return { ok: false, error: screenErr.message }
    promoScreenId = screen.id
  }

  // Compute initial status and next_send_at
  let status:       string
  let next_send_at: string | null = null

  if (input.send_mode === 'immediate') {
    status       = 'active'
    next_send_at = new Date().toISOString()
  } else if (input.send_mode === 'scheduled') {
    status       = 'scheduled'
    next_send_at = input.scheduled_at || null
  } else {
    // recurring — first send at the chosen start time
    status       = 'active'
    next_send_at = input.scheduled_at || null
  }

  const { error } = await admin
    .from('notification_campaigns')
    .insert({
      created_by:        userId,
      title:             input.title,
      message:           input.message,
      recipient_mode:    input.recipient_mode,
      recipient_ids:     input.recipient_mode === 'specific' && input.recipient_ids.length
                           ? input.recipient_ids
                           : null,
      send_mode:         input.send_mode,
      scheduled_at:      input.scheduled_at  || null,
      recurrence_rule:   input.recurrence_rule || null,
      recurrence_end:    input.recurrence_end  || null,
      destination_type:  input.destination_type,
      destination_route: input.destination_route || null,
      promo_screen_id:   promoScreenId,
      status,
      next_send_at,
    })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/campaigns')
  return { ok: true }
}

export async function updateCampaign(
  id: string,
  input: CreateCampaignInput,
): Promise<{ ok: boolean; error?: string }> {
  const { admin } = await requireAdmin()

  let promoScreenId: string | null = input.promo_screen_id || null

  if (input.destination_type === 'promo_screen' && !promoScreenId && input.new_promo) {
    const { data: screen, error: screenErr } = await admin
      .from('temporary_screens')
      .insert({
        headline:    input.new_promo.headline,
        body:        input.new_promo.body,
        mascot_pose: input.new_promo.mascot_pose || null,
        cta_label:   input.new_promo.cta_label   || 'Got it',
        cta_action:  input.new_promo.cta_action   || null,
        expires_at:  input.new_promo.expires_at   || null,
      })
      .select('id')
      .single()

    if (screenErr) return { ok: false, error: screenErr.message }
    promoScreenId = screen.id
  }

  let status:       string
  let next_send_at: string | null = null

  if (input.send_mode === 'immediate') {
    status       = 'active'
    next_send_at = new Date().toISOString()
  } else if (input.send_mode === 'scheduled') {
    status       = 'scheduled'
    next_send_at = input.scheduled_at || null
  } else {
    status       = 'active'
    next_send_at = input.scheduled_at || null
  }

  const { error } = await admin
    .from('notification_campaigns')
    .update({
      title:             input.title,
      message:           input.message,
      recipient_mode:    input.recipient_mode,
      recipient_ids:     input.recipient_mode === 'specific' && input.recipient_ids.length
                           ? input.recipient_ids
                           : null,
      send_mode:         input.send_mode,
      scheduled_at:      input.scheduled_at  || null,
      recurrence_rule:   input.recurrence_rule || null,
      recurrence_end:    input.recurrence_end  || null,
      destination_type:  input.destination_type,
      destination_route: input.destination_route || null,
      promo_screen_id:   promoScreenId,
      status,
      next_send_at,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'draft')   // guard: only drafts can be edited

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/campaigns')
  return { ok: true }
}

export async function pauseCampaign(id: string): Promise<void> {
  const { admin } = await requireAdmin()
  await admin
    .from('notification_campaigns')
    .update({ status: 'paused', next_send_at: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['active', 'scheduled'])
  revalidatePath('/admin/campaigns')
}

export async function resumeCampaign(id: string): Promise<void> {
  const { admin } = await requireAdmin()

  const { data: camp } = await admin
    .from('notification_campaigns')
    .select('send_mode, scheduled_at, last_sent_at, recurrence_rule')
    .eq('id', id)
    .single()

  if (!camp) return

  let status:       string
  let next_send_at: string

  if (camp.send_mode === 'immediate') {
    status       = 'active'
    next_send_at = new Date().toISOString()
  } else if (camp.send_mode === 'scheduled') {
    const scheduledDate = camp.scheduled_at ? new Date(camp.scheduled_at) : null
    if (scheduledDate && scheduledDate > new Date()) {
      status       = 'scheduled'
      next_send_at = camp.scheduled_at
    } else {
      status       = 'active'
      next_send_at = new Date().toISOString()
    }
  } else {
    // recurring — advance from last send
    const base = new Date(camp.last_sent_at ?? new Date().toISOString())
    if (camp.recurrence_rule === 'daily')        base.setDate(base.getDate()   + 1)
    else if (camp.recurrence_rule === 'weekly')  base.setDate(base.getDate()   + 7)
    else if (camp.recurrence_rule === 'monthly') base.setMonth(base.getMonth() + 1)
    status       = 'active'
    next_send_at = base.toISOString()
  }

  await admin
    .from('notification_campaigns')
    .update({ status, next_send_at, updated_at: new Date().toISOString() })
    .eq('id', id)

  revalidatePath('/admin/campaigns')
}

export async function deleteCampaign(id: string): Promise<void> {
  const { admin } = await requireAdmin()
  await admin
    .from('notification_campaigns')
    .delete()
    .eq('id', id)
    .in('status', ['draft', 'completed'])
  revalidatePath('/admin/campaigns')
}
