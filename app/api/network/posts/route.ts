/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const EXPIRY_DAYS = { ask: 7, offer: 14 }

function stripUrls(text: string): string {
  return text.replace(/https?:\/\/\S+/gi, '').replace(/\s{2,}/g, ' ').trim()
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { post_type, field_1, field_2, field_3 } = body ?? {}

  if (!['ask', 'offer'].includes(post_type)) {
    return NextResponse.json({ error: 'post_type must be ask or offer' }, { status: 400 })
  }
  if (!field_1?.trim() || !field_2?.trim() || !field_3?.trim()) {
    return NextResponse.json({ error: 'All three fields are required' }, { status: 400 })
  }

  const f1 = stripUrls(field_1.trim()).slice(0, 80)
  const f2 = stripUrls(field_2.trim()).slice(0, 240)
  const f3 = stripUrls(field_3.trim()).slice(0, post_type === 'ask' ? 140 : 80)

  if (!f1 || !f2 || !f3) {
    return NextResponse.json({ error: 'Fields cannot be empty after URL stripping' }, { status: 400 })
  }

  const expiresAt = new Date(Date.now() + EXPIRY_DAYS[post_type as 'ask' | 'offer'] * 86_400_000).toISOString()

  const admin = createAdminClient()
  const { data: post, error } = await (admin as any)
    .from('network_posts')
    .insert({
      author_id:  user.id,
      post_type,
      field_1: f1,
      field_2: f2,
      field_3: f3,
      expires_at: expiresAt,
    })
    .select('id, author_id, post_type, field_1, field_2, field_3, created_at, expires_at')
    .single()

  if (error) {
    console.error('[network/posts] insert error', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }

  return NextResponse.json(post, { status: 201 })
}
