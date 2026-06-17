import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { adminId: null, status: 401 as const }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { adminId: null, status: 403 as const }
  return { adminId: user.id, status: 200 as const }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { adminId, status } = await requireAdmin()
  if (!adminId) {
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
  }

  const body = await request.json().catch(() => null)
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled (boolean) required' }, { status: 400 })
  }

  const { enabled } = body
  const targetUserId = params.id
  const admin = createAdminClient()

  const { data: signal } = await admin
    .from('signals')
    .select('open_to')
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (!signal) {
    return NextResponse.json(
      { error: 'Member has no signals row — onboarding incomplete' },
      { status: 404 },
    )
  }

  const current: string[] = signal.open_to ?? []
  const newOpenTo = enabled
    ? (current.includes('open_door') ? current : [...current, 'open_door'])
    : current.filter(v => v !== 'open_door')

  // Idempotent — if already in desired state, skip the write
  const alreadyCorrect = enabled ? current.includes('open_door') : !current.includes('open_door')
  if (!alreadyCorrect) {
    const { error: updateErr } = await admin
      .from('signals')
      .update({ open_to: newOpenTo })
      .eq('user_id', targetUserId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
  }

  // Audit — best-effort, never blocks the response
  void admin.from('admin_audit_log').insert({
    admin_user_id:  adminId,
    action:         enabled ? 'open_door_enabled' : 'open_door_disabled',
    target_user_id: targetUserId,
    details:        { enabled, changed: !alreadyCorrect },
  }).then(({ error }) => { if (error) console.error('[audit]', error.message) })

  return NextResponse.json({ ok: true, changed: !alreadyCorrect })
}
