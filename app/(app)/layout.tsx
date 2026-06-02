import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarding_completed) redirect('/onboarding')

  return (
    <div className="min-h-screen bg-warm-white">
      <nav className="sticky top-0 z-50 bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="font-display text-xl font-bold text-navy">
            ROSTA<span className="text-lime">.</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/members"
              className="text-sm text-body-grey hover:text-navy transition-colors"
            >
              Members
            </Link>
            <Link
              href={`/profile/${user.id}`}
              className="text-sm text-body-grey hover:text-navy transition-colors"
            >
              My profile
            </Link>
            <Link
              href="/settings"
              className="text-sm font-medium border border-navy text-navy px-4 py-1.5 rounded-full hover:bg-navy hover:text-warm-white transition-colors"
            >
              Settings
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-sm text-body-grey hover:text-navy transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>
      {children}
    </div>
  )
}
