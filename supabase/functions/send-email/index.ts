import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM = 'ROSTA <hello@onrosta.com>'

const SUBJECTS: Record<string, string> = {
  signup:                 'Confirm your ROSTA account',
  recovery:               'Reset your ROSTA password',
  email_change_current:   'Confirm your email change',
  email_change_new:       'Confirm your new email address',
  magiclink:              'Your ROSTA login link',
  reauthentication:       'Confirm reauthentication',
}

function buildHtml(actionType: string, url: string): string {
  const btn = `<a href="${url}" style="display:inline-block;background:#0F1B3C;color:#ffffff;padding:13px 28px;border-radius:100px;text-decoration:none;font-weight:600;font-size:15px;">{{label}}</a>`

  const wrap = (heading: string, body: string, cta: string, footnote: string) => `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:48px 24px;background:#F5F2EE;">
      <p style="font-size:22px;font-weight:700;color:#0F1B3C;margin:0 0 4px;">ROSTA<span style="color:#C8F53C;">.</span></p>
      <hr style="border:none;border-top:1px solid #E5E1DB;margin:20px 0 32px;"/>
      <h1 style="font-size:26px;color:#0F1B3C;margin:0 0 12px;font-weight:700;">${heading}</h1>
      <p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 28px;">${body}</p>
      ${btn.replace('{{label}}', cta)}
      <p style="color:#6B7280;font-size:12px;margin-top:32px;line-height:1.5;">${footnote}</p>
    </div>`

  switch (actionType) {
    case 'signup':
      return wrap(
        'Confirm your account',
        'Welcome to ROSTA. Click below to verify your email address and activate your account.',
        'Confirm email',
        "If you didn't create a ROSTA account, you can safely ignore this email."
      )
    case 'recovery':
      return wrap(
        'Reset your password',
        'We received a request to reset your ROSTA password. This link expires in 1 hour.',
        'Reset password',
        "If you didn't request this, ignore this email — your password won't change."
      )
    case 'email_change_current':
    case 'email_change_new':
      return wrap(
        'Confirm your new email',
        'Click below to confirm your updated email address for ROSTA.',
        'Confirm new email',
        "If you didn't request this change, contact us immediately."
      )
    case 'magiclink':
      return wrap(
        'Your login link',
        'Click below to sign in to ROSTA. This link expires in 1 hour and can only be used once.',
        'Sign in to ROSTA',
        "If you didn't request this link, ignore this email."
      )
    default:
      return wrap('ROSTA', 'Click below to continue.', 'Continue', '')
  }
}

serve(async (req) => {
  try {
    const payload = await req.json()
    const { user, email_data } = payload
    const { token_hash, token_hash_new, email_action_type } = email_data

    // For email_change_new the new-address hash is in token_hash_new
    const hash = email_action_type === 'email_change_new' ? token_hash_new : token_hash

    console.log('[send-email] Hook received', {
      action:         email_action_type,
      to:             user?.email,
      hash:           hash ? `${hash.slice(0, 8)}...` : null,
      resend_key_set: !!RESEND_API_KEY,
    })

    if (!hash) {
      console.error('[send-email] No token_hash in payload — cannot build confirmation URL', email_data)
      return new Response(JSON.stringify({ error: 'missing_token_hash' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const confirmUrl = `https://app.onrosta.com/auth/callback?token_hash=${hash}&type=${email_action_type}`

    const subject = SUBJECTS[email_action_type] ?? 'ROSTA notification'
    const html = buildHtml(email_action_type, confirmUrl)

    const resendPayload = { from: FROM, to: [user.email], subject, html: '[omitted]' }
    console.log('[send-email] Calling Resend API', resendPayload)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: [user.email], subject, html }),
    })

    const resStatus = res.status
    const resBody = await res.text()
    console.log('[send-email] Resend response', { status: resStatus, body: resBody })

    if (!res.ok) {
      console.error('[send-email] Resend error', { status: resStatus, body: resBody })
      return new Response(JSON.stringify({ error: resBody }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let parsed: { id?: string } = {}
    try { parsed = JSON.parse(resBody) } catch { /* ignore */ }
    console.log('[send-email] Email sent', { resend_id: parsed.id, to: user.email })
    return new Response(JSON.stringify({ id: parsed.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Hook error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
