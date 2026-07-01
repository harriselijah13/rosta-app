import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminNav from './AdminNav'

export const metadata = { title: 'Admin — ROSTA' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: profile }, { count: pendingInviteCount }] = await Promise.all([
    admin.from('profiles').select('is_admin').eq('id', user.id).single(),
    admin
      .from('invite_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  if (!profile?.is_admin) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-warm-white flex flex-col md:flex-row">
      <AdminNav pendingInviteRequestCount={pendingInviteCount ?? 0} />
      <main className="flex-1 min-w-0 px-4 sm:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
