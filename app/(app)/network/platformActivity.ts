/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js'

export type PlatformActivityItem = {
  id: string
  text: string
  createdAt: string
}

export async function buildPlatformActivity(
  admin: SupabaseClient,
  userId: string,
  connectionIds: string[],
): Promise<PlatformActivityItem[]> {
  const sevenDaysAgo  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const excludeIds = [userId, ...connectionIds]

  // New members: onboarding-complete, last 14 days, not self or connections
  let newMembersQuery = (admin as any)
    .from('profiles')
    .select('id, first_name, created_at')
    .eq('onboarding_completed', true)
    .gt('created_at', fourteenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(20)

  newMembersQuery = newMembersQuery.not('id', 'in', `(${excludeIds.join(',')})`)

  // Signal updates from non-connections/non-self, last 14 days
  let signalQuery = (admin as any)
    .from('signal_updates')
    .select('id, member_id, created_at')
    .neq('member_id', userId)
    .gt('created_at', fourteenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(20)

  if (connectionIds.length > 0) {
    signalQuery = signalQuery.not('member_id', 'in', `(${connectionIds.join(',')})`)
  }

  const [
    { data: newMembers },
    { data: recentIntro, count: introsCount },
    { data: recentConn,  count: connsCount  },
    { data: signalRows  },
  ] = await Promise.all([
    newMembersQuery,
    // Accepted intros this week — count + most-recent timestamp
    (admin as any)
      .from('intro_requests')
      .select('id, created_at', { count: 'exact' })
      .eq('status', 'accepted')
      .gt('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1),
    // New connections this week — count + most-recent timestamp
    admin
      .from('connections')
      .select('id, created_at', { count: 'exact' })
      .gt('created_at', sevenDaysAgo)
      .is('removed_at', null)
      .order('created_at', { ascending: false })
      .limit(1),
    signalQuery,
  ])

  const items: PlatformActivityItem[] = []

  // New members
  for (const m of (newMembers as any[] ?? [])) {
    items.push({
      id:        `member-${m.id as string}`,
      text:      `${(m.first_name as string | null) ?? 'A new member'} joined ROSTA`,
      createdAt: m.created_at as string,
    })
  }

  // Intros aggregate
  const introTotal = introsCount ?? 0
  if (introTotal > 0 && Array.isArray(recentIntro) && recentIntro.length > 0) {
    items.push({
      id:        'intros-week',
      text:      `${introTotal} ${introTotal === 1 ? 'intro' : 'intros'} made on ROSTA this week`,
      createdAt: (recentIntro as any[])[0].created_at as string,
    })
  }

  // Connections aggregate
  const connTotal = connsCount ?? 0
  if (connTotal > 0 && Array.isArray(recentConn) && recentConn.length > 0) {
    items.push({
      id:        'connections-week',
      text:      `${connTotal} new ${connTotal === 1 ? 'connection' : 'connections'} made this week`,
      createdAt: (recentConn as any[])[0].created_at as string,
    })
  }

  // Signal updates from non-connections (deduplicated per member)
  const sigRows = (signalRows as any[] ?? [])
  if (sigRows.length > 0) {
    const memberIds = Array.from(new Set(sigRows.map((s: any) => s.member_id as string)))
    const { data: memberProfiles } = await (admin as any)
      .from('profiles')
      .select('id, first_name, onboarding_completed')
      .in('id', memberIds)

    const profileMap: Record<string, any> = Object.fromEntries(
      ((memberProfiles as any[]) ?? []).map((p: any) => [p.id as string, p])
    )

    const seenMembers = new Set<string>()
    for (const s of sigRows as any[]) {
      const memberId = s.member_id as string
      if (seenMembers.has(memberId)) continue
      seenMembers.add(memberId)
      const p = profileMap[memberId]
      const name = p?.onboarding_completed ? ((p.first_name as string | null) ?? 'A member') : 'A member'
      items.push({
        id:        `signal-${s.id as string}`,
        text:      `${name} updated their signals`,
        createdAt: s.created_at as string,
      })
    }
  }

  // Sort reverse-chronological, cap at 8
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return items.slice(0, 8)
}
