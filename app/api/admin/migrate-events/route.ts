import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// One-time migration endpoint — remove after use
// Protected by MIGRATION_SECRET env var
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const key = process.env.SUPABASE_MANAGEMENT_API_KEY
  if (!key) return NextResponse.json({ error: 'SUPABASE_MANAGEMENT_API_KEY not set' }, { status: 500 })

  const REF = 'gukouwplaofdydbetfoz'

  async function runSql(label: string, query: string) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const text = await r.text()
    if (!r.ok) throw new Error(`${label} failed (HTTP ${r.status}): ${text}`)
    return JSON.parse(text)
  }

  try {
    await runSql('add event_name', `ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS event_name TEXT`)
    await runSql('add event_date', `ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS event_date DATE`)
    await runSql('add event_location', `ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS event_location TEXT`)
    await runSql('add organiser_name', `ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS organiser_name TEXT`)
    await runSql('add organiser_email', `ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS organiser_email TEXT`)
    await runSql('add event_notes', `ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS event_notes TEXT`)

    // Verify
    const cols = await runSql('verify', `
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'invite_codes'
        AND column_name IN ('event_name','event_date','event_location','organiser_name','organiser_email','event_notes')
      ORDER BY column_name
    `)

    return NextResponse.json({ ok: true, columns_added: cols.map((c: { column_name: string }) => c.column_name) })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
