import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import NetworkClient from './NetworkClient'
import { buildFeedItems } from './feedUtils'

export const dynamic = 'force-dynamic'

export default async function NetworkPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [{ data: profile }, { data: connRows }] = await Promise.all([
    admin.from('profiles').select('first_name, last_name, avatar_url, username, is_verified').eq('id', user.id).single(),
    admin.from('connections').select('user_a, user_b').or(`user_a.eq.${user.id},user_b.eq.${user.id}`).is('removed_at', null),
  ])

  const connectionIds = (connRows ?? []).map(c => c.user_a === user.id ? c.user_b : c.user_a)

  // Fetch connection profiles for the forward modal
  const { data: connProfiles } = connectionIds.length > 0
    ? await admin.from('profiles').select('id, first_name, last_name, avatar_url').in('id', connectionIds)
    : { data: [] }

  const connections = (connProfiles ?? [])
    .map(p => ({
      id:        p.id as string,
      name:      [p.first_name, p.last_name].filter(Boolean).join(' ') || 'A member',
      avatarUrl: (p.avatar_url as string | null) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Build the initial feed
  const { items, hasMore } = await buildFeedItems(admin, user.id, new Date().toISOString(), 50)

  const currentUserName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'You'

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <NetworkClient
        initialItems={items}
        initialHasMore={hasMore}
        currentUserId={user.id}
        currentUserName={currentUserName}
        currentUserAvatarUrl={profile?.avatar_url ?? null}
        currentUserIsVerified={profile?.is_verified ?? false}
        currentUserUsername={profile?.username ?? null}
        connections={connections}
      />
    </div>
  )
}
