/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, networkDigestEmail } from '@/lib/resend'
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

  // Find all connections to know who should get a digest about whom
  const { data: connRows } = await admin.from('connections').select('user_a, user_b').is('removed_at', null)
  if (!connRows || connRows.length === 0) {
    await recordCronRun('network-digest', 'ok', 'no connections')
    return NextResponse.json({ sent: 0 })
  }

  // Build connection map: userId → [connectionIds]
  const connsByUser: Record<string, string[]> = {}
  for (const row of connRows) {
    if (!connsByUser[row.user_a]) connsByUser[row.user_a] = []
    if (!connsByUser[row.user_b]) connsByUser[row.user_b] = []
    connsByUser[row.user_a].push(row.user_b)
    connsByUser[row.user_b].push(row.user_a)
  }

  const allUserIds = Object.keys(connsByUser)

  // Fetch new posts since yesterday
  const { data: newPosts } = await (admin as any)
    .from('network_posts')
    .select('id, author_id, post_type')
    .gt('created_at', since)
    .is('deleted_at', null)

  // Fetch new signal updates since yesterday
  const { data: newSignals } = await (admin as any)
    .from('signal_updates')
    .select('id, member_id')
    .gt('created_at', since)

  // Profiles + emails
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, first_name')
    .in('id', allUserIds)
    .eq('onboarding_completed', true)

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  const emailMap: Record<string, string> = {}
  await Promise.all(
    allUserIds.map(async uid => {
      const { data } = await admin.auth.admin.getUserById(uid)
      if (data.user?.email) emailMap[uid] = data.user.email
    })
  )

  let sent = 0, skipped = 0

  for (const uid of allUserIds) {
    const profile = profileMap[uid]
    const email   = emailMap[uid]
    if (!profile || !email) continue

    const myConnIds = new Set(connsByUser[uid] ?? [])

    const askCount    = (newPosts    ?? []).filter((p: any) => myConnIds.has(p.author_id) && p.post_type === 'ask').length
    const offerCount  = (newPosts    ?? []).filter((p: any) => myConnIds.has(p.author_id) && p.post_type === 'offer').length
    const signalCount = (newSignals  ?? []).filter((s: any) => myConnIds.has(s.member_id)).length

    if (askCount + offerCount + signalCount === 0) continue

    try {
      const subject = askCount + offerCount > 0
        ? `New asks and offers in your network.`
        : `Signal updates from your network.`
      await sendEmail(
        email,
        subject,
        networkDigestEmail(profile.first_name ?? 'there', askCount, offerCount, signalCount),
      )
      sent++
    } catch (err) {
      console.error('[network-digest] send failed for', uid, err)
      skipped++
    }
  }

  await recordCronRun('network-digest', 'ok', `sent ${sent}, skipped ${skipped}`)
  return NextResponse.json({ sent, skipped })
}
