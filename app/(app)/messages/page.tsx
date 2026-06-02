import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import InboxList, { type ConversationRow } from './InboxList'

export default async function MessagesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: convs } = await admin
    .from('conversations')
    .select('id, user_a, user_b, last_message_at')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (!convs?.length) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="font-display text-3xl font-bold text-navy mb-4">Messages</h1>
        <p className="text-body-grey text-sm">No conversations yet.</p>
        <p className="text-body-grey text-sm mt-1">
          Messages appear here once you&apos;re connected with someone.
        </p>
      </div>
    )
  }

  const otherIds = convs.map(c => (c.user_a === user.id ? c.user_b : c.user_a))

  const [{ data: profiles }, messageRows] = await Promise.all([
    admin
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, username')
      .in('id', otherIds),
    Promise.all(
      convs.map(async c => {
        const [{ data: last }, { count: unread }] = await Promise.all([
          admin
            .from('messages')
            .select('id, body, created_at, sender_id')
            .eq('conversation_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          admin
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', c.id)
            .is('read_at', null)
            .neq('sender_id', user.id),
        ])
        return { convId: c.id, lastMessage: last, unreadCount: unread ?? 0 }
      }),
    ),
  ])

  const profileById = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const msgData = Object.fromEntries(messageRows.map(r => [r.convId, r]))

  const rows: ConversationRow[] = convs.map(c => {
    const otherId = c.user_a === user.id ? c.user_b : c.user_a
    const data = msgData[c.id]
    return {
      id: c.id,
      otherUser: profileById[otherId] ?? {
        id: otherId,
        first_name: null,
        last_name: null,
        avatar_url: null,
        username: null,
      },
      lastMessage: data?.lastMessage ?? null,
      unreadCount: data?.unreadCount ?? 0,
    }
  })

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-3xl font-bold text-navy mb-6">Messages</h1>
      <InboxList rows={rows} currentUserId={user.id} />
    </div>
  )
}
