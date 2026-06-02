import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, connectionNudgeEmail } from '@/lib/resend'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('Authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data: convs } = await admin
    .from('conversations')
    .select('id, user_a, user_b')
    .is('nudge_sent_at', null)
    .is('last_message_at', null)
    .lt('created_at', cutoff)
    .limit(50)

  if (!convs?.length) return NextResponse.json({ nudged: 0 })

  let nudged = 0

  for (const conv of convs) {
    try {
      const [{ data: profiles }, authA, authB] = await Promise.all([
        admin.from('profiles').select('id, first_name, last_name').in('id', [conv.user_a, conv.user_b]),
        admin.auth.admin.getUserById(conv.user_a),
        admin.auth.admin.getUserById(conv.user_b),
      ])

      const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
      const name = (id: string) =>
        [byId[id]?.first_name, byId[id]?.last_name].filter(Boolean).join(' ') || 'A member'

      const emailA = authA.data.user?.email
      const emailB = authB.data.user?.email

      await Promise.all([
        emailA && sendEmail(
          emailA,
          `Say hello to ${name(conv.user_b)}`,
          connectionNudgeEmail(name(conv.user_a), name(conv.user_b), conv.id),
        ),
        emailB && sendEmail(
          emailB,
          `Say hello to ${name(conv.user_a)}`,
          connectionNudgeEmail(name(conv.user_b), name(conv.user_a), conv.id),
        ),
      ])

      await admin.from('conversations')
        .update({ nudge_sent_at: new Date().toISOString() })
        .eq('id', conv.id)

      nudged++
    } catch (e) {
      console.error('[cron/nudge] failed for conv', conv.id, e)
    }
  }

  return NextResponse.json({ nudged })
}
