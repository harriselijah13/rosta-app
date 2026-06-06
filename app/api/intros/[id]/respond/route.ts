import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendEmail,
  introAcceptedEmailToRequester,
  introAcceptedEmailToTarget,
  introDeclinedEmail,
  openDoorAcceptedEmail,
  openDoorDeclinedEmail,
} from '@/lib/resend'
import { checkAndAwardBadges } from '@/lib/badges'

function currentPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { decision, note } = body ?? {}
  if (decision !== 'accepted' && decision !== 'declined') {
    return NextResponse.json({ error: 'decision must be accepted or declined' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: req } = await admin.from('intro_requests')
    .select('id, type, requester_id, target_id, facilitator_id, status, requester_note, expires_at')
    .eq('id', params.id).single()

  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // For open_door the target responds; for warm_intro the facilitator responds
  const isOpenDoor = req.type === 'open_door'
  const responderId = isOpenDoor ? req.target_id : req.facilitator_id
  if (responderId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (req.status !== 'pending') {
    return NextResponse.json({ error: `Request is already ${req.status}` }, { status: 400 })
  }

  const now = new Date()
  if (new Date(req.expires_at) < now) {
    await admin.from('intro_requests').update({ status: 'expired' }).eq('id', params.id)
    return NextResponse.json({ error: 'This request has expired' }, { status: 400 })
  }

  // Fetch profiles (filter null facilitator_id for open_door)
  const partyIds = [req.requester_id, req.target_id, req.facilitator_id].filter(Boolean) as string[]
  const [{ data: profiles }, requesterAuth, targetAuth] = await Promise.all([
    admin.from('profiles').select('id, first_name, last_name, username').in('id', partyIds),
    admin.auth.admin.getUserById(req.requester_id),
    admin.auth.admin.getUserById(req.target_id),
  ])

  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const name = (p: { first_name?: string | null; last_name?: string | null } | undefined) =>
    [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'A member'
  const slug = (p: { username?: string | null; id: string } | undefined) =>
    p?.username ?? p?.id ?? ''

  const requesterName = name(byId[req.requester_id])
  const targetName = name(byId[req.target_id])
  const facilitatorName = req.facilitator_id ? name(byId[req.facilitator_id]) : ''
  const requesterEmail = requesterAuth.data.user?.email
  const targetEmail = targetAuth.data.user?.email
  const respondNote = (note ?? '').trim()
  const origin = isOpenDoor ? 'open_door' : 'warm_intro'

  if (decision === 'accepted') {
    // Create connection (canonical ordering)
    const [userA, userB] = [req.requester_id, req.target_id].sort()
    const { error: connErr } = await admin.from('connections').insert({
      user_a: userA, user_b: userB, origin,
    })
    if (connErr && connErr.code !== '23505') {
      console.error('[intros/respond] connection insert failed', connErr)
      return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
    }

    // Create conversation for messaging (ignored if already exists)
    const [convA, convB] = [req.requester_id, req.target_id].sort()
    await admin.from('conversations').upsert(
      { user_a: convA, user_b: convB },
      { onConflict: 'user_a,user_b', ignoreDuplicates: true },
    )

    await admin.from('intro_requests').update({
      status: 'accepted',
      facilitator_note: respondNote || null,
      responded_at: now.toISOString(),
    }).eq('id', params.id)

    if (isOpenDoor) {
      // Open door: no credits, just notify requester
      if (requesterEmail) {
        await sendEmail(
          requesterEmail,
          `${targetName} accepted your request`,
          openDoorAcceptedEmail(requesterName, targetName, slug(byId[req.target_id])),
        )
      }
    } else {
      // Warm intro: facilitator earns a credit + notify both parties
      const period = currentPeriod()
      const { data: fCredits } = await admin.from('intro_credits')
        .select('balance, period, lifetime_earned').eq('user_id', user.id).maybeSingle()
      const fBalance = (!fCredits || fCredits.period !== period) ? 3 : fCredits.balance
      await admin.from('intro_credits').upsert({
        user_id: user.id,
        balance: Math.min(fBalance + 1, 10),
        period,
        lifetime_earned: (fCredits?.lifetime_earned ?? 0) + 1,
        updated_at: now.toISOString(),
      })

      await Promise.all([
        requesterEmail && sendEmail(
          requesterEmail,
          `Your intro to ${targetName} is happening`,
          introAcceptedEmailToRequester(
            requesterName, facilitatorName, targetName,
            slug(byId[req.target_id]), respondNote,
          ),
        ),
        targetEmail && sendEmail(
          targetEmail,
          `${facilitatorName} connected you with ${requesterName}`,
          introAcceptedEmailToTarget(
            targetName, facilitatorName, requesterName,
            slug(byId[req.requester_id]), req.requester_note ?? '', respondNote,
          ),
        ),
      ])
    }

    // Award badges to all parties after a successful connection
    const awardIds = [req.requester_id, req.target_id]
    if (!isOpenDoor && req.facilitator_id) awardIds.push(req.facilitator_id)
    await Promise.all(awardIds.map(id => checkAndAwardBadges(id)))
  } else {
    // Declined
    await admin.from('intro_requests').update({
      status: 'declined',
      facilitator_note: respondNote || null,
      responded_at: now.toISOString(),
    }).eq('id', params.id)

    if (requesterEmail) {
      await sendEmail(
        requesterEmail,
        isOpenDoor
          ? `Your connection request to ${targetName}`
          : `Your intro request to ${targetName}`,
        isOpenDoor
          ? openDoorDeclinedEmail(requesterName, targetName)
          : introDeclinedEmail(requesterName, facilitatorName, targetName, respondNote),
      )
    }
  }

  return NextResponse.json({ status: decision })
}
