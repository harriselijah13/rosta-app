import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateMemberQR, getOrCreateGuestQR, qrUrl } from '@/lib/qr'
import { ensureInviteCodes } from '@/lib/invite'
import SettingsClient from './SettingsClient'
import QRSection from './QRSection'
import GuestQRSection from './GuestQRSection'
import InviteCodesSection from './InviteCodesSection'

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

  const [{ data: profile }, { data: signalRow }, memberToken, guestQR, { data: optinRow }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        `username, first_name, last_name, avatar_url, what_i_do, building_now,
         who_i_want_to_meet, where_i_operate, fun_fact, profile_mode, founding_member`
      )
      .eq('id', user.id)
      .single(),
    supabase.from('signals').select('open_to, working_on, need_right_now').eq('user_id', user.id).single(),
    getOrCreateMemberQR(user.id),
    getOrCreateGuestQR(user.id),
    admin.from('open_table_optins').select('id').eq('user_id', user.id).eq('period', period).maybeSingle(),
  ])

  // Auto-generate invite codes for founding members who don't have them yet
  if (profile?.founding_member) {
    await ensureInviteCodes(user.id)
  }

  const { data: rawCodes } = await admin
    .from('invite_codes')
    .select('id, token, used_by, used_at')
    .eq('owner_id', user.id)
    .eq('type', 'founding_invite')
    .order('created_at')

  // Resolve names for used codes
  const usedByIds = (rawCodes ?? []).map(c => c.used_by).filter(Boolean) as string[]
  const { data: usedByProfiles } = usedByIds.length > 0
    ? await admin.from('profiles').select('id, first_name, last_name').in('id', usedByIds)
    : { data: [] as { id: string; first_name: string | null; last_name: string | null }[] }

  const nameById = Object.fromEntries(
    (usedByProfiles ?? []).map(p => [
      p.id,
      [p.first_name, p.last_name].filter(Boolean).join(' ') || 'A member',
    ]),
  )

  const inviteCodes = (rawCodes ?? []).map(c => ({
    id: c.id,
    token: c.token,
    used_at: c.used_at,
    usedByName: c.used_by ? (nameById[c.used_by] ?? null) : null,
  }))

  return (
    <>
      <SettingsClient
        userId={user.id}
        profile={profile ?? {}}
        signals={signalRow ?? null}
        openTableOptedIn={!!optinRow}
        openTablePeriod={period}
      />
      {memberToken && <QRSection url={qrUrl(memberToken)} />}
      {guestQR && (
        <GuestQRSection
          initialToken={guestQR.token}
          initialExpiresAt={guestQR.expiresAt}
        />
      )}
      {profile?.founding_member && inviteCodes.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-10">
          <InviteCodesSection codes={inviteCodes} />
        </div>
      )}
    </>
  )
}
