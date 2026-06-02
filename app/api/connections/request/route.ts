import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, openDoorRequestEmail } from '@/lib/resend'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { targetId, note } = body ?? {}
  if (!targetId || typeof note !== 'string') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (targetId === user.id) {
    return NextResponse.json({ error: 'Cannot connect with yourself' }, { status: 400 })
  }
  if (!note.trim()) {
    return NextResponse.json({ error: 'A context note is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Confirm target has Open Door on
  const { data: signal } = await admin.from('signals')
    .select('open_to').eq('user_id', targetId).single()
  if (!signal?.open_to?.includes('open_door')) {
    return NextResponse.json({ error: 'This member does not have Open Door enabled' }, { status: 400 })
  }

  // Not already connected
  const [ua, ub] = [user.id, targetId].sort()
  const { data: existing } = await admin.from('connections')
    .select('id').eq('user_a', ua).eq('user_b', ub).maybeSingle()
  if (existing) return NextResponse.json({ error: 'Already connected' }, { status: 400 })

  // No pending request already
  const { data: pendingReq } = await admin.from('intro_requests')
    .select('id')
    .eq('requester_id', user.id)
    .eq('target_id', targetId)
    .eq('status', 'pending')
    .maybeSingle()
  if (pendingReq) return NextResponse.json({ error: 'You already have a pending request to this person' }, { status: 400 })

  // Create the request
  const { data: introReq, error: insertErr } = await admin.from('intro_requests').insert({
    type: 'open_door',
    requester_id: user.id,
    target_id: targetId,
    facilitator_id: null,
    requester_note: note.trim(),
  }).select('id').single()

  if (insertErr || !introReq) {
    console.error('[connections/request] insert failed', insertErr)
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 })
  }

  // Fetch names + target email
  const [{ data: profiles }, targetAuth] = await Promise.all([
    admin.from('profiles').select('id, first_name, last_name')
      .in('id', [user.id, targetId]),
    admin.auth.admin.getUserById(targetId),
  ])

  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const name = (p: { first_name: string | null; last_name: string | null } | undefined) =>
    [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'A member'

  const requesterName = name(byId[user.id])
  const targetName = name(byId[targetId])
  const targetEmail = targetAuth.data.user?.email

  if (targetEmail) {
    await sendEmail(
      targetEmail,
      `${requesterName} wants to connect`,
      openDoorRequestEmail(targetName, requesterName, note.trim(), introReq.id),
    )
  }

  return NextResponse.json({ id: introReq.id })
}
