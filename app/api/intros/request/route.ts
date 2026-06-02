import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, introRequestEmail } from '@/lib/resend'

function currentPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { targetId, facilitatorId, note } = body ?? {}
  if (!targetId || !facilitatorId || typeof note !== 'string') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (targetId === user.id) {
    return NextResponse.json({ error: 'Cannot request intro to yourself' }, { status: 400 })
  }
  if (facilitatorId === user.id || facilitatorId === targetId) {
    return NextResponse.json({ error: 'Invalid facilitator' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify A↔B connection
  const [abA, abB] = [user.id, facilitatorId].sort()
  const { data: abConn } = await admin.from('connections')
    .select('id').eq('user_a', abA).eq('user_b', abB).maybeSingle()
  if (!abConn) return NextResponse.json({ error: 'You are not connected to this facilitator' }, { status: 400 })

  // Verify B↔C connection
  const [bcA, bcB] = [facilitatorId, targetId].sort()
  const { data: bcConn } = await admin.from('connections')
    .select('id').eq('user_a', bcA).eq('user_b', bcB).maybeSingle()
  if (!bcConn) return NextResponse.json({ error: 'Facilitator is not connected to the target' }, { status: 400 })

  // Verify A not already connected to C
  const [acA, acB] = [user.id, targetId].sort()
  const { data: acConn } = await admin.from('connections')
    .select('id').eq('user_a', acA).eq('user_b', acB).maybeSingle()
  if (acConn) return NextResponse.json({ error: 'You are already connected to this person' }, { status: 400 })

  // No existing pending request
  const { data: existing } = await admin.from('intro_requests')
    .select('id').eq('requester_id', user.id).eq('target_id', targetId).eq('status', 'pending').maybeSingle()
  if (existing) return NextResponse.json({ error: 'You already have a pending intro request to this person' }, { status: 400 })

  // Credit check + lazy monthly reset
  const period = currentPeriod()
  const { data: credits } = await admin.from('intro_credits')
    .select('balance, period, lifetime_earned').eq('user_id', user.id).maybeSingle()

  const isNewPeriod = !credits || credits.period !== period
  const currentBalance = isNewPeriod ? 3 : credits.balance
  if (currentBalance < 1) {
    return NextResponse.json({ error: 'No intro credits remaining this month' }, { status: 400 })
  }

  // Insert intro request
  const { data: introRequest, error: insertErr } = await admin.from('intro_requests').insert({
    type: 'warm_intro',
    requester_id: user.id,
    target_id: targetId,
    facilitator_id: facilitatorId,
    requester_note: note.trim() || null,
  }).select('id').single()

  if (insertErr || !introRequest) {
    console.error('[intros/request] insert failed', insertErr)
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 })
  }

  // Deduct credit
  await admin.from('intro_credits').upsert({
    user_id: user.id,
    balance: currentBalance - 1,
    period,
    lifetime_earned: credits?.lifetime_earned ?? 0,
    updated_at: new Date().toISOString(),
  })

  // Fetch names + facilitator email for notification
  const [{ data: profiles }, facilitatorAuth] = await Promise.all([
    admin.from('profiles').select('id, first_name, last_name, username')
      .in('id', [user.id, targetId, facilitatorId]),
    admin.auth.admin.getUserById(facilitatorId),
  ])

  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const name = (p: { first_name: string | null; last_name: string | null }) =>
    [p.first_name, p.last_name].filter(Boolean).join(' ') || 'A member'

  const requesterName = name(byId[user.id] ?? {})
  const targetName = name(byId[targetId] ?? {})
  const facilitatorName = name(byId[facilitatorId] ?? {})
  const facilitatorEmail = facilitatorAuth.data.user?.email

  if (facilitatorEmail) {
    await sendEmail(
      facilitatorEmail,
      `${requesterName} wants an intro to ${targetName}`,
      introRequestEmail(facilitatorName, requesterName, targetName, note.trim(), introRequest.id),
    )
  }

  return NextResponse.json({ id: introRequest.id })
}
