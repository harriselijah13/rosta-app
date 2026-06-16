import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, inviteByEmailHtml } from '@/lib/resend'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { codeId, recipientEmail, recipientName, note } = body as {
    codeId: string
    recipientEmail: string
    recipientName?: string
    note?: string
  }

  if (!codeId || !recipientEmail) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: code } = await admin
    .from('invite_codes')
    .select('id, token, used_at')
    .eq('id', codeId)
    .eq('owner_id', user.id)
    .eq('type', 'founding_invite')
    .is('used_at', null)
    .maybeSingle()

  if (!code) {
    return NextResponse.json({ error: 'Code not found or already used' }, { status: 400 })
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .single()

  const firstName = profile?.first_name ?? 'Someone'
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'A ROSTA member'

  await sendEmail(
    recipientEmail,
    `${fullName} invited you to join ROSTA`,
    inviteByEmailHtml(fullName, firstName, code.token, recipientName || null, note || null),
  )

  await admin
    .from('invite_codes')
    .update({ reserved_for_email: recipientEmail })
    .eq('id', code.id)

  return NextResponse.json({ ok: true })
}
