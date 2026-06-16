import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { memberAId, memberBId } = body ?? {}
  if (!memberAId || !memberBId || memberAId === memberBId) {
    return NextResponse.json({ error: 'memberAId and memberBId required' }, { status: 400 })
  }

  // Normalise to canonical order (smaller UUID first) to match the CHECK constraint
  const [a, b] = [memberAId, memberBId].sort() as [string, string]

  const admin = createAdminClient()
  const { error } = await admin.from('matchmaker_dismissals').insert({
    user_id:     user.id,
    member_a_id: a,
    member_b_id: b,
  })

  // Ignore unique-constraint violations — idempotent dismiss is fine
  if (error && error.code !== '23505') {
    console.error('[matchmaker/dismiss] insert failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
