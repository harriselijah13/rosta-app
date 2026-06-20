import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyAdminOnSignup } from '@/lib/resend'

const ADMIN_EMAIL = 'harris@onrosta.com'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Skip if the new member is the admin themselves
  if (user.email === ADMIN_EMAIL) {
    return NextResponse.json({ ok: true, skipped: 'admin' })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('first_name, last_name, username, where_i_operate, onboarding_completed')
    .eq('id', user.id)
    .single()

  // Guard: only fire when onboarding is genuinely complete
  if (!profile?.onboarding_completed) {
    return NextResponse.json({ ok: true, skipped: 'not_complete' })
  }

  const memberName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'A new member'

  try {
    await notifyAdminOnSignup({
      memberName,
      memberEmail:    user.email ?? '',
      memberUsername: profile.username ?? null,
      location:       profile.where_i_operate ?? null,
    })
  } catch (err) {
    // Best-effort — log but never surface to the client
    console.error('[notify-signup] admin email failed', err)
  }

  return NextResponse.json({ ok: true })
}
