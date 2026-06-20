import { NextResponse, type NextRequest } from 'next/server'
import { sendEmail } from '@/lib/resend'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const { name, email, why, ref } = body ?? {}

  if (!name || !email || !why) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  await sendEmail(
    'harris@onrosta.com',
    `ROSTA join request: ${name}`,
    `<div style="font-family:sans-serif;max-width:480px;padding:32px 24px;">
      <p style="font-size:18px;font-weight:700;color:#0F1B3C;margin:0 0 16px;">New join request</p>
      <table style="border-collapse:collapse;font-size:14px;">
        <tr><td style="color:#6B7280;padding:3px 16px 3px 0;white-space:nowrap;">Name</td><td style="color:#0F1B3C;">${name}</td></tr>
        <tr><td style="color:#6B7280;padding:3px 16px 3px 0;white-space:nowrap;">Email</td><td style="color:#0F1B3C;"><a href="mailto:${email}" style="color:#0F1B3C;">${email}</a></td></tr>
        ${ref ? `<tr><td style="color:#6B7280;padding:3px 16px 3px 0;white-space:nowrap;">Via QR</td><td style="color:#0F1B3C;"><a href="https://app.onrosta.com/qr/${ref}" style="color:#0F1B3C;">@${ref}</a></td></tr>` : ''}
      </table>
      <p style="font-size:13px;color:#6B7280;margin:16px 0 4px;font-weight:600;">Why interested:</p>
      <p style="font-size:14px;color:#0F1B3C;margin:0;">${why}</p>
    </div>`,
  )

  return NextResponse.json({ ok: true })
}
