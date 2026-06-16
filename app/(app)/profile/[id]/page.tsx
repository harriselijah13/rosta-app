import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Badge from '@/components/ui/Badge'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import BadgeTile from '@/components/badges/BadgeTile'
import { OPEN_TO_OPTIONS, PROFILE_MODES } from '@/lib/constants'
import { computeConnectorScore } from '@/lib/connector-score'
import { BADGE_CATALOG } from '@/lib/badge-catalog'
import OpenDoorToggle from './OpenDoorToggle'
import AvatarLightbox from './AvatarLightbox'

const OPEN_TO_MAP = Object.fromEntries(OPEN_TO_OPTIONS.map(o => [o.value, o.label]))
const MODE_MAP = Object.fromEntries(PROFILE_MODES.map(m => [m.value, m.label]))

function isActive(signalUpdatedAt: string | null, profileUpdatedAt: string): boolean {
  const ref = signalUpdatedAt ?? profileUpdatedAt
  return Date.now() - new Date(ref).getTime() < 14 * 24 * 60 * 60 * 1000
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ProfilePage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const PROFILE_SELECT = `id, username, first_name, last_name, avatar_url, what_i_do, building_now,
       who_i_want_to_meet, where_i_operate, fun_fact, profile_mode,
       onboarding_completed, founding_member, is_verified, verification_status, updated_at`

  const isUuid = UUID_RE.test(params.id)
  const { data: profile } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq(isUuid ? 'id' : 'username', params.id)
    .single()

  if (!profile || !profile.onboarding_completed) notFound()

  // IMPORTANT: signals MUST be fetched via the admin client (service role).
  // The "own or connected signals" RLS policy hides the target's signals from
  // non-connected viewers, which incorrectly returns hasOpenDoor = false and
  // suppresses the Connect button for members with Open Door enabled.
  // Do NOT change this back to the session client (supabase).
  const admin = createAdminClient()

  const { data: signalsRows } = await admin
    .from('signals')
    .select('open_to, working_on, need_right_now, updated_at')
    .eq('user_id', profile.id)
    .limit(1)

  const isSelf = user.id === profile.id
  const signal = (signalsRows as { open_to: string[]; working_on: string | null; need_right_now: string | null; updated_at: string }[] | null)?.[0] ?? null

  const openTo = (signal?.open_to ?? []).filter(v => v !== 'open_door')
  const hasOpenDoor = signal?.open_to?.includes('open_door') ?? false
  const active = isActive(signal?.updated_at ?? null, profile.updated_at)
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Anonymous'

  const { total: score } = await computeConnectorScore(profile.id)

  // Connection status, pending requests, and mutual connections
  let isConnected = false
  let hasMutuals = false
  let hasPendingRequest = false

  if (!isSelf) {
    const [ua, ub] = [user.id, profile.id].sort()
    const { data: conn } = await admin.from('connections')
      .select('id').eq('user_a', ua).eq('user_b', ub).maybeSingle()
    isConnected = !!conn

    if (!isConnected) {
      // Any pending request from viewer to this profile
      const { data: pendingAny } = await admin.from('intro_requests')
        .select('id')
        .eq('requester_id', user.id)
        .eq('target_id', profile.id)
        .eq('status', 'pending')
        .maybeSingle()
      hasPendingRequest = !!pendingAny

      // Mutual connections — only needed when no open door and no pending request
      if (!hasOpenDoor && !hasPendingRequest) {
        const [{ data: viewerConns }, { data: targetConns }] = await Promise.all([
          admin.from('connections').select('user_a, user_b').or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
          admin.from('connections').select('user_a, user_b').or(`user_a.eq.${profile.id},user_b.eq.${profile.id}`),
        ])
        const viewerIds = new Set((viewerConns ?? []).map(c => c.user_a === user.id ? c.user_b : c.user_a))
        const targetIds = new Set((targetConns ?? []).map(c => c.user_a === profile.id ? c.user_b : c.user_a))
        hasMutuals = Array.from(viewerIds).some(id => targetIds.has(id))
      }
    }
  }

  const canSeeFullProfile = isSelf || isConnected

  // Fetch earned badges — reuse the admin client already in scope
  const { data: earnedBadgeRows } = await admin
    .from('member_badges')
    .select('badge_slug')
    .eq('user_id', profile.id)
  const earnedSlugs = new Set((earnedBadgeRows ?? []).map(r => r.badge_slug))

  // Sort: earned first, unearned second (preserve catalog order within each group)
  const sortedBadges = [
    ...BADGE_CATALOG.filter(b => earnedSlugs.has(b.slug)),
    ...BADGE_CATALOG.filter(b => !earnedSlugs.has(b.slug)),
  ]

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Back */}
      <Link
        href="/members"
        className="inline-flex items-center gap-1.5 text-sm text-body-grey hover:text-navy transition-colors mb-8"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Members
      </Link>

      {/* Open Door toggle — own profile only */}
      {isSelf && <OpenDoorToggle initialEnabled={hasOpenDoor} />}

      {/* Header card */}
      <div className="bg-white border border-border rounded-2xl p-8 mb-4">
        <div className="flex items-start gap-6">
          {/* Avatar — click to enlarge */}
          <AvatarLightbox avatarUrl={profile.avatar_url} name={name} />

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-3xl font-bold text-navy">{name}</h1>
                {profile.is_verified && <VerifiedBadge size="md" />}
              </div>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {profile.profile_mode && (
                  <Badge variant="navy">{MODE_MAP[profile.profile_mode] ?? profile.profile_mode}</Badge>
                )}
                {profile.founding_member && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-navy bg-lime/30 border border-lime/50 px-2 py-0.5 rounded-full">
                    Founding member
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-xs text-body-grey">
                  <span
                    className={`w-2 h-2 rounded-full ${active ? 'bg-green-500' : 'bg-body-grey/40'}`}
                  />
                  {active ? 'Active on ROSTA' : 'Inactive'}
                </span>
                <span className="text-xs text-body-grey">
                  Score{' '}
                  {isSelf ? (
                    <Link
                      href="/score"
                      className="font-medium text-navy hover:opacity-70 transition-opacity"
                    >
                      {score}
                    </Link>
                  ) : (
                    <span className="font-medium text-navy">{score}</span>
                  )}
                </span>
              </div>
            </div>

            {/* What I do — visible to all */}
            {profile.what_i_do && (
              <p className="text-navy mt-4 text-sm leading-relaxed">{profile.what_i_do}</p>
            )}

            {/* Open To — visible to all */}
            {openTo.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {openTo.map(v => (
                  <span
                    key={v}
                    className="text-xs px-2.5 py-1 rounded-full bg-surface text-body-grey border border-border"
                  >
                    {OPEN_TO_MAP[v] ?? v}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-6 pt-6 border-t border-border">
          {isSelf ? (
            <>
              <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 text-sm font-medium bg-navy text-warm-white px-5 py-2.5 rounded-full hover:bg-navy/90 transition-colors"
              >
                Edit profile
              </Link>
              <Link
                href="/qr"
                className="inline-flex items-center gap-1.5 text-sm font-medium border border-border text-body-grey px-5 py-2.5 rounded-full hover:border-navy hover:text-navy transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                My QR
              </Link>
              {!profile.is_verified && profile.verification_status !== 'pending' && profile.verification_status !== 'approved' && (
                <Link
                  href="/verify"
                  className="inline-flex items-center gap-1.5 text-sm font-medium border border-lime text-navy px-5 py-2.5 rounded-full hover:bg-lime/10 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
                  Get verified
                </Link>
              )}
              {profile.verification_status === 'pending' && (
                <span className="inline-flex items-center gap-1.5 text-xs text-body-grey border border-border px-4 py-2.5 rounded-full">
                  Verification under review
                </span>
              )}
              {profile.verification_status === 'approved' && !profile.is_verified && (
                <Link
                  href="/verify/pay"
                  className="inline-flex items-center gap-1.5 text-sm font-medium bg-lime text-navy px-5 py-2.5 rounded-full hover:bg-lime/90 transition-colors"
                >
                  Complete payment
                </Link>
              )}
            </>
          ) : isConnected ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-body-grey px-5 py-2.5 rounded-full border border-border">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Connected
            </span>
          ) : hasPendingRequest ? (
            <Link
              href="/intro"
              className="text-sm font-medium text-body-grey px-5 py-2.5 rounded-full border border-border hover:border-navy hover:text-navy transition-colors"
            >
              Request pending
            </Link>
          ) : hasOpenDoor ? (
            <Link
              href={`/connections/request/${profile.id}`}
              className="text-sm font-medium bg-navy text-warm-white px-5 py-2.5 rounded-full hover:bg-navy/90 transition-colors"
            >
              Connect
            </Link>
          ) : hasMutuals ? (
            <Link
              href={`/intro/request/${profile.id}`}
              className="text-sm font-medium bg-navy text-warm-white px-5 py-2.5 rounded-full hover:bg-navy/90 transition-colors"
            >
              Request intro
            </Link>
          ) : null}
        </div>
      </div>

      {/* Limited-view notice for non-connections */}
      {!canSeeFullProfile && (
        <div className="bg-surface border border-border rounded-xl px-5 py-4 mb-4 text-sm text-body-grey">
          {hasOpenDoor
            ? 'Send a connection request to unlock the full profile — building now, who they want to meet, and more.'
            : hasMutuals
            ? 'Request an intro to unlock the full profile — building now, who they want to meet, and more.'
            : 'Connect to see the full profile — building now, who they want to meet, and more.'}
        </div>
      )}

      {/* Full profile sections (own profile only for now) */}
      {canSeeFullProfile && (
        <div className="space-y-4">
          {/* Profile details */}
          {(profile.building_now || profile.who_i_want_to_meet || profile.where_i_operate || profile.fun_fact) && (
            <div className="bg-white border border-border rounded-2xl p-6">
              <h2 className="font-display text-lg font-bold text-navy mb-4">Profile</h2>
              <dl className="space-y-4">
                {profile.building_now && (
                  <div>
                    <dt className="text-xs font-medium text-body-grey uppercase tracking-wide mb-1">Building now</dt>
                    <dd className="text-sm text-navy">{profile.building_now}</dd>
                  </div>
                )}
                {profile.who_i_want_to_meet && (
                  <div>
                    <dt className="text-xs font-medium text-body-grey uppercase tracking-wide mb-1">Who I want to meet</dt>
                    <dd className="text-sm text-navy">{profile.who_i_want_to_meet}</dd>
                  </div>
                )}
                {profile.where_i_operate && (
                  <div>
                    <dt className="text-xs font-medium text-body-grey uppercase tracking-wide mb-1">Where I operate</dt>
                    <dd className="text-sm text-navy">{profile.where_i_operate}</dd>
                  </div>
                )}
                {profile.fun_fact && (
                  <div>
                    <dt className="text-xs font-medium text-body-grey uppercase tracking-wide mb-1">One thing people don&apos;t know</dt>
                    <dd className="text-sm text-navy">{profile.fun_fact}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Signals */}
          {signal && (signal.working_on || signal.need_right_now || openTo.length > 0) && (
            <div className="bg-white border border-border rounded-2xl p-6">
              <h2 className="font-display text-lg font-bold text-navy mb-4">Signals</h2>
              <div className="space-y-4">
                {openTo.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-body-grey uppercase tracking-wide mb-2">Open to</p>
                    <div className="flex flex-wrap gap-1.5">
                      {openTo.map(v => (
                        <span
                          key={v}
                          className="text-xs px-2.5 py-1 rounded-full bg-surface text-body-grey border border-border"
                        >
                          {OPEN_TO_MAP[v] ?? v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {signal.working_on && (
                  <div>
                    <p className="text-xs font-medium text-body-grey uppercase tracking-wide mb-1">Working on</p>
                    <p className="text-sm text-navy">{signal.working_on}</p>
                  </div>
                )}
                {signal.need_right_now && (
                  <div>
                    <p className="text-xs font-medium text-body-grey uppercase tracking-wide mb-1">Need right now</p>
                    <p className="text-sm text-navy">{signal.need_right_now}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Badges */}
          <div className="bg-white border border-border rounded-2xl p-6">
            <h2 className="font-display text-lg font-bold text-navy mb-4">Badges</h2>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {sortedBadges.map(badge => (
                <BadgeTile
                  key={badge.slug}
                  badge={badge}
                  earned={earnedSlugs.has(badge.slug)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
