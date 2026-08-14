import { createAdminClient } from './supabase/admin'

export type ScoreBreakdown = {
  referrals:       number   // +5 each (joined via this member's referral link)
  introRequests:   number   // +1 each (as requester, accepted)
  deepConvos:      number   // +3 each (3+ msgs both sides, from facilitated intros)
  qrConnections:   number   // +5 each
  outcomes:        number   // +8 each (from facilitated intros)
  thankYous:       number   // +2 each received as facilitator
  signalBonus:     number   // +2 if signal updated this week
  lendAHand:       number   // +10 each (can_help reaction + follow-up message to post author)
  blueprint:       number   // +15 if member has published a Blueprint (one-time)
  signalComplete:  number   // +5 one-time: all three signal fields filled for the first time
  premiumBonus:    number   // +10 one-time: account ever became Premium
  total:           number
}

export async function computeConnectorScore(userId: string): Promise<ScoreBreakdown> {
  const admin = createAdminClient()

  const today   = new Date()
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: referrals },
    { count: introRequests },
    { data: facilitatedIntros },
    { count: qrConnections },
    { count: thankYous },
    { data: profile },
    { data: lendAHandReactions },
    { count: blueprintCount },
    { data: signalRow },
  ] = await Promise.all([
    // +5 per person who joined through this member's referral link
    admin.from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', userId),

    // +1 per accepted intro request made as requester
    admin.from('intro_requests')
      .select('id', { count: 'exact', head: true })
      .eq('requester_id', userId)
      .eq('status', 'accepted')
      .eq('type', 'warm_intro'),

    // For deep convo + outcome scoring (as facilitator)
    admin.from('intro_requests')
      .select('requester_id, target_id')
      .eq('facilitator_id', userId)
      .eq('status', 'accepted')
      .eq('type', 'warm_intro'),

    // +5 per QR connection (member or unified QR)
    admin.from('connections')
      .select('id', { count: 'exact', head: true })
      .in('origin', ['qr_member', 'qr_scan'])
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .is('removed_at', null),

    // +2 per thank you received as facilitator
    admin.from('intro_requests')
      .select('id', { count: 'exact', head: true })
      .eq('facilitator_id', userId)
      .not('thank_you_at', 'is', null),

    // Signal bonus check + premium bonus flag
    admin.from('profiles')
      .select('signal_score_last_awarded, premium_bonus_awarded')
      .eq('id', userId)
      .single(),

    // +10 per can_help reaction where the reactor also sent a message to the post author
    admin.from('network_post_reactions')
      .select('post_id, created_at, network_posts!inner(author_id)')
      .eq('reactor_id', userId)
      .eq('reaction_type', 'can_help'),

    // +15 if member has published a Blueprint (one-time; 0 or 1 rows)
    admin.from('blueprints').select('id', { count: 'exact', head: true }).eq('user_id', userId),

    // Signal complete + premium bonus flags
    admin.from('signals').select('complete_bonus_awarded').eq('user_id', userId).maybeSingle(),
  ])

  // Deep convos + outcomes from facilitated intros
  let deepConvos = 0
  let outcomes   = 0

  if (facilitatedIntros?.length) {
    const convResults = await Promise.all(
      facilitatedIntros.map(i => {
        const [a, b] = [i.requester_id, i.target_id].sort()
        return admin.from('conversations')
          .select('id')
          .eq('user_a', a).eq('user_b', b)
          .maybeSingle()
          .then(r => ({ convId: r.data?.id ?? null, intro: i }))
      })
    )

    const validConvIds = convResults.map(r => r.convId).filter(Boolean) as string[]

    if (validConvIds.length) {
      const { data: outcomeRows } = await admin
        .from('outcomes')
        .select('conversation_id')
        .in('conversation_id', validConvIds)
      outcomes = outcomeRows?.length ?? 0

      await Promise.all(
        convResults.map(async ({ convId, intro }) => {
          if (!convId) return
          const [{ count: a }, { count: b }] = await Promise.all([
            admin.from('messages').select('id', { count: 'exact', head: true })
              .eq('conversation_id', convId).eq('sender_id', intro.requester_id),
            admin.from('messages').select('id', { count: 'exact', head: true })
              .eq('conversation_id', convId).eq('sender_id', intro.target_id),
          ])
          if ((a ?? 0) >= 3 && (b ?? 0) >= 3) deepConvos++
        })
      )
    }
  }

  // Signal bonus: +2 if signal was updated in the past 7 days and hasn't been awarded this week
  const lastAwarded = (profile as { signal_score_last_awarded: string | null; premium_bonus_awarded: boolean } | null)?.signal_score_last_awarded
  const signalBonus = lastAwarded && new Date(lastAwarded) >= new Date(weekAgo) ? 2 : 0

  // Lend a Hand: +2 per can_help reaction followed by a message to the post author
  let lendAHand = 0
  if (lendAHandReactions?.length) {
    const results = await Promise.all(
      lendAHandReactions.map(async (rxn) => {
        const rxnRow = rxn as unknown as { network_posts: { author_id: string }[] | null }
        const authorId = Array.isArray(rxnRow.network_posts) ? rxnRow.network_posts[0]?.author_id : undefined
        if (!authorId || authorId === userId) return false
        const [ua, ub] = [userId, authorId].sort()
        const { data: conv } = await admin
          .from('conversations')
          .select('id')
          .eq('user_a', ua)
          .eq('user_b', ub)
          .maybeSingle()
        if (!conv) return false
        const { count } = await admin
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .eq('sender_id', userId)
          .gt('created_at', rxn.created_at)
        return (count ?? 0) > 0
      })
    )
    lendAHand = results.filter(Boolean).length
  }

  const signalComplete = (signalRow as { complete_bonus_awarded: boolean } | null)?.complete_bonus_awarded ? 5 : 0
  const premiumBonus   = (profile as { signal_score_last_awarded: string | null; premium_bonus_awarded: boolean } | null)?.premium_bonus_awarded ? 10 : 0

  const total =
    (referrals ?? 0) * 5 +
    (introRequests ?? 0)   * 1 +
    deepConvos             * 3 +
    (qrConnections ?? 0)   * 5 +
    outcomes               * 8 +
    (thankYous ?? 0)       * 2 +
    signalBonus            +
    lendAHand              * 10 +
    ((blueprintCount ?? 0) > 0 ? 15 : 0) +
    signalComplete         +
    premiumBonus

  return {
    referrals:      referrals ?? 0,
    introRequests:  introRequests ?? 0,
    deepConvos,
    qrConnections:  qrConnections ?? 0,
    outcomes,
    thankYous:      thankYous ?? 0,
    signalBonus,
    lendAHand,
    blueprint:      (blueprintCount ?? 0) > 0 ? 1 : 0,
    signalComplete,
    premiumBonus,
    total,
  }
}
