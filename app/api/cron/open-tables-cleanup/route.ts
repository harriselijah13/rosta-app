import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordCronRun } from '@/lib/cron-recorder'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('Authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient()

  const { error, count } = await admin
    .from('open_table_rooms')
    .delete({ count: 'exact' })
    .lt('expires_at', new Date().toISOString())

  if (error) {
    console.error('[open-tables-cleanup] delete failed', error)
    await recordCronRun('open-tables-cleanup', 'error', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await recordCronRun('open-tables-cleanup', 'ok', `deleted ${count ?? 0} expired rooms`)
  return NextResponse.json({ deleted: count ?? 0 })
}
