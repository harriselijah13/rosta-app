import { createAdminClient } from '@/lib/supabase/admin'
import InviteCodesClient, { type InviteCode, type MemberOption } from './InviteCodesClient'

export const dynamic = 'force-dynamic'

function displayName(p: { first_name: string | null; last_name: string | null } | null | undefined): string {
  return [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Unknown'
}

export default async function InviteCodesPage() {
  const admin = createAdminClient()

  const [{ data: rawCodes }, { data: profiles }] = await Promise.all([
    admin
      .from('invite_codes')
      .select('id, token, owner_id, created_at, used_at, used_by')
      .eq('type', 'founding_invite')
      .order('created_at', { ascending: false }),
    admin
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('onboarding_completed', true),
  ])

  const profileById = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  const codes: InviteCode[] = (rawCodes ?? []).map(c => ({
    id:           c.id,
    token:        c.token,
    owner_id:     c.owner_id,
    owner_name:   displayName(profileById[c.owner_id]),
    created_at:   c.created_at,
    used_at:      c.used_at,
    used_by_name: c.used_by ? displayName(profileById[c.used_by]) : null,
  }))

  const members: MemberOption[] = (profiles ?? [])
    .map(p => ({ id: p.id, name: displayName(p) }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return <InviteCodesClient codes={codes} members={members} />
}
