import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeConnectorScore } from '@/lib/connector-score'
import { OPEN_TO_OPTIONS } from '@/lib/constants'

const OPEN_TO_MAP = Object.fromEntries(OPEN_TO_OPTIONS.map(o => [o.value, o.label]))

// ─── helpers ─────────────────────────────────────────────────────────────────

function currentPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function timeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3600000)
  if (h >= 24) return `${Math.floor(h / 24)}d left`
  return `${h}h left`
}

function displayName(p: { first_name: string | null; last_name: string | null } | undefined): string {
  return [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'A member'
}

function activityLabel(working_on: string | null, need_right_now: string | null): string {
  if (working_on) return "Updated what they're building"
  if (need_right_now) return 'Updated what they need right now'
  return 'Updated their signals'
}

// ─── sub-components ──────────────────────────────────────────────────────────

function Eyebrow({ label }: { label: string }) {
  return (
    <p className="text-navy text-xs font-medium tracking-widest uppercase mb-3 flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
      {label}
    </p>
  )
}

function StatCard({
  label,
  value,
  href,
  lime,
}: {
  label: string
  value: number | string
  href?: string
  lime?: boolean
}) {
  const inner = (
    <div
      className={`rounded-2xl px-5 py-4 border transition-shadow ${
        lime
          ? 'bg-lime/10 border-lime/40'
          : 'bg-white border-border hover:shadow-sm'
      }`}
    >
      <p className="font-display text-3xl font-bold text-navy leading-none mb-1">{value}</p>
      <p className="text-xs text-body-grey">{label}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const period = currentPeriod()

  // ── Round 1: parallel base fetches ───────────────────────────────────────
  const [
    { data: profile },
    { data: pendingRows },
    { data: myConnections },
    { data: mySignals },
    { data: creditsRow },
  ] = await Promise.all([
    supabase.from('profiles').select('first_name, username').eq('id', user.id).single(),
    admin
      .from('intro_requests')
      .select('id, type, requester_id, target_id, facilitator_id, expires_at')
      .or(`facilitator_id.eq.${user.id},target_id.eq.${user.id}`)
      .eq('status', 'pending')
      .gt('expires_at', now)
      .order('expires_at', { ascending: true }),
    admin
      .from('connections')
      .select('user_a, user_b')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
    // Expanded signals — we show the user's own signals on the dashboard
    admin
      .from('signals')
      .select('open_to, working_on, need_right_now, updated_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    admin.from('intro_credits').select('balance, period').eq('user_id', user.id).maybeSingle(),
  ])

  const connectionIds = (myConnections ?? []).map(c =>
    c.user_a === user.id ? c.user_b : c.user_a,
  )

  const pendingActions = (pendingRows ?? []).filter(
    r =>
      (r.type === 'warm_intro' && r.facilitator_id === user.id) ||
      (r.type === 'open_door' && r.target_id === user.id),
  )

  // ── Round 2: dependent fetches ────────────────────────────────────────────
  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString()

  const [
    { data: activitySignals },
    { count: introsMadeCount },
    { count: outcomesThisMonth },
    connectorScore,
  ] = await Promise.all([
    connectionIds.length > 0
      ? admin
          .from('signals')
          .select('user_id, updated_at, working_on, need_right_now')
          .in('user_id', connectionIds)
          .gt('updated_at', sevenDaysAgo)
          .order('updated_at', { ascending: false })
          .limit(8)
      : Promise.resolve({
          data: [] as {
            user_id: string
            updated_at: string
            working_on: string | null
            need_right_now: string | null
          }[],
        }),
    connectionIds.length > 0
      ? admin
          .from('intro_requests')
          .select('id', { count: 'exact', head: true })
          .eq('requester_id', user.id)
      : Promise.resolve({ count: 0 }),
    admin
      .from('outcomes')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart),
    computeConnectorScore(user.id),
  ])

  // ── Round 3: profiles for referenced users ────────────────────────────────
  const activityIds = (activitySignals ?? []).map(s => s.user_id)
  const pendingPartyIds = pendingActions.flatMap(r =>
    [r.requester_id, r.target_id].filter(Boolean),
  )
  const allProfileIds = Array.from(new Set([...activityIds, ...pendingPartyIds]))

  const { data: profiles } =
    allProfileIds.length > 0
      ? await admin
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, username')
          .in('id', allProfileIds)
      : {
          data: [] as {
            id: string
            first_name: string | null
            last_name: string | null
            avatar_url: string | null
            username: string | null
          }[],
        }

  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const slug = (id: string) => byId[id]?.username ?? id

  // ── Derived state ─────────────────────────────────────────────────────────
  const firstName = profile?.first_name ?? null
  const signalsStale =
    !mySignals || new Date(mySignals.updated_at) < new Date(fourteenDaysAgo)
  const creditBalance =
    !creditsRow || creditsRow.period !== period ? 3 : creditsRow.balance
  const hasConnections = connectionIds.length > 0
  const networkActivity = activitySignals ?? []
  const realOutcomes = outcomesThisMonth ?? 0

  // Matchmaker: two connections with recent signal activity
  const connWithSignals = (activitySignals ?? []).map(s => s.user_id)
  const matchPair =
    connWithSignals.length >= 2
      ? ([connWithSignals[0], connWithSignals[1]] as [string, string])
      : null

  // Contextual nudge (credits are in the stats row — this is action-oriented)
  const nudge = (() => {
    if (signalsStale)
      return {
        text: "Your signals haven't been updated in a while — members can see when you're active.",
        linkLabel: 'Update signals',
        href: '/settings',
      }
    if (hasConnections && (introsMadeCount ?? 0) === 0)
      return {
        text: "Making introductions is how ROSTA works. Who in your network should meet someone?",
        linkLabel: 'Browse members',
        href: '/members',
      }
    return null
  })()

  const myOpenTo = (mySignals?.open_to ?? []).filter(
    (v: string) => v !== 'open_door',
  )

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="font-display text-4xl font-bold text-navy">
          {firstName ? `Good to see you, ${firstName}.` : 'Good to see you.'}
        </h1>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard
          label="Connections"
          value={connectionIds.length}
          href="/members"
        />
        <StatCard
          label="Intro credits"
          value={creditBalance}
          href="/intro"
        />
        <StatCard
          label="Connector Score"
          value={connectorScore.total}
          href={`/profile/${profile?.username ?? user.id}`}
        />
        <StatCard
          label="Outcomes this month"
          value={realOutcomes}
          lime={realOutcomes > 0}
        />
      </div>

      {/* ── My signals ── */}
      {mySignals ? (
        <div className="bg-white border border-border rounded-2xl p-6 mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h2 className="font-display text-lg font-bold text-navy">Your signals</h2>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  signalsStale ? 'bg-body-grey/30' : 'bg-green-500'
                }`}
              />
              <span className="text-xs text-body-grey">
                {signalsStale ? 'Inactive' : 'Active on ROSTA'}
              </span>
              <Link
                href="/settings"
                className="text-xs font-medium text-navy hover:underline ml-2"
              >
                {signalsStale ? 'Update →' : 'Edit →'}
              </Link>
            </div>
          </div>
          <div className="space-y-3">
            {mySignals.working_on && (
              <div>
                <p className="text-xs font-medium text-body-grey uppercase tracking-wide mb-0.5">
                  Working on
                </p>
                <p className="text-sm text-navy">{mySignals.working_on}</p>
              </div>
            )}
            {mySignals.need_right_now && (
              <div>
                <p className="text-xs font-medium text-body-grey uppercase tracking-wide mb-0.5">
                  Need right now
                </p>
                <p className="text-sm text-navy">{mySignals.need_right_now}</p>
              </div>
            )}
            {myOpenTo.length > 0 && (
              <div>
                <p className="text-xs font-medium text-body-grey uppercase tracking-wide mb-1.5">
                  Open to
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {myOpenTo.map((v: string) => (
                    <span
                      key={v}
                      className="text-xs px-2.5 py-1 rounded-full bg-surface border border-border text-body-grey"
                    >
                      {OPEN_TO_MAP[v] ?? v}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {signalsStale && (
            <p className="text-xs text-body-grey mt-4 pt-4 border-t border-border">
              Last updated over 14 days ago — keep your signals fresh so your network knows what you need.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl p-6 mb-8">
          <p className="text-sm font-medium text-navy mb-1">Set your signals</p>
          <p className="text-sm text-body-grey mb-4">
            Tell your network what you&apos;re building and what you need.
          </p>
          <Link
            href="/settings"
            className="text-sm font-medium bg-navy text-warm-white px-5 py-2.5 rounded-full hover:bg-navy/90 transition-colors inline-block"
          >
            Add signals
          </Link>
        </div>
      )}

      <div className="space-y-8">
        {/* Nudge */}
        {nudge && (
          <div className="bg-white border border-border rounded-2xl px-5 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <p className="text-sm text-navy leading-relaxed flex-1">{nudge.text}</p>
            <Link
              href={nudge.href}
              className="shrink-0 text-xs font-medium bg-navy text-warm-white px-4 py-2 rounded-full hover:bg-navy/90 transition-colors whitespace-nowrap"
            >
              {nudge.linkLabel}
            </Link>
          </div>
        )}

        {/* Pending actions */}
        {pendingActions.length > 0 && (
          <section>
            <Eyebrow label="Pending" />
            <div className="space-y-2">
              {pendingActions.map(r => {
                const isOpenDoor = r.type === 'open_door'
                const requesterName = displayName(byId[r.requester_id])
                const targetName = displayName(byId[r.target_id])
                const description = isOpenDoor
                  ? `${requesterName} wants to connect`
                  : `${requesterName} wants an intro to ${targetName}`
                return (
                  <Link
                    key={r.id}
                    href={`/intro/${r.id}`}
                    className="flex items-center justify-between gap-4 bg-white border border-border rounded-xl px-5 py-4 hover:border-navy/30 hover:shadow-sm transition-all group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy">{description}</p>
                      <p className="text-xs text-body-grey mt-0.5">{timeLeft(r.expires_at)}</p>
                    </div>
                    <span className="text-xs font-medium text-navy shrink-0 group-hover:underline">
                      Respond →
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Network activity */}
        {networkActivity.length > 0 && (
          <section>
            <Eyebrow label="Network activity" />
            <div className="bg-white border border-border rounded-2xl overflow-hidden divide-y divide-border">
              {networkActivity.map(signal => {
                const p = byId[signal.user_id]
                if (!p) return null
                const name = displayName(p)
                const label = activityLabel(signal.working_on, signal.need_right_now)
                const profileSlug = slug(signal.user_id)
                const initials = name
                  .trim()
                  .split(' ')
                  .map(s => s[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()
                return (
                  <Link
                    key={signal.user_id}
                    href={`/profile/${profileSlug}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-surface/60 transition-colors group"
                  >
                    {p.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.avatar_url}
                        alt={name}
                        className="w-9 h-9 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-navy/10 text-navy font-semibold flex items-center justify-center shrink-0 text-sm">
                        {initials || '?'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-navy group-hover:underline">
                        {name}
                      </p>
                      <p className="text-xs text-body-grey truncate">{label}</p>
                    </div>
                    <svg
                      className="w-4 h-4 text-border group-hover:text-navy/40 transition-colors shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Matchmaker */}
        {matchPair && (
          <section>
            <Eyebrow label="Matchmaker" />
            <div className="bg-white border border-border rounded-2xl p-5">
              <p className="text-sm font-medium text-navy mb-4">
                Do you think{' '}
                <Link
                  href={`/profile/${slug(matchPair[0])}`}
                  className="underline underline-offset-2"
                >
                  {displayName(byId[matchPair[0]])}
                </Link>{' '}
                and{' '}
                <Link
                  href={`/profile/${slug(matchPair[1])}`}
                  className="underline underline-offset-2"
                >
                  {displayName(byId[matchPair[1]])}
                </Link>{' '}
                should meet?
              </p>
              <div className="flex gap-2 flex-wrap">
                <Link
                  href={`/intro/request/${matchPair[1]}?suggest=${matchPair[0]}`}
                  className="text-xs font-medium bg-navy text-warm-white px-4 py-2 rounded-full hover:bg-navy/90 transition-colors"
                >
                  Yes — draft intro
                </Link>
                <Link
                  href="/dashboard"
                  className="text-xs font-medium text-body-grey border border-border px-4 py-2 rounded-full hover:border-navy hover:text-navy transition-colors"
                >
                  Not this time
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* New-user empty state */}
        {!hasConnections && pendingActions.length === 0 && (
          <div className="bg-white border border-border rounded-2xl p-8 text-center">
            <p className="font-display text-xl font-bold text-navy mb-2">
              Start building your network
            </p>
            <p className="text-sm text-body-grey mb-6">
              Browse members, make connections, and start facilitating intros.
            </p>
            <Link
              href="/members"
              className="inline-block bg-navy text-warm-white px-6 py-3 rounded-full text-sm font-medium hover:bg-navy/90 transition-colors"
            >
              Browse members
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
