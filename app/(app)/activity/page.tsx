import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import NetworkActivityList, { type ActivityItem } from '@/app/(app)/dashboard/NetworkActivityList'

export const dynamic = 'force-dynamic'

function displayName(p: { first_name: string | null; last_name: string | null } | undefined): string {
  return [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'A member'
}

export default async function ActivityPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: connRows } = await admin
    .from('connections')
    .select('user_a, user_b')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

  const connectionIds = (connRows ?? []).map(c =>
    c.user_a === user.id ? c.user_b : c.user_a
  )

  const { data: signals } = connectionIds.length > 0
    ? await admin
        .from('signals')
        .select('user_id, updated_at, working_on, need_right_now, open_to')
        .in('user_id', connectionIds)
        .gt('updated_at', thirtyDaysAgo)
        .order('updated_at', { ascending: false })
        .limit(30)
    : { data: [] }

  const activityIds = (signals ?? []).map(s => s.user_id)

  type ProfileRow = { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; username: string | null; is_verified: boolean }
  type ConvRow = { id: string; user_a: string; user_b: string }

  const [{ data: profiles }, { data: convRows }] = await Promise.all([
    activityIds.length > 0
      ? admin.from('profiles').select('id, first_name, last_name, avatar_url, username, is_verified').in('id', activityIds)
      : Promise.resolve({ data: [] as ProfileRow[] }),
    activityIds.length > 0
      ? admin.from('conversations')
          .select('id, user_a, user_b')
          .or(activityIds.map(id => {
            const [a, b] = [user.id, id].sort()
            return `and(user_a.eq.${a},user_b.eq.${b})`
          }).join(','))
      : Promise.resolve({ data: [] as ConvRow[] }),
  ])

  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const convByUserId: Record<string, string> = {}
  for (const c of convRows ?? []) {
    const otherId = c.user_a === user.id ? c.user_b : c.user_a
    convByUserId[otherId] = c.id
  }

  const items: ActivityItem[] = (signals ?? []).flatMap(signal => {
    const p = byId[signal.user_id]
    if (!p) return []
    const name = displayName(p)
    return [{
      userId:         signal.user_id,
      name,
      avatarUrl:      p.avatar_url,
      isVerified:     p.is_verified,
      profileSlug:    p.username ?? signal.user_id,
      initials:       name.trim().split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase(),
      workingOn:      signal.working_on,
      needRightNow:   signal.need_right_now,
      openTo:         (signal.open_to ?? []) as string[],
      updatedAt:      signal.updated_at,
      conversationId: convByUserId[signal.user_id] ?? null,
    }]
  })

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-body-grey hover:text-navy transition-colors mb-8"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Dashboard
      </Link>

      <h1 className="font-display text-3xl font-bold text-navy mb-6">Network activity</h1>

      <NetworkActivityList items={items} hasMore={false} />
    </div>
  )
}
