import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Fetch the connection — caller must be one of the parties
  const { data: conn } = await admin
    .from('connections')
    .select('id, user_a, user_b, removed_at')
    .eq('id', params.id)
    .single()

  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (conn.user_a !== user.id && conn.user_b !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (conn.removed_at) {
    return NextResponse.json({ error: 'Already removed' }, { status: 400 })
  }

  const otherId = conn.user_a === user.id ? conn.user_b : conn.user_a

  // Soft-delete the connection
  await admin
    .from('connections')
    .update({ removed_at: now, removed_by: user.id })
    .eq('id', params.id)

  // Cancel pending intro requests involving both parties
  await admin
    .from('intro_requests')
    .update({ status: 'cancelled', responded_at: now })
    .eq('status', 'pending')
    .or(
      [
        `and(requester_id.eq.${user.id},target_id.eq.${otherId})`,
        `and(requester_id.eq.${otherId},target_id.eq.${user.id})`,
        `and(facilitator_id.eq.${user.id},requester_id.eq.${otherId})`,
        `and(facilitator_id.eq.${user.id},target_id.eq.${otherId})`,
        `and(facilitator_id.eq.${otherId},requester_id.eq.${user.id})`,
        `and(facilitator_id.eq.${otherId},target_id.eq.${user.id})`,
      ].join(','),
    )

  return NextResponse.json({ ok: true })
}
