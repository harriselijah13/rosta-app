import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, onboardingReminderEmail } from '@/lib/resend'
import { recordCronRun } from '@/lib/cron-recorder'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('Authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient()
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Find all incomplete, un-reminded profiles
  const { data: profiles } = await admin
    .from('profiles')
    .select('id')
    .eq('onboarding_completed', false)
    .eq('onboarding_reminder_sent', false)

  if (!profiles || profiles.length === 0) {
    await recordCronRun('onboarding-reminder', 'ok', 'no eligible profiles')
    return NextResponse.json({ sent: 0 })
  }

  const userIds = profiles.map(p => p.id)

  // Fetch auth users to check email_confirmed_at > 24h ago
  // listUsers returns up to 1000 — sufficient for a founding network
  const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })

  const eligible = users.filter(u =>
    userIds.includes(u.id) &&
    u.email_confirmed_at != null &&
    new Date(u.email_confirmed_at as string) < new Date(twentyFourHoursAgo) &&
    u.email
  )

  let sent = 0
  let skipped = 0

  for (const user of eligible) {
    try {
      await sendEmail(
        user.email!,
        'Finish setting up your ROSTA profile',
        onboardingReminderEmail(),
      )

      await admin
        .from('profiles')
        .update({ onboarding_reminder_sent: true })
        .eq('id', user.id)

      sent++
    } catch (err) {
      console.error('[onboarding-reminder] failed for', user.id, err)
      skipped++
    }
  }

  await recordCronRun('onboarding-reminder', 'ok', `sent ${sent}, skipped ${skipped}`)
  return NextResponse.json({ sent, skipped, eligible: eligible.length })
}
