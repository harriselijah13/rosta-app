import { createAdminClient } from '@/lib/supabase/admin'
import GeographyChart, { type LocationRow } from './GeographyChart'

export const dynamic = 'force-dynamic'

function normalise(raw: string | null): string | null {
  if (!raw?.trim()) return null
  // Collapse whitespace, title-case for consistent grouping
  return raw.trim().replace(/\s+/g, ' ')
}

function monthStart() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

export default async function GeographyPage() {
  const admin = createAdminClient()
  const since = monthStart()

  const [{ data: allProfiles }, { data: newProfiles }] = await Promise.all([
    admin
      .from('profiles')
      .select('where_i_operate')
      .eq('onboarding_completed', true),
    admin
      .from('profiles')
      .select('where_i_operate')
      .eq('onboarding_completed', true)
      .gte('created_at', since),
  ])

  // Aggregate totals
  const totalMap: Record<string, number> = {}
  for (const p of allProfiles ?? []) {
    const loc = normalise(p.where_i_operate)
    if (!loc) continue
    totalMap[loc] = (totalMap[loc] ?? 0) + 1
  }

  const newMap: Record<string, number> = {}
  for (const p of newProfiles ?? []) {
    const loc = normalise(p.where_i_operate)
    if (!loc) continue
    newMap[loc] = (newMap[loc] ?? 0) + 1
  }

  const noLocation = (allProfiles ?? []).filter(p => !p.where_i_operate?.trim()).length
  const noLocationNew = (newProfiles ?? []).filter(p => !p.where_i_operate?.trim()).length

  // Build sorted rows (descending by total)
  const rows: LocationRow[] = Object.entries(totalMap)
    .map(([location, total]) => ({
      location,
      total,
      newThisMonth: newMap[location] ?? 0,
    }))
    .sort((a, b) => b.total - a.total)

  // Pull out RAK and London for featured display
  const RAK    = rows.find(r => /rak|ras al|united arab|uae/i.test(r.location))
  const London = rows.find(r => /london/i.test(r.location))
  const others = rows.filter(r => r !== RAK && r !== London)

  const totalMembers = (allProfiles ?? []).length

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold text-navy">Member Geography</h1>

      {/* Featured locations */}
      <section>
        <h2 className="font-display text-lg font-bold text-navy mb-3">Key locations</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            RAK    ?? { location: 'RAK / UAE', total: 0, newThisMonth: 0 },
            London ?? { location: 'London',    total: 0, newThisMonth: 0 },
          ].map(row => (
            <div key={row.location} className="bg-white border border-border rounded-2xl px-5 py-4">
              <p className="font-display text-3xl font-bold text-navy leading-none mb-1">{row.total}</p>
              <p className="text-xs text-body-grey">{row.location}</p>
              {row.newThisMonth > 0 && (
                <p className="text-xs text-navy font-medium mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
                  +{row.newThisMonth} this month
                </p>
              )}
            </div>
          ))}
          <div className="bg-white border border-border rounded-2xl px-5 py-4">
            <p className="font-display text-3xl font-bold text-navy leading-none mb-1">{others.reduce((s, r) => s + r.total, 0)}</p>
            <p className="text-xs text-body-grey">Other locations</p>
          </div>
          <div className="bg-white border border-border rounded-2xl px-5 py-4">
            <p className="font-display text-3xl font-bold text-navy leading-none mb-1">{noLocation}</p>
            <p className="text-xs text-body-grey">No location set</p>
            {noLocationNew > 0 && (
              <p className="text-xs text-navy font-medium mt-1">+{noLocationNew} this month</p>
            )}
          </div>
        </div>
      </section>

      {/* Bar chart — all locations */}
      {rows.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold text-navy mb-1">All locations</h2>
          <p className="text-xs text-body-grey mb-4">
            Navy = total members · Lime = new this month
          </p>
          <div className="bg-white border border-border rounded-2xl p-5">
            <GeographyChart data={rows} />
          </div>
        </section>
      )}

      {/* Text list */}
      {others.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold text-navy mb-3">Other locations</h2>
          <div className="bg-white border border-border rounded-2xl divide-y divide-border overflow-hidden">
            {others.map(row => (
              <div key={row.location} className="flex items-center justify-between px-5 py-3">
                <p className="text-sm text-navy">{row.location}</p>
                <div className="flex items-center gap-4">
                  {row.newThisMonth > 0 && (
                    <p className="text-xs text-navy font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
                      +{row.newThisMonth} this month
                    </p>
                  )}
                  <p className="text-sm font-medium text-navy w-6 text-right">{row.total}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-body-grey">
        Based on {totalMembers} members · Location = &quot;Where I operate&quot; profile field
      </p>
    </div>
  )
}
