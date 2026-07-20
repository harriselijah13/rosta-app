import { createAdminClient } from './supabase/admin'

export type ScoreBreakdown = {
  invitesRedeemed:  number   // +5 each (invite code used_at IS NOT NULL)
  introRequests:    number   // +1 each (as requester, accepted)
  deepConvos:       number   // +3 each (3+ msgs both sides, from facilitated intros)
  qrConnections:    number   // +5 each
  outcomes:         number   // +8 each (from facilitated intros)
  thankYous:        number   // +2 each received as facilitator
  openTables:       number   // +1 each completed
  signalBonus:      number   // +2 if signal updated this week
  lendAHand:        number   // +2 each (can_help reaction + follow-up message to post author)
  total:            number
}

export async function computeConnectorScore(userId: string): Promise<ScoreBreakdown> {
  const admin = createAdminClient()

  const today   = new Date()
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: invitesRedeemed },
    { count: introRequests },
    { data: facilitatedIntros },
    { count: qrConnections },
    { count: thankYous },
    { count: openTables },
    { data: profile },
    { data: lendAHandReactions },
  ] = await Promise.all([
    // +5 per redeemed invite code owned by this user
    admin.from('invite_codes')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .not('used_at', 'is', null),

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

    // +1 per completed Open Table room
    admin.from('open_table_members')
      .select('id, open_table_rooms!inner(expires_at)', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lt('open_table_rooms.expires_at', today.toISOString()),

    // Signal bonus check
    admin.from('profiles')
      .select('signal_score_last_awarded')
      .eq('id', userId)
      .single(),

    // +2 per can_help reaction where the reactor also sent a message to the post author
    admin.from('network_post_reactions')
      .select('post_id, created_at, network_posts!inner(author_id)')
      .eq('reactor_id', userId)
      .eq('reaction_type', 'can_help'),
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
  const lastAwarded = profile?.signal_score_last_awarded
  const signalBonus = lastAwarded && new Date(lastAwarded) >= new Date(weekAgo) ? 2 : 0

  // Lend a Hand: +2 per can_help reaction followed by a message to the post author
  let lendAHand = 0
  if (lendAHandReactions?.length) {
    const results = await Promise.all(
      lendAHandReactions.map(async (rxn) => {
        const authorId = (rxn as any).network_posts?.author_id as string | undefined
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

  const total =
    (invitesRedeemed ?? 0) * 5 +
    (introRequests ?? 0)   * 1 +
    deepConvos             * 3 +
    (qrConnections ?? 0)   * 5 +
    outcomes               * 8 +
    (thankYous ?? 0)       * 2 +
    // weekly challenge: placeholder 0
    (openTables ?? 0)      * 1 +
    signalBonus            +
    lendAHand              * 2

  return {
    invitesRedeemed: invitesRedeemed ?? 0,
    introRequests:   introRequests ?? 0,
    deepConvos,
    qrConnections:   qrConnections ?? 0,
    outcomes,
    thankYous:       thankYous ?? 0,
    openTables:      openTables ?? 0,
    signalBonus,
    lendAHand,
    total,
  }
}
