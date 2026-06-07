import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { cardId, name, email, company, role, phone, met_at, action_taken } = body ?? {}

  if (!met_at?.trim()) return NextResponse.json({ error: 'met_at required' }, { status: 400 })

  const admin = createAdminClient()

  // Updating an existing pending card
  if (cardId) {
    const { error } = await admin
      .from('scanned_cards')
      .update({ action_taken })
      .eq('id', cardId)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    return NextResponse.json({ ok: true, cardId })
  }

  // Creating a new card
  const { data, error } = await admin
    .from('scanned_cards')
    .insert({
      user_id: user.id,
      name:    name?.trim()    || null,
      email:   email?.trim()   || null,
      company: company?.trim() || null,
      role:    role?.trim()    || null,
      phone:   phone?.trim()   || null,
      met_at:  met_at.trim(),
      action_taken: action_taken ?? 'pending',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  return NextResponse.json({ ok: true, cardId: data.id })
}
