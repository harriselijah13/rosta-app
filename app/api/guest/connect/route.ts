import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, guestWelcomeEmail, guestNotifyHostEmail } from '@/lib/resend'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const { token, name, email, whatIDo } = body ?? {}

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
  }
  if (!whatIDo?.trim()) {
    return NextResponse.json({ error: 'Tell us what you do' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Validate token
  const { data: code } = await admin
    .from('invite_codes')
    .select('id, owner_id, type, expires_at')
    .eq('token', token)
    .single()

  if (!code || code.type !== 'guest_qr') {
    return NextResponse.json({ error: 'Invalid QR code' }, { status: 404 })
  }
  if (new Date(code.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This QR code has expired' }, { status: 400 })
  }

  // Duplicate check — same email + same invite code
  const { data: duplicate } = await admin
    .from('guest_connections')
    .select('id')
    .eq('invite_code_id', code.id)
    .eq('guest_email', email.trim().toLowerCase())
    .maybeSingle()

  if (duplicate) {
    return NextResponse.json({ error: 'already_submitted' }, { status: 409 })
  }

  // Fetch host profile
  const { data: host } = await admin
    .from('profiles')
    .select('first_name, last_name, what_i_do, building_now')
    .eq('id', code.owner_id)
    .single()

  const hostName =
    [host?.first_name, host?.last_name].filter(Boolean).join(' ') || 'Your connection'

  // Insert guest_connection
  const { data: gc, error: gcErr } = await admin
    .from('guest_connections')
    .insert({
      invite_code_id: code.id,
      host_id: code.owner_id,
      guest_name: name.trim(),
      guest_email: email.trim().toLowerCase(),
      guest_what_i_do: whatIDo.trim(),
      status: 'pending',
    })
    .select('id')
    .single()

  if (gcErr || !gc) {
    console.error('[guest/connect] insert failed', gcErr)
    return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 })
  }

  // Send emails + update status
  const hostAuth = await admin.auth.admin.getUserById(code.owner_id)
  const hostEmail = hostAuth.data.user?.email

  await Promise.all([
    sendEmail(
      email.trim().toLowerCase(),
      `You connected with ${hostName}`,
      guestWelcomeEmail(name.trim(), hostName, host?.what_i_do ?? null, host?.building_now ?? null),
    ),
    hostEmail && sendEmail(
      hostEmail,
      `${name.trim()} connected with you`,
      guestNotifyHostEmail(hostName, name.trim(), email.trim().toLowerCase(), whatIDo.trim()),
    ),
  ])

  await admin
    .from('guest_connections')
    .update({ status: 'email_sent' })
    .eq('id', gc.id)

  return NextResponse.json({ ok: true })
}
