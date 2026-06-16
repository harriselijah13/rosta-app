import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: conv } = await admin
    .from('conversations')
    .select('id, user_a, user_b')
    .eq('id', params.id)
    .maybeSingle()

  if (!conv) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (conv.user_a !== user.id && conv.user_b !== user.id)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const field = conv.user_a === user.id ? 'deleted_by_user_a' : 'deleted_by_user_b'

  await admin
    .from('conversations')
    .update({ [field]: true })
    .eq('id', conv.id)

  return NextResponse.json({ ok: true })
}
