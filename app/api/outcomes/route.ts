import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkAndAwardBadges } from '@/lib/badges'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { conversationId } = body ?? {}
  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: conv } = await admin
    .from('conversations').select('id, user_a, user_b').eq('id', conversationId).single()

  if (!conv || (conv.user_a !== user.id && conv.user_b !== user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('outcomes')
    .insert({ conversation_id: conversationId, marked_by: user.id })
    .select('id, conversation_id, marked_by, created_at')
    .single()

  // 23505 = unique constraint — already marked, return existing
  if (error && error.code !== '23505') {
    console.error('[outcomes]', error)
    return NextResponse.json({ error: 'Failed to mark outcome' }, { status: 500 })
  }

  if (error?.code === '23505') {
    const { data: existing } = await admin
      .from('outcomes').select('id, conversation_id, marked_by, created_at')
      .eq('conversation_id', conversationId).single()
    return NextResponse.json(existing)
  }

  // Award badges to both conversation parties
  await Promise.all([
    checkAndAwardBadges(conv.user_a),
    checkAndAwardBadges(conv.user_b),
  ])

  return NextResponse.json(data)
}
