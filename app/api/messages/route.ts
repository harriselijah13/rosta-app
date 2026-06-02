import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { conversationId, body: text } = body ?? {}

  if (!conversationId || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'conversationId and body required' }, { status: 400 })
  }
  if (text.trim().length > 2000) {
    return NextResponse.json({ error: 'Message too long (max 2000 chars)' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: conv } = await admin
    .from('conversations')
    .select('id, user_a, user_b')
    .eq('id', conversationId)
    .single()

  if (!conv || (conv.user_a !== user.id && conv.user_b !== user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const now = new Date().toISOString()

  const [{ data: message, error: msgErr }] = await Promise.all([
    admin.from('messages')
      .insert({ conversation_id: conversationId, sender_id: user.id, body: text.trim() })
      .select('id, conversation_id, sender_id, body, read_at, created_at')
      .single(),
    admin.from('conversations')
      .update({ last_message_at: now })
      .eq('id', conversationId),
  ])

  if (msgErr || !message) {
    console.error('[messages/send]', msgErr)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }

  return NextResponse.json(message)
}
