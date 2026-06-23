// ONE-OFF: manually resend the event-capture reminder email to a given address.
// Protected by admin session. Delete this file after confirming receipt.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, eventCaptureReminderEmail } from '@/lib/resend'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { adminId: null, status: 401 as const }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { adminId: null, status: 403 as const }
  return { adminId: user.id, status: 200 as const }
}

export async function GET(request: Request) {
  const { adminId, status } = await requireAdmin()
  if (!adminId) {
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
  }

  const targetEmail = new URL(request.url).searchParams.get('email') ?? 'harris@onrosta.com'

  const admin = createAdminClient()

  // Look up name from profiles via auth users
  const { data: { users: authUsers } } = await admin.auth.admin.listUsers()
  const targetUser = authUsers.find(u => u.email === targetEmail)
  if (!targetUser) {
    return NextResponse.json({ error: `No auth user found for ${targetEmail}` }, { status: 404 })
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', targetUser.id)
    .single()

  const memberName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'there'
    : 'there'

  await sendEmail(
    targetEmail,
    "Yesterday at the event — capture the names while they're fresh",
    eventCaptureReminderEmail(memberName),
  )

  return NextResponse.json({ ok: true, to: targetEmail, name: memberName })
}
