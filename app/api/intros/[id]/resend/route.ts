import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, introRequestEmail, openDoorRequestEmail } from '@/lib/resend'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: orig } = await admin
    .from('intro_requests')
    .select('id, type, requester_id, target_id, facilitator_id, status, expires_at, resent_at, requester_note')
    .eq('id', params.id)
    .single()

  if (!orig) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (orig.requester_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isExpired = orig.status === 'pending' && new Date(orig.expires_at) < new Date()
  if (!isExpired) return NextResponse.json({ error: 'Request has not expired' }, { status: 400 })
  if (orig.resent_at) return NextResponse.json({ error: 'Already resent — start a new request to try again' }, { status: 400 })

  const now = new Date()

  // Create new request row — expires_at uses the DB default (7 days)
  const { data: newReq, error: insertErr } = await admin
    .from('intro_requests')
    .insert({
      type:           orig.type,
      requester_id:   orig.requester_id,
      target_id:      orig.target_id,
      facilitator_id: orig.facilitator_id,
      requester_note: orig.requester_note,
    })
    .select('id')
    .single()

  if (insertErr || !newReq) {
    console.error('[intros/resend] insert failed', insertErr)
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 })
  }

  // Mark original as resent and hide it from the requester
  await admin
    .from('intro_requests')
    .update({
      resent_at:                now.toISOString(),
      dismissed_by_requester_at: now.toISOString(),
    })
    .eq('id', params.id)

  // Fetch profiles + email for the recipient of the notification
  const partyIds = [orig.requester_id, orig.target_id, orig.facilitator_id].filter(Boolean) as string[]
  const recipientId = orig.type === 'warm_intro' ? orig.facilitator_id! : orig.target_id

  const [{ data: profiles }, recipientAuth] = await Promise.all([
    admin.from('profiles').select('id, first_name, last_name, username').in('id', partyIds),
    admin.auth.admin.getUserById(recipientId),
  ])

  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const name = (p: { first_name: string | null; last_name: string | null } | undefined) =>
    [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'A member'

  const requesterName  = name(byId[orig.requester_id])
  const targetName     = name(byId[orig.target_id])
  const facilitatorName = orig.facilitator_id ? name(byId[orig.facilitator_id]) : ''
  const recipientEmail = recipientAuth.data.user?.email
  const note = orig.requester_note ?? ''

  if (recipientEmail) {
    if (orig.type === 'warm_intro') {
      await sendEmail(
        recipientEmail,
        `Resent: ${requesterName} wants an intro to ${targetName}`,
        introRequestEmail(facilitatorName, requesterName, targetName, note, newReq.id),
      )
    } else {
      await sendEmail(
        recipientEmail,
        `Resent: ${requesterName} wants to connect`,
        openDoorRequestEmail(targetName, requesterName, note, newReq.id),
      )
    }
  }

  return NextResponse.json({ id: newReq.id })
}
