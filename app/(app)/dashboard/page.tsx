import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('id', user.id)
    .single()

  const name = profile?.first_name ?? 'there'

  return (
    <main className="flex flex-col items-center justify-center min-h-[calc(100vh-65px)] px-6">
      <div className="text-center max-w-lg">
        <p className="text-lime text-xs font-medium tracking-widest uppercase mb-4">
          Dashboard
        </p>
        <h1 className="font-display text-6xl font-bold text-navy mb-4">
          Welcome, {name}.
        </h1>
        <p className="text-body-grey text-lg mb-10">
          Your ROSTA profile is live.
        </p>
        <div className="flex items-center gap-4 justify-center">
          <Link
            href="/members"
            className="bg-navy text-warm-white px-6 py-3 rounded-full text-sm font-medium hover:bg-navy/90 transition-colors"
          >
            Browse members
          </Link>
          <Link
            href={`/profile/${user.id}`}
            className="border border-navy text-navy px-6 py-3 rounded-full text-sm font-medium hover:bg-navy/5 transition-colors"
          >
            View my profile
          </Link>
        </div>
      </div>
    </main>
  )
}
