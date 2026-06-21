import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordCronRun } from '@/lib/cron-recorder'
import { sendEmail, eventCaptureReminderEmail } from '@/lib/resend'

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
  const now = new Date()
  // Window: 12h–48h ago. Hobby plan allows only one cron per day (0 8 * * *),
  // so the window is wider than the ideal 12-24h to ensure no tap-ins are missed.
  const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
  const windowEnd   = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString()

  // Find attendances tapped in within the window that haven't been shown a prompt yet
  const { data: rows } = await admin
    .from('event_attendances')
    .select('id, user_id')
    .is('prompt_shown_at', null)
    .is('dismissed_at', null)
    .is('completed_at', null)
    .gt('tapped_in_at', windowStart)
    .lte('tapped_in_at', windowEnd)

  if (!rows?.length) {
    await recordCronRun('event-prompt', 'ok', 'nothing to show')
    return NextResponse.json({ marked: 0 })
  }

  const ids     = rows.map(r => r.id)
  const userIds = Array.from(new Set(rows.map(r => r.user_id as string)))

  // Mark prompt_shown_at first — email failures must not block the dashboard surface
  await admin
    .from('event_attendances')
    .update({ prompt_shown_at: now.toISOString() })
    .in('id', ids)

  // Fetch member profiles for personalised emails
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', userIds)

  const profileById = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  // Send one email per row; failures are logged and don't block other rows
  let emailed = 0
  for (const row of rows) {
    try {
      const { data: authData } = await admin.auth.admin.getUserById(row.user_id as string)
      const email = authData.user?.email
      if (!email) continue
      const p = profileById[row.user_id as string]
      const memberName = p
        ? [p.first_name, p.last_name].filter(Boolean).join(' ') || 'there'
        : 'there'
      await sendEmail(
        email,
        "Yesterday at the event — capture the names while they're fresh",
        eventCaptureReminderEmail(memberName),
      )
      emailed++
    } catch (e) {
      console.error('[cron/event-prompt] email failed for user', row.user_id, e)
    }
  }

  await recordCronRun('event-prompt', 'ok', `marked ${ids.length}, emailed ${emailed}`)
  return NextResponse.json({ marked: ids.length, emailed })
}
