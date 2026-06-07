import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import MemberDirectory from './MemberDirectory'
import type { Profile } from '@/lib/types'

export default async function MembersPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  const SELECT = `id, username, first_name, last_name, avatar_url, what_i_do, building_now,
                  where_i_operate, profile_mode, onboarding_completed, founding_member, is_verified, updated_at,
                  signals ( open_to, working_on, need_right_now, updated_at )`

  // Fetch all onboarded members, current user's connections, and current user's own profile in parallel.
  // The current user may not appear in `members` (e.g. onboarding_completed mismatch), so their profile
  // is fetched separately so the My Network centre node always has the right data.
  const [{ data: members }, { data: connRows }, { data: currentProfile }] = await Promise.all([
    admin
      .from('profiles')
      .select(SELECT)
      .eq('onboarding_completed', true)
      .order('updated_at', { ascending: false }),

    admin
      .from('connections')
      .select('user_a, user_b')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`),

    admin
      .from('profiles')
      .select(SELECT)
      .eq('id', user.id)
      .single(),
  ])

  const connectedUserIds: string[] = (connRows ?? []).map(c =>
    c.user_a === user.id ? c.user_b : c.user_a
  )

  return (
    <MemberDirectory
      members={(members ?? []) as Profile[]}
      currentUserId={user.id}
      currentUserProfile={(currentProfile ?? null) as Profile | null}
      connectedUserIds={connectedUserIds}
    />
  )
}
