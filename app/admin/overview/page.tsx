import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function fetchStats() {
  const admin = createAdminClient()
  const now = new Date()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const fifteenMinsAgo  = new Date(now.getTime() - 15 * 60 * 1000).toISOString()

  const [
    { count: totalMembers },
    { count: activeLast14d },
    { count: onlineNow },
    { count: totalConnections },
    { count: totalIntros },
    { count: totalOutcomes },
    { count: verifiedMembers },
    { count: pendingVerifications },
    { count: awaitingOnboarding },
  ] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarding_completed', true),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarding_completed', true).gte('last_active_at', fourteenDaysAgo),
    admin.from('profiles').select('id', { count: 'exact', head: true }).gte('last_active_at', fifteenMinsAgo),
    admin.from('connections').select('user_a', { count: 'exact', head: true }),
    admin.from('intro_requests').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
    admin.from('outcomes').select('id', { count: 'exact', head: true }),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_verified', true),
    admin.from('verification_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarding_completed', false),
  ])

  return {
    totalMembers:         totalMembers         ?? 0,
    activeLast14d:        activeLast14d        ?? 0,
    onlineNow:            onlineNow            ?? 0,
    totalConnections:     totalConnections     ?? 0,
    totalIntros:          totalIntros          ?? 0,
    totalOutcomes:        totalOutcomes        ?? 0,
    verifiedMembers:      verifiedMembers      ?? 0,
    pendingVerifications: pendingVerifications ?? 0,
    awaitingOnboarding:   awaitingOnboarding   ?? 0,
  }
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-white border border-border rounded-2xl px-5 py-4">
      <p className="font-display text-3xl font-bold text-navy leading-none mb-1">
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-body-grey flex items-center gap-1.5">
        {accent && <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0 animate-pulse" />}
        {label}
      </p>
    </div>
  )
}

export default async function OverviewPage() {
  const stats = await fetchStats()

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-navy mb-6">Overview</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-3">
        <Stat label="Total members"       value={stats.totalMembers} />
        <Stat label="Active last 14 days" value={stats.activeLast14d} />
        <Stat label="Online now"          value={stats.onlineNow} accent />
        <Stat label="Connections"         value={stats.totalConnections} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Stat label="Intros made"           value={stats.totalIntros} />
        <Stat label="Outcomes marked"       value={stats.totalOutcomes} />
        <Stat label="Verified members"      value={stats.verifiedMembers} />
        <Stat label="Pending verifications" value={stats.pendingVerifications} accent={stats.pendingVerifications > 0} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
        <Stat label="Awaiting onboarding" value={stats.awaitingOnboarding} accent={stats.awaitingOnboarding > 0} />
      </div>

      <p className="mt-4 text-xs text-body-grey">
        Updates on page refresh. Online now = active in last 15 minutes.
      </p>
    </div>
  )
}
