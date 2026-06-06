import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST() {
  // ── 1. API key diagnostic (before auth so we can see it in logs) ─────────
  const apiKey = process.env.ANTHROPIC_API_KEY ?? ''
  console.log('[signal-coach] ANTHROPIC_API_KEY set:', !!apiKey, '| length:', apiKey.length, '| prefix:', apiKey.slice(0, 7))

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 2. Fetch profile + signals ───────────────────────────────────────────
  const admin = createAdminClient()
  const [{ data: profile, error: profileErr }, { data: signal }] = await Promise.all([
    admin.from('profiles')
      .select('first_name, what_i_do, building_now, who_i_want_to_meet, where_i_operate, profile_mode')
      .eq('id', user.id)
      .single(),
    admin.from('signals')
      .select('working_on, need_right_now')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  console.log('[signal-coach] profile fetch error:', profileErr?.message ?? 'none')
  console.log('[signal-coach] profile:', JSON.stringify(profile))

  if (!profile) return NextResponse.json({ suggestions: null })

  // ── 3. Anthropic call ────────────────────────────────────────────────────
  const MODEL = 'claude-haiku-4-5-20251001'
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
    const client = new Anthropic({ apiKey })
    console.log('[signal-coach] calling Anthropic model:', MODEL)
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    console.log('[signal-coach] Anthropic stop_reason:', msg.stop_reason, '| usage:', JSON.stringify(msg.usage))
    const block = msg.content[0]
    raw = block.type === 'text' ? block.text.trim() : null
    console.log('[signal-coach] raw response:', raw)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; error?: unknown }
    console.error('[signal-coach] Anthropic error — status:', e.status, '| message:', e.message, '| body:', JSON.stringify(e.error))
    return NextResponse.json({ suggestions: null })
  }

  if (!raw) return NextResponse.json({ suggestions: null })

  // ── 4. Parse JSON ────────────────────────────────────────────────────────
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[signal-coach] no JSON found in raw response')
      return NextResponse.json({ suggestions: null })
    }
    const parsed = JSON.parse(match[0])
    if (typeof parsed.working_on !== 'string' || typeof parsed.need_right_now !== 'string') {
      console.error('[signal-coach] parsed object missing expected fields:', JSON.stringify(parsed))
      return NextResponse.json({ suggestions: null })
    }
    return NextResponse.json({ suggestions: { working_on: parsed.working_on, need_right_now: parsed.need_right_now } })
  } catch (parseErr) {
    console.error('[signal-coach] JSON parse failed:', parseErr)
    return NextResponse.json({ suggestions: null })
  }
}
