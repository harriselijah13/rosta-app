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

export async function POST(request: Request) {
  const { adminId, status } = await requireAdmin()
  if (!adminId) {
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
  }

  const body = await request.json().catch(() => null)
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled (boolean) required' }, { status: 400 })
  }

  const { enabled } = body
  const admin = createAdminClient()

  // Fetch all existing signals rows — members without one are excluded (no row creation)
  const { data: signals, error: fetchErr } = await admin
    .from('signals')
    .select('user_id, open_to')

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  const rows = signals ?? []
  let changed = 0

  const updates = rows.map(s => {
    const current: string[] = s.open_to ?? []
    const alreadyCorrect = enabled ? current.includes('open_door') : !current.includes('open_door')
    if (!alreadyCorrect) changed++
    const newOpenTo = enabled
      ? (current.includes('open_door') ? current : [...current, 'open_door'])
      : current.filter(v => v !== 'open_door')
    return { user_id: s.user_id, open_to: newOpenTo }
  })

  if (updates.length > 0) {
    const { error: upsertErr } = await admin
      .from('signals')
      .upsert(updates, { onConflict: 'user_id' })

    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  void admin.from('admin_audit_log').insert({
    admin_user_id:  adminId,
    action:         enabled ? 'open_door_bulk_enabled' : 'open_door_bulk_disabled',
    target_user_id: null,
    details:        { enabled, changed, total_with_signals: rows.length },
  }).then(({ error }) => { if (error) console.error('[audit]', error.message) })

  return NextResponse.json({ ok: true, changed, total: rows.length })
}
