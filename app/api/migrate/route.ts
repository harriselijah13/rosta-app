import { NextResponse, type NextRequest } from 'next/server'

// One-time migration endpoint — REMOVE this file after running.
// Protected by CRON_SECRET to prevent unauthorised execution.

const SQL = `
CREATE TABLE IF NOT EXISTS event_attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tapped_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  prompt_shown_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_attendances_user
  ON event_attendances (user_id);

CREATE INDEX IF NOT EXISTS idx_event_attendances_pending
  ON event_attendances (user_id)
  WHERE completed_at IS NULL AND dismissed_at IS NULL;
`

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('Authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const managementKey = process.env.SUPABASE_MANAGEMENT_API_KEY
  if (!managementKey) {
    return NextResponse.json({ error: 'SUPABASE_MANAGEMENT_API_KEY not set' }, { status: 500 })
  }

  const projectRef = 'gukouwplaofdydbetfoz'
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${managementKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: SQL }),
  })

  const data = await res.json()

  if (!res.ok) {
    console.error('[migrate] Supabase management API error', data)
    return NextResponse.json({ error: data }, { status: res.status })
  }

  return NextResponse.json({ ok: true, result: data })
}
