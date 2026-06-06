import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: profile }, { data: signal }] = await Promise.all([
    admin.from('profiles')
      .select('first_name, what_i_do, building_now, who_i_want_to_meet, where_i_operate, profile_mode')
      .eq('id', user.id)
      .single(),
    admin.from('signals')
      .select('working_on, need_right_now')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (!profile) return NextResponse.json({ suggestions: null })

  const prompt = `You are a professional networking coach helping a ROSTA member improve their profile signals. ROSTA is an invite-only network for founders, operators, and creatives.

Member profile:
- Name: ${profile.first_name ?? 'unknown'}
- What they do: ${profile.what_i_do ?? 'not set'}
- Building now: ${profile.building_now ?? 'not set'}
- Who they want to meet: ${profile.who_i_want_to_meet ?? 'not set'}
- Where they operate: ${profile.where_i_operate ?? 'not set'}
- Mode: ${profile.profile_mode ?? 'not set'}

Current signals:
- Working on: ${signal?.working_on ?? 'empty'}
- Need right now: ${signal?.need_right_now ?? 'empty'}

Write improved versions of their two signals. Be specific, concrete, and useful to someone scanning the network. Avoid vague phrases like "looking to network", "open to opportunities", "exploring options". Reference what they are actually building or doing. Each rewrite should be 1–2 sentences max.

Return ONLY a JSON object in this exact format (no markdown, no explanation):
{"working_on":"<improved text>","need_right_now":"<improved text>"}`

  let raw: string | null = null
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = msg.content[0]
    raw = block.type === 'text' ? block.text.trim() : null
  } catch (err: unknown) {
    const e = err as { status?: number; error?: { error?: { message?: string } } }
    const msg = e.error?.error?.message ?? ''
    if (msg.includes('credit balance')) {
      console.error('[signal-coach] Anthropic credits exhausted')
      return NextResponse.json({ error: 'AI suggestions are temporarily unavailable.' }, { status: 503 })
    }
    console.error('[signal-coach] Anthropic error:', e.status, msg)
    return NextResponse.json({ suggestions: null })
  }

  if (!raw) return NextResponse.json({ suggestions: null })

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ suggestions: null })
    const parsed = JSON.parse(match[0])
    if (typeof parsed.working_on !== 'string' || typeof parsed.need_right_now !== 'string') {
      return NextResponse.json({ suggestions: null })
    }
    return NextResponse.json({ suggestions: { working_on: parsed.working_on, need_right_now: parsed.need_right_now } })
  } catch {
    return NextResponse.json({ suggestions: null })
  }
}
