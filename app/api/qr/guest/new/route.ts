import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await admin
    .from('invite_codes')
    .insert({ owner_id: user.id, type: 'guest_qr', expires_at: expiresAt })
    .select('token, expires_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 })
  }

  return NextResponse.json({ token: data.token, expiresAt: data.expires_at })
}
