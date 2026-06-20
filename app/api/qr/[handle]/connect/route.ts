import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkAndAwardBadges } from '@/lib/badges'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  _request: NextRequest,
  { params }: { params: { handle: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { handle } = params
  const admin = createAdminClient()

  // Resolve handle → owner profile
  const isUuid = UUID_RE.test(handle)
  const { data: owner } = await admin
    .from('profiles')
    .select('id, first_name, last_name, username, onboarding_completed')
    .eq(isUuid ? 'id' : 'username', handle)
    .single()

  if (!owner || !owner.onboarding_completed) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (owner.id === user.id) {
    return NextResponse.json({ error: 'Cannot connect with yourself' }, { status: 400 })
  }

  const [ua, ub] = [user.id, owner.id].sort()

  // Already connected (and not removed)?
  const { data: existing } = await admin
    .from('connections')
    .select('id')
    .eq('user_a', ua)
    .eq('user_b', ub)
    .is('removed_at', null)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Already connected' }, { status: 400 })
  }

  // Create connection with qr_scan origin
  const { error: connErr } = await admin.from('connections').insert({
    user_a: ua, user_b: ub, origin: 'qr_scan',
  })
  if (connErr && connErr.code !== '23505') {
    console.error('[qr/handle/connect] insert failed', connErr)
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }

  // Create conversation
  await admin.from('conversations').upsert(
    { user_a: ua, user_b: ub },
    { onConflict: 'user_a,user_b', ignoreDuplicates: true },
  )

  // Award badges to both parties
  await Promise.all([
    checkAndAwardBadges(user.id),
    checkAndAwardBadges(owner.id),
  ])

  return NextResponse.json({
    ownerSlug: owner.username ?? owner.id,
  })
}
