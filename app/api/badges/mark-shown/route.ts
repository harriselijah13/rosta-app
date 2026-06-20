import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { slug } = body ?? {}
  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('member_badges')
    .update({ badge_earned_shown_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('badge_slug', slug)
    .is('badge_earned_shown_at', null)

  if (error) {
    console.error('[badges/mark-shown] update failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
