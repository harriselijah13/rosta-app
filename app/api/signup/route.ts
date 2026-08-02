import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  // ── Step 1: parse body ──────────────────────────────────────────────────
  let body: { email?: string; password?: string; ref?: string; invite_code?: string } = {}
  try {
    body = await request.json()
  } catch {
    console.error('[signup] Failed to parse request body')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { email, password, ref, invite_code } = body
  console.log('[signup] Request received', { email, hasPassword: !!password, hasRef: !!ref, hasInviteCode: !!invite_code })

  if (!email || !password) {
    console.error('[signup] Missing email or password')
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  // ── Rate limit by IP: 5 attempts per IP per hour ────────────────────────
  const ip    = request.headers.get('x-forwarded-for') ?? request.ip ?? 'unknown'
  const admin = createAdminClient()
  const { data: signupAllowed } = await admin.rpc('check_signup_rate_limit', {
    _ip: ip, _max_attempts: 5, _window_minutes: 60,
  })
  if (!signupAllowed) {
    return NextResponse.json({ error: 'Too many signup attempts. Try again later.' }, { status: 429 })
  }

  // ── Step 2: call supabase.auth.signUp ───────────────────────────────────
  // If a ref (referrer user_id) was captured from ?ref= on the landing page,
  // store it in user metadata. A database trigger on profiles inserts the
  // referral row once the profile is created.
  console.log('[signup] Calling supabase.auth.signUp...')
  const supabase = createClient()

  const metadata: Record<string, string> = {}
  if (ref)         metadata.ref         = ref
  if (invite_code) metadata.invite_code = invite_code.trim().toUpperCase()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'https://app.onrosta.com/auth/callback',
      data: Object.keys(metadata).length > 0 ? metadata : undefined,
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
