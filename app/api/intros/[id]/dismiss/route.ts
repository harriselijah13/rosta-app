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
  const { data: req } = await admin
    .from('intro_requests')
    .select('requester_id, target_id, status, expires_at')
    .eq('id', params.id)
    .single()

  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isExpired = req.status === 'pending' && new Date(req.expires_at) < new Date()
  if (req.status === 'pending' && !isExpired) {
    return NextResponse.json({ error: 'Cannot dismiss a pending request' }, { status: 400 })
  }

  let field: string
  if (req.requester_id === user.id) {
    field = 'dismissed_by_requester_at'
  } else if (req.target_id === user.id) {
    field = 'dismissed_by_recipient_at'
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await admin
    .from('intro_requests')
    .update({ [field]: new Date().toISOString() })
    .eq('id', params.id)

  if (error) {
    console.error('[intros/dismiss] update failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
