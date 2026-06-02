import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code      = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type      = searchParams.get('type') ?? ''
  const next      = searchParams.get('next') ?? '/onboarding'

  console.log('[callback] Request received', {
    hasCode:      !!code,
    hasTokenHash: !!tokenHash,
    type,
    next,
    origin,
  })

  const supabase = createClient()

  // PKCE flow — code exchanged for session (Supabase-native links, e.g. OAuth)
  if (code) {
    console.log('[callback] Trying PKCE code exchange...')
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[callback] PKCE exchange failed', { message: error.message })
    } else {
      console.log('[callback] PKCE exchange success, redirecting to', next)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // OTP flow — token_hash from our custom email hook (signup, recovery, email change)
  if (tokenHash && type) {
    const otpType = (type === 'email_change_current' || type === 'email_change_new')
      ? 'email_change'
      : type as 'signup' | 'recovery' | 'magiclink' | 'invite' | 'email'

    console.log('[callback] Trying OTP verifyOtp...', { otpType, tokenHashPrefix: tokenHash.slice(0, 8) })
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType })

    if (error) {
      console.error('[callback] verifyOtp failed', { message: error.message, status: error.status })
    } else {
      const dest = type === 'recovery' ? '/reset-password/update' : '/onboarding'
      console.log('[callback] verifyOtp success, redirecting to', dest)
      return NextResponse.redirect(`${origin}${dest}`)
    }
  }

  console.error('[callback] All auth paths failed — no code, no token_hash, or verification error')
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
