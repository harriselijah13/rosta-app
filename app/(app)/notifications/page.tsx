import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNotifications, markAllRead } from '@/lib/notifications'
import NotificationsClient from './NotificationsClient'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: { before?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Mark all as read on page open (spec: "server, on page mount")
  await markAllRead(user.id)

  const raw = await getNotifications(user.id, {
    limit: 20,
    before: searchParams.before,
  })

  const hasMore = raw.length > 20
  const notifications = hasMore ? raw.slice(0, 20) : raw
  const nextCursor = hasMore ? notifications[notifications.length - 1].created_at : undefined

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-3xl font-bold text-navy mb-8">Notifications</h1>
      <NotificationsClient
        initialNotifications={notifications}
        initialHasMore={hasMore}
        initialNextCursor={nextCursor}
      />
    </div>
  )
}
