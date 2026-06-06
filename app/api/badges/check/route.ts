import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAndAwardBadges } from '@/lib/badges'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await checkAndAwardBadges(user.id)
  return NextResponse.json({ ok: true })
}
