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

  const MEMBERS_SELECT = `id, username, first_name, last_name, avatar_url, what_i_do, building_now,
                          where_i_operate, profile_mode, onboarding_completed, founding_member, is_verified, updated_at,
                          signals ( open_to, working_on, need_right_now, updated_at )`

  // Current user's own profile uses a simpler select (no signals join) via their session
  // client — the same pattern as the app layout, which is known to work. Using .maybeSingle()
  // so a missing row returns null instead of an error.
  const SELF_SELECT = `id, first_name, last_name, avatar_url, what_i_do, building_now,
                       where_i_operate, profile_mode, onboarding_completed, founding_member, is_verified, updated_at`

  const [{ data: members }, { data: connRows }, { data: currentProfile, error: profileFetchError }] = await Promise.all([
    admin
      .from('profiles')
      .select(MEMBERS_SELECT)
      .eq('onboarding_completed', true)
      .order('updated_at', { ascending: false }),

    admin
      .from('connections')
      .select('user_a, user_b')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`),

    supabase
      .from('profiles')
      .select(SELF_SELECT)
      .eq('id', user.id)
      .maybeSingle(),
  ])

  if (profileFetchError) {
    console.error('[MembersPage] currentProfile fetch error:', profileFetchError)
  }

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
