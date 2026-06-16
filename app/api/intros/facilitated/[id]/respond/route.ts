import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, facilitatedIntroEmail, facilitatedIntroDeclinedEmail } from '@/lib/resend'
import { checkAndAwardBadges } from '@/lib/badges'

function currentPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { decision } = body ?? {}
  if (decision !== 'accepted' && decision !== 'declined') {
    return NextResponse.json({ error: 'decision must be accepted or declined' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: req } = await admin.from('intro_requests')
    .select('id, type, requester_id, target_id, facilitator_id, status, facilitator_note, member_a_accepted_at, member_b_accepted_at')
    .eq('id', params.id)
    .single()

  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (req.status !== 'pending') {
    return NextResponse.json({ error: `Introduction is already ${req.status}` }, { status: 400 })
  }

  // Only requester (member A) or target (member B) may respond
  const isA = user.id === req.requester_id
  const isB = user.id === req.target_id
  if (!isA && !isB) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Guard: don't let a party respond twice
  if (isA && req.member_a_accepted_at) {
    return NextResponse.json({ error: 'You have already responded' }, { status: 400 })
  }
  if (isB && req.member_b_accepted_at) {
    return NextResponse.json({ error: 'You have already responded' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // ── Declined ──────────────────────────────────────────────────────────────
  if (decision === 'declined') {
    await admin.from('intro_requests')
      .update({ status: 'declined', responded_at: now })
      .eq('id', req.id)

    // Notify the facilitator
    const [{ data: profiles }, facilitatorAuth] = await Promise.all([
      admin.from('profiles').select('id, first_name, last_name').in('id', [user.id, req.facilitator_id, isA ? req.target_id : req.requester_id]),
      admin.auth.admin.getUserById(req.facilitator_id),
    ])
    const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
    const displayName = (id: string) => [byId[id]?.first_name, byId[id]?.last_name].filter(Boolean).join(' ') || 'A member'
    const facilitatorEmail = facilitatorAuth.data.user?.email
    const declinerName = displayName(user.id)
    const otherName = displayName(isA ? req.target_id : req.requester_id)
    const facilitatorName = displayName(req.facilitator_id)

    if (facilitatorEmail) {
      await sendEmail(
        facilitatorEmail,
        `${declinerName} declined the introduction to ${otherName}`,
        facilitatedIntroDeclinedEmail(facilitatorName, declinerName, otherName),
      )
    }

    return NextResponse.json({ status: 'declined' })
  }

  // ── Accepted ─────────────────────────────────────────────────────────────
  const update = isA ? { member_a_accepted_at: now } : { member_b_accepted_at: now }
  await admin.from('intro_requests').update(update).eq('id', req.id)

  // Re-fetch to check if both parties have now accepted
  const { data: fresh } = await admin.from('intro_requests')
    .select('member_a_accepted_at, member_b_accepted_at')
    .eq('id', req.id)
    .single()

  const bothAccepted = !!(fresh?.member_a_accepted_at && fresh?.member_b_accepted_at)

  if (!bothAccepted) {
    return NextResponse.json({ status: 'waiting' })
  }

  // ── Atomic gate: only the first request to claim pending→accepted proceeds ──
  // A concurrent accept from the other party may have already flipped the status.
  // We use a conditional UPDATE (WHERE status = 'pending') as a compare-and-swap.
  const { data: claimed } = await admin.from('intro_requests')
    .update({ status: 'accepted', responded_at: now })
    .eq('id', req.id)
    .eq('status', 'pending')
    .select('id')

  if (!claimed || claimed.length === 0) {
    // Another concurrent request already processed this — return the existing conversation
    const [racedA, racedB] = [req.requester_id, req.target_id].sort() as [string, string]
    const { data: existingConv } = await admin.from('conversations')
      .select('id').eq('user_a', racedA).eq('user_b', racedB).maybeSingle()
    return NextResponse.json({ status: 'accepted', conversationId: existingConv?.id ?? '' })
  }

  // This request won the race — create connection, conversation, award, notify
  const [abA, abB] = [req.requester_id, req.target_id].sort() as [string, string]

  const { error: connErr } = await admin.from('connections').insert({
    user_a: abA, user_b: abB, origin: 'warm_intro',
  })
  if (connErr && connErr.code !== '23505') {
    console.error('[facilitated/respond] connection insert failed', connErr)
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }

  await admin.from('conversations').upsert(
    { user_a: abA, user_b: abB },
    { onConflict: 'user_a,user_b', ignoreDuplicates: true },
  )
  const { data: conv } = await admin.from('conversations')
    .select('id').eq('user_a', abA).eq('user_b', abB).single()
  const conversationId = conv?.id ?? ''

  // Award facilitator +1 intro credit
  const period = currentPeriod()
  const { data: fCredits } = await admin.from('intro_credits')
    .select('balance, period, lifetime_earned').eq('user_id', req.facilitator_id).maybeSingle()
  const fBalance = (!fCredits || fCredits.period !== period) ? 3 : fCredits.balance
  await admin.from('intro_credits').upsert({
    user_id: req.facilitator_id,
    balance: Math.min(fBalance + 1, 10),
    period,
    lifetime_earned: (fCredits?.lifetime_earned ?? 0) + 1,
    updated_at: now,
  })

  // Fetch profiles + emails for confirmation notifications
  const [{ data: profiles }, authA, authB] = await Promise.all([
    admin.from('profiles').select('id, first_name, last_name, username').in('id', [req.facilitator_id, req.requester_id, req.target_id]),
    admin.auth.admin.getUserById(req.requester_id),
    admin.auth.admin.getUserById(req.target_id),
  ])

  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const displayName = (id: string) => [byId[id]?.first_name, byId[id]?.last_name].filter(Boolean).join(' ') || 'A member'
  const slug = (id: string) => byId[id]?.username ?? id

  const facilitatorName = displayName(req.facilitator_id)
  const nameA = displayName(req.requester_id)
  const nameB = displayName(req.target_id)
  const emailA = authA.data.user?.email
  const emailB = authB.data.user?.email
  const note = req.facilitator_note ?? ''

  await Promise.all([
    emailA && sendEmail(
      emailA,
      `You're now connected with ${nameB}`,
      facilitatedIntroEmail(nameA, facilitatorName, nameB, slug(req.target_id), note, conversationId),
    ),
    emailB && sendEmail(
      emailB,
      `You're now connected with ${nameA}`,
      facilitatedIntroEmail(nameB, facilitatorName, nameA, slug(req.requester_id), note, conversationId),
    ),
  ])

  await Promise.all([req.facilitator_id, req.requester_id, req.target_id].map(id => checkAndAwardBadges(id)))

  return NextResponse.json({ status: 'accepted', conversationId })
}
