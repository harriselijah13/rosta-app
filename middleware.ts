import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const MARKETING_SITE = 'https://onrosta.com'

// (app)-group routes redirected externally to the marketing site.
// Excluded intentionally:
//   /verify*   — verification purchase flow stays live here
//   /profile   — QR codes and native app universal links use app.onrosta.com/profile/[id]
//   /qr exact  — handled separately below (public profile landing, not the user QR display)
const GATED_APP_PREFIXES = [
  '/dashboard', '/activity', '/connect', '/connections', '/intro', '/invite',
  '/members', '/messages', '/network', '/notifications', '/open-tables',
  '/scan', '/score', '/settings',
]

function isGatedAppRoute(pathname: string): boolean {
  if (GATED_APP_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return true
  // /qr (exact) is the user's own QR display page — gate it.
  // /qr/[handle] is the public profile landing page — leave it alone.
  if (pathname === '/qr') return true
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Root "/" redirects to the marketing site — it's the canonical home for ROSTA.
  if (pathname === '/') {
    return NextResponse.redirect(MARKETING_SITE)
  }

  // Gate all app routes (except /verify*, /profile/*) externally to the
  // marketing site before any auth check or page render runs.
  if (isGatedAppRoute(pathname)) {
    return NextResponse.redirect(MARKETING_SITE)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // /dashboard removed from isProtected — caught by isGatedAppRoute above.
  const isProtected =
    pathname.startsWith('/onboarding') || pathname.startsWith('/admin')
  const isAuthPage = pathname === '/login' || pathname === '/signup'

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Logged-in users on auth pages go to the marketing site directly.
  if (isAuthPage && user) {
    return NextResponse.redirect(MARKETING_SITE)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
