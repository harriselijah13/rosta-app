import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { cardId, email, name, company, role, phone, met_at } = body ?? {}

  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email required to find member' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── Look up whether the email belongs to a ROSTA member ──────────────────
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 })
  const match = users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase())

  if (!match) {
    return NextResponse.json({ found: false })
  }

  if (match.id === user.id) {
    return NextResponse.json({ error: 'That is your own email address' }, { status: 400 })
  }

  // ── Check if already connected ────────────────────────────────────────────
  const [ua, ub] = [user.id, match.id].sort()
  const { data: existing } = await admin.from('connections')
    .select('id').eq('user_a', ua).eq('user_b', ub).maybeSingle()

  if (existing) {
    // Already connected — just save the card
    await saveCard(admin, user.id, cardId, { name, email, company, role, phone, met_at }, 'connected')
    const { data: profile } = await admin.from('profiles')
      .select('first_name, last_name, username').eq('id', match.id).single()
    const memberName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'This member'
    const memberSlug = profile?.username ?? match.id
    return NextResponse.json({ found: true, already_connected: true, memberName, memberSlug })
  }

  // ── Create connection (origin: scanned_card — IRL meeting) ────────────────
  const { error: connErr } = await admin.from('connections').insert({
    user_a: ua, user_b: ub, origin: 'scanned_card',
  })
  if (connErr && connErr.code !== '23505') {
    console.error('[scan-card/connect] connection insert failed', connErr)
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }

  // Create conversation
  await admin.from('conversations').upsert(
    { user_a: ua, user_b: ub },
    { onConflict: 'user_a,user_b', ignoreDuplicates: true },
  )

  // Fetch profile for response
  const { data: profile } = await admin.from('profiles')
    .select('first_name, last_name, username').eq('id', match.id).single()
  const memberName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'This member'
  const memberSlug = profile?.username ?? match.id

  // Save/update the card
  await saveCard(admin, user.id, cardId, { name, email, company, role, phone, met_at }, 'connected')

  // Award badges to both parties
  const { checkAndAwardBadges } = await import('@/lib/badges')
  await Promise.all([checkAndAwardBadges(user.id), checkAndAwardBadges(match.id)])

  return NextResponse.json({ found: true, connected: true, memberName, memberSlug })
}

async function saveCard(
  admin: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>,
  userId: string,
  cardId: string | undefined,
  data: { name?: string; email?: string; company?: string; role?: string; phone?: string; met_at?: string },
  action: 'connected' | 'invited' | 'pending',
) {
  if (cardId) {
    await admin.from('scanned_cards').update({ action_taken: action })
      .eq('id', cardId).eq('user_id', userId)
  } else {
    await admin.from('scanned_cards').insert({
      user_id: userId,
      name:    data.name?.trim()    || null,
      email:   data.email?.trim()   || null,
      company: data.company?.trim() || null,
      role:    data.role?.trim()    || null,
      phone:   data.phone?.trim()   || null,
      met_at:  data.met_at?.trim()  || null,
      action_taken: action,
    })
  }
}
