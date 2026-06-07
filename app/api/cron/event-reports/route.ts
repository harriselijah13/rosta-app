import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, eventReportEmail } from '@/lib/resend'
import { recordCronRun } from '@/lib/cron-recorder'

export const dynamic = 'force-dynamic'

const REPORT_BASE = 'https://app.onrosta.com/admin/event-tools/report'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('Authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient()

  // Find event codes where event_date was exactly 7 days ago and report not yet sent
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 7)
  const sevenDaysAgo = d.toISOString().slice(0, 10)  // 'YYYY-MM-DD'

  const { data: codes } = await admin
    .from('invite_codes')
    .select('id, event_name, label, event_date, organiser_name, organiser_email')
    .eq('type', 'guest_qr')
    .eq('event_date', sevenDaysAgo)
    .eq('report_sent', false)

  if (!codes?.length) {
    await recordCronRun('event-reports', 'ok', 'no events due today')
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0
  for (const code of codes) {
    if (!code.organiser_email) continue
    const eventName = code.event_name ?? code.label ?? 'Your event'

    try {
      const stats = await computeStats(admin, code.id, code.event_date)

      await sendEmail(
        code.organiser_email,
        `Your ${eventName} ROSTA report is ready`,
        eventReportEmail(
          code.organiser_name ?? 'there',
          eventName,
          stats,
          `${REPORT_BASE}/${code.id}`,
        ),
      )

      await admin.from('invite_codes').update({ report_sent: true }).eq('id', code.id)
      sent++
    } catch (err) {
      console.error('[cron/event-reports] failed for code', code.id, err)
    }
  }

  await recordCronRun('event-reports', 'ok', `sent ${sent} of ${codes.length}`)
  return NextResponse.json({ sent, total: codes.length })
}

async function computeStats(
  admin: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>,
  codeId: string,
  eventDate: string | null,
) {
  const { data: guestConns } = await admin
    .from('guest_connections')
    .select('id, guest_email')
    .eq('invite_code_id', codeId)

  const scans = (guestConns ?? []).length

  const guestEmails = Array.from(new Set(
    (guestConns ?? []).map(gc => gc.guest_email?.toLowerCase()).filter(Boolean) as string[],
  ))

  if (guestEmails.length === 0) return { scans, members: 0, connections: 0, outcomes: 0 }

  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 })
  const memberIds = users
    .filter(u => u.email && guestEmails.includes(u.email.toLowerCase()))
    .map(u => u.id)

  if (memberIds.length === 0) return { scans, members: memberIds.length, connections: 0, outcomes: 0 }

  const idList      = memberIds.join(',')
  const windowStart = eventDate ? new Date(eventDate + 'T00:00:00Z').toISOString() : null
  const windowEnd   = eventDate
    ? new Date(new Date(eventDate + 'T00:00:00Z').getTime() + 30 * 86400000).toISOString()
    : null

  let connQ = admin
    .from('connections')
    .select('id', { count: 'exact', head: true })
    .or(`user_a.in.(${idList}),user_b.in.(${idList})`)
  if (windowStart) connQ = connQ.gte('created_at', windowStart)
  if (windowEnd)   connQ = connQ.lte('created_at', windowEnd)
  const { count: connections } = await connQ

  const { data: convs } = await admin
    .from('conversations')
    .select('id')
    .or(`user_a.in.(${idList}),user_b.in.(${idList})`)

  let outcomes = 0
  if (convs?.length) {
    const { count } = await admin
      .from('outcomes')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', convs.map(c => c.id))
    outcomes = count ?? 0
  }

  return { scans, members: memberIds.length, connections: connections ?? 0, outcomes }
}
