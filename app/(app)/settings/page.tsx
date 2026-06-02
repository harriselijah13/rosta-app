import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateMemberQR, getOrCreateGuestQR, qrUrl } from '@/lib/qr'
import SettingsClient from './SettingsClient'
import QRSection from './QRSection'
import GuestQRSection from './GuestQRSection'

export default async function SettingsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, { data: signalRow }, memberToken, guestQR] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        `username, first_name, last_name, avatar_url, what_i_do, building_now,
         who_i_want_to_meet, where_i_operate, fun_fact, profile_mode`
      )
      .eq('id', user.id)
      .single(),
    supabase
      .from('signals')
      .select('open_to, working_on, need_right_now')
      .eq('user_id', user.id)
      .single(),
    getOrCreateMemberQR(user.id),
    getOrCreateGuestQR(user.id),
  ])

  return (
    <>
      <SettingsClient
        userId={user.id}
        profile={profile ?? {}}
        signals={signalRow ?? null}
      />
      {memberToken && <QRSection url={qrUrl(memberToken)} />}
      {guestQR && (
        <GuestQRSection
          initialToken={guestQR.token}
          initialExpiresAt={guestQR.expiresAt}
        />
      )}
    </>
  )
}
