import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      `first_name, last_name, avatar_url, what_i_do, building_now,
       who_i_want_to_meet, where_i_operate, fun_fact, profile_mode`
    )
    .eq('id', user.id)
    .single()

  const { data: signalRow } = await supabase
    .from('signals')
    .select('open_to, working_on, need_right_now')
    .eq('user_id', user.id)
    .single()

  return (
    <SettingsClient
      userId={user.id}
      profile={profile ?? {}}
      signals={signalRow ?? null}
    />
  )
}
