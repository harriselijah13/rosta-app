'use server'

import { createClient } from '@/lib/supabase/server'
import {
  getNotifications,
  deleteNotification,
  deleteAllNotifications,
  type AppNotification,
} from '@/lib/notifications'

export async function loadMoreNotificationsAction(
  before: string,
): Promise<AppNotification[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  return getNotifications(user.id, { limit: 20, before })
}

export async function deleteNotificationAction(
  notificationId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  return deleteNotification(user.id, notificationId)
}

export async function deleteAllNotificationsAction(): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  return deleteAllNotifications(user.id)
}
