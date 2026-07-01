/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js'

export type FeedPost = {
  kind: 'post'
  id: string
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  authorUsername: string | null
  authorIsVerified: boolean
  postType: 'ask' | 'offer'
  field1: string
  field2: string
  field3: string
  createdAt: string
  expiresAt: string
  isOwnPost: boolean
  forwardedBy: { id: string; name: string } | null
  isForwardable: boolean
  myReactions: Array<'can_help' | 'know_someone' | 'noted'>
  canHelpCount: number
  knowSomeoneCount: number
}

export type FeedSignalUpdate = {
  kind: 'signal_update'
  id: string
  memberId: string
  memberName: string
  memberAvatarUrl: string | null
  memberUsername: string | null
  memberIsVerified: boolean
  signalType: 'open_to' | 'working_on' | 'need_right_now'
  newValue: string
  createdAt: string
  conversationId: string | null
  myReactions: Array<'can_help' | 'know_someone' | 'noted'>
}

export type FeedItem = FeedPost | FeedSignalUpdate

function displayName(p: { first_name: string | null; last_name: string | null } | undefined): string {
  return [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'A member'
}

export async function buildFeedItems(
  admin: SupabaseClient,
  userId: string,
  beforeCursor: string,
  limit: number,
): Promise<{ items: FeedItem[]; hasMore: boolean }> {
  const now = new Date().toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // ── 1. Get connection IDs ──────────────────────────────────────────────────
  const { data: connRows } = await admin
    .from('connections')
    .select('user_a, user_b')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .is('removed_at', null)

  const connectionIds = (connRows ?? []).map(c =>
    c.user_a === userId ? c.user_b : c.user_a
  )

  // ── 2. Direct posts from connections + own posts ─────────────────────────
  const authorIds = [...connectionIds, userId]
  const { data: directPosts } = await (admin as any)
    .from('network_posts')
    .select('id, author_id, post_type, field_1, field_2, field_3, created_at, expires_at')
    .in('author_id', authorIds)
    .is('archived_at', null)
    .is('deleted_at', null)
    .gt('expires_at', now)
    .lt('created_at', beforeCursor)
    .order('created_at', { ascending: false })
    .limit(limit)

  // ── 3. Posts forwarded to this user ───────────────────────────────────────
  const { data: forwardRows } = await (admin as any)
    .from('network_post_forwards')
    .select('post_id, forwarder_id')
    .eq('recipient_id', userId)

  const forwardedPostIds = (forwardRows ?? []).map((f: any) => f.post_id)
  const forwarderById: Record<string, string> = {}
  for (const f of (forwardRows ?? []) as any[]) forwarderById[f.post_id] = f.forwarder_id

  const { data: forwardedPosts } = forwardedPostIds.length > 0
    ? await (admin as any)
        .from('network_posts')
        .select('id, author_id, post_type, field_1, field_2, field_3, created_at, expires_at')
        .in('id', forwardedPostIds)
        .is('archived_at', null)
        .is('deleted_at', null)
        .gt('expires_at', now)
        .lt('created_at', beforeCursor)
    : { data: [] }

  // ── 4. Signal updates from connections + self ────────────────────────────
  const { data: signalUpdates } = await (admin as any)
    .from('signal_updates')
    .select('id, member_id, signal_type, new_value, created_at')
    .in('member_id', authorIds)
    .gt('created_at', thirtyDaysAgo)
    .lt('created_at', beforeCursor)
    .order('created_at', { ascending: false })
    .limit(limit)

  // ── 5. Collect all author/member IDs we need profiles for ─────────────────
  const allPostRows = [...(directPosts ?? []), ...(forwardedPosts ?? [])] as any[]
  const allSignalRows = (signalUpdates ?? []) as any[]

  const profileIds = Array.from(new Set([
    ...allPostRows.map(p => p.author_id),
    ...allSignalRows.map(s => s.member_id),
    ...Object.values(forwarderById),
  ]))

  const { data: profiles } = profileIds.length > 0
    ? await admin
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, username, is_verified')
        .in('id', profileIds)
    : { data: [] }

  const profileMap: Record<string, any> = Object.fromEntries(
    (profiles ?? []).map(p => [p.id, p])
  )

  // ── 6. User's own reactions ────────────────────────────────────────────────
  const allPostIds = allPostRows.map(p => p.id)
  const { data: myReactionRows } = allPostIds.length > 0
    ? await (admin as any)
        .from('network_post_reactions')
        .select('post_id, reaction_type')
        .in('post_id', allPostIds)
        .eq('reactor_id', userId)
    : { data: [] }

  const myReactionsByPostId: Record<string, Array<'can_help' | 'know_someone' | 'noted'>> = {}
  for (const r of (myReactionRows ?? []) as any[]) {
    if (!myReactionsByPostId[r.post_id]) myReactionsByPostId[r.post_id] = []
    myReactionsByPostId[r.post_id].push(r.reaction_type)
  }

  // ── 7. Reaction counts for own posts ──────────────────────────────────────
  const ownPostIds = allPostRows.filter(p => p.author_id === userId).map(p => p.id)
  const { data: ownReactionRows } = ownPostIds.length > 0
    ? await (admin as any)
        .from('network_post_reactions')
        .select('post_id, reaction_type')
        .in('post_id', ownPostIds)
    : { data: [] }

  const ownReactionCounts: Record<string, { can_help: number; know_someone: number }> = {}
  for (const r of (ownReactionRows ?? []) as any[]) {
    if (!ownReactionCounts[r.post_id]) ownReactionCounts[r.post_id] = { can_help: 0, know_someone: 0 }
    if (r.reaction_type === 'can_help') ownReactionCounts[r.post_id].can_help++
    if (r.reaction_type === 'know_someone') ownReactionCounts[r.post_id].know_someone++
  }

  // ── 8. Posts already forwarded by this user (to skip forward button) ──────
  const { data: alreadyForwardedByMe } = allPostIds.length > 0
    ? await (admin as any)
        .from('network_post_forwards')
        .select('post_id')
        .in('post_id', allPostIds)
        .eq('forwarder_id', userId)
    : { data: [] }

  const alreadyForwardedSet = new Set((alreadyForwardedByMe ?? []).map((f: any) => f.post_id))

  // ── 9. Conversations for signal update "Reach out" ────────────────────────
  const signalMemberIds = allSignalRows.map(s => s.member_id)
  const convPairs = signalMemberIds.map(id => {
    const [a, b] = [userId, id].sort()
    return `and(user_a.eq.${a},user_b.eq.${b})`
  })

  const { data: convRows } = convPairs.length > 0
    ? await admin
        .from('conversations')
        .select('id, user_a, user_b')
        .or(convPairs.join(','))
    : { data: [] }

  const convByMemberId: Record<string, string> = {}
  for (const c of (convRows ?? []) as any[]) {
    const otherId = c.user_a === userId ? c.user_b : c.user_a
    convByMemberId[otherId] = c.id
  }

  // ── 10. Build FeedPost items ───────────────────────────────────────────────
  const postItems: FeedPost[] = allPostRows.map(post => {
    const author = profileMap[post.author_id]
    const forwarderId = forwarderById[post.id]
    const forwarder = forwarderId ? profileMap[forwarderId] : null
    const counts = ownReactionCounts[post.id] ?? { can_help: 0, know_someone: 0 }
    return {
      kind: 'post' as const,
      id: post.id,
      authorId: post.author_id,
      authorName: displayName(author),
      authorAvatarUrl: author?.avatar_url ?? null,
      authorUsername: author?.username ?? null,
      authorIsVerified: author?.is_verified ?? false,
      postType: post.post_type,
      field1: post.field_1,
      field2: post.field_2,
      field3: post.field_3,
      createdAt: post.created_at,
      expiresAt: post.expires_at,
      isOwnPost: post.author_id === userId,
      forwardedBy: forwarder
        ? { id: forwarderId!, name: displayName(forwarder) }
        : null,
      isForwardable: !forwarderById[post.id] && post.author_id !== userId && !alreadyForwardedSet.has(post.id),
      myReactions: myReactionsByPostId[post.id] ?? [],
      canHelpCount: counts.can_help,
      knowSomeoneCount: counts.know_someone,
    }
  })

  // ── 11. Build FeedSignalUpdate items ──────────────────────────────────────
  const signalItems: FeedSignalUpdate[] = allSignalRows.map(su => {
    const member = profileMap[su.member_id]
    return {
      kind: 'signal_update' as const,
      id: su.id,
      memberId: su.member_id,
      memberName: displayName(member),
      memberAvatarUrl: member?.avatar_url ?? null,
      memberUsername: member?.username ?? null,
      memberIsVerified: member?.is_verified ?? false,
      signalType: su.signal_type,
      newValue: su.new_value,
      createdAt: su.created_at,
      conversationId: convByMemberId[su.member_id] ?? null,
      myReactions: [],
    }
  })

  // ── 12. Merge and sort ────────────────────────────────────────────────────
  const merged: FeedItem[] = [...postItems, ...signalItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const page = merged.slice(0, limit)
  const hasMore = merged.length > limit

  return { items: page, hasMore }
}
