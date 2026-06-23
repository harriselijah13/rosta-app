import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  _request: NextRequest,
  { params }: { params: { code: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { code } = params

  const { data: row } = await admin
    .from('invite_codes')
    .select('id, owner_id, shared_at')
    .eq('token', code)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Idempotent — already marked, no-op
  if (row.shared_at) return NextResponse.json({ ok: true })

  await admin
    .from('invite_codes')
    .update({ shared_at: new Date().toISOString() })
    .eq('id', row.id)

  return NextResponse.json({ ok: true })
}
