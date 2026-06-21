import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { attendanceId } = body ?? {}
  if (!attendanceId) return NextResponse.json({ error: 'Missing attendanceId' }, { status: 400 })

  const admin = createAdminClient()
  await admin
    .from('event_attendances')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', attendanceId)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
