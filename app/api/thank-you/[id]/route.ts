import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, thankYouEmail } from '@/lib/resend'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: req } = await admin
    .from('intro_requests')
    .select('id, requester_id, target_id, facilitator_id, thank_you_at, status, type')
    .eq('id', params.id)
    .single()

  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only warm intros with an accepted status and a facilitator
  if (req.type !== 'warm_intro' || req.status !== 'accepted' || !req.facilitator_id) {
    return NextResponse.json({ error: 'Not applicable' }, { status: 400 })
  }

  // Only the requester or target (not the facilitator) can send a thank you
  if (req.requester_id !== user.id && req.target_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (req.facilitator_id === user.id) {
    return NextResponse.json({ error: 'You cannot thank yourself' }, { status: 400 })
  }
  if (req.thank_you_at) {
    return NextResponse.json({ error: 'Thank you already sent' }, { status: 400 })
  }

  await admin.from('intro_requests')
    .update({ thank_you_at: new Date().toISOString() })
    .eq('id', params.id)

  // Notify the intro-maker
  const [{ data: profiles }, facilitatorAuth] = await Promise.all([
    admin.from('profiles')
      .select('id, first_name, last_name, username')
      .in('id', [user.id, req.facilitator_id]),
    admin.auth.admin.getUserById(req.facilitator_id),
  ])
  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const name = (id: string) =>
    [byId[id]?.first_name, byId[id]?.last_name].filter(Boolean).join(' ') || 'A member'
  const slug = (id: string) => byId[id]?.username ?? id

  const facilitatorEmail = facilitatorAuth.data.user?.email
  if (facilitatorEmail) {
    await sendEmail(
      facilitatorEmail,
      `${name(user.id)} said thank you`,
      thankYouEmail(name(req.facilitator_id), name(user.id), slug(user.id)),
    )
  }

  return NextResponse.json({ ok: true })
}
