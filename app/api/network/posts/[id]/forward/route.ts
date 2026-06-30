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
  const { recipient_id } = body ?? {}
  if (!recipient_id) return NextResponse.json({ error: 'recipient_id required' }, { status: 400 })
  if (recipient_id === user.id) return NextResponse.json({ error: 'Cannot forward to yourself' }, { status: 400 })

  const admin = createAdminClient()
  const postId = params.id

  // Verify post exists and the forwarder received it directly (not via another forward)
  const { data: post } = await (admin as any)
    .from('network_posts')
    .select('id, author_id')
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (post.author_id === user.id) return NextResponse.json({ error: 'Cannot forward your own post' }, { status: 400 })

  // Check this isn't a forwarded-post being forwarded again (one hop only)
  const { data: existingForward } = await (admin as any)
    .from('network_post_forwards')
    .select('id')
    .eq('post_id', postId)
    .eq('recipient_id', user.id)
    .maybeSingle()

  if (existingForward) {
    return NextResponse.json({ error: 'Forwarded posts cannot be forwarded again' }, { status: 400 })
  }

  // Verify the recipient is a direct connection of the forwarder
  const [a, b] = [user.id, recipient_id].sort()
  const { data: connection } = await admin
    .from('connections')
    .select('id')
    .eq('user_a', a)
    .eq('user_b', b)
    .is('removed_at', null)
    .maybeSingle()

  if (!connection) return NextResponse.json({ error: 'Can only forward to direct connections' }, { status: 400 })

  const { error } = await (admin as any)
    .from('network_post_forwards')
    .insert({ post_id: postId, forwarder_id: user.id, recipient_id })

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Already forwarded to this person' }, { status: 409 })
    console.error('[network/forward] insert error', error)
    return NextResponse.json({ error: 'Failed to forward' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
