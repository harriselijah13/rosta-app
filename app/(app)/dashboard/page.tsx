import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, onboarding_completed')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarding_completed) redirect('/onboarding')

  const name = profile?.first_name ?? 'there'

  return (
    <div className="min-h-screen bg-warm-white flex flex-col">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-border bg-white">
        <span className="font-display text-2xl font-bold text-navy">
          ROSTA<span className="text-lime">.</span>
        </span>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-sm text-body-grey hover:text-navy transition-colors"
          >
            Sign out
          </button>
        </form>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-lg">
          <p className="text-lime text-xs font-medium tracking-widest uppercase mb-4">
            Dashboard
          </p>
          <h1 className="font-display text-6xl font-bold text-navy mb-4">
            Welcome, {name}.
          </h1>
          <p className="text-body-grey text-lg">
            Your ROSTA profile is live. Features are on their way.
          </p>
        </div>
      </main>
    </div>
  )
}
