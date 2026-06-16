import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeConnectorScore } from '@/lib/connector-score'
import { OPEN_TO_OPTIONS } from '@/lib/constants'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import WelcomeBanner from './WelcomeBanner'
import ProgressBar from './ProgressBar'
import NetworkBackground from './NetworkBackground'
import HeroCanvas from './HeroCanvas'
import FloatingAvatars from './FloatingAvatars'
import ScoreCounter from './ScoreCounter'
import NetworkPulseStats from './NetworkPulseStats'
import SuggestIntroBlock from './SuggestIntroBlock'
import MatchmakerCard, { type MatchPair } from './MatchmakerCard'

const OPEN_TO_MAP = Object.fromEntries(OPEN_TO_OPTIONS.map(o => [o.value, o.label]))
const TOTAL_BADGES = 14

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

// All eyebrow dots use the livePulse animation defined in globals.css
function Eyebrow({ label }: { label: string }) {
  return (
    <p className="text-navy text-xs font-medium tracking-widest uppercase mb-3 flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-lime animate-live-pulse shrink-0" />
      {label}
    </p>
  )
}

// Shared card shadow + hover lift — apply to the outermost element of each card
const cardCls =
  'bg-white border border-border rounded-2xl shadow-[0_4px_16px_rgba(15,27,60,0.08)] hover:shadow-[0_8px_24px_rgba(15,27,60,0.13)] hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200'

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
    <div className={`rounded-2xl px-5 py-4 border shadow-[0_4px_16px_rgba(15,27,60,0.08)] hover:shadow-[0_8px_24px_rgba(15,27,60,0.13)] hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200 ${lime ? 'bg-lime/10 border-lime/40' : 'bg-white border-border'}`}>
      <p className="font-display text-3xl font-bold text-navy leading-none mb-1">{value}</p>
      <p className="text-xs text-body-grey">{label}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}


function OpenTableCard({ roomId, expiresAt }: { roomId: string; expiresAt: string }) {
  const daysLeft = Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000))
  return (
    <section>
      <Eyebrow label="Your Open Table" />
      <Link
        href={`/open-tables/${roomId}`}
        className={`${cardCls} flex items-center justify-between gap-4 px-6 py-5 group block`}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-navy">Your group is active</p>
          <p className="text-xs text-body-grey mt-0.5">{daysLeft}d left to contribute</p>
        </div>
        <span className="text-xs font-medium text-navy shrink-0 group-hover:underline">Open →</span>
      </Link>
    </section>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const period = currentPeriod()

  // ── Round 1 ──────────────────────────────────────────────────────────────
  const [
    { data: profile },
    { data: pendingRows },
    { data: myConnections },
    { data: mySignals },
    { data: creditsRow },
    { data: earnedBadgeRows },
    { data: dismissalRows },
  ] = await Promise.all([
    supabase.from('profiles').select('first_name, username, onboarding_completed').eq('id', user.id).single(),
    admin.from('intro_requests')
      .select('id, type, requester_id, target_id, facilitator_id, expires_at')
      .or(`facilitator_id.eq.${user.id},target_id.eq.${user.id}`)
      .eq('status', 'pending').gt('expires_at', now)
      .order('expires_at', { ascending: true }),
    admin.from('connections').select('user_a, user_b').or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
    admin.from('signals').select('open_to, working_on, need_right_now, updated_at').eq('user_id', user.id).maybeSingle(),
    admin.from('intro_credits').select('balance, period').eq('user_id', user.id).maybeSingle(),
    admin.from('member_badges').select('badge_slug').eq('user_id', user.id),
    admin.from('matchmaker_dismissals').select('member_a_id, member_b_id').eq('user_id', user.id),
  ])

  const connectionIds = (myConnections ?? []).map(c => c.user_a === user.id ? c.user_b : c.user_a)
  const pendingActions = (pendingRows ?? []).filter(r =>
    (r.type === 'warm_intro' && r.facilitator_id === user.id) ||
    (r.type === 'open_door' && r.target_id === user.id),
  )

  // ── Round 2 ──────────────────────────────────────────────────────────────
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [
    { data: activitySignals },
    { count: introsMadeCount },
    { count: outcomesThisMonth },
    connectorScore,
    { count: indexIntrosThisWeek },
    { count: indexSignalsThisWeek },
    { count: indexOpenTables },
    { data: myMemberships },
    { data: crossConns },
  ] = await Promise.all([
    connectionIds.length > 0
      ? admin.from('signals')
          .select('user_id, updated_at, working_on, need_right_now')
          .in('user_id', connectionIds).gt('updated_at', sevenDaysAgo)
          .order('updated_at', { ascending: false }).limit(8)
      : Promise.resolve({ data: [] as { user_id: string; updated_at: string; working_on: string | null; need_right_now: string | null }[] }),
    connectionIds.length > 0
      ? admin.from('intro_requests').select('id', { count: 'exact', head: true }).eq('requester_id', user.id)
      : Promise.resolve({ count: 0 }),
    admin.from('outcomes').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
    computeConnectorScore(user.id),
    admin.from('intro_requests').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    admin.from('signals').select('id', { count: 'exact', head: true }).gte('updated_at', sevenDaysAgo),
    admin.from('open_table_rooms').select('id', { count: 'exact', head: true }).gt('expires_at', now),
    admin.from('open_table_members').select('room_id, open_table_rooms(id, expires_at)').eq('user_id', user.id),
    // Cross-connections: pairs within the user's network already connected to each other
    connectionIds.length >= 2
      ? admin.from('connections').select('user_a, user_b').in('user_a', connectionIds).in('user_b', connectionIds)
      : Promise.resolve({ data: [] as { user_a: string; user_b: string }[] }),
  ])

  // ── Matchmaker pair computation ───────────────────────────────────────────
  const dismissedSet = new Set((dismissalRows ?? []).map(d => `${d.member_a_id}:${d.member_b_id}`))
  const crossConnSet = new Set((crossConns ?? []).map(c => `${c.user_a}:${c.user_b}`))

  const candidatePairIds: Array<[string, string]> = []
  for (let i = 0; i < connectionIds.length && candidatePairIds.length < 5; i++) {
    for (let j = i + 1; j < connectionIds.length && candidatePairIds.length < 5; j++) {
      const [a, b] = [connectionIds[i], connectionIds[j]].sort() as [string, string]
      if (crossConnSet.has(`${a}:${b}`)) continue  // already connected to each other
      if (dismissedSet.has(`${a}:${b}`)) continue  // dismissed by current user
      candidatePairIds.push([a, b])
    }
  }
  const matchmakerProfileIds = Array.from(new Set(candidatePairIds.flat()))

  // ── Round 3: names for referenced users ───────────────────────────────────
  const activityIds = (activitySignals ?? []).map(s => s.user_id)
  const pendingPartyIds = pendingActions.flatMap(r => [r.requester_id, r.target_id].filter(Boolean))
  const allProfileIds = Array.from(new Set([...activityIds, ...pendingPartyIds, ...matchmakerProfileIds]))

  const { data: profiles } = allProfileIds.length > 0
    ? await admin.from('profiles').select('id, first_name, last_name, avatar_url, username, is_verified').in('id', allProfileIds)
    : { data: [] as { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; username: string | null; is_verified: boolean }[] }

  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const slug = (id: string) => byId[id]?.username ?? id

  // ── Derived ───────────────────────────────────────────────────────────────
  const firstName       = profile?.first_name ?? null
  const signalsStale    = !mySignals || new Date(mySignals.updated_at) < new Date(fourteenDaysAgo)
  const creditBalance   = !creditsRow || creditsRow.period !== period ? 3 : creditsRow.balance
  const hasConnections  = connectionIds.length > 0
  const networkActivity = activitySignals ?? []
  const realOutcomes    = outcomesThisMonth ?? 0

  const matchPairs: MatchPair[] = candidatePairIds.map(([a, b]) => ({
    memberAId:   a,
    memberBId:   b,
    memberAName: displayName(byId[a]),
    memberBName: displayName(byId[b]),
    memberASlug: byId[a]?.username ?? a,
    memberBSlug: byId[b]?.username ?? b,
  }))

  const myOpenTo = (mySignals?.open_to ?? []).filter((v: string) => v !== 'open_door')

  type RoomRef = { id: string; expires_at: string }
  const myOpenTableRoom = (myMemberships ?? [])
    .map(m => {
      const raw = (m as unknown as { open_table_rooms: RoomRef | RoomRef[] | null }).open_table_rooms
      return Array.isArray(raw) ? raw[0] ?? null : raw
    })
    .find((r): r is RoomRef => r != null && r.expires_at > now) ?? null

  const rostaIndex = {
    intros:   indexIntrosThisWeek  ?? 0,
    outcomes: outcomesThisMonth    ?? 0,
    signals:  indexSignalsThisWeek ?? 0,
    tables:   indexOpenTables      ?? 0,
  }

  // ── Badge progress ────────────────────────────────────────────────────────
  const earnedSlugs  = new Set((earnedBadgeRows ?? []).map(r => r.badge_slug))
  const earnedCount  = earnedSlugs.size
  const score        = connectorScore.total
  const showBadgeTeaser = !!profile?.onboarding_completed
  const badgePercent = Math.max(2, Math.round((earnedCount / TOTAL_BADGES) * 100))

  type NextBadge = { label: string; hint: string }
  const nextBadge = ((): NextBadge | null => {
    if (connectionIds.length === 0 && !earnedSlugs.has('first-connection'))
      return { label: 'First Connection', hint: 'make your first connection' }
    if (!earnedSlugs.has('connector') && score < 15)
      return { label: 'Connector', hint: `reach a Connector Score of 15 (currently ${score})` }
    if (!earnedSlugs.has('bridge') && score < 40)
      return { label: 'Bridge', hint: `reach a Connector Score of 40 (currently ${score})` }
    if (!earnedSlugs.has('catalyst') && score < 80)
      return { label: 'Catalyst', hint: 'reach a Connector Score of 80' }
    if (!earnedSlugs.has('architect') && score < 150)
      return { label: 'Architect', hint: 'reach a Connector Score of 150' }
    if (!earnedSlugs.has('introducer'))
      return { label: 'Introducer', hint: 'facilitate your first warm introduction' }
    if (!earnedSlugs.has('spark'))
      return { label: 'Spark', hint: 'mark your first connection outcome' }
    if (!earnedSlugs.has('table-setter'))
      return { label: 'Table Setter', hint: 'join an Open Table session' }
    if (!earnedSlugs.has('signal-strength'))
      return { label: 'Signal Strength', hint: 'keep signals active for 4 consecutive weeks' }
    if (!earnedSlugs.has('thanked'))
      return { label: 'Thanked', hint: 'receive 3 thank-yous for making intros' }
    if (!earnedSlugs.has('five-outcomes'))
      return { label: 'Five Outcomes', hint: 'mark 5 connection outcomes' }
    if (!earnedSlugs.has('all-in'))
      return { label: 'All In', hint: 'earn 5 or more badges' }
    return null
  })()

  // ── Contextual greeting line ──────────────────────────────────────────────
  const contextualLine = (() => {
    if (pendingActions.length > 0)
      return `You have ${pendingActions.length} ${pendingActions.length === 1 ? 'thing' : 'things'} that need your attention.`
    if (signalsStale) return "Your signals haven't been updated in a while."
    if (myOpenTableRoom) {
      const d = Math.max(1, Math.ceil((new Date(myOpenTableRoom.expires_at).getTime() - Date.now()) / 86400000))
      return `Your Open Table is running — ${d}d left.`
    }
    return 'Your network is ready when you are.'
  })()

  const profileSlugSelf = profile?.username ?? user.id

  // ── Floating avatar data — up to 4 from recently active connections ───────
  const avatarProfiles = (activitySignals ?? [])
    .slice(0, 4)
    .map(s => {
      const p = byId[s.user_id]
      if (!p) return null
      return {
        initials:   [p.first_name?.[0], p.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?',
        avatar_url: p.avatar_url,
      }
    })
    .filter((x): x is { initials: string; avatar_url: string | null } => x !== null)

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Animated background — fixed, behind everything */}
      <NetworkBackground />

      {/* ── Navy hero greeting ── */}
      <div className="relative bg-navy overflow-hidden">
        {/* Canvas network animation — behind all hero content */}
        <HeroCanvas />
        {/* Floating member avatars at edges */}
        <FloatingAvatars profiles={avatarProfiles} />
        {/* Inner radial glow */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 80% 50%, rgba(200,245,60,0.06) 0%, transparent 60%)' }}
        />
        <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-12">
          {/* Connector score — top right, count-up animation */}
          <div className="flex justify-end mb-8">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-medium" style={{ color: 'rgba(200,245,60,0.6)' }}>Score</span>
              <span className="text-2xl font-bold text-lime">
                <ScoreCounter value={connectorScore.total} />
              </span>
            </div>
          </div>
          {/* Greeting */}
          <div className="flex items-start gap-3">
            <span
              className="w-2.5 h-2.5 rounded-full bg-lime animate-live-pulse shrink-0"
              style={{ marginTop: 16 }}
              aria-hidden="true"
            />
            <div>
              <h1 className="font-display text-4xl font-bold text-white">
                {firstName ? `Good to see you, ${firstName}.` : 'Good to see you.'}
              </h1>
              <p className="text-base mt-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {contextualLine}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Card content ── */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">

        {/* Welcome banner — new members only */}
        <div className="card-enter" style={{ animationDelay: '0.05s' }}>
          <WelcomeBanner hasConnections={hasConnections} />
        </div>

        {/* ── Pending actions ── */}
        {pendingActions.length > 0 && (
          <section className="card-enter" style={{ animationDelay: '0.1s' }}>
            <Eyebrow label="Needs your response" />
            <div className="space-y-2">
              {pendingActions.map(r => {
                const isOpenDoor   = r.type === 'open_door'
                const requesterName = displayName(byId[r.requester_id])
                const targetName    = displayName(byId[r.target_id])
                const description   = isOpenDoor
                  ? `${requesterName} wants to connect with you`
                  : `${requesterName} wants an intro to ${targetName}`
                const remaining = timeLeft(r.expires_at)
                const isUrgent  = new Date(r.expires_at).getTime() - Date.now() < 24 * 60 * 60 * 1000
                return (
                  <Link
                    key={r.id}
                    href={`/intro/${r.id}`}
                    className="flex items-start justify-between gap-4 rounded-2xl px-6 py-5
                      border border-border border-l-[3px] border-l-[#C8F53C]
                      shadow-[0_4px_16px_rgba(15,27,60,0.08)] hover:shadow-[0_8px_24px_rgba(15,27,60,0.13)]
                      hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200 group"
                    style={{ backgroundColor: 'rgba(200,245,60,0.04)' }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        <span className="text-[11px] font-medium text-body-grey uppercase tracking-wide">
                          {isOpenDoor ? 'Connection request' : 'Intro request'}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-navy">{description}</p>
                      <p className={`text-xs mt-1 ${isUrgent ? 'text-amber-500 font-medium' : 'text-body-grey'}`}>
                        {remaining}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-navy shrink-0 group-hover:underline mt-0.5 hover:scale-[1.02] transition-transform duration-150">
                      Respond →
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Suggest an intro ── */}
        <SuggestIntroBlock />

        {/* ── Matchmaker ── */}
        {matchPairs.length > 0 && (
          <section className="card-enter" style={{ animationDelay: '0.2s' }}>
            <Eyebrow label="Matchmaker" />
            <MatchmakerCard pairs={matchPairs} />
          </section>
        )}

        {/* ── Signals (merged with nudge) ── */}
        {mySignals ? (
          <div
            className="card-enter rounded-2xl p-6 shadow-[0_4px_16px_rgba(15,27,60,0.08)] hover:shadow-[0_8px_24px_rgba(15,27,60,0.13)] hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200 bg-white border"
            style={{ borderColor: signalsStale ? 'var(--border)' : 'rgba(200,245,60,0.25)', animationDelay: '0.3s' }}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 className="font-display text-lg font-bold text-navy">Your signals</h2>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${signalsStale ? 'bg-body-grey/30' : 'bg-green-500'}`} />
                <span className="text-xs text-body-grey">{signalsStale ? 'Inactive' : 'Active on ROSTA'}</span>
                <Link href="/settings" className="text-xs font-medium text-navy hover:underline ml-2">
                  {signalsStale ? 'Update →' : 'Edit →'}
                </Link>
              </div>
            </div>
            <div className="space-y-3">
              {mySignals.working_on && (
                <div>
                  <p className="text-xs font-medium text-body-grey uppercase tracking-wide mb-0.5">Working on</p>
                  <p className="text-sm text-navy">{mySignals.working_on}</p>
                </div>
              )}
              {mySignals.need_right_now && (
                <div>
                  <p className="text-xs font-medium text-body-grey uppercase tracking-wide mb-0.5">Need right now</p>
                  <p className="text-sm text-navy">{mySignals.need_right_now}</p>
                </div>
              )}
              {myOpenTo.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-body-grey uppercase tracking-wide mb-1.5">Open to</p>
                  <div className="flex flex-wrap gap-1.5">
                    {myOpenTo.map((v: string) => (
                      <span key={v} className="text-xs px-2.5 py-1 rounded-full bg-surface border border-border text-body-grey">
                        {OPEN_TO_MAP[v] ?? v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {signalsStale && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-body-grey">
                  Last updated over 14 days ago — keep your signals fresh so your network knows what you need.
                </p>
              </div>
            )}
            {!signalsStale && hasConnections && (introsMadeCount ?? 0) === 0 && (
              <div className="mt-4 pt-4 border-t border-border flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <p className="text-sm text-navy flex-1">
                  Making introductions is how ROSTA works. Who in your network should meet someone?
                </p>
                <Link
                  href="/members"
                  className="shrink-0 text-xs font-medium bg-navy text-warm-white px-4 py-2 rounded-full
                    hover:bg-navy/90 hover:scale-[1.02] transition-all duration-150 whitespace-nowrap"
                >
                  Browse members
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className={`card-enter ${cardCls} bg-surface p-6`} style={{ animationDelay: '0.3s' }}>
            <p className="text-sm font-medium text-navy mb-1">Set your signals</p>
            <p className="text-sm text-body-grey mb-4">
              Tell your network what you&apos;re building and what you need.
            </p>
            <Link
              href="/settings"
              className="text-sm font-medium bg-navy text-warm-white px-5 py-2.5 rounded-full
                hover:bg-navy/90 hover:scale-[1.02] transition-all duration-150 inline-block"
            >
              Add signals
            </Link>
          </div>
        )}

        {/* ── Network activity ── */}
        {networkActivity.length > 0 && (
          <section className="card-enter" style={{ animationDelay: '0.4s' }}>
            <Eyebrow label="Network activity" />
            <div className={`${cardCls} overflow-hidden divide-y divide-border`}>
              {networkActivity.map(signal => {
                const p = byId[signal.user_id]
                if (!p) return null
                const name        = displayName(p)
                const label       = activityLabel(signal.working_on, signal.need_right_now)
                const profileSlug = slug(signal.user_id)
                const initials    = name.trim().split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
                return (
                  <Link
                    key={signal.user_id}
                    href={`/profile/${profileSlug}`}
                    className="flex items-center gap-4 px-5 py-4 transition-all duration-150 group
                      border-l-[3px] border-l-transparent
                      hover:border-l-lime/70 hover:bg-[rgba(200,245,60,0.04)]"
                  >
                    {p.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatar_url} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-navy/10 text-navy font-semibold flex items-center justify-center shrink-0 text-sm">
                        {initials || '?'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-navy group-hover:underline flex items-center gap-1.5">
                        {name}{p.is_verified && <VerifiedBadge />}
                      </p>
                      <p className="text-xs text-body-grey truncate">{label}</p>
                    </div>
                    <svg className="w-4 h-4 text-border group-hover:text-navy/40 transition-colors shrink-0"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Your Open Table ── */}
        {myOpenTableRoom && (
          <div className="card-enter" style={{ animationDelay: '0.5s' }}>
            <OpenTableCard roomId={myOpenTableRoom.id} expiresAt={myOpenTableRoom.expires_at} />
          </div>
        )}

        {/* ── Badge progress teaser ── */}
        {showBadgeTeaser && (
          <section className="card-enter" style={{ animationDelay: '0.6s' }}>
            <Eyebrow label="Your badges" />
            <Link
              href={`/profile/${profileSlugSelf}`}
              className={`${cardCls} p-6 block group`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-navy">{earnedCount} of {TOTAL_BADGES} badges earned</p>
                <span className="text-xs text-body-grey group-hover:text-navy transition-colors">View all →</span>
              </div>
              <ProgressBar percent={badgePercent} />
              <div className="mt-4">
                {nextBadge ? (
                  <p className="text-xs text-body-grey">
                    Next: <span className="font-semibold text-navy">{nextBadge.label}</span> — {nextBadge.hint}
                  </p>
                ) : (
                  <p className="text-xs font-medium text-navy">All badges earned.</p>
                )}
              </div>
            </Link>
          </section>
        )}

        {/* ── Network pulse ── */}
        <div className="card-enter" style={{ animationDelay: '0.65s' }}>
          <NetworkPulseStats
            intros={rostaIndex.intros}
            outcomes={rostaIndex.outcomes}
            signals={rostaIndex.signals}
            tables={rostaIndex.tables}
          />
        </div>

        {/* ── Stats row ── */}
        <div className="card-enter grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ animationDelay: '0.75s' }}>
          <StatCard label="Connections"       value={connectionIds.length} href="/members" />
          <StatCard label="Intro credits"     value={creditBalance}        href="/intro" />
          <StatCard label="Connector Score"   value={connectorScore.total} href={`/profile/${profileSlugSelf}`} />
          <StatCard label="Outcomes this month" value={realOutcomes}       lime={realOutcomes > 0} />
        </div>

        {/* ── Empty state ── */}
        {!hasConnections && pendingActions.length === 0 && (
          <div className={`card-enter ${cardCls} p-8 text-center`} style={{ animationDelay: '0.15s' }}>
            <p className="font-display text-xl font-bold text-navy mb-2">Start building your network</p>
            <p className="text-sm text-body-grey mb-6">
              Browse members, make connections, and start facilitating intros.
            </p>
            <Link
              href="/members"
              className="inline-block bg-navy text-warm-white px-6 py-3 rounded-full text-sm font-medium
                hover:bg-navy/90 hover:scale-[1.02] transition-all duration-150"
            >
              Browse members
            </Link>
          </div>
        )}

      </main>
    </>
  )
}
