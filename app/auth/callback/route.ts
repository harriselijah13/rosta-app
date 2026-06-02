import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code      = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type      = searchParams.get('type') ?? ''
  const next      = searchParams.get('next') ?? '/onboarding'

  const supabase = createClient()

  // PKCE flow — code exchanged for session (Supabase-native links, e.g. OAuth)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // OTP flow — token_hash from our custom email hook (signup, recovery, email change)
  if (tokenHash && type) {
    // Supabase verifyOtp uses 'email_change' for both current and new address steps
    const otpType = (type === 'email_change_current' || type === 'email_change_new')
      ? 'email_change'
      : type as 'signup' | 'recovery' | 'magiclink' | 'invite' | 'email'

    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType })

    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password/update`)
      }
      return NextResponse.redirect(`${origin}/onboarding`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
