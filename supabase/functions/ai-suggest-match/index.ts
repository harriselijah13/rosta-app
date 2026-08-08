// ai-suggest-match — Smart Match Phase 2
//
// verify_jwt: true (Supabase gateway validates the JWT before this runs).
// No external npm imports — direct PostgREST + Anthropic fetch only.
//
// Tier behaviour (enforced server-side; not client-checkable):
//   Free    → 1 call / 7 days,  1 suggestion, no urgency weighting,
//             no blueprint context, no Warm Path, no outcome context.
//   Premium → 10 calls / hour,  up to 3 ranked suggestions, full context.
//
// Warm Path (Premium only):
//   Two-hop traversal only — user's connections → their connections.
//   Pool capped at POOL_CAP to match the direct-match budget. No recursion.

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const POOL_CAP          = 30   // max connections fetched per hop
const FREE_WINDOW_MINS  = 10_080  // 7 days
const FREE_MAX_CALLS    = 1
const PREMIUM_WINDOW_MINS = 60
const PREMIUM_MAX_CALLS = 10

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const nullResult = {
  suggestions:  [] as SuggestionResult[],
  warm_path:    null as WarmPathResult | null,
}

type SuggestionResult = {
  person1Id:  string
  person2Id:  string
  reasoning:  string
  match_type: 'direct' | 'complementary' | 'warm'
}

type WarmPathResult = {
  bridge_person_id:  string
  suggested_person_id: string
  reasoning:         string
}

type PoolMember = {
  id:      string
  profile: {
    first_name:   string | null
    last_name:    string | null
    what_i_do:    string | null
    building_now: string | null
  }
  signal: {
    working_on:              string | null
    need_right_now:          string | null
    need_right_now_updated_at: string | null
    open_to:                 string[] | null
  } | null
  blueprint: {
    looking_for: string | null
    stage:       string | null
    next_step:   string | null
    deadline:    string | null
  } | null
}

function memberBlock(m: PoolMember, i: number): string {
  const p  = m.profile
  const s  = m.signal
  const bp = m.blueprint
  const name   = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Member'
  const openTo = s?.open_to?.filter(v => v !== 'open_door').join(', ') || 'not specified'

  const urgencyLine = (() => {
    if (s?.need_right_now && s.need_right_now_updated_at) {
      const daysAgo = Math.floor((Date.now() - new Date(s.need_right_now_updated_at).getTime()) / 86_400_000)
      return `  - Need urgency: stated ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`
    }
    return null
  })()

  const blueprintLines = bp ? [
    bp.stage       ? `  - Blueprint stage: ${bp.stage}`         : null,
    bp.looking_for ? `  - Blueprint looking for: ${bp.looking_for}` : null,
    bp.next_step   ? `  - Blueprint next step: ${bp.next_step}` : null,
    bp.deadline    ? `  - Blueprint deadline: ${bp.deadline}`   : null,
  ].filter(Boolean) : []

  return [
    `[${i}] ${name}`,
    `  - What they do: ${p.what_i_do ?? 'not specified'}`,
    `  - Building: ${p.building_now ?? 'not specified'}`,
    `  - Working on: ${s?.working_on ?? 'not specified'}`,
    `  - Need right now: ${s?.need_right_now ?? 'not specified'}`,
    urgencyLine,
    `  - Open to: ${openTo}`,
    ...blueprintLines,
  ].filter(Boolean).join('\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const userId = userIdFromAuth(req.headers.get('Authorization'))
  if (!userId) return json({ error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = (path: string) =>
    `${supabaseUrl}/rest/v1/${path}`
  const dbHeaders = {
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Accept':        'application/json',
    'Content-Type':  'application/json',
  }

  // ── 1. Resolve premium status server-side ─────────────────────────────────
  const profileRes = await fetch(
    db(`profiles?id=eq.${userId}&select=is_premium`),
    { headers: dbHeaders },
  )
  const [profileRow] = await profileRes.json() as { is_premium: boolean }[]
  const isPremium = !!profileRow?.is_premium

  // ── 2. Tier-gated rate limit (enforced via smart_match_runs) ─────────────
  const windowMins = isPremium ? PREMIUM_WINDOW_MINS : FREE_WINDOW_MINS
  const maxCalls   = isPremium ? PREMIUM_MAX_CALLS   : FREE_MAX_CALLS
  const windowStart = new Date(Date.now() - windowMins * 60_000).toISOString()

  const rlRes = await fetch(
    db(`smart_match_runs?user_id=eq.${userId}&created_at=gte.${windowStart}&select=id`),
    { headers: dbHeaders },
  )
  const recentRuns = await rlRes.json() as { id: string }[]
  if (recentRuns.length >= maxCalls) {
    const resetAt = isPremium
      ? 'in an hour'
      : 'in 7 days'
    return json({ error: `Rate limit reached. Try again ${resetAt}.`, rate_limited: true, is_premium: isPremium }, 429)
  }

  // ── 3. Fetch user's connections (pool) ────────────────────────────────────
  const connRes = await fetch(
    db(`connections?or=(user_a.eq.${userId},user_b.eq.${userId})&removed_at=is.null&select=user_a,user_b&limit=${POOL_CAP}`),
    { headers: dbHeaders },
  )
  const connRows: { user_a: string; user_b: string }[] = await connRes.json()

  if (!Array.isArray(connRows) || connRows.length < 2) {
    return json({ ...nullResult, is_premium: isPremium })
  }

  const connectionIds = connRows.map(r => r.user_a === userId ? r.user_b : r.user_a)
  const idList        = connectionIds.join(',')

  // ── 4. Fetch profiles, signals, blueprints for the pool ──────────────────
  const [profileRes2, signalRes, blueprintRes] = await Promise.all([
    fetch(
      db(`profiles?id=in.(${idList})&select=id,first_name,last_name,what_i_do,building_now`),
      { headers: dbHeaders },
    ),
    fetch(
      db(`signals?user_id=in.(${idList})&select=user_id,working_on,need_right_now,need_right_now_updated_at,open_to`),
      { headers: dbHeaders },
    ),
    isPremium
      ? fetch(db(`blueprints?user_id=in.(${idList})&select=user_id,looking_for,stage,next_step,deadline`), { headers: dbHeaders })
      : Promise.resolve(new Response('[]')),
  ])

  const profileRows    = await profileRes2.json()  as { id: string; first_name: string | null; last_name: string | null; what_i_do: string | null; building_now: string | null }[]
  const signalRows     = await signalRes.json()    as { user_id: string; working_on: string | null; need_right_now: string | null; need_right_now_updated_at: string | null; open_to: string[] | null }[]
  const blueprintRows  = await blueprintRes.json() as { user_id: string; looking_for: string | null; stage: string | null; next_step: string | null; deadline: string | null }[]

  const profileMap   = Object.fromEntries((Array.isArray(profileRows)   ? profileRows   : []).map(p => [p.id,       p]))
  const signalMap    = Object.fromEntries((Array.isArray(signalRows)    ? signalRows    : []).map(s => [s.user_id,  s]))
  const blueprintMap = Object.fromEntries((Array.isArray(blueprintRows) ? blueprintRows : []).map(b => [b.user_id,  b]))

  const pool: PoolMember[] = connectionIds
    .map(id => ({
      id,
      profile:   profileMap[id],
      signal:    signalMap[id]    ?? null,
      blueprint: blueprintMap[id] ?? null,
    }))
    .filter(m => !!m.profile)

  if (pool.length < 2) {
    return json({ ...nullResult, is_premium: isPremium })
  }

  // ── 5. Find already-connected pairs within the pool ───────────────────────
  const innerRes = await fetch(
    db(`connections?user_a=in.(${idList})&user_b=in.(${idList})&removed_at=is.null&select=user_a,user_b`),
    { headers: dbHeaders },
  )
  const innerRows: { user_a: string; user_b: string }[] = await innerRes.json()

  const alreadyConnected = new Set(
    (Array.isArray(innerRows) ? innerRows : []).map(r => [r.user_a, r.user_b].sort().join(':'))
  )

  const eligiblePairs: [number, number][] = []
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const key = [pool[i].id, pool[j].id].sort().join(':')
      if (!alreadyConnected.has(key)) eligiblePairs.push([i, j])
    }
  }

  // ── 6. Fetch recent outcome context (Premium only, last 10) ───────────────
  // These are example outcomes injected as prompt context — not a persistent
  // trained model. They give the model recent examples of this user's patterns.
  let outcomeContext = ''
  if (isPremium) {
    const ocRes = await fetch(
      db(`smart_match_outcomes?user_id=eq.${userId}&order=created_at.desc&limit=10&select=outcome`),
      { headers: dbHeaders },
    )
    const ocRows = await ocRes.json() as { outcome: string }[]
    if (Array.isArray(ocRows) && ocRows.length > 0) {
      const went    = ocRows.filter(r => r.outcome === 'went_somewhere').length
      const nothing = ocRows.filter(r => r.outcome === 'nothing_came_of_it').length
      outcomeContext = `\n[RECENT OUTCOME CONTEXT: of this user's last ${ocRows.length} introductions, ${went} led somewhere and ${nothing} did not. Use this as context, not as a rule — variety is still valuable.]`
    }
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) {
    console.error('[ai-suggest-match] ANTHROPIC_API_KEY not set')
    return json({ ...nullResult, is_premium: isPremium })
  }

  // ── 7. Direct-match prompt ────────────────────────────────────────────────
  const maxSuggestions = isPremium ? 3 : 1
  const memberProfiles = pool.map((m, i) => memberBlock(m, i)).join('\n\n')

  const urgencyInstruction = isPremium
    ? '\nPrioritise pairs where at least one person has a time-sensitive need (recent "need urgency" or an upcoming blueprint deadline) over pairs matched only on general profile similarity.'
    : ''

  const connectedNote = alreadyConnected.size > 0
    ? `\nExclude pairs already connected to each other: ${
        [...alreadyConnected].map(key => {
          const [a, b] = key.split(':')
          const ai = pool.findIndex(m => m.id === a)
          const bi = pool.findIndex(m => m.id === b)
          return ai !== -1 && bi !== -1 ? `[${ai},${bi}]` : null
        }).filter(Boolean).join(', ')
      }`
    : ''

  const directPrompt = `You are helping a ROSTA member identify the best introduction${maxSuggestions > 1 ? 's' : ''} they could make within their professional network. ROSTA is a members-only network for people actively building things — every connection happens through a warm introduction.

Find ${maxSuggestions > 1 ? `the top ${maxSuggestions} distinct pairs` : 'the single best pair'} with strong complementary signals: what one person needs or is building closely matches what the other person does, has, or is open to. Consider both direct matches (clear supply/demand fit) and complementary matches (different but mutually beneficial roles around a shared context).${urgencyInstruction}
${outcomeContext}
Here are the ${pool.length} connections (indexed 0–${pool.length - 1}):

${memberProfiles}
${connectedNote}

Return ONLY a JSON array (no markdown, no explanation):
[{"person1":<index>,"person2":<index>,"reasoning":"<one concise sentence>","match_type":"direct|complementary"}]

Return up to ${maxSuggestions} entries, best first. If no compelling match exists, return [].`

  let directSuggestions: SuggestionResult[] = []

  if (eligiblePairs.length > 0) {
    try {
      const res  = await callHaiku(directPrompt, anthropicKey)
      const raw  = (res?.content?.[0]?.text ?? '').trim()
      const match = raw.match(/\[[\s\S]*\]/)
      if (match) {
        const parsed = JSON.parse(match[0]) as { person1: number; person2: number; reasoning: string; match_type: string }[]
        for (const item of parsed) {
          const { person1: p1, person2: p2, reasoning, match_type } = item
          if (
            typeof p1 === 'number' && typeof p2 === 'number' &&
            p1 >= 0 && p1 < pool.length && p2 >= 0 && p2 < pool.length && p1 !== p2
          ) {
            directSuggestions.push({
              person1Id:  pool[p1].id,
              person2Id:  pool[p2].id,
              reasoning:  typeof reasoning === 'string' ? reasoning : '',
              match_type: (match_type === 'complementary') ? 'complementary' : 'direct',
            })
          }
          if (directSuggestions.length >= maxSuggestions) break
        }
      }
    } catch (err) {
      console.error('[ai-suggest-match] direct match error:', err)
    }
  }

  // ── 8. Warm Path (Premium only, two-hop, capped at POOL_CAP) ─────────────
  // Only runs when no direct suggestion was found.
  // Traversal: user → connection C → C's connections (not already in user's network).
  // Hard limit: exactly two hops. No further recursion.
  let warmResult: WarmPathResult | null = null

  if (isPremium && directSuggestions.length === 0 && connectionIds.length > 0) {
    try {
      // Pick the top POOL_CAP connections as bridge candidates
      const bridgeIds = connectionIds.slice(0, POOL_CAP)

      // Fetch second-hop connections for all bridges in one query
      const bridgeList  = bridgeIds.join(',')
      const hop2Res = await fetch(
        db(`connections?or=(user_a.in.(${bridgeList}),user_b.in.(${bridgeList}))&removed_at=is.null&select=user_a,user_b&limit=${POOL_CAP}`),
        { headers: dbHeaders },
      )
      const hop2Rows: { user_a: string; user_b: string }[] = await hop2Res.json()

      // Build a map: bridge → second-hop ids not in user's own network
      const userNetworkSet = new Set([userId, ...connectionIds])
      const bridgeToHop2: Record<string, string[]> = {}
      for (const r of (Array.isArray(hop2Rows) ? hop2Rows : [])) {
        for (const bridgeId of bridgeIds) {
          if (r.user_a === bridgeId || r.user_b === bridgeId) {
            const hop2Id = r.user_a === bridgeId ? r.user_b : r.user_a
            if (!userNetworkSet.has(hop2Id)) {
              if (!bridgeToHop2[bridgeId]) bridgeToHop2[bridgeId] = []
              if (bridgeToHop2[bridgeId].length < POOL_CAP) {
                bridgeToHop2[bridgeId].push(hop2Id)
              }
            }
          }
        }
      }

      // Collect unique second-hop candidates
      const hop2Ids = [...new Set(Object.values(bridgeToHop2).flat())].slice(0, POOL_CAP)
      if (hop2Ids.length > 0) {
        const hop2List = hop2Ids.join(',')
        const [h2ProfileRes, h2SignalRes] = await Promise.all([
          fetch(db(`profiles?id=in.(${hop2List})&select=id,first_name,last_name,what_i_do,building_now`), { headers: dbHeaders }),
          fetch(db(`signals?user_id=in.(${hop2List})&select=user_id,working_on,need_right_now,open_to`), { headers: dbHeaders }),
        ])
        const h2Profiles = await h2ProfileRes.json() as typeof profileRows
        const h2Signals  = await h2SignalRes.json()  as { user_id: string; working_on: string | null; need_right_now: string | null; open_to: string[] | null }[]
        const h2PMap = Object.fromEntries((Array.isArray(h2Profiles) ? h2Profiles : []).map(p => [p.id, p]))
        const h2SMap = Object.fromEntries((Array.isArray(h2Signals)  ? h2Signals  : []).map(s => [s.user_id, s]))

        // Fetch the requesting user's own profile/signal for comparison
        const [myPRes, mySRes] = await Promise.all([
          fetch(db(`profiles?id=eq.${userId}&select=id,first_name,last_name,what_i_do,building_now`), { headers: dbHeaders }),
          fetch(db(`signals?user_id=eq.${userId}&select=user_id,working_on,need_right_now,open_to`), { headers: dbHeaders }),
        ])
        const [myProfile] = await myPRes.json() as typeof profileRows
        const [mySignal]  = await mySRes.json()  as { user_id: string; working_on: string | null; need_right_now: string | null; open_to: string[] | null }[]

        if (myProfile) {
          const myBlock = memberBlock(
            { id: userId, profile: myProfile, signal: mySignal ?? null, blueprint: null },
            0,
          )

          // Build indexed candidate list for the warm-path prompt
          const warmPool = hop2Ids
            .filter(id => !!h2PMap[id])
            .map((id, i) => ({
              id,
              profile:   h2PMap[id],
              signal:    h2SMap[id] ?? null,
              blueprint: null,
            }))

          const warmBlocks = warmPool.map((m, i) => memberBlock(m, i + 1)).join('\n\n')

          const warmPrompt = `You are helping a ROSTA member find someone worth meeting who is currently outside their network but reachable through a mutual connection.

Here is the person looking for a connection:
${myBlock}

Here are ${warmPool.length} potential people (indexed 1–${warmPool.length}) who could be introduced through a mutual connection:

${warmBlocks}

Return ONLY a JSON object (no markdown, no explanation) identifying the single best match:
{"candidate":<index>,"reasoning":"<one sentence explaining why they should meet>"}

If none are a compelling fit, return {"candidate":null,"reasoning":"no match found"}.`

          try {
            const warmRes  = await callHaiku(warmPrompt, anthropicKey)
            const warmRaw  = (warmRes?.content?.[0]?.text ?? '').trim()
            const warmMatch = warmRaw.match(/\{[\s\S]*\}/)
            if (warmMatch) {
              const wp = JSON.parse(warmMatch[0]) as { candidate: number | null; reasoning: string }
              if (wp.candidate !== null && typeof wp.candidate === 'number') {
                const idx = wp.candidate - 1  // shift back to 0-based
                if (idx >= 0 && idx < warmPool.length) {
                  const candidateId = warmPool[idx].id
                  // Find a bridge that has this candidate in their hop-2 set
                  const bridgeId = bridgeIds.find(b => bridgeToHop2[b]?.includes(candidateId))
                  if (bridgeId) {
                    warmResult = {
                      bridge_person_id:   bridgeId,
                      suggested_person_id: candidateId,
                      reasoning:          typeof wp.reasoning === 'string' ? wp.reasoning : '',
                    }
                  }
                }
              }
            }
          } catch (err) {
            console.error('[ai-suggest-match] warm path error:', err)
          }
        }
      }
    } catch (err) {
      console.error('[ai-suggest-match] warm path setup error:', err)
    }
  }

  // ── 9. Log the run for rate-limit tracking ────────────────────────────────
  const topSuggestion = directSuggestions[0] ?? null
  await fetch(db('smart_match_runs'), {
    method:  'POST',
    headers: dbHeaders,
    body: JSON.stringify({
      user_id:   userId,
      person1_id: topSuggestion?.person1Id ?? null,
      person2_id: topSuggestion?.person2Id ?? null,
      reasoning:  topSuggestion?.reasoning  ?? null,
      is_warm:    warmResult !== null && directSuggestions.length === 0,
    }),
  })

  return json({
    suggestions:  directSuggestions,
    warm_path:    warmResult,
    is_premium:   isPremium,
  })
})

// ── Haiku helper ──────────────────────────────────────────────────────────────

async function callHaiku(prompt: string, apiKey: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages:   [{ role: 'user', content: prompt }],
    }),
  })
  return res.json()
}
