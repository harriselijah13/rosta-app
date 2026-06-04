import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const REF = 'gukouwplaofdydbetfoz'
const FREE_TIER_BYTES = 500 * 1024 * 1024 // 500 MB

const CRON_META: Record<string, { label: string; schedule: string }> = {
  'nudge':               { label: '48h connection nudge',     schedule: 'Daily at 09:00 UTC' },
  'message-notifications': { label: '24h message email',      schedule: 'Daily at 10:00 UTC' },
  'open-tables-match':   { label: 'Open Tables matching',     schedule: '1st of month, 08:00 UTC' },
  'open-tables-cleanup': { label: 'Open Tables cleanup',      schedule: 'Daily at 06:00 UTC' },
}

async function queryManagementApi(sql: string): Promise<unknown[] | null> {
  const token = process.env.SUPABASE_MANAGEMENT_API_KEY
  if (!token) return null
  try {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
      cache: 'no-store',
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

function relTime(iso: string | null): string {
  if (!iso) return 'Never'
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 2)    return 'Just now'
  if (m < 60)   return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)   return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function StatusBadge({ status }: { status: 'ok' | 'error' | 'never' }) {
  if (status === 'ok')    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />OK</span>
  if (status === 'error') return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />Error</span>
  return <span className="text-xs font-medium text-body-grey border border-border px-2 py-0.5 rounded-full">Never run</span>
}

export default async function SystemHealthPage() {
  const admin = createAdminClient()

  // Cron runs
  const { data: cronRows } = await admin.from('cron_runs').select('*')
  const cronMap = Object.fromEntries((cronRows ?? []).map(r => [r.cron_name, r]))

  // DB size + auth errors via management API (parallel)
  const [dbResult, authResult] = await Promise.all([
    queryManagementApi('SELECT pg_database_size(current_database()) AS bytes'),
    queryManagementApi(`
      SELECT count(*) AS count
      FROM auth.audit_log_entries
      WHERE created_at > now() - interval '24 hours'
        AND (payload->>'error' IS NOT NULL OR payload->>'error_description' IS NOT NULL)
    `),
  ])

  const dbBytes: number | null = dbResult?.[0] && typeof (dbResult[0] as Record<string, unknown>).bytes === 'number'
    ? (dbResult[0] as Record<string, unknown>).bytes as number
    : null
  const dbMb    = dbBytes != null ? (dbBytes / (1024 * 1024)).toFixed(1) : null
  const dbPct   = dbBytes != null ? Math.min(100, Math.round((dbBytes / FREE_TIER_BYTES) * 100)) : null

  const authErrors: number | null = authResult?.[0] != null
    ? Number((authResult[0] as Record<string, unknown>).count ?? 0)
    : null

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold text-navy">System Health</h1>

      {/* Cron jobs */}
      <section>
        <h2 className="font-display text-lg font-bold text-navy mb-3">Cron jobs</h2>
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Job', 'Schedule', 'Last run', 'Status', 'Detail'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-body-grey uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Object.entries(CRON_META).map(([name, meta]) => {
                const row = cronMap[name]
                const status: 'ok' | 'error' | 'never' = row ? row.status as 'ok' | 'error' : 'never'
                return (
                  <tr key={name} className="hover:bg-surface/50">
                    <td className="px-4 py-3 font-medium text-navy whitespace-nowrap">{meta.label}</td>
                    <td className="px-4 py-3 text-body-grey whitespace-nowrap text-xs">{meta.schedule}</td>
                    <td className="px-4 py-3 text-body-grey whitespace-nowrap">
                      {row ? (
                        <span title={new Date(row.last_ran_at).toLocaleString()}>
                          {relTime(row.last_ran_at)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={status} /></td>
                    <td className="px-4 py-3 text-body-grey text-xs max-w-[200px] truncate">{row?.detail ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-body-grey mt-2">
          Status is recorded the first time each cron runs after today&apos;s deploy. Rows will appear after the next scheduled execution.
        </p>
      </section>

      {/* Database */}
      <section>
        <h2 className="font-display text-lg font-bold text-navy mb-3">Database</h2>
        <div className="bg-white border border-border rounded-2xl p-5">
          {dbMb != null && dbPct != null ? (
            <div>
              <div className="flex items-end justify-between mb-2">
                <p className="text-sm text-navy">
                  <span className="font-display text-2xl font-bold">{dbMb}</span>
                  <span className="text-body-grey ml-1">MB used of 500 MB free tier</span>
                </p>
                <p className="text-sm font-medium text-navy">{dbPct}%</p>
              </div>
              <div className="h-3 bg-surface rounded-full overflow-hidden border border-border">
                <div
                  className={`h-full rounded-full transition-all ${dbPct > 80 ? 'bg-red-500' : dbPct > 60 ? 'bg-amber-400' : 'bg-navy'}`}
                  style={{ width: `${dbPct}%` }}
                />
              </div>
              {dbPct > 80 && (
                <p className="text-xs text-red-600 mt-2 font-medium">
                  Database approaching free tier limit. Consider upgrading your Supabase plan.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-body-grey">
              Database size unavailable.{' '}
              {!process.env.SUPABASE_MANAGEMENT_API_KEY && 'Set SUPABASE_MANAGEMENT_API_KEY to enable.'}
            </p>
          )}
        </div>
      </section>

      {/* Auth errors */}
      <section>
        <h2 className="font-display text-lg font-bold text-navy mb-3">Auth errors (last 24h)</h2>
        <div className="bg-white border border-border rounded-2xl p-5">
          {authErrors != null ? (
            <div className="flex items-center gap-3">
              <p className={`font-display text-3xl font-bold ${authErrors > 0 ? 'text-red-600' : 'text-navy'}`}>
                {authErrors}
              </p>
              <p className="text-sm text-body-grey">
                {authErrors === 0
                  ? 'No auth errors in the last 24 hours.'
                  : `auth error event${authErrors !== 1 ? 's' : ''} logged. Review the Supabase Auth logs for details.`}
              </p>
            </div>
          ) : (
            <p className="text-sm text-body-grey">Auth error count unavailable.</p>
          )}
        </div>
      </section>
    </div>
  )
}
