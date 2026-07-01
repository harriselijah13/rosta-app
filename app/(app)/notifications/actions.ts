'use server'

import { createClient } from '@/lib/supabase/server'
import { getNotifications, type AppNotification } from '@/lib/notifications'

export async function loadMoreNotificationsAction(
  before: string,
): Promise<AppNotification[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  return getNotifications(user.id, { limit: 20, before })
}
