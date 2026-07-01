/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, networkActivityDigestEmail } from '@/lib/resend'
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
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Fetch all unread reaction/forward notifications from the last 24h
  const { data: notifRows, error: notifErr } = await (admin as any)
    .from('notifications')
    .select('user_id, type')
    .is('read_at', null)
    .gte('created_at', since)
    .in('type', ['reaction_can_help', 'reaction_know_someone', 'post_forwarded'])
    .limit(2000)

  if (notifErr) {
    console.error('[cron/network-activity-digest] notifications query error', notifErr)
    await recordCronRun('network-activity-digest', 'error', notifErr.message)
    return NextResponse.json({ error: 'query failed' }, { status: 500 })
  }

  if (!notifRows || notifRows.length === 0) {
    await recordCronRun('network-activity-digest', 'ok', 'no unread notifications')
    return NextResponse.json({ sent: 0 })
  }

  // Group counts by user_id
  const byUser: Record<string, { can_help: number; know_someone: number; forwarded: number }> = {}
  for (const row of notifRows as any[]) {
    if (!byUser[row.user_id]) byUser[row.user_id] = { can_help: 0, know_someone: 0, forwarded: 0 }
    if (row.type === 'reaction_can_help')    byUser[row.user_id].can_help++
    if (row.type === 'reaction_know_someone') byUser[row.user_id].know_someone++
    if (row.type === 'post_forwarded')        byUser[row.user_id].forwarded++
  }

  const userIds = Object.keys(byUser)
  if (userIds.length === 0) {
    await recordCronRun('network-activity-digest', 'ok', 'no users to notify')
    return NextResponse.json({ sent: 0 })
  }

  // Fetch profiles (first_name) and auth emails in parallel
  const [{ data: profiles }, authResults] = await Promise.all([
    admin.from('profiles').select('id, first_name').in('id', userIds),
    Promise.all(userIds.map(id => admin.auth.admin.getUserById(id))),
  ])

  const profileById: Record<string, any> = Object.fromEntries(
    (profiles ?? []).map(p => [p.id, p])
  )
  const emailById: Record<string, string | undefined> = Object.fromEntries(
    userIds.map((id, i) => [id, authResults[i].data.user?.email])
  )

  let sent = 0

  for (const userId of userIds) {
    const email = emailById[userId]
    if (!email) continue

    const profile = profileById[userId]
    const firstName = profile?.first_name ?? 'there'
    const counts = byUser[userId]

    try {
      await sendEmail(
        email,
        'Activity on your ROSTA posts',
        networkActivityDigestEmail({
          firstName,
          canHelpCount: counts.can_help,
          knowSomeoneCount: counts.know_someone,
          forwardCount: counts.forwarded,
        }),
      )
      sent++
    } catch (err) {
      console.error('[cron/network-activity-digest] failed for', userId, err)
    }
  }

  await recordCronRun('network-activity-digest', 'ok', `sent ${sent}`)
  return NextResponse.json({ sent })
}
