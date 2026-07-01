'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateInviteToken } from '@/lib/invite'
import { sendEmail, inviteApprovalEmail } from '@/lib/resend'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) throw new Error('Forbidden')
  return { admin, adminId: user.id }
}

export async function approveInviteRequest(
  requestId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const { admin, adminId } = await requireAdmin()

    const { data: request, error: fetchErr } = await admin
      .from('invite_requests')
      .select('full_name, email, status')
      .eq('id', requestId)
      .single()

    if (fetchErr || !request) return { error: 'Request not found' }
    if (request.status !== 'pending') return { error: 'Request is no longer pending' }

    const token = generateInviteToken()
    const { data: newCode, error: codeErr } = await admin
      .from('invite_codes')
      .insert({
        owner_id: adminId,
        token,
        type: 'founding_invite',
        label: `Auto-issued for invite request from ${request.full_name} (${request.email})`,
      })
      .select('id')
      .single()

    if (codeErr || !newCode) return { error: 'Failed to generate invite code' }

    const { error: updateErr } = await admin
      .from('invite_requests')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: adminId,
        invite_code_id: newCode.id,
      })
      .eq('id', requestId)

    if (updateErr) return { error: updateErr.message }

    const joinUrl = `https://app.onrosta.com/join?code=${token}`
    const html = inviteApprovalEmail(request.full_name, token, joinUrl)
    await sendEmail(request.email, "You're in. Welcome to ROSTA.", html)

    revalidatePath('/admin/invite-requests')
    return { success: true }
  } catch (err) {
    console.error('[approveInviteRequest]', err)
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function declineInviteRequest(
  requestId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const { admin, adminId } = await requireAdmin()

    const { error } = await admin
      .from('invite_requests')
      .update({
        status: 'declined',
        declined_at: new Date().toISOString(),
        declined_by: adminId,
      })
      .eq('id', requestId)

    if (error) return { error: error.message }

    revalidatePath('/admin/invite-requests')
    return { success: true }
  } catch (err) {
    console.error('[declineInviteRequest]', err)
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
