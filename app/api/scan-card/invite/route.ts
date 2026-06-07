import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, scanCardInviteEmail } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { cardId, email, name, company, role, phone, met_at } = body ?? {}

  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })
  if (!met_at?.trim()) return NextResponse.json({ error: 'met_at required' }, { status: 400 })

  const admin = createAdminClient()

  // Fetch sender's profile + an unused invite code
  const [{ data: senderProfile }, { data: inviteCodes }] = await Promise.all([
    admin.from('profiles').select('first_name, last_name').eq('id', user.id).single(),
    admin.from('invite_codes')
      .select('token')
      .eq('owner_id', user.id)
      .eq('type', 'founding_invite')
      .is('used_at', null)
      .limit(1),
  ])

  const senderName = [senderProfile?.first_name, senderProfile?.last_name].filter(Boolean).join(' ') || 'A ROSTA member'
  const inviteCode = inviteCodes?.[0]?.token ?? null

  // Send invite email
  await sendEmail(
    email.trim(),
    `${senderName} wants to connect on ROSTA`,
    scanCardInviteEmail(name?.trim() || 'there', senderName, met_at.trim(), inviteCode),
  )

  // Save/update the card
  if (cardId) {
    await admin.from('scanned_cards')
      .update({ action_taken: 'invited' })
      .eq('id', cardId)
      .eq('user_id', user.id)
  } else {
    await admin.from('scanned_cards').insert({
      user_id: user.id,
      name:    name?.trim()    || null,
      email:   email.trim(),
      company: company?.trim() || null,
      role:    role?.trim()    || null,
      phone:   phone?.trim()   || null,
      met_at:  met_at.trim(),
      action_taken: 'invited',
    })
  }

  return NextResponse.json({ ok: true })
}
