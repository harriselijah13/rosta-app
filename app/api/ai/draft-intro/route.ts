import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aiText } from '@/lib/anthropic'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { targetId } = await request.json()
  if (!targetId) return NextResponse.json({ draft: null })

  const admin = createAdminClient()

  const [{ data: requester }, { data: target }] = await Promise.all([
    admin.from('profiles')
      .select('first_name, what_i_do, building_now, who_i_want_to_meet')
      .eq('id', user.id)
      .single(),
    admin.from('profiles')
      .select('first_name, what_i_do, building_now')
      .eq('id', targetId)
      .single(),
  ])

  if (!requester || !target) return NextResponse.json({ draft: null })

  const requesterName = requester.first_name ?? 'The requester'
  const targetName    = target.first_name    ?? 'the target'

  const prompt = `You are helping write a warm professional intro request note for a professional networking platform called ROSTA.

${requesterName} wants an introduction to ${targetName}.

About ${requesterName}:
- What they do: ${requester.what_i_do ?? 'not specified'}
- Building now: ${requester.building_now ?? 'not specified'}
- Who they want to meet: ${requester.who_i_want_to_meet ?? 'not specified'}

About ${targetName}:
- What they do: ${target.what_i_do ?? 'not specified'}
- Building now: ${target.building_now ?? 'not specified'}

Write a concise, warm, specific intro request note (2–4 sentences) that ${requesterName} will send to a mutual friend who can make the introduction. The note should explain WHY ${requesterName} wants to meet ${targetName} and what they hope to get from the connection. Be concrete — reference what both people are doing. Do not use generic phrases like "pick your brain" or "grab a coffee". Write in first person as ${requesterName}. Output only the note text, no quotes or preamble.`

  const draft = await aiText(prompt, 200)
  return NextResponse.json({ draft })
}
