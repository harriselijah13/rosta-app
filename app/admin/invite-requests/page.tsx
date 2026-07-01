import { createAdminClient } from '@/lib/supabase/admin'
import InviteRequestsClient, { type InviteRequest } from './InviteRequestsClient'

export const dynamic = 'force-dynamic'

function displayName(p: { first_name: string | null } | null | undefined): string {
  return p?.first_name ?? 'Admin'
}

export default async function InviteRequestsPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const rawTab = searchParams.tab
  const tab: 'pending' | 'approved' | 'declined' =
    rawTab === 'approved' || rawTab === 'declined' ? rawTab : 'pending'

  const admin = createAdminClient()

  const [{ data: rows, error }, { count: pendingCount }] = await Promise.all([
    admin
      .from('invite_requests')
      .select('*')
      .eq('status', tab)
      .order('created_at', { ascending: false }),
    admin
      .from('invite_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  if (error) {
    console.error('[InviteRequestsPage]', error)
  }

  const data = rows ?? []

  // Collect IDs we need to join (deduplicated without Set spread)
  const rawAdminIds = [
    ...data.filter(r => r.approved_by).map((r: Record<string, string>) => r.approved_by as string),
    ...data.filter(r => r.declined_by).map((r: Record<string, string>) => r.declined_by as string),
  ]
  const adminIds = rawAdminIds.filter((id, i) => rawAdminIds.indexOf(id) === i)

  const codeIds = data
    .filter(r => r.invite_code_id)
    .map((r: Record<string, string>) => r.invite_code_id as string)

  const [profilesResult, codesResult] = await Promise.all([
    adminIds.length > 0
      ? admin.from('profiles').select('id, first_name').in('id', adminIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string | null }[] }),
    codeIds.length > 0
      ? admin.from('invite_codes').select('id, token, used_at').in('id', codeIds)
      : Promise.resolve({ data: [] as { id: string; token: string; used_at: string | null }[] }),
  ])

  const profileById = Object.fromEntries(
    (profilesResult.data ?? []).map(p => [p.id, p]),
  )
  const codeById = Object.fromEntries(
    (codesResult.data ?? []).map(c => [c.id, c]),
  )

  const requests: InviteRequest[] = data.map(r => ({
    id:               r.id,
    full_name:        r.full_name,
    email:            r.email,
    url:              r.url ?? null,
    what_building:    r.what_building,
    city:             r.city ?? null,
    knows_member:     r.knows_member ?? null,
    member_name:      r.member_name ?? null,
    status:           r.status,
    created_at:       r.created_at,
    approved_at:      r.approved_at ?? null,
    declined_at:      r.declined_at ?? null,
    invite_code_token:   r.invite_code_id ? (codeById[r.invite_code_id]?.token ?? null) : null,
    invite_code_used_at: r.invite_code_id ? (codeById[r.invite_code_id]?.used_at ?? null) : null,
    approved_by_name:  r.approved_by  ? displayName(profileById[r.approved_by])  : null,
    declined_by_name:  r.declined_by  ? displayName(profileById[r.declined_by])  : null,
  }))

  return (
    <InviteRequestsClient
      requests={requests}
      tab={tab}
      pendingCount={pendingCount ?? 0}
    />
  )
}
