import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import OpenTableThread from './OpenTableThread'

export default async function OpenTablePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Verify room exists, is active, and user is a member
  const [{ data: room }, { data: membership }] = await Promise.all([
    admin
      .from('open_table_rooms')
      .select('id, prompt, expires_at, period')
      .eq('id', params.id)
      .gt('expires_at', now)
      .maybeSingle(),
    admin
      .from('open_table_members')
      .select('id')
      .eq('room_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (!room || !membership) notFound()

  // Fetch all members + their profiles, and initial messages in parallel
  const [{ data: memberRows }, { data: messages }] = await Promise.all([
    admin
      .from('open_table_members')
      .select('user_id, joined_at')
      .eq('room_id', params.id),
    admin
      .from('open_table_messages')
      .select('id, room_id, sender_id, content, created_at')
      .eq('room_id', params.id)
      .order('created_at', { ascending: true }),
  ])

  const memberIds = (memberRows ?? []).map(m => m.user_id)
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, username')
    .in('id', memberIds)

  // Update last_read_at for this member (fire-and-forget)
  admin
    .from('open_table_members')
    .update({ last_read_at: now })
    .eq('room_id', params.id)
    .eq('user_id', user.id)
    .then(() => {})

  const daysLeft = Math.max(1, Math.ceil((new Date(room.expires_at).getTime() - Date.now()) / 86400000))

  return (
    <OpenTableThread
      roomId={room.id}
      prompt={room.prompt}
      daysLeft={daysLeft}
      currentUserId={user.id}
      members={(profiles ?? []).map(p => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        avatar_url: p.avatar_url,
        username: p.username,
      }))}
      initialMessages={(messages ?? []).map(m => ({
        id: m.id,
        room_id: m.room_id,
        sender_id: m.sender_id,
        content: m.content,
        created_at: m.created_at,
      }))}
    />
  )
}
