/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from './supabase/admin'

// ── Payload shapes ────────────────────────────────────────────────────────────

export type ReactionCanHelpPayload = {
  post_id: string
  post_field_1: string
  post_type: 'ask' | 'offer'
  reactor_id: string
  reactor_name: string
  reactor_avatar_url: string | null
  note?: string
}

export type ReactionKnowSomeonePayload = {
  post_id: string
  post_field_1: string
  post_type: 'ask' | 'offer'
  reactor_id: string
  reactor_name: string
  reactor_avatar_url: string | null
  note?: string
}

export type PostForwardedPayload = {
  post_id: string
  post_field_1: string
  post_type: 'ask' | 'offer'
  // Deliberately no forwarder_id or forwarder_name — forwards are count-only
}

export type NotificationType =
  | 'reaction_can_help'
  | 'reaction_know_someone'
  | 'post_forwarded'

export type NotificationPayload =
  | ReactionCanHelpPayload
  | ReactionKnowSomeonePayload
  | PostForwardedPayload

export type AppNotification = {
  id: string
  user_id: string
  type: NotificationType
  payload: NotificationPayload
  read_at: string | null
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function createNotification({
  userId,
  type,
  payload,
}: {
  userId: string
  type: NotificationType
  payload: NotificationPayload
}): Promise<{ id: string } | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await (admin as any)
      .from('notifications')
      .insert({ user_id: userId, type, payload })
      .select('id')
      .single()
    if (error) {
      console.error('[notifications] createNotification error', error)
      return null
    }
    return data as { id: string }
  } catch (err) {
    console.error('[notifications] createNotification unexpected error', err)
    return null
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const admin = createAdminClient()
    const { count, error } = await (admin as any)
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

export async function getNotifications(
  userId: string,
  { limit = 20, before }: { limit?: number; before?: string } = {},
): Promise<AppNotification[]> {
  try {
    const admin = createAdminClient()
    let query = (admin as any)
      .from('notifications')
      .select('id, user_id, type, payload, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit + 1)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data, error } = await query
    if (error) {
      console.error('[notifications] getNotifications error', error)
      return []
    }
    return (data ?? []) as AppNotification[]
  } catch {
    return []
  }
}

export async function markAllRead(userId: string): Promise<void> {
  try {
    const admin = createAdminClient()
    await (admin as any)
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)
  } catch (err) {
    console.error('[notifications] markAllRead error', err)
  }
}

export async function deleteNotification(
  userId: string,
  notificationId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient()
    const { error } = await (admin as any)
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId)
    if (error) {
      console.error('[notifications] deleteNotification error', error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err) {
    console.error('[notifications] deleteNotification unexpected error', err)
    return { success: false, error: 'Unexpected error' }
  }
}

export async function deleteAllNotifications(
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient()
    const { error } = await (admin as any)
      .from('notifications')
      .delete()
      .eq('user_id', userId)
    if (error) {
      console.error('[notifications] deleteAllNotifications error', error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err) {
    console.error('[notifications] deleteAllNotifications unexpected error', err)
    return { success: false, error: 'Unexpected error' }
  }
}

// Reserved for future granular read state — not called yet
export async function markRead(userId: string, notificationIds: string[]): Promise<void> {
  if (!notificationIds.length) return
  try {
    const admin = createAdminClient()
    await (admin as any)
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('id', notificationIds)
      .is('read_at', null)
  } catch (err) {
    console.error('[notifications] markRead error', err)
  }
}
