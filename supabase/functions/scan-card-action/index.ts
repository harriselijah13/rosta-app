// verify_jwt: true
// Handles connect and invite actions for scanned business cards.
// Connect requires admin auth API to look up user by email (not available client-side).
// Invite requires RESEND_API_KEY (server-only).
// Save has no such requirements and is handled directly from the native client under RLS.

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FROM = 'ROSTA <hello@onrosta.com>'

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

function buildInviteHtml(
  recipientName: string,
  senderName:    string,
  metAt:         string,
  inviteCode:    string | null,
): string {
  const joinUrl  = inviteCode
    ? `https://app.onrosta.com/signup?invite=${inviteCode}`
    : 'https://app.onrosta.com/signup'
  const codeNote = inviteCode
    ? ` — use invite code: <strong>${inviteCode}</strong>`
    : ''
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:48px 24px;background:#F5F2EE;">
      <p style="font-size:22px;font-weight:700;color:#0F1B3C;margin:0 0 4px;">ROSTA<span style="color:#C8F53C;">.</span></p>
      <hr style="border:none;border-top:1px solid #E5E1DB;margin:20px 0 32px;"/>
      <h1 style="font-size:26px;color:#0F1B3C;margin:0 0 12px;font-weight:700;">${senderName} wants to stay connected</h1>
      <p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 28px;white-space:pre-line;">Hi ${recipientName},\n\n${senderName} met you at ${metAt} and wants to stay connected. They use ROSTA — a professional network built around real introductions.\n\nJoin here${codeNote}.</p>
      <a href="${joinUrl}" style="display:inline-block;background:#0F1B3C;color:#ffffff;padding:13px 28px;border-radius:100px;text-decoration:none;font-weight:600;font-size:15px;">Join ROSTA</a>
    </div>`
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
  const {
    action, cardId,
    name, email, company, role, phone,
    location, date_met, notes, met_at,
  } = body ?? {}

  if (!action || !['connect', 'invite'].includes(action)) {
    return new Response(JSON.stringify({ error: 'action must be connect or invite' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const dbHeaders   = {
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type':  'application/json',
    'Accept':        'application/json',
  }

  async function saveCard(actionTaken: 'connected' | 'invited') {
    if (cardId) {
      await fetch(
        `${supabaseUrl}/rest/v1/scanned_cards?id=eq.${cardId}&user_id=eq.${userId}`,
        { method: 'PATCH', headers: dbHeaders, body: JSON.stringify({ action_taken: actionTaken }) },
      )
    } else {
      await fetch(
        `${supabaseUrl}/rest/v1/scanned_cards`,
        {
          method:  'POST',
          headers: { ...dbHeaders, Prefer: 'return=minimal' },
          body: JSON.stringify({
            user_id:      userId,
            name:         name?.trim()     || null,
            email:        email?.trim()    || null,
            company:      company?.trim()  || null,
            role:         role?.trim()     || null,
            phone:        phone?.trim()    || null,
            location:     location?.trim() || null,
            date_met:     date_met         || null,
            notes:        notes?.trim()    || null,
            met_at:       met_at           || null,
            action_taken: actionTaken,
          }),
        },
      )
    }
  }

  // ── CONNECT ───────────────────────────────────────────────────────────────────

  if (action === 'connect') {
    if (!email?.trim()) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const usersRes  = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    )
    const usersData = await usersRes.json()
    const match     = (usersData.users ?? []).find(
      (u: { id: string; email?: string }) =>
        u.email?.toLowerCase() === email.trim().toLowerCase(),
    )

    if (!match) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (match.id === userId) {
      return new Response(JSON.stringify({ error: 'That is your own email address' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const [ua, ub] = [userId, match.id].sort()

    const existingRes = await fetch(
      `${supabaseUrl}/rest/v1/connections?user_a=eq.${ua}&user_b=eq.${ub}&select=id&limit=1`,
      { headers: dbHeaders },
    )
    const existing = await existingRes.json()

    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${match.id}&select=first_name,last_name&limit=1`,
      { headers: dbHeaders },
    )
    const [profile]  = await profileRes.json()
    const memberName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'This member'

    if (existing?.[0]) {
      await saveCard('connected')
      return new Response(JSON.stringify({ found: true, already_connected: true, memberName }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    await fetch(`${supabaseUrl}/rest/v1/connections`, {
      method:  'POST',
      headers: { ...dbHeaders, Prefer: 'return=minimal' },
      body:    JSON.stringify({ user_a: ua, user_b: ub, origin: 'scanned_card' }),
    })

    await fetch(`${supabaseUrl}/rest/v1/conversations`, {
      method:  'POST',
      headers: { ...dbHeaders, Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body:    JSON.stringify({ user_a: ua, user_b: ub }),
    })

    await saveCard('connected')

    return new Response(JSON.stringify({ found: true, connected: true, memberName }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // ── INVITE ────────────────────────────────────────────────────────────────────

  if (action === 'invite') {
    if (!email?.trim()) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      console.error('[scan-card-action] RESEND_API_KEY not set')
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const [senderRes, codesRes] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=first_name,last_name&limit=1`,
        { headers: dbHeaders },
      ),
      fetch(
        `${supabaseUrl}/rest/v1/invite_codes?owner_id=eq.${userId}&type=eq.founding_invite&used_at=is.null&limit=1&select=token`,
        { headers: dbHeaders },
      ),
    ])

    const [sender]   = await senderRes.json()
    const [codeRow]  = await codesRes.json()
    const senderName = [sender?.first_name, sender?.last_name].filter(Boolean).join(' ') || 'A ROSTA member'
    const inviteCode = codeRow?.token ?? null
    const displayMet = met_at || location || 'a recent event'

    const emailRes = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        from:    FROM,
        to:      [email.trim()],
        subject: `${senderName} wants to connect on ROSTA`,
        html:    buildInviteHtml(name?.trim() || 'there', senderName, displayMet, inviteCode),
      }),
    })

    if (!emailRes.ok) {
      const errBody = await emailRes.text()
      console.error('[scan-card-action] Resend error', { status: emailRes.status, body: errBody })
      return new Response(JSON.stringify({ error: 'Failed to send invite' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    await saveCard('invited')

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
