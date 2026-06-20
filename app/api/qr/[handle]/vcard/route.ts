import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _request: NextRequest,
  { params }: { params: { handle: string } },
) {
  const { handle } = params
  const admin = createAdminClient()

  const isUuid = UUID_RE.test(handle)
  const { data: owner } = await admin
    .from('profiles')
    .select('first_name, last_name, what_i_do, onboarding_completed')
    .eq(isUuid ? 'id' : 'username', handle)
    .single()

  if (!owner || !owner.onboarding_completed) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const first = owner.first_name ?? ''
  const last  = owner.last_name  ?? ''
  const title = owner.what_i_do  ?? ''
  const fullName = [first, last].filter(Boolean).join(' ')

  // vCard 3.0 — plain text, works in all OS contact apps
  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${last};${first};;;`,
    `FN:${fullName}`,
    title ? `TITLE:${title}` : null,
    `NOTE:Met via ROSTA — app.onrosta.com`,
    `URL:https://app.onrosta.com/qr/${encodeURIComponent(handle)}`,
    'END:VCARD',
  ].filter(Boolean).join('\r\n')

  const filename = `${fullName.replace(/\s+/g, '-') || 'contact'}.vcf`

  return new NextResponse(vcf, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
