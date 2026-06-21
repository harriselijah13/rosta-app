import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { unifiedQrUrl } from '@/lib/qr'
import SettingsClient from './SettingsClient'
import QRSection from './QRSection'

function currentMonthPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const period = currentMonthPeriod()

  const [{ data: profile }, { data: signalRow }, { data: optinRow }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        `username, first_name, last_name, avatar_url, what_i_do, building_now,
         who_i_want_to_meet, where_i_operate, fun_fact, founding_member,
         signal_streak, signal_streak_last_week`
      )
      .eq('id', user.id)
      .single(),
    supabase.from('signals').select('open_to, working_on, need_right_now').eq('user_id', user.id).single(),
    admin.from('open_table_optins').select('id').eq('user_id', user.id).eq('period', period).maybeSingle(),
  ])


  return (
    <>
      <SettingsClient
        userId={user.id}
        profile={profile ?? {}}
        signals={signalRow ?? null}
        openTableOptedIn={!!optinRow}
        openTablePeriod={period}
        currentStreak={profile?.signal_streak ?? 0}
        currentStreakLastWeek={profile?.signal_streak_last_week ?? null}
      />
      <QRSection url={unifiedQrUrl(profile?.username ?? user.id)} />
    </>
  )
}
