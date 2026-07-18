// verify_jwt: true (Supabase gateway validates the JWT before reaching this code).
// No external imports — direct PostgREST fetch + Anthropic fetch only.

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function userIdFromAuth(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const parts = authHeader.slice(7).split('.')
  if (parts.length !== 3) return null
  try {
    const padded  = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(padded))
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const userId = userIdFromAuth(req.headers.get('Authorization'))
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const dbHeaders   = {
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Accept':        'application/json',
  }

  const [profileRes, signalRes] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=first_name,what_i_do,building_now,who_i_want_to_meet,where_i_operate&limit=1`,
      { headers: dbHeaders },
    ),
    fetch(
      `${supabaseUrl}/rest/v1/signals?user_id=eq.${userId}&select=working_on,need_right_now&limit=1`,
      { headers: dbHeaders },
    ),
  ])

  const profiles = await profileRes.json()
  const signals  = await signalRes.json()
  const profile  = profiles[0] ?? null
  const signal   = signals[0]  ?? null

  if (!profile) {
    return new Response(JSON.stringify({ suggestions: null }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Prompt identical to /api/ai/signal-coach in rosta-app
  const prompt = `You are a professional networking coach helping a ROSTA member improve their profile signals. ROSTA is an invite-only network for founders, operators, and creatives.

Member profile:
- Name: ${profile.first_name ?? 'unknown'}
- What they do: ${profile.what_i_do ?? 'not set'}
- Building now: ${profile.building_now ?? 'not set'}
- Who they want to meet: ${profile.who_i_want_to_meet ?? 'not set'}
- Where they operate: ${profile.where_i_operate ?? 'not set'}

Current signals:
- Working on: ${signal?.working_on ?? 'empty'}
- Need right now: ${signal?.need_right_now ?? 'empty'}

Write improved versions of their two signals. Be specific, concrete, and useful to someone scanning the network. Avoid vague phrases like "looking to network", "open to opportunities", "exploring options". Reference what they are actually building or doing. Each rewrite should be 1–2 sentences max.

Return ONLY a JSON object in this exact format (no markdown, no explanation):
{"working_on":"<improved text>","need_right_now":"<improved text>"}`

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) {
    console.error('[ai-signal-coach] ANTHROPIC_API_KEY not set')
    return new Response(JSON.stringify({ suggestions: null }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    const data  = await res.json()
    const raw   = (data?.content?.[0]?.text ?? '').trim()
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) {
      return new Response(JSON.stringify({ suggestions: null }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    const parsed = JSON.parse(match[0])
    if (typeof parsed.working_on !== 'string' || typeof parsed.need_right_now !== 'string') {
      return new Response(JSON.stringify({ suggestions: null }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    return new Response(
      JSON.stringify({ suggestions: { working_on: parsed.working_on, need_right_now: parsed.need_right_now } }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[ai-signal-coach] error', err)
    return new Response(JSON.stringify({ suggestions: null }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
