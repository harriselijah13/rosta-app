import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Open Table is temporarily hidden. The data logic, cron routes, and room pages
// are intact. To re-enable: restore the room-redirect logic and opt-in CTA below,
// and uncomment the dashboard card in app/(app)/dashboard/page.tsx.

export default async function OpenTablesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="font-display text-4xl font-bold text-navy mb-8">Open Tables</h1>
      <div className="bg-white border border-border rounded-2xl p-8">
        <h2 className="font-display text-xl font-bold text-navy mb-3">Open Tables</h2>
        <p className="text-sm text-body-grey leading-relaxed">
          Coming soon.
        </p>
      </div>
    </div>
  )
}
