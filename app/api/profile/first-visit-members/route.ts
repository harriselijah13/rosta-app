import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('profiles')
    .update({ first_visit_members_at: new Date().toISOString() })
    .eq('id', user.id)
    .is('first_visit_members_at', null)

  return NextResponse.json({ ok: true })
}
