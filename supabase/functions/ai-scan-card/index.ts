// verify_jwt: true
// Vision extraction for business card scan. Uses claude-sonnet-4-6
// (Haiku cannot do vision). Same CORS + Bearer auth pattern as ai-signal-coach.

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

function userIdFromAuth(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const parts = authHeader.slice(7).split('.')
  if (parts.length !== 3) return null
  try {
    const padded  = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(padded))
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch { return null }
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
  const { imageBase64, mimeType } = body ?? {}

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return new Response(JSON.stringify({ error: 'imageBase64 required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const safeMime = VALID_MIME.includes(mimeType) ? mimeType : 'image/jpeg'

  // Rate limit: 20 calls per user per hour
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const rlRes   = await fetch(`${supabaseUrl}/rest/v1/rpc/check_ai_rate_limit`, {
    method: 'POST',
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ _uid: userId, _fn_name: 'ai-scan-card', _max_calls: 20, _window_minutes: 60 }),
  })
  if (!(await rlRes.json().catch(() => false))) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
      status: 429, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
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
        model:      'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            {
              type:   'image',
              source: { type: 'base64', media_type: safeMime, data: imageBase64 },
            },
            {
              type: 'text',
              text: 'Extract the contact information from this business card. Return only JSON with fields: name, email, company, role, phone. If a field is not visible return null. Return nothing else.',
            },
          ],
        }],
      }),
    })

    const data  = await res.json()
    const raw   = (data?.content?.[0]?.text ?? '').trim()
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) {
      return new Response(JSON.stringify({ error: 'Could not read card' }), {
        status: 422, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const parsed = JSON.parse(match[0])
    return new Response(
      JSON.stringify({
        name:    parsed.name    ?? null,
        email:   parsed.email   ?? null,
        company: parsed.company ?? null,
        role:    parsed.role    ?? null,
        phone:   parsed.phone   ?? null,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[ai-scan-card] error', err)
    return new Response(JSON.stringify({ error: 'Failed to process image' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
