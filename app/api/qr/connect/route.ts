import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, qrConnectedToOwnerEmail, qrConnectedToScannerEmail } from '@/lib/resend'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { token } = body ?? {}
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const admin = createAdminClient()

  // Resolve token → owner
  const { data: code } = await admin
    .from('invite_codes')
    .select('id, owner_id, type, expires_at')
    .eq('token', token)
    .single()

  if (!code || code.type !== 'member_qr') {
    return NextResponse.json({ error: 'Invalid QR code' }, { status: 404 })
  }
  // member_qr tokens don't expire, but guard anyway
  if (code.expires_at && new Date(code.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This QR code has expired' }, { status: 400 })
  }

  const ownerId = code.owner_id
  if (ownerId === user.id) {
    return NextResponse.json({ error: 'This is your own QR code' }, { status: 400 })
  }

  // Already connected?
  const [ua, ub] = [user.id, ownerId].sort()
  const { data: existing } = await admin
    .from('connections')
    .select('id')
    .eq('user_a', ua).eq('user_b', ub).is('removed_at', null)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'Already connected' }, { status: 400 })

  // Create connection
  const { error: connErr } = await admin.from('connections').insert({
    user_a: ua, user_b: ub, origin: 'qr_member',
  })
  if (connErr && connErr.code !== '23505') {
    console.error('[qr/connect] insert failed', connErr)
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }

  // Create conversation for messaging (ignored if already exists)
  await admin.from('conversations').upsert(
    { user_a: ua, user_b: ub },
    { onConflict: 'user_a,user_b', ignoreDuplicates: true },
  )

  // Fetch profiles + emails
  const [{ data: profiles }, ownerAuth, scannerAuth] = await Promise.all([
    admin.from('profiles').select('id, first_name, last_name, username').in('id', [ownerId, user.id]),
    admin.auth.admin.getUserById(ownerId),
    admin.auth.admin.getUserById(user.id),
  ])

  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const name = (id: string) =>
    [byId[id]?.first_name, byId[id]?.last_name].filter(Boolean).join(' ') || 'A member'
  const slug = (id: string) => byId[id]?.username ?? id

  const ownerName = name(ownerId)
  const scannerName = name(user.id)
  const ownerEmail = ownerAuth.data.user?.email
  const scannerEmail = scannerAuth.data.user?.email

  await Promise.all([
    ownerEmail && sendEmail(
      ownerEmail,
      `${scannerName} connected with you`,
      qrConnectedToOwnerEmail(ownerName, scannerName, slug(user.id)),
    ),
    scannerEmail && sendEmail(
      scannerEmail,
      `You're connected with ${ownerName}`,
      qrConnectedToScannerEmail(scannerName, ownerName, slug(ownerId)),
    ),
  ])

  return NextResponse.json({
    ownerName,
    ownerSlug: slug(ownerId),
    ownerAvatarUrl: byId[ownerId]?.avatar_url ?? null,
  })
}
