// verify_jwt: true (Supabase gateway validates the JWT before reaching this code).
// No external imports — direct PostgREST fetch + Anthropic fetch only.
// Richer than the Open Tables cron: includes working_on, need_right_now, open_to
// from the signals table, not just static profile fields.

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const POOL_CAP = 30  // max connections to include in one prompt

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

const nullResult = { person1Id: null, person2Id: null, reasoning: null }

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

  // ── 1. Fetch the current user's connections ────────────────────────────────
  const connRes = await fetch(
    `${supabaseUrl}/rest/v1/connections?or=(user_a.eq.${userId},user_b.eq.${userId})&removed_at=is.null&select=user_a,user_b&limit=${POOL_CAP}`,
    { headers: dbHeaders },
  )
  const connRows: { user_a: string; user_b: string }[] = await connRes.json()

  if (!Array.isArray(connRows) || connRows.length < 2) {
    return new Response(JSON.stringify(nullResult), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const connectionIds = connRows.map(r => r.user_a === userId ? r.user_b : r.user_a)

  // ── 2. Fetch profiles and signals for the pool ────────────────────────────
  const idList = connectionIds.join(',')
  const [profileRes, signalRes] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/profiles?id=in.(${idList})&select=id,first_name,last_name,what_i_do,building_now`,
      { headers: dbHeaders },
    ),
    fetch(
      `${supabaseUrl}/rest/v1/signals?user_id=in.(${idList})&select=user_id,working_on,need_right_now,open_to`,
      { headers: dbHeaders },
    ),
  ])
  const profileRows: { id: string; first_name: string | null; last_name: string | null; what_i_do: string | null; building_now: string | null }[] = await profileRes.json()
  const signalRows:  { user_id: string; working_on: string | null; need_right_now: string | null; open_to: string[] | null }[] = await signalRes.json()

  const profileMap = Object.fromEntries((Array.isArray(profileRows) ? profileRows : []).map(p => [p.id, p]))
  const signalMap  = Object.fromEntries((Array.isArray(signalRows)  ? signalRows  : []).map(s => [s.user_id, s]))

  // Build the candidate pool — only members with a profile entry
  const pool = connectionIds
    .map(id => ({ id, profile: profileMap[id], signal: signalMap[id] ?? null }))
    .filter(m => !!m.profile)

  if (pool.length < 2) {
    return new Response(JSON.stringify(nullResult), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // ── 3. Find which pairs in the pool are already connected to each other ────
  const innerRes = await fetch(
    `${supabaseUrl}/rest/v1/connections?user_a=in.(${idList})&user_b=in.(${idList})&removed_at=is.null&select=user_a,user_b`,
    { headers: dbHeaders },
  )
  const innerRows: { user_a: string; user_b: string }[] = await innerRes.json()

  const alreadyConnected = new Set(
    (Array.isArray(innerRows) ? innerRows : []).map(r => [r.user_a, r.user_b].sort().join(':'))
  )

  // Build list of eligible (not already connected) pair index pairs
  const eligiblePairs: [number, number][] = []
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const key = [pool[i].id, pool[j].id].sort().join(':')
      if (!alreadyConnected.has(key)) {
        eligiblePairs.push([i, j])
      }
    }
  }

  if (eligiblePairs.length === 0) {
    return new Response(JSON.stringify(nullResult), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // ── 4. Build the prompt ────────────────────────────────────────────────────
  const memberProfiles = pool.map((m, i) => {
    const p = m.profile
    const s = m.signal
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Member'
    const openTo = s?.open_to?.filter(v => v !== 'open_door').join(', ') || 'not specified'
    return (
      `[${i}] ${name}\n` +
      `  - What they do: ${p.what_i_do ?? 'not specified'}\n` +
      `  - Building: ${p.building_now ?? 'not specified'}\n` +
      `  - Working on: ${s?.working_on ?? 'not specified'}\n` +
      `  - Need right now: ${s?.need_right_now ?? 'not specified'}\n` +
      `  - Open to: ${openTo}`
    )
  }).join('\n\n')

  const alreadyConnectedPairs = eligiblePairs.length < pool.length * (pool.length - 1) / 2
    ? `\nPairs already connected to each other (exclude these from consideration): ${
        [...alreadyConnected].map(key => {
          const [a, b] = key.split(':')
          const ai = pool.findIndex(m => m.id === a)
          const bi = pool.findIndex(m => m.id === b)
          if (ai === -1 || bi === -1) return null
          return `[${ai},${bi}]`
        }).filter(Boolean).join(', ')
      }`
    : ''

  const prompt =
`You are helping a ROSTA member identify the single best introduction they could make within their network. ROSTA is an invite-only network for founders, operators, and creatives.

Find two people with strong complementary signals — meaning what one person needs right now or is working on closely matches what the other person does, is building, or is open to. Prioritise semantic compatibility, not just keyword overlap. A good match has bidirectional value: person A benefits from meeting person B and vice versa.

Here are the ${pool.length} connections (indexed 0–${pool.length - 1}):

${memberProfiles}
${alreadyConnectedPairs}

Return ONLY a JSON object in this format (no markdown, no explanation):
{"person1":<index>,"person2":<index>,"reasoning":"<one sentence explaining the match>"}

If no compelling match exists, return:
{"person1":null,"person2":null,"reasoning":"no strong match found"}`

  // ── 5. Call Haiku ──────────────────────────────────────────────────────────
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) {
    console.error('[ai-suggest-match] ANTHROPIC_API_KEY not set')
    return new Response(JSON.stringify(nullResult), {
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
    const raw   = (data?.content?.[0]?.text ?? '').trim()
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[ai-suggest-match] no JSON in response:', raw)
      return new Response(JSON.stringify(nullResult), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const parsed = JSON.parse(match[0])
    const p1idx  = parsed.person1
    const p2idx  = parsed.person2

    if (p1idx === null || p2idx === null || typeof p1idx !== 'number' || typeof p2idx !== 'number') {
      return new Response(JSON.stringify(nullResult), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (p1idx < 0 || p1idx >= pool.length || p2idx < 0 || p2idx >= pool.length || p1idx === p2idx) {
      console.error('[ai-suggest-match] invalid indices:', p1idx, p2idx, 'pool size:', pool.length)
      return new Response(JSON.stringify(nullResult), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        person1Id: pool[p1idx].id,
        person2Id: pool[p2idx].id,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : null,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[ai-suggest-match] error', err)
    return new Response(JSON.stringify(nullResult), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
