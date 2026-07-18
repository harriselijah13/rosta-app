import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  // ── Step 1: parse body ──────────────────────────────────────────────────
  let body: { email?: string; password?: string; inviteCode?: string } = {}
  try {
    body = await request.json()
  } catch {
    console.error('[signup] Failed to parse request body')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { email, password, inviteCode } = body
  console.log('[signup] Request received', { email, hasPassword: !!password, hasInviteCode: !!inviteCode })

  if (!email || !password) {
    console.error('[signup] Missing email or password')
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  // ── Step 1b: invite code — optional referral, validated only if provided ──
  if (inviteCode) {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    const { data: code } = await admin
      .from('invite_codes')
      .select('id')
      .eq('token', (inviteCode as string).trim().toUpperCase())
      .eq('type', 'founding_invite')
      .is('used_at', null)
      .maybeSingle()
    if (!code) {
      return NextResponse.json({ error: 'Invalid or already-used invite code' }, { status: 400 })
    }
  }

  // ── Step 2: call supabase.auth.signUp ───────────────────────────────────
  console.log('[signup] Calling supabase.auth.signUp...')
  const supabase = createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'https://app.onrosta.com/auth/callback',
      data: inviteCode ? { invite_code: inviteCode } : undefined,
    },
  })

  // ── Step 3: log full Supabase response ──────────────────────────────────
  if (error) {
    console.error('[signup] supabase.auth.signUp ERROR', {
      message: error.message,
      status:  error.status,
      name:    error.name,
    })
    return NextResponse.json({ error: error.message }, { status: error.status ?? 400 })
  }

  const user = data.user
  console.log('[signup] supabase.auth.signUp SUCCESS', {
    userId:               user?.id,
    email:                user?.email,
    identitiesCount:      user?.identities?.length ?? 'unknown',
    alreadyConfirmed:     !!user?.email_confirmed_at,
    confirmationSentAt:   user?.confirmation_sent_at ?? 'not set',
    // identities === [] means address is already registered — Supabase returns
    // a fake success to prevent enumeration, but does NOT trigger the email hook
    userAlreadyExists:    (user?.identities?.length ?? 1) === 0,
  })

  if ((user?.identities?.length ?? 1) === 0) {
    console.warn('[signup] User already exists — hook will NOT fire, no email will be sent')
  }

  return NextResponse.json({ success: true })
}
