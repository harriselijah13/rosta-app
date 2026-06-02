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
    const { token_hash, email_action_type, redirect_to, site_url } = email_data

    console.log(`[send-email] Hook fired — action: ${email_action_type}, to: ${user?.email}`)

    const confirmUrl = token_hash
      ? `${site_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirect_to)}`
      : redirect_to

    const subject = SUBJECTS[email_action_type] ?? 'ROSTA notification'
    const html = buildHtml(email_action_type, confirmUrl)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: [user.email], subject, html }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return new Response(JSON.stringify({ error: err }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    console.log('Email sent via Resend:', data.id, '→', user.email)
    return new Response(JSON.stringify({ id: data.id }), {
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
