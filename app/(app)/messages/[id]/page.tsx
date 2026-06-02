import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MessageThread from './MessageThread'

export default async function ThreadPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: conv } = await admin
    .from('conversations')
    .select('id, user_a, user_b')
    .eq('id', params.id)
    .single()

  if (!conv || (conv.user_a !== user.id && conv.user_b !== user.id)) {
    redirect('/messages')
  }

  const otherId = conv.user_a === user.id ? conv.user_b : conv.user_a

  const [{ data: otherProfile }, { data: messages }, { data: outcome }, introRow] =
    await Promise.all([
      admin
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, username')
        .eq('id', otherId)
        .single(),
      admin
        .from('messages')
        .select('id, conversation_id, sender_id, body, read_at, created_at')
        .eq('conversation_id', params.id)
        .order('created_at', { ascending: true })
        .limit(50),
      admin
        .from('outcomes')
        .select('id')
        .eq('conversation_id', params.id)
        .maybeSingle(),
      // Find warm intro for this connection (for thank-you mechanic)
      admin
        .from('intro_requests')
        .select('id, facilitator_id, thank_you_at')
        .eq('type', 'warm_intro')
        .eq('status', 'accepted')
        .or(
          `and(requester_id.eq.${user.id},target_id.eq.${otherId}),and(requester_id.eq.${otherId},target_id.eq.${user.id})`,
        )
        .maybeSingle(),
    ])

  // Mark all unread messages in this thread as read
  await admin
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', params.id)
    .neq('sender_id', user.id)
    .is('read_at', null)

  return (
    <MessageThread
      conversationId={params.id}
      currentUserId={user.id}
      otherProfile={
        otherProfile ?? {
          id: otherId,
          first_name: null,
          last_name: null,
          avatar_url: null,
          username: null,
        }
      }
      initialMessages={messages ?? []}
      hasOutcome={!!outcome}
      introRequestId={introRow.data?.id ?? null}
      facilitatorId={introRow.data?.facilitator_id ?? null}
      thankYouSent={!!introRow.data?.thank_you_at}
    />
  )
}
