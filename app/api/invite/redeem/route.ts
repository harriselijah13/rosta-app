import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureInviteCodes } from '@/lib/invite'
import { sendEmail, inviteUsedEmail } from '@/lib/resend'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const inviteToken = (user.user_metadata?.invite_code as string | undefined)?.trim().toUpperCase()
  if (!inviteToken) {
    // No invite code — still grant founding member status to current cohort
    const admin = createAdminClient()
    await admin.from('profiles').update({ founding_member: true }).eq('id', user.id)
    await ensureInviteCodes(user.id)
    return NextResponse.json({ ok: true, founding: true })
  }

  const admin = createAdminClient()

  const { data: code } = await admin
    .from('invite_codes')
    .select('id, owner_id, used_at')
    .eq('token', inviteToken)
    .eq('type', 'founding_invite')
    .is('used_at', null)
    .maybeSingle()

  if (!code) {
    // Invalid or already-used code — still complete onboarding without founding status
    return NextResponse.json({ ok: true, founding: false })
  }

  const now = new Date().toISOString()

  await Promise.all([
    admin.from('invite_codes').update({ used_by: user.id, used_at: now }).eq('id', code.id),
    admin.from('profiles').update({ founding_member: true, invite_code: inviteToken }).eq('id', user.id),
  ])

  // Generate 5 codes for the new member
  await ensureInviteCodes(user.id)

  // Notify the inviter
  const [{ data: profiles }, newMemberAuth] = await Promise.all([
    admin.from('profiles')
      .select('id, first_name, last_name, username')
      .in('id', [code.owner_id, user.id]),
    admin.auth.admin.getUserById(code.owner_id),
  ])
  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const name = (id: string) =>
    [byId[id]?.first_name, byId[id]?.last_name].filter(Boolean).join(' ') || 'A member'
  const slug = (id: string) => byId[id]?.username ?? id

  const inviterEmail = newMemberAuth.data.user?.email
  if (inviterEmail) {
    await sendEmail(
      inviterEmail,
      `${name(user.id)} joined ROSTA with your invite`,
      inviteUsedEmail(name(code.owner_id), name(user.id), slug(user.id)),
    )
  }

  return NextResponse.json({ ok: true, founding: true })
}
