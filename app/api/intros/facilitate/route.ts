import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, facilitatedIntroRequestEmail } from '@/lib/resend'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { memberAId, memberBId, note } = body ?? {}

  if (!memberAId || !memberBId || typeof note !== 'string') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (memberAId === memberBId || memberAId === user.id || memberBId === user.id) {
    return NextResponse.json({ error: 'Invalid members' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify facilitator is connected to both members
  const [[fAa, fAb], [fBa, fBb]] = [
    [user.id, memberAId].sort() as [string, string],
    [user.id, memberBId].sort() as [string, string],
  ]
  const [{ data: connA }, { data: connB }] = await Promise.all([
    admin.from('connections').select('id').eq('user_a', fAa).eq('user_b', fAb).maybeSingle(),
    admin.from('connections').select('id').eq('user_a', fBa).eq('user_b', fBb).maybeSingle(),
  ])
  if (!connA) return NextResponse.json({ error: 'You are not connected to member A' }, { status: 400 })
  if (!connB) return NextResponse.json({ error: 'You are not connected to member B' }, { status: 400 })

  // Check no duplicate pending facilitated intro between these two
  const { data: existing } = await admin.from('intro_requests')
    .select('id')
    .eq('facilitator_id', user.id)
    .eq('status', 'pending')
    .or(`and(requester_id.eq.${memberAId},target_id.eq.${memberBId}),and(requester_id.eq.${memberBId},target_id.eq.${memberAId})`)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'You already have a pending intro suggestion for this pair' }, { status: 400 })

  // Create intro_request as pending — no connection yet, both parties must accept
  const { data: intro, error: insertErr } = await admin.from('intro_requests').insert({
    type: 'warm_intro',
    requester_id: memberAId,
    target_id: memberBId,
    facilitator_id: user.id,
    status: 'pending',
    facilitator_note: note.trim() || null,
  }).select('id').single()

  if (insertErr || !intro) {
    console.error('[intros/facilitate] insert failed', insertErr)
    return NextResponse.json({ error: 'Failed to create introduction' }, { status: 500 })
  }

  // Fetch profiles + emails to notify both parties
  const [{ data: profiles }, authA, authB] = await Promise.all([
    admin.from('profiles').select('id, first_name, last_name').in('id', [user.id, memberAId, memberBId]),
    admin.auth.admin.getUserById(memberAId),
    admin.auth.admin.getUserById(memberBId),
  ])

  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const displayName = (id: string) =>
    [byId[id]?.first_name, byId[id]?.last_name].filter(Boolean).join(' ') || 'A member'

  const facilitatorName = displayName(user.id)
  const nameA = displayName(memberAId)
  const nameB = displayName(memberBId)
  const emailA = authA.data.user?.email
  const emailB = authB.data.user?.email

  await Promise.all([
    emailA && sendEmail(
      emailA,
      `${facilitatorName} wants to introduce you to ${nameB}`,
      facilitatedIntroRequestEmail(nameA, facilitatorName, nameB, note.trim(), intro.id),
    ),
    emailB && sendEmail(
      emailB,
      `${facilitatorName} wants to introduce you to ${nameA}`,
      facilitatedIntroRequestEmail(nameB, facilitatorName, nameA, note.trim(), intro.id),
    ),
  ])

  return NextResponse.json({ ok: true, introId: intro.id })
}
