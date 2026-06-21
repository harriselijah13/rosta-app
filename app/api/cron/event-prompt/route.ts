import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const now = new Date()
  // Window: 12h–48h ago. Hobby plan allows only one cron per day (0 8 * * *),
  // so the window is wider than the ideal 12-24h to ensure no tap-ins are missed.
  const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
  const windowEnd   = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString()

  // Find attendances tapped in 12–24h ago that haven't been shown a prompt yet
  const { data: rows } = await admin
    .from('event_attendances')
    .select('id')
    .is('prompt_shown_at', null)
    .is('dismissed_at', null)
    .is('completed_at', null)
    .gt('tapped_in_at', windowStart)
    .lte('tapped_in_at', windowEnd)

  if (!rows?.length) {
    await recordCronRun('event-prompt', 'ok', 'nothing to show')
    return NextResponse.json({ marked: 0 })
  }

  const ids = rows.map(r => r.id)
  await admin
    .from('event_attendances')
    .update({ prompt_shown_at: now.toISOString() })
    .in('id', ids)

  await recordCronRun('event-prompt', 'ok', `marked ${ids.length}`)
  return NextResponse.json({ marked: ids.length })
}
