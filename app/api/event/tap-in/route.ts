import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('event_attendances')
    .insert({ user_id: user.id })
    .select('id')
    .single()

  if (error) {
    console.error('[event/tap-in] insert failed', error)
    return NextResponse.json({ error: 'Failed to record attendance' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id })
}
