import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MemberDirectory from './MemberDirectory'
import type { Profile } from '@/lib/types'

export default async function MembersPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: members } = await supabase
    .from('profiles')
    .select(
      `id, username, first_name, last_name, avatar_url, what_i_do, building_now,
       where_i_operate, profile_mode, onboarding_completed, founding_member, updated_at,
       signals ( open_to, working_on, need_right_now, updated_at )`
    )
    .eq('onboarding_completed', true)
    .order('updated_at', { ascending: false })

  return (
    <MemberDirectory
      members={(members ?? []) as Profile[]}
      currentUserId={user.id}
    />
  )
}
