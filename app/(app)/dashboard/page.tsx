import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeConnectorScore } from '@/lib/connector-score'
import { OPEN_TO_OPTIONS } from '@/lib/constants'
import FirstVisitGuide from './FirstVisitGuide'
import BadgeEarnedModal from '@/components/badges/BadgeEarnedModal'
import { BADGE_MAP } from '@/lib/badge-catalog'
import NetworkBackground from './NetworkBackground'
import HeroCanvas from './HeroCanvas'
import FloatingAvatars from './FloatingAvatars'
import ScoreCounter from './ScoreCounter'
import SuggestIntroBlock from './SuggestIntroBlock'
import MatchmakerCard, { type MatchPair } from './MatchmakerCard'
import NetworkActivityList, { type ActivityItem } from './NetworkActivityList'
import EventTapIn from './EventTapIn'
import PostEventPrompt from './PostEventPrompt'

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

// ─── sub-components ──────────────────────────────────────────────────────────

function Eyebrow({ label }: { label: string }) {
  return (
    <p className="text-navy text-xs font-medium tracking-widest uppercase mb-3 flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-lime animate-live-pulse shrink-0" />
      {label}
    </p>
  )
}

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
    { count: guideFacilitatedCount },
    { count: guideReceivedCount },
    { data: unshownBadgeRows },
  ] = await Promise.all([
    supabase.from('profiles').select('first_name, username, onboarding_completed, created_at, first_visit_members_at, first_visit_guide_dismissed_at').eq('id', user.id).single(),
    admin.from('intro_requests')
      .select('id, type, requester_id, target_id, facilitator_id, facilitator_note, expires_at')
      .or(`requester_id.eq.${user.id},facilitator_id.eq.${user.id},target_id.eq.${user.id}`)
      .eq('status', 'pending').gt('expires_at', now)
      .order('expires_at', { ascending: true }),
    admin.from('connections').select('user_a, user_b').or(`user_a.eq.${user.id},user_b.eq.${user.id}`).is('removed_at', null),
    admin.from('signals').select('open_to, working_on, need_right_now, updated_at').eq('user_id', user.id).maybeSingle(),
    admin.from('intro_credits').select('balance, period').eq('user_id', user.id).maybeSingle(),
    admin.from('member_badges').select('badge_slug').eq('user_id', user.id),
    admin.from('matchmaker_dismissals').select('member_a_id, member_b_id').eq('user_id', user.id),
    admin.from('member_badges')
      .select('badge_slug')
      .eq('user_id', user.id)
      .is('badge_earned_shown_at', null)
      .order('created_at', { ascending: false }),
    admin.from('intro_requests').select('id', { count: 'exact', head: true }).eq('facilitator_id', user.id),
    admin.from('intro_requests').select('id', { count: 'exact', head: true }).eq('target_id', user.id),
  ])

  const connectionIds = (myConnections ?? []).map(c => c.user_a === user.id ? c.user_b : c.user_a)

  // ── Event attendance state ────────────────────────────────────────────────
  const tapInCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const [
    { data: activeEventPromptRow },
    { data: recentTapInRow },
  ] = await Promise.all([
    admin.from('event_attendances')
      .select('id')
      .eq('user_id', user.id)
      .not('prompt_shown_at', 'is', null)
      .is('completed_at', null)
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from('event_attendances')
      .select('id')
      .eq('user_id', user.id)
      .is('prompt_shown_at', null)
      .is('dismissed_at', null)
      .is('completed_at', null)
      .gt('tapped_in_at', tapInCutoff)
      .order('tapped_in_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const { data: eventInviteCodes } = activeEventPromptRow
    ? await admin.from('invite_codes')
        .select('id, token')
        .eq('owner_id', user.id)
        .eq('type', 'founding_invite')
        .is('used_at', null)
        .order('created_at')
        .limit(5)
    : { data: [] as { id: string; token: string }[] }

  const isFacilitatedRow = (r: { type: string; facilitator_note: string | null }) =>
    r.type === 'warm_intro' && r.facilitator_note !== null

  const pendingActions = (pendingRows ?? []).filter(r => {
    if (r.type === 'open_door')   return r.target_id === user.id
    if (r.type === 'warm_intro') {
      if (isFacilitatedRow(r)) return r.target_id === user.id
      return r.facilitator_id === user.id
    }
    return false
  })

  const trackedIntros = (pendingRows ?? []).filter(r =>
    isFacilitatedRow(r) && (r.facilitator_id === user.id || r.requester_id === user.id)
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
    { count: availableInviteCount },
  ] = await Promise.all([
    connectionIds.length > 0
      ? admin.from('signals')
          .select('user_id, updated_at, working_on, need_right_now, open_to')
          .in('user_id', connectionIds).gt('updated_at', sevenDaysAgo)
          .order('updated_at', { ascending: false }).limit(6)
      : Promise.resolve({ data: [] as { user_id: string; updated_at: string; working_on: string | null; need_right_now: string | null; open_to: string[] | null }[] }),
    connectionIds.length > 0
      ? admin.from('intro_requests').select('id', { count: 'exact', head: true }).eq('requester_id', user.id)
      : Promise.resolve({ count: 0 }),
    admin.from('outcomes').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
    computeConnectorScore(user.id),
    admin.from('intro_requests').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    admin.from('signals').select('id', { count: 'exact', head: true }).gte('updated_at', sevenDaysAgo),
    admin.from('open_table_rooms').select('id', { count: 'exact', head: true }).gt('expires_at', now),
    admin.from('open_table_members').select('room_id, open_table_rooms(id, expires_at)').eq('user_id', user.id),
    connectionIds.length >= 2
      ? admin.from('connections').select('user_a, user_b').in('user_a', connectionIds).in('user_b', connectionIds).is('removed_at', null)
      : Promise.resolve({ data: [] as { user_a: string; user_b: string }[] }),
    admin.from('invite_codes')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .is('used_at', null)
      .is('shared_at', null),
  ])

  // ── Matchmaker pair computation ───────────────────────────────────────────
  const dismissedSet = new Set((dismissalRows ?? []).map(d => `${d.member_a_id}:${d.member_b_id}`))
  const crossConnSet = new Set((crossConns ?? []).map(c => `${c.user_a}:${c.user_b}`))

  const facilitatedPairSet = new Set(
    (pendingRows ?? [])
      .filter(r => r.facilitator_id === user.id)
      .map(r => {
        const [a, b] = [r.requester_id, r.target_id].sort() as [string, string]
        return `${a}:${b}`
      })
  )

  const candidatePairIds: Array<[string, string]> = []
  for (let i = 0; i < connectionIds.length && candidatePairIds.length < 5; i++) {
    for (let j = i + 1; j < connectionIds.length && candidatePairIds.length < 5; j++) {
      const [a, b] = [connectionIds[i], connectionIds[j]].sort() as [string, string]
      if (crossConnSet.has(`${a}:${b}`)) continue
      if (dismissedSet.has(`${a}:${b}`)) continue
      if (facilitatedPairSet.has(`${a}:${b}`)) continue
      candidatePairIds.push([a, b])
    }
  }
  const matchmakerProfileIds = Array.from(new Set(candidatePairIds.flat()))

  // ── Round 3: profiles + activity conversations in parallel ────────────────
  const activityIds = (activitySignals ?? []).map(s => s.user_id)
  const pendingPartyIds = [
    ...pendingActions.flatMap(r => [r.requester_id, r.target_id, r.facilitator_id]),
    ...trackedIntros.flatMap(r => [r.requester_id, r.target_id, r.facilitator_id]),
  ].filter((id): id is string => typeof id === 'string')
  const allProfileIds = Array.from(new Set([...activityIds, ...pendingPartyIds, ...matchmakerProfileIds]))

  type ProfileRow = { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; username: string | null; is_verified: boolean }
  type ConvRow = { id: string; user_a: string; user_b: string }

  const [{ data: profiles }, { data: activityConvs }] = await Promise.all([
    allProfileIds.length > 0
      ? admin.from('profiles').select('id, first_name, last_name, avatar_url, username, is_verified').in('id', allProfileIds)
      : Promise.resolve({ data: [] as ProfileRow[] }),
    activityIds.length > 0
      ? admin.from('conversations')
          .select('id, user_a, user_b')
          .or(activityIds.map(id => {
            const [a, b] = [user.id, id].sort()
            return `and(user_a.eq.${a},user_b.eq.${b})`
          }).join(','))
      : Promise.resolve({ data: [] as ConvRow[] }),
  ])

  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const slug = (id: string) => byId[id]?.username ?? id

  const convByUserId: Record<string, string> = {}
  for (const c of activityConvs ?? []) {
    const otherId = c.user_a === user.id ? c.user_b : c.user_a
    convByUserId[otherId] = c.id
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const firstName      = profile?.first_name ?? null
  const signalsStale   = !mySignals || new Date(mySignals.updated_at) < new Date(fourteenDaysAgo)
  const creditBalance  = !creditsRow || creditsRow.period !== period ? 3 : creditsRow.balance
  const hasConnections = connectionIds.length > 0

  const guideStep1     = !!(mySignals?.working_on)
  const guideStep2     = !!(profile as { first_visit_members_at?: string | null } | null)?.first_visit_members_at
  const guideStep3     = (guideFacilitatedCount ?? 0) > 0
  const guideStep4     = (guideReceivedCount ?? 0) > 0 ||
    (Date.now() - new Date((profile as { created_at?: string } | null)?.created_at ?? 0).getTime() > 7 * 24 * 60 * 60 * 1000)
  const guideDismissed = !!(profile as { first_visit_guide_dismissed_at?: string | null } | null)?.first_visit_guide_dismissed_at
  const networkActivity = activitySignals ?? []
  const realOutcomes    = outcomesThisMonth ?? 0

  const activityItems: ActivityItem[] = networkActivity.flatMap(signal => {
    const p = byId[signal.user_id]
    if (!p) return []
    const name = displayName(p)
    return [{
      userId:         signal.user_id,
      name,
      avatarUrl:      p.avatar_url,
      isVerified:     p.is_verified,
      profileSlug:    slug(signal.user_id),
      initials:       name.trim().split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase(),
      workingOn:      signal.working_on,
      needRightNow:   signal.need_right_now,
      openTo:         (signal.open_to ?? []) as string[],
      updatedAt:      signal.updated_at,
      conversationId: convByUserId[signal.user_id] ?? null,
    }]
  })

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

  const earnedSlugs     = new Set((earnedBadgeRows ?? []).map(r => r.badge_slug))
  const earnedCount     = earnedSlugs.size
  const showBadgeTeaser = !!profile?.onboarding_completed
  const profileSlugSelf = profile?.username ?? user.id

  const unshownBadges = ((unshownBadgeRows ?? []) as unknown as Array<{ badge_slug: string }>)
    .map(r => BADGE_MAP[r.badge_slug])
    .filter((b): b is NonNullable<typeof b> => b != null)

  // Floating avatar data — up to 4 from recently active connections
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

  // Network Pulse — built server-side as a plain text line (no client animation needed)
  const pulseParts = [
    rostaIndex.intros   > 0 ? `${rostaIndex.intros} intro${rostaIndex.intros === 1 ? '' : 's'} made this week` : null,
    rostaIndex.outcomes > 0 ? `${rostaIndex.outcomes} collaboration${rostaIndex.outcomes === 1 ? '' : 's'} started this month` : null,
    rostaIndex.signals  > 0 ? `${rostaIndex.signals} member${rostaIndex.signals === 1 ? '' : 's'} updated their signals this week` : null,
    rostaIndex.tables   > 0 ? `${rostaIndex.tables} Open Table${rostaIndex.tables === 1 ? '' : 's'} running` : null,
  ].filter((s): s is string => s !== null)

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Badge recognition modal */}
      {unshownBadges.length > 0 && (
        <BadgeEarnedModal badges={unshownBadges} profileSlug={profileSlugSelf} />
      )}

      {/* Ambient page background */}
      <NetworkBackground />

      {/* ── Navy hero — ambient motion + Fraunces greeting, compact height ── */}
      <div className="relative bg-navy overflow-hidden">
        <HeroCanvas />
        <FloatingAvatars profiles={avatarProfiles} />
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 80% 50%, rgba(200,245,60,0.06) 0%, transparent 60%)' }}
        />
        <div className="relative z-10 max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
          <div className="flex justify-end mb-6">
            <Link
              href="/score"
              className="flex items-baseline gap-1.5 hover:opacity-75 transition-opacity"
              aria-label="View your Connector Score breakdown"
            >
              <span className="text-xs font-medium" style={{ color: 'rgba(200,245,60,0.6)' }}>Score</span>
              <span className="text-2xl font-bold text-lime">
                <ScoreCounter value={connectorScore.total} />
              </span>
            </Link>
          </div>
          <div className="flex items-start gap-3">
            <span
              className="w-2.5 h-2.5 rounded-full bg-lime animate-live-pulse shrink-0"
              style={{ marginTop: 12 }}
              aria-hidden="true"
            />
            <h1 className="font-display text-3xl font-bold text-white">
              {firstName ? `Good to see you, ${firstName}.` : 'Good to see you.'}
            </h1>
          </div>
        </div>
      </div>

      {/* ── Two-column layout: lg = side by side, <lg = single column ── */}
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-10 items-start">

          {/* ── LEFT COLUMN — action-oriented, priority ── */}
          <div className="space-y-6">

            {/* Post-event capture prompt — priority card when active */}
            {activeEventPromptRow && (
              <PostEventPrompt
                attendanceId={activeEventPromptRow.id}
                availableCodes={eventInviteCodes ?? []}
              />
            )}

            {/* First-visit guide — new members only */}
            <div className="card-enter" style={{ animationDelay: '0.05s' }}>
              <FirstVisitGuide
                step1Complete={guideStep1}
                step2Complete={guideStep2}
                step3Complete={guideStep3}
                step4Complete={guideStep4}
                dismissed={guideDismissed}
              />
            </div>

            {/* Needs your response */}
            {pendingActions.length > 0 && (
              <section className="card-enter" style={{ animationDelay: '0.1s' }}>
                <Eyebrow label="Needs your response" />
                <div className="space-y-2">
                  {pendingActions.map(r => {
                    const isOpenDoor      = r.type === 'open_door'
                    const requesterName   = displayName(byId[r.requester_id])
                    const targetName      = displayName(byId[r.target_id])
                    const facilitatorName = r.facilitator_id ? displayName(byId[r.facilitator_id]) : ''
                    const description = isOpenDoor
                      ? `${requesterName} wants to connect with you`
                      : isFacilitatedRow(r)
                        ? `${facilitatorName} suggested you should meet ${requesterName}`
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
                            <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
                            <span className="text-[11px] font-medium text-body-grey uppercase tracking-wide">
                              {isOpenDoor ? 'Connection request' : 'Intro request'}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-navy">{description}</p>
                          <p className={`text-xs mt-1 ${isUrgent ? 'text-navy font-medium' : 'text-body-grey'}`}>
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

            {/* Tracked intros */}
            {trackedIntros.length > 0 && (
              <section className="card-enter" style={{ animationDelay: '0.12s' }}>
                <Eyebrow label="Intros you've set up" />
                <div className="space-y-2">
                  {trackedIntros.map(r => {
                    const isFacilitator = r.facilitator_id === user.id
                    const requesterName = displayName(byId[r.requester_id])
                    const targetName    = displayName(byId[r.target_id])
                    const facName       = r.facilitator_id ? displayName(byId[r.facilitator_id]) : ''
                    const description   = isFacilitator
                      ? `You suggested ${requesterName} meet ${targetName}`
                      : `${facName} suggested you meet ${targetName}`
                    const remaining = timeLeft(r.expires_at)
                    return (
                      <Link
                        key={r.id}
                        href={`/intro/${r.id}`}
                        className={`${cardCls} flex items-start justify-between gap-4 px-6 py-5 group block`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-body-grey/40 shrink-0" />
                            <span className="text-[11px] font-medium text-body-grey uppercase tracking-wide">
                              Intro suggested
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-navy">{description}</p>
                          <p className="text-xs mt-1 text-body-grey">{remaining}</p>
                        </div>
                        <span className="text-xs font-medium text-navy shrink-0 group-hover:underline mt-0.5">
                          View →
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Matchmaker when a specific pair exists; generic Suggest as fallback */}
            {matchPairs.length > 0 ? (
              <section className="card-enter" style={{ animationDelay: '0.2s' }}>
                <Eyebrow label="Matchmaker" />
                <MatchmakerCard pairs={matchPairs} />
              </section>
            ) : (
              <SuggestIntroBlock />
            )}

            {/* At a networking event today? — only when no active post-event prompt */}
            {!activeEventPromptRow && (
              <div className="card-enter" style={{ animationDelay: '0.25s' }}>
                <EventTapIn isTappedIn={!!recentTapInRow} />
              </div>
            )}

            {/* Empty state — no connections and nothing pending */}
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

          </div>

          {/* ── RIGHT COLUMN — contextual, passive ── */}
          <div className="space-y-6">

            {/* Your signals */}
            {mySignals ? (
              <div
                className="card-enter rounded-2xl p-6 shadow-[0_4px_16px_rgba(15,27,60,0.08)] hover:shadow-[0_8px_24px_rgba(15,27,60,0.13)] hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200 bg-white border"
                style={{ borderColor: signalsStale ? 'var(--border)' : 'rgba(200,245,60,0.25)', animationDelay: '0.1s' }}
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
              <div className={`card-enter ${cardCls} bg-surface p-6`} style={{ animationDelay: '0.1s' }}>
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

            {/* Stats grid — 5 tiles in 2 columns */}
            <div className="card-enter grid grid-cols-2 gap-3" style={{ animationDelay: '0.2s' }}>
              <StatCard label="Connections"            value={connectionIds.length}        href="/members" />
              <StatCard label="Intro credits"          value={creditBalance}               href="/intro" />
              <StatCard label="Connector Score"        value={connectorScore.total}        href={`/profile/${profileSlugSelf}`} />
              <StatCard label="Outcomes this month"    value={realOutcomes}                lime={realOutcomes > 0} />
              <StatCard label="Invite codes available" value={availableInviteCount ?? 0}  href="/invite" />
            </div>

            {/* Your badges */}
            {showBadgeTeaser && (
              <section className="card-enter" style={{ animationDelay: '0.25s' }}>
                <Eyebrow label="Your badges" />
                <Link
                  href={`/profile/${profileSlugSelf}`}
                  className={`${cardCls} p-5 block group`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-navy">
                      {earnedCount === TOTAL_BADGES
                        ? 'All badges awarded.'
                        : `${earnedCount} badge${earnedCount === 1 ? '' : 's'} awarded`}
                    </p>
                    <span className="text-xs text-body-grey group-hover:text-navy transition-colors">View →</span>
                  </div>
                </Link>
              </section>
            )}

            {/* Your Open Table */}
            {myOpenTableRoom && (
              <div className="card-enter" style={{ animationDelay: '0.3s' }}>
                <OpenTableCard roomId={myOpenTableRoom.id} expiresAt={myOpenTableRoom.expires_at} />
              </div>
            )}

          </div>
        </div>

        {/* ── Full-width below both columns ── */}
        {pulseParts.length > 0 && (
          <p className="card-enter text-xs text-body-grey leading-relaxed px-1 mt-6" style={{ animationDelay: '0.35s' }}>
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-lime animate-live-pulse mr-1.5"
              style={{ verticalAlign: 'middle' }}
              aria-hidden="true"
            />
            {pulseParts.join(' · ')}
          </p>
        )}

        {hasConnections && (
          <section className="card-enter mt-6" style={{ animationDelay: '0.4s' }}>
            <Eyebrow label="Network activity" />
            <NetworkActivityList items={activityItems.slice(0, 5)} hasMore={networkActivity.length > 5} />
          </section>
        )}

      </main>
    </>
  )
}
