import { createAdminClient } from './supabase/admin'
import { computeConnectorScore } from './connector-score'

// Award a single badge — silently no-ops if already earned
async function award(admin: ReturnType<typeof createAdminClient>, userId: string, slug: string) {
  await admin.from('member_badges').upsert({ user_id: userId, badge_slug: slug }, { onConflict: 'user_id,badge_slug', ignoreDuplicates: true })
}

export async function checkAndAwardBadges(userId: string): Promise<void> {
  const admin = createAdminClient()

  // Fetch all data needed to evaluate every badge condition in parallel
  const [
    { data: profile },
    { data: earnedRows },
    { count: connectionCount },
    { count: facilitatedCount },
    { count: openTableCount },
    { count: thankYousReceived },
    { count: outcomesCount },
    score,
  ] = await Promise.all([
    admin.from('profiles')
      .select('founding_member, is_verified, signal_streak')
      .eq('id', userId)
      .single(),

    admin.from('member_badges')
      .select('badge_slug')
      .eq('user_id', userId),

    admin.from('connections')
      .select('id', { count: 'exact', head: true })
      .or(`user_a.eq.${userId},user_b.eq.${userId}`),

    admin.from('intro_requests')
      .select('id', { count: 'exact', head: true })
      .eq('facilitator_id', userId)
      .eq('status', 'accepted')
      .eq('type', 'warm_intro'),

    admin.from('open_table_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),

    admin.from('intro_requests')
      .select('id', { count: 'exact', head: true })
      .eq('facilitator_id', userId)
      .not('thank_you_at', 'is', null),

    // Outcomes this user was party to (via their conversations)
    (async () => {
      const { data: convs } = await admin.from('conversations')
        .select('id')
        .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      const convIds = (convs ?? []).map(c => c.id)
      if (!convIds.length) return { count: 0 }
      return admin.from('outcomes')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convIds)
    })(),

    computeConnectorScore(userId),
  ])

  const alreadyEarned = new Set((earnedRows ?? []).map(r => r.badge_slug))

  async function maybeAward(slug: string, condition: boolean) {
    if (condition && !alreadyEarned.has(slug)) {
      await award(admin, userId, slug)
    }
  }

  const earned = earnedRows?.length ?? 0
  const connScore = score.total

  await Promise.all([
    // Status badges
    maybeAward('founding-member', !!profile?.founding_member),
    maybeAward('verified',        !!profile?.is_verified),

    // Activity badges
    maybeAward('first-connection', (connectionCount ?? 0) >= 1),
    maybeAward('introducer',       (facilitatedCount ?? 0) >= 1),
    maybeAward('connector',        connScore >= 15),
    maybeAward('bridge',           connScore >= 40),
    maybeAward('catalyst',         connScore >= 80),
    maybeAward('architect',        connScore >= 150),

    // Milestone badges
    maybeAward('spark',           (outcomesCount ?? 0) >= 1),
    maybeAward('five-outcomes',   (outcomesCount ?? 0) >= 5),
    maybeAward('table-setter',    (openTableCount ?? 0) >= 1),
    maybeAward('signal-strength', (profile?.signal_streak ?? 0) >= 4),
    maybeAward('thanked',         (thankYousReceived ?? 0) >= 3),
    maybeAward('all-in',          earned >= 5),
  ])
}
