import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function pct(num: number, den: number): string {
  if (den === 0) return '0%'
  return `${Math.round((num / den) * 100)}%`
}

function currentMonthPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthStart() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

function MetricCard({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-white border border-border rounded-2xl px-5 py-4">
      <p className="font-display text-3xl font-bold text-navy leading-none mb-1">{value}</p>
      <p className="text-xs text-body-grey flex items-center gap-1.5">
        {accent && <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />}
        {label}
      </p>
      {sub && <p className="text-xs text-body-grey mt-0.5">{sub}</p>}
    </div>
  )
}

function ScoreBar({ label, count, total }: { label: string; count: number; total: number }) {
  const width = total === 0 ? 0 : Math.round((count / total) * 100)
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-body-grey w-16 shrink-0">{label}</p>
      <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
        <div className="h-full bg-navy rounded-full" style={{ width: `${width}%` }} />
      </div>
      <p className="text-xs font-medium text-navy w-8 text-right shrink-0">{count}</p>
    </div>
  )
}

export default async function NetworkHealthPage() {
  const admin = createAdminClient()
  const period = currentMonthPeriod()
  const monthStartIso = monthStart()

  const [
    { count: totalMembers },
    { count: completeMembers },
    { data: allConnections },
    { count: totalIntroRequests },
    { count: acceptedIntros },
    { data: convos },
    { data: outcomeConvoIds },
    { data: creditsRows },
    { count: totalIntrosThisMonth },
    { count: openTablesNow },
    { count: optinsThisMonth },
    { data: introsByFacilitator },
    { data: invitesByOwner },
  ] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarding_completed', true),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarding_completed', true).not('first_name', 'is', null).not('building_now', 'is', null),
    admin.from('connections').select('user_a, user_b'),
    admin.from('intro_requests').select('id', { count: 'exact', head: true }),
    admin.from('intro_requests').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
    admin.from('conversations').select('id, last_message_at'),
    admin.from('outcomes').select('conversation_id'),
    admin.from('intro_credits').select('balance, period').eq('period', period),
    admin.from('intro_requests').select('id', { count: 'exact', head: true }).gte('created_at', monthStartIso),
    admin.from('open_table_rooms').select('id', { count: 'exact', head: true }).gt('expires_at', new Date().toISOString()),
    admin.from('open_table_optins').select('id', { count: 'exact', head: true }).eq('period', period),
    // For connector score distribution: count accepted intros per facilitator
    admin.from('intro_requests').select('facilitator_id').eq('status', 'accepted').eq('type', 'warm_intro').not('facilitator_id', 'is', null),
    // Count used founding invites per owner
    admin.from('invite_codes').select('owner_id').eq('type', 'founding_invite').not('used_at', 'is', null),
  ])

  // ── Connection rate ─────────────────────────────────────────────────────────
  const memberIdsWithConns = new Set<string>()
  for (const c of allConnections ?? []) {
    memberIdsWithConns.add(c.user_a)
    memberIdsWithConns.add(c.user_b)
  }
  const membersWithConnections = memberIdsWithConns.size
  const totalConvos = (convos ?? []).length
  const convosWithMessages = (convos ?? []).filter(c => !!c.last_message_at).length
  const outcomeConvoSet = new Set((outcomeConvoIds ?? []).map(o => o.conversation_id))
  const convosWithOutcomes = outcomeConvoSet.size

  // ── Credits ─────────────────────────────────────────────────────────────────
  const membersWithCredits = (creditsRows ?? []).length
  const creditsRemaining   = (creditsRows ?? []).reduce((s, r) => s + (r.balance ?? 0), 0)
  // Each member gets 3 base credits per month
  const creditsIssued = (totalMembers ?? 0) * 3
  const creditsUsed   = Math.max(0, creditsIssued - creditsRemaining)

  // ── Connector score distribution ────────────────────────────────────────────
  const scoreMap: Record<string, number> = {}
  for (const r of introsByFacilitator ?? []) {
    if (r.facilitator_id) scoreMap[r.facilitator_id] = (scoreMap[r.facilitator_id] ?? 0) + 1
  }
  for (const r of invitesByOwner ?? []) {
    scoreMap[r.owner_id] = (scoreMap[r.owner_id] ?? 0) + 1
  }
  const total = totalMembers ?? 0
  const scored = Object.values(scoreMap)
  const inRange0   = total - scored.length
  const inRange1   = scored.filter(s => s >= 1  && s <= 10).length
  const inRange11  = scored.filter(s => s >= 11 && s <= 50).length
  const inRange50  = scored.filter(s => s > 50).length

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold text-navy">Network Health</h1>

      {/* Activation metrics */}
      <section>
        <h2 className="font-display text-lg font-bold text-navy mb-3">Activation</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard
            label="Profile completion"
            value={pct(completeMembers ?? 0, total)}
            sub={`${completeMembers ?? 0} of ${total}`}
          />
          <MetricCard
            label="Connection rate"
            value={pct(membersWithConnections, total)}
            sub={`${membersWithConnections} with 1+ connection`}
          />
          <MetricCard
            label="Intro conversion"
            value={pct(acceptedIntros ?? 0, totalIntroRequests ?? 0)}
            sub={`${acceptedIntros ?? 0} accepted of ${totalIntroRequests ?? 0} sent`}
          />
          <MetricCard
            label="Message rate"
            value={pct(convosWithMessages, totalConvos)}
            sub={`${convosWithMessages} of ${totalConvos} connections messaged`}
          />
          <MetricCard
            label="Outcome rate"
            value={pct(convosWithOutcomes, totalConvos)}
            sub={`${convosWithOutcomes} connections led to something`}
          />
        </div>
      </section>

      {/* Connector score distribution */}
      <section>
        <h2 className="font-display text-lg font-bold text-navy mb-3">Connector Score distribution</h2>
        <div className="bg-white border border-border rounded-2xl p-5 space-y-3 max-w-md">
          <ScoreBar label="Score 0"    count={inRange0}  total={total} />
          <ScoreBar label="1 – 10"     count={inRange1}  total={total} />
          <ScoreBar label="11 – 50"    count={inRange11} total={total} />
          <ScoreBar label="50+"        count={inRange50} total={total} />
          <p className="text-xs text-body-grey pt-2 border-t border-border">
            Score = accepted intros facilitated + founding invites used. Approximate.
          </p>
        </div>
      </section>

      {/* Credits + Open Tables */}
      <section>
        <h2 className="font-display text-lg font-bold text-navy mb-3">This month</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Credits issued"         value={creditsIssued.toString()} sub={`${total} members × 3`} />
          <MetricCard label="Credits used (est.)"    value={creditsUsed.toString()}   sub={`${creditsRemaining} remaining across ${membersWithCredits} active`} />
          <MetricCard label="Intro requests sent"    value={(totalIntrosThisMonth ?? 0).toString()} />
          <MetricCard label="Open Tables running"    value={(openTablesNow ?? 0).toString()} sub={`${optinsThisMonth ?? 0} opted in this month`} accent />
        </div>
      </section>
    </div>
  )
}
