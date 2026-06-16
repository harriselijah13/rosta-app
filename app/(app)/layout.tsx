import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MobileNav from './MobileNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, username')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarding_completed) redirect('/onboarding')

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const [{ count: pendingFacilitator }, { count: pendingOpenDoor }, { data: userConvs }] =
    await Promise.all([
      admin.from('intro_requests')
        .select('id', { count: 'exact', head: true })
        .eq('facilitator_id', user.id).eq('status', 'pending').gt('expires_at', now),
      admin.from('intro_requests')
        .select('id', { count: 'exact', head: true })
        .eq('target_id', user.id).eq('type', 'open_door').eq('status', 'pending').gt('expires_at', now),
      admin.from('conversations').select('id').or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
    ])

  const pendingIntros = (pendingFacilitator ?? 0) + (pendingOpenDoor ?? 0)
  const convIds = (userConvs ?? []).map(c => c.id)

  let unreadMessages = 0
  const activityUpdate = admin.from('profiles').update({ last_active_at: now }).eq('id', user.id)
  if (convIds.length > 0) {
    const [, { count }] = await Promise.all([
      activityUpdate,
      admin.from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .is('read_at', null)
        .neq('sender_id', user.id),
    ])
    unreadMessages = count ?? 0
  } else {
    await activityUpdate
  }

  return (
    <div className="min-h-screen bg-warm-white flex flex-col">
      <MobileNav
        profileSlug={profile.username ?? user.id}
        pendingIntros={pendingIntros}
        unreadMessages={unreadMessages}
      />
      <div className="flex-1">{children}</div>
      <footer className="py-8 px-6 border-t border-border mt-12 text-center">
        <p className="text-xs text-body-grey flex items-center justify-center gap-2 flex-wrap">
          <Link href="/help" className="hover:text-navy transition-colors">How it works</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-navy transition-colors">Privacy Policy</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-navy transition-colors">Terms</Link>
          <span>·</span>
          <Link href="/cookies" className="hover:text-navy transition-colors">Cookies</Link>
        </p>
      </footer>
    </div>
  )
}
