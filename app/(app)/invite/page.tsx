import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureInviteCodes } from '@/lib/invite'
import InviteClient from './InviteClient'

export default async function InvitePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, founding_member')
    .eq('id', user.id)
    .single()

  if (profile?.founding_member) {
    await ensureInviteCodes(user.id)
  }

  const { data: rawCodes } = await admin
    .from('invite_codes')
    .select('id, token, used_by, used_at')
    .eq('owner_id', user.id)
    .eq('type', 'founding_invite')
    .order('created_at')

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

  const codes = (rawCodes ?? []).map(c => ({
    id:         c.id as string,
    token:      c.token as string,
    used_at:    c.used_at as string | null,
    usedByName: c.used_by ? (nameById[c.used_by as string] ?? null) : null,
  }))

  const availableCount = codes.filter(c => !c.used_at).length
  const redeemedCount  = codes.filter(c => c.used_at).length

  return (
    <InviteClient
      codes={codes}
      availableCount={availableCount}
      redeemedCount={redeemedCount}
      memberFirstName={profile?.first_name ?? 'A ROSTA member'}
    />
  )
}
