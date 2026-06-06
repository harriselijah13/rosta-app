import { createAdminClient } from '@/lib/supabase/admin'
import MembersClient, { type AdminMember } from './MembersClient'

export const dynamic = 'force-dynamic'

export default async function MembersPage() {
  const admin = createAdminClient()

  // Fetch ALL profiles regardless of onboarding status
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, first_name, last_name, username, where_i_operate, profile_mode, founding_member, created_at, last_active_at, building_now, is_verified, onboarding_completed')
    .order('created_at', { ascending: false })

  // Fetch emails from auth (up to 1000 — fine for founding network)
  const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const emailById = Object.fromEntries(users.map(u => [u.id, u.email ?? '']))

  const members: AdminMember[] = (profiles ?? []).map(p => ({
    id:              p.id,
    email:           emailById[p.id] ?? '',
    first_name:      p.first_name,
    last_name:       p.last_name,
    username:        p.username,
    where_i_operate: p.where_i_operate,
    profile_mode:    p.profile_mode,
    founding_member: p.founding_member ?? false,
    created_at:      p.created_at,
    last_active_at:  p.last_active_at,
    is_complete:          !!(p.first_name && p.building_now),
    is_verified:          p.is_verified ?? false,
    onboarding_completed: p.onboarding_completed ?? false,
  }))

  return <MembersClient members={members} />
}
