import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/conversations/with/[userId]
// Finds an existing conversation with this user or creates one (requires connection),
// then redirects to /messages/[convId].
export async function GET(
  request: Request,
  { params }: { params: { userId: string } },
) {
  const origin = new URL(request.url).origin
  const fallback = `${origin}/messages`

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  const otherId = params.userId
  if (!otherId || otherId === user.id) return NextResponse.redirect(fallback)

  const admin = createAdminClient()
  const [a, b] = [user.id, otherId].sort() as [string, string]

  // Check for existing conversation first
  const { data: existing } = await admin
    .from('conversations')
    .select('id')
    .eq('user_a', a)
    .eq('user_b', b)
    .maybeSingle()

  if (existing) return NextResponse.redirect(`${origin}/messages/${existing.id}`)

  // Verify they are connected before creating a conversation
  const { data: connection } = await admin
    .from('connections')
    .select('id')
    .eq('user_a', a)
    .eq('user_b', b)
    .maybeSingle()

  if (!connection) return NextResponse.redirect(fallback)

  const { data: created } = await admin
    .from('conversations')
    .insert({ user_a: a, user_b: b })
    .select('id')
    .single()

  if (!created) return NextResponse.redirect(fallback)
  return NextResponse.redirect(`${origin}/messages/${created.id}`)
}
