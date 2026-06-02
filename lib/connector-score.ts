import { createAdminClient } from './supabase/admin'

export type ScoreBreakdown = {
  introsMade: number    // +1 each
  deepConvos: number    // +3 each (3+ msgs both sides)
  outcomes: number      // +10 each
  invitesUsed: number   // +1 each
  total: number
}

export async function computeConnectorScore(userId: string): Promise<ScoreBreakdown> {
  const admin = createAdminClient()

  const [{ count: introsMade }, { data: facilitatedIntros }, { count: invitesUsed }] =
    await Promise.all([
      admin.from('intro_requests')
        .select('id', { count: 'exact', head: true })
        .eq('facilitator_id', userId).eq('status', 'accepted').eq('type', 'warm_intro'),
      admin.from('intro_requests')
        .select('requester_id, target_id')
        .eq('facilitator_id', userId).eq('status', 'accepted').eq('type', 'warm_intro'),
      admin.from('invite_codes')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId).eq('type', 'founding_invite').not('used_at', 'is', null),
    ])

  let deepConvos = 0
  let outcomes = 0

  if (facilitatedIntros?.length) {
    // Find conversations for each facilitated pair
    const convResults = await Promise.all(
      facilitatedIntros.map(i => {
        const [a, b] = [i.requester_id, i.target_id].sort()
        return admin.from('conversations')
          .select('id')
          .eq('user_a', a).eq('user_b', b)
          .maybeSingle()
          .then(r => ({ convId: r.data?.id ?? null, intro: i }))
      }),
    )

    const validConvIds = convResults.map(r => r.convId).filter(Boolean) as string[]

    if (validConvIds.length) {
      const { data: outcomeRows } = await admin
        .from('outcomes')
        .select('conversation_id')
        .in('conversation_id', validConvIds)
      outcomes = outcomeRows?.length ?? 0

      // Check message depth per conversation
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
        }),
      )
    }
  }

  const total =
    (introsMade ?? 0) * 1 +
    deepConvos * 3 +
    outcomes * 10 +
    (invitesUsed ?? 0) * 1

  return {
    introsMade: introsMade ?? 0,
    deepConvos,
    outcomes,
    invitesUsed: invitesUsed ?? 0,
    total,
  }
}
