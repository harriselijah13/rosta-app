/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { reaction_type, action, note } = body ?? {}

  if (!['can_help', 'know_someone', 'noted'].includes(reaction_type)) {
    return NextResponse.json({ error: 'Invalid reaction_type' }, { status: 400 })
  }
  if (!['add', 'remove', 'note'].includes(action)) {
    return NextResponse.json({ error: 'action must be add, remove, or note' }, { status: 400 })
  }

  const admin = createAdminClient()
  const postId = params.id

  // Verify the post exists and the user can see it (direct connection or forwarded)
  const { data: post } = await (admin as any)
    .from('network_posts')
    .select('id, author_id, post_type, field_1')
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (post.author_id === user.id) return NextResponse.json({ error: 'Cannot react to your own post' }, { status: 400 })

  if (action === 'note') {
    if (reaction_type === 'noted') {
      return NextResponse.json({ error: 'Notes not allowed on noted reactions' }, { status: 400 })
    }
    const noteStr = typeof note === 'string' ? note.trim() : ''
    if (!noteStr) return NextResponse.json({ error: 'note is required' }, { status: 400 })
    if (noteStr.length > 240) return NextResponse.json({ error: 'note too long' }, { status: 400 })

    const { error: updateErr } = await (admin as any)
      .from('network_post_reactions')
      .update({ note: noteStr })
      .eq('post_id', postId)
      .eq('reactor_id', user.id)
      .eq('reaction_type', reaction_type)

    if (updateErr) {
      console.error('[network/react] note update error', updateErr)
      return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
    }

    // Patch the matching notification payload with the note
    const notifType = `reaction_${reaction_type}` as 'reaction_can_help' | 'reaction_know_someone'
    try {
      const { data: notifRow } = await (admin as any)
        .from('notifications')
        .select('id, payload')
        .eq('user_id', post.author_id)
        .eq('type', notifType)
        .filter('payload', 'cs', JSON.stringify({ post_id: postId, reactor_id: user.id }))
        .maybeSingle()

      if (notifRow) {
        await (admin as any)
          .from('notifications')
          .update({ payload: { ...notifRow.payload, note: noteStr } })
          .eq('id', notifRow.id)
      }
    } catch (err) {
      console.error('[network/react] note notification patch error', err)
    }

    return NextResponse.json({ ok: true })
  }

  if (action === 'add') {
    const { error } = await (admin as any)
      .from('network_post_reactions')
      .insert({ post_id: postId, reactor_id: user.id, reaction_type })

    if (error && error.code !== '23505') { // ignore unique constraint violations
      console.error('[network/react] insert error', error)
      return NextResponse.json({ error: 'Failed to add reaction' }, { status: 500 })
    }

    // Notify post author on new can_help / know_someone reactions (not noted — silent by design)
    if (!error && (reaction_type === 'can_help' || reaction_type === 'know_someone')) {
      try {
        const notifType = `reaction_${reaction_type}` as 'reaction_can_help' | 'reaction_know_someone'
        const [{ data: reactorProfile }, { data: existingNotif }] = await Promise.all([
          admin.from('profiles').select('first_name, last_name, avatar_url').eq('id', user.id).single(),
          (admin as any)
            .from('notifications')
            .select('id')
            .eq('user_id', post.author_id)
            .eq('type', notifType)
            .filter('payload', 'cs', JSON.stringify({ post_id: postId, reactor_id: user.id }))
            .maybeSingle(),
        ])

        if (!existingNotif) {
          const p = reactorProfile as any
          const reactorName = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'A member'
          await createNotification({
            userId: post.author_id,
            type: notifType,
            payload: {
              post_id: postId,
              post_field_1: post.field_1,
              post_type: post.post_type,
              reactor_id: user.id,
              reactor_name: reactorName,
              reactor_avatar_url: p?.avatar_url ?? null,
            },
          })
        }
      } catch (notifErr) {
        console.error('[network/react] notification error', notifErr)
      }
    }
  } else {
    await (admin as any)
      .from('network_post_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('reactor_id', user.id)
      .eq('reaction_type', reaction_type)
  }

  return NextResponse.json({ ok: true })
}
