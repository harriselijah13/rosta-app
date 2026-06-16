import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled (boolean) required' }, { status: 400 })
  }

  const { enabled } = body
  const admin = createAdminClient()

  const { data: signal } = await admin
    .from('signals')
    .select('open_to')
    .eq('user_id', user.id)
    .maybeSingle()

  const current: string[] = signal?.open_to ?? []
  const newOpenTo = enabled
    ? current.includes('open_door') ? current : [...current, 'open_door']
    : current.filter(v => v !== 'open_door')

  const { error } = await admin
    .from('signals')
    .upsert({ user_id: user.id, open_to: newOpenTo }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
