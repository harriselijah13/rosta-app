import { createAdminClient } from '@/lib/supabase/admin'
import EventToolsClient, { type GuestCode } from './EventToolsClient'

export const dynamic = 'force-dynamic'

export default async function EventToolsPage() {
  const admin = createAdminClient()
  const now   = new Date().toISOString()

  const [{ data: codes }, { data: connections }, { data: profiles }] = await Promise.all([
    admin
      .from('invite_codes')
      .select('id, token, owner_id, label, created_at, expires_at')
      .eq('type', 'guest_qr')
      .order('created_at', { ascending: false }),
    admin
      .from('guest_connections')
      .select('id, invite_code_id, guest_name, guest_email, guest_what_i_do, created_at')
      .order('created_at', { ascending: false }),
    admin
      .from('profiles')
      .select('id, first_name, last_name'),
  ])

  const profileById = Object.fromEntries(
    (profiles ?? []).map(p => [
      p.id,
      [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
    ])
  )

  const connsByCode: Record<string, GuestCode['connections']> = {}
  for (const gc of connections ?? []) {
    if (!connsByCode[gc.invite_code_id]) connsByCode[gc.invite_code_id] = []
    connsByCode[gc.invite_code_id].push({
      id:            gc.id,
      guest_name:    gc.guest_name,
      guest_email:   gc.guest_email,
      guest_what_i_do: gc.guest_what_i_do,
      created_at:    gc.created_at,
    })
  }

  const guestCodes: GuestCode[] = (codes ?? []).map(c => ({
    id:         c.id,
    token:      c.token,
    owner_name: profileById[c.owner_id] ?? 'Unknown',
    label:      c.label,
    created_at: c.created_at,
    expires_at: c.expires_at,
    is_expired: c.expires_at < now,
    connections: connsByCode[c.id] ?? [],
  }))

  return <EventToolsClient codes={guestCodes} />
}
