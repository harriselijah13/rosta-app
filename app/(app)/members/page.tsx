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

  // Fetch all onboarded members — no connection filter, all are visible
  const [{ data: members }, { data: connRows }] = await Promise.all([
    admin
      .from('profiles')
      .select(
        `id, username, first_name, last_name, avatar_url, what_i_do, building_now,
         where_i_operate, profile_mode, onboarding_completed, founding_member, is_verified, updated_at,
         signals ( open_to, working_on, need_right_now, updated_at )`
      )
      .eq('onboarding_completed', true)
      .order('updated_at', { ascending: false }),

    // Fetch current user's connections to drive limited vs full card view
    admin
      .from('connections')
      .select('user_a, user_b')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
  ])

  const connectedUserIds: string[] = (connRows ?? []).map(c =>
    c.user_a === user.id ? c.user_b : c.user_a
  )

  return (
    <MemberDirectory
      members={(members ?? []) as Profile[]}
      currentUserId={user.id}
      connectedUserIds={connectedUserIds}
    />
  )
}
