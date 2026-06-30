/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { reaction_type, action } = body ?? {}

  if (!['can_help', 'know_someone', 'noted'].includes(reaction_type)) {
    return NextResponse.json({ error: 'Invalid reaction_type' }, { status: 400 })
  }
  if (!['add', 'remove'].includes(action)) {
    return NextResponse.json({ error: 'action must be add or remove' }, { status: 400 })
  }

  const admin = createAdminClient()
  const postId = params.id

  // Verify the post exists and the user can see it (direct connection or forwarded)
  const { data: post } = await (admin as any)
    .from('network_posts')
    .select('id, author_id')
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (post.author_id === user.id) return NextResponse.json({ error: 'Cannot react to your own post' }, { status: 400 })

  if (action === 'add') {
    const { error } = await (admin as any)
      .from('network_post_reactions')
      .insert({ post_id: postId, reactor_id: user.id, reaction_type })

    if (error && error.code !== '23505') { // ignore unique constraint violations
      console.error('[network/react] insert error', error)
      return NextResponse.json({ error: 'Failed to add reaction' }, { status: 500 })
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
