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

  const body = await req.json().catch(() => null)
  const targetId: string | undefined = body?.targetId
  if (!targetId) {
    return new Response(JSON.stringify({ draft: null }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const dbHeaders   = {
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Accept':        'application/json',
  }

  const [requesterRes, targetRes] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=first_name,what_i_do,building_now,who_i_want_to_meet&limit=1`,
      { headers: dbHeaders },
    ),
    fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${targetId}&select=first_name,what_i_do,building_now&limit=1`,
      { headers: dbHeaders },
    ),
  ])

  const requesters = await requesterRes.json()
  const targets    = await targetRes.json()
  const requester  = requesters[0] ?? null
  const target     = targets[0]    ?? null

  if (!requester || !target) {
    return new Response(JSON.stringify({ draft: null }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const requesterName = requester.first_name ?? 'The requester'
  const targetName    = target.first_name    ?? 'the target'

  // Prompt identical to /api/ai/draft-intro in rosta-app
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

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) {
    console.error('[ai-draft-intro] ANTHROPIC_API_KEY not set')
    return new Response(JSON.stringify({ draft: null }), {
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
        max_tokens: 200,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    const data  = await res.json()
    const draft = (data?.content?.[0]?.text ?? '').trim()
    return new Response(
      JSON.stringify({ draft: draft.length > 0 ? draft : null }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[ai-draft-intro] error', err)
    return new Response(JSON.stringify({ draft: null }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
