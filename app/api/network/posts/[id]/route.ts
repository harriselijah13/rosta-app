/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// DELETE /api/network/posts/[id] — soft-delete own post
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: post } = await (admin as any)
    .from('network_posts')
    .select('id, author_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (post.author_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await (admin as any)
    .from('network_posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)

  return NextResponse.json({ ok: true })
}
