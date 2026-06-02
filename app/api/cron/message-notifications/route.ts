import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, newMessageEmail } from '@/lib/resend'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('Authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient()

  // Window: messages created between 48h and 24h ago.
  // With a daily cron each message falls in this window exactly once,
  // so notifications are sent at most once per message.
  const windowEnd = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const windowStart = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data: messages } = await admin
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .is('read_at', null)
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)
    .limit(200)

  if (!messages?.length) return NextResponse.json({ notified: 0 })

  const convIds = Array.from(new Set(messages.map(m => m.conversation_id)))
  const { data: convs } = await admin
    .from('conversations')
    .select('id, user_a, user_b')
    .in('id', convIds)

  const convById = Object.fromEntries((convs ?? []).map(c => [c.id, c]))

  // One notification per (recipient, conversation) — use earliest message as preview
  const notify = new Map<string, { conversationId: string; senderId: string; preview: string }>()

  for (const msg of messages) {
    const conv = convById[msg.conversation_id]
    if (!conv) continue
    const recipientId = conv.user_a === msg.sender_id ? conv.user_b : conv.user_a
    const key = `${recipientId}:${msg.conversation_id}`
    if (!notify.has(key)) {
      notify.set(key, {
        conversationId: msg.conversation_id,
        senderId: msg.sender_id,
        preview: msg.body.length > 80 ? msg.body.slice(0, 80) + '…' : msg.body,
      })
    }
  }

  if (!notify.size) return NextResponse.json({ notified: 0 })

  const recipientIds = Array.from(new Set(Array.from(notify.keys()).map(k => k.split(':')[0])))
  const senderIds = Array.from(new Set(Array.from(notify.values()).map(v => v.senderId)))
  const allIds = Array.from(new Set([...recipientIds, ...senderIds]))

  const [{ data: profiles }, authResults] = await Promise.all([
    admin.from('profiles').select('id, first_name, last_name, last_active_at').in('id', allIds),
    Promise.all(recipientIds.map(id => admin.auth.admin.getUserById(id))),
  ])

  const profileById = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const emailById = Object.fromEntries(
    recipientIds.map((id, i) => [id, authResults[i].data.user?.email]),
  )

  const inactive24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const name = (id: string) =>
    [profileById[id]?.first_name, profileById[id]?.last_name].filter(Boolean).join(' ') || 'A member'

  let notified = 0

  for (const [key, { conversationId, senderId, preview }] of Array.from(notify.entries())) {
    const recipientId = key.split(':')[0]
    const profile = profileById[recipientId]
    const email = emailById[recipientId]
    if (!email) continue

    // Skip if active in last 24h
    if (profile?.last_active_at && new Date(profile.last_active_at) > inactive24h) continue

    try {
      await sendEmail(
        email,
        `${name(senderId)} sent you a message`,
        newMessageEmail(name(recipientId), name(senderId), preview, conversationId),
      )
      notified++
    } catch (e) {
      console.error('[cron/message-notifications] failed for', recipientId, e)
    }
  }

  return NextResponse.json({ notified })
}
