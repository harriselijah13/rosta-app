import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MarkVisited from './MarkVisited'
import { IntroCardDismissable } from './IntroCardDismissable'

type IntroRow = {
  id: string
  type: string
  requester_id: string
  target_id: string
  facilitator_id: string | null
  status: string
  requester_note: string | null
  expires_at: string
  created_at: string
  responded_at: string | null
  dismissed_by_requester_at: string | null
  dismissed_by_recipient_at: string | null
  resent_at: string | null
}

function currentPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function nextResetDate() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 1)
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function timeLabel(expiresAt: string, status: string): string {
  if (status !== 'pending') return ''
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3600000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`
  return `${h}h left`
}

function StatusPill({ status, expiresAt }: { status: string; expiresAt: string }) {
  const isExpired = status === 'pending' && new Date(expiresAt) < new Date()
  const effective = isExpired ? 'expired' : status
  const map: Record<string, string> = {
    pending:  'bg-surface text-body-grey border-border',
    accepted: 'bg-lime/10 border-lime/40 text-navy',
    declined: 'bg-surface text-body-grey border-border',
    expired:  'bg-surface text-body-grey border-border',
  }
  const labels: Record<string, string> = {
    pending: 'Pending', accepted: 'Accepted', declined: 'Declined', expired: 'Expired',
  }
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${map[effective] ?? map.expired}`}>
      {labels[effective] ?? effective}
    </span>
  )
}

// ── Ambient drift dots ────────────────────────────────────────────────────────

type DotConfig = { style: CSSProperties; dur: string; delay: string }

const DRIFT_DOTS: DotConfig[] = [
  { style: { top: '12%',    left:  '6%'   }, dur: '5.2s', delay: '0s'   },
  { style: { top: '18%',    right: '10%'  }, dur: '6.1s', delay: '1.3s' },
  { style: { top: '55%',    left:  '4%'   }, dur: '4.8s', delay: '2.7s' },
  { style: { top: '40%',    right: '6%'   }, dur: '5.5s', delay: '0.6s' },
  { style: { top: '70%',    left:  '18%'  }, dur: '7.0s', delay: '3.4s' },
  { style: { bottom: '15%', right: '14%'  }, dur: '5.8s', delay: '1.8s' },
  { style: { top: '70%',    left:  '55%'  }, dur: '5.0s', delay: '2.2s' },
  { style: { top: '25%',    left:  '42%'  }, dur: '6.3s', delay: '1.0s' },
  { style: { bottom: '35%', right: '30%'  }, dur: '4.7s', delay: '3.8s' },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function IntroInboxPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const period = currentPeriod()

  const lastIntroVisit = cookies().get('intro-last-visited')?.value ?? new Date(0).toISOString()

  const [{ data: rows }, { data: creditsRow }, { data: rawCodes }, { data: userConvs }] = await Promise.all([
    admin
      .from('intro_requests')
      .select('id, type, requester_id, target_id, facilitator_id, status, requester_note, expires_at, created_at, responded_at, dismissed_by_requester_at, dismissed_by_recipient_at, resent_at')
      .or(`requester_id.eq.${user.id},facilitator_id.eq.${user.id},target_id.eq.${user.id}`)
      .order('created_at', { ascending: false }),
    admin
      .from('intro_credits')
      .select('balance, period, lifetime_earned')
      .eq('user_id', user.id)
      .maybeSingle(),
    admin
      .from('invite_codes')
      .select('*')
      .eq('owner_id', user.id)
      .eq('type', 'founding_invite')
      .order('created_at'),
    admin
      .from('conversations')
      .select('id, user_a, user_b')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
  ])

  const inviteCodes = (rawCodes ?? []).map(c => ({
    id:                 c.id as string,
    token:              c.token as string,
    used_at:            c.used_at as string | null,
    reserved_for_email: (c as Record<string, unknown>).reserved_for_email as string | null ?? null,
  }))

  const isNewPeriod         = !creditsRow || creditsRow.period !== period
  const balance             = isNewPeriod ? 3 : creditsRow.balance
  const lifetimeEarned      = creditsRow?.lifetime_earned ?? 0
  const availableInviteCount = inviteCodes.filter(c => !c.used_at).length

  const allRows = (rows ?? []) as IntroRow[]

  const convByPartner = Object.fromEntries(
    (userConvs ?? []).map(c => [c.user_a === user.id ? c.user_b : c.user_a, c.id])
  )

  const acceptedUnseen = allRows.filter(r =>
    r.requester_id === user.id &&
    r.status === 'accepted' &&
    r.responded_at &&
    r.responded_at > lastIntroVisit
  )

  const profileIds = Array.from(new Set(allRows.flatMap(r =>
    [r.requester_id, r.target_id, r.facilitator_id].filter(Boolean) as string[]
  )))
  const { data: profiles } = profileIds.length
    ? await admin.from('profiles').select('id, first_name, last_name, username').in('id', profileIds)
    : { data: [] }

  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const name = (id: string) =>
    [byId[id]?.first_name, byId[id]?.last_name].filter(Boolean).join(' ') || 'A member'

  const pending = allRows.filter(r =>
    r.status === 'pending' && new Date(r.expires_at) > new Date() && (
      (r.type === 'open_door'  && r.target_id     === user.id) ||
      (r.type === 'warm_intro' && r.facilitator_id === user.id)
    )
  )
  const mine = allRows.filter(r =>
    r.requester_id === user.id && !r.dismissed_by_requester_at
  )
  const asTarget = allRows.filter(r =>
    r.target_id === user.id && r.type !== 'warm_intro' && !r.dismissed_by_recipient_at
  )

  function IntroCard({ row }: { row: IntroRow }) {
    const label   = timeLabel(row.expires_at, row.status)
    const headline = row.type === 'open_door'
      ? `${name(row.requester_id)} wants to connect`
      : `${name(row.requester_id)} → ${name(row.target_id)}`
    const subline = row.type === 'warm_intro' && row.facilitator_id
      ? `via ${name(row.facilitator_id)}`
      : row.type === 'open_door' ? 'Open Door' : null

    return (
      <Link
        href={`/intro/${row.id}`}
        className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-surface/50 transition-colors"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-navy">{headline}</p>
          {subline && <p className="text-xs text-body-grey mt-0.5">{subline}</p>}
          {label   && <p className="text-xs text-body-grey mt-1">{label}</p>}
        </div>
        <StatusPill status={row.status} expiresAt={row.expires_at} />
      </Link>
    )
  }

  const isEmpty = allRows.length === 0
  const barFilled = Math.min(balance, 3)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-16">

      {/* ── Section 1: Navy hero block ── */}
      <div className="relative bg-navy rounded-[20px] overflow-hidden mb-4">
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none">
          {DRIFT_DOTS.map((dot, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="absolute rounded-full network-node"
              style={{
                ...dot.style,
                width:             3,
                height:            3,
                backgroundColor:   'rgba(245,242,238,0.06)',
                '--node-duration': dot.dur,
                '--node-delay':    dot.delay,
              } as CSSProperties}
            />
          ))}
        </div>

        <div className="relative z-10 px-8 sm:px-12 py-12 sm:py-14 text-center">
          <p
            className="font-display font-medium italic mb-4"
            style={{ fontSize: 14, color: 'rgba(245,242,238,0.65)' }}
          >
            Intro Credits
          </p>
          <h1
            className="font-display font-black text-warm-white leading-tight mb-2"
            style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)' }}
          >
            {balance} {balance === 1 ? 'credit' : 'credits'}
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(245,242,238,0.55)' }}>
            Resets {nextResetDate()}
            {lifetimeEarned > 0 && (
              <> · {lifetimeEarned} earned lifetime</>
            )}
          </p>

          {/* Progress bars */}
          <div className="flex gap-1.5 mt-6 mx-auto" style={{ maxWidth: 160 }}>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{ backgroundColor: i < barFilled ? '#C8F53C' : 'rgba(245,242,238,0.18)' }}
              />
            ))}
          </div>

          {balance > 3 && (
            <p className="mt-2" style={{ fontSize: 13, color: 'rgba(245,242,238,0.60)' }}>
              +{balance - 3} bonus from facilitations
            </p>
          )}

          <p className="mt-3" style={{ fontSize: 14, color: 'rgba(245,242,238,0.50)' }}>
            {balance === 0
              ? 'Out of credits — facilitate an intro to earn one back.'
              : 'Each warm intro request costs 1 credit. Earn one back by facilitating an intro.'}
          </p>
        </div>
      </div>

      {/* ── Section 2: Contextual invite shortcut ── */}
      <div
        className="rounded-xl px-5 py-4 mb-10 flex items-center justify-between gap-4"
        style={{ backgroundColor: '#0F1B3C' }}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-warm-white">
            {availableInviteCount > 0 ? 'Need to bring someone new in?' : 'Want to invite someone?'}
          </p>
          <p className="mt-0.5" style={{ fontSize: 13, color: 'rgba(245,242,238,0.55)' }}>
            {availableInviteCount > 0
              ? `You have ${availableInviteCount} invite ${availableInviteCount === 1 ? 'code' : 'codes'} ready.`
              : 'New codes are awarded as you contribute to the network.'}
          </p>
        </div>
        <Link
          href="/invite"
          className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-navy bg-lime px-4 py-1.5 rounded-full hover:bg-lime/90 transition-colors whitespace-nowrap"
        >
          Invite
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* ── Accepted-unseen banners ── */}
      {acceptedUnseen.length > 0 && (
        <div className="mb-6 space-y-2">
          {acceptedUnseen.map(r => {
            const connectedName = name(r.target_id)
            const convId        = convByPartner[r.target_id]
            return (
              <div
                key={r.id}
                className="flex items-center justify-between gap-4 bg-lime/10 border border-lime/40 rounded-xl px-5 py-3.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-lime shrink-0" />
                  <p className="text-sm font-medium text-navy truncate">
                    Your connection request to {connectedName} was accepted.
                  </p>
                </div>
                {convId && (
                  <Link
                    href={`/messages/${convId}`}
                    className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-navy hover:underline decoration-lime underline-offset-2"
                  >
                    Start the conversation
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}

      <MarkVisited />

      {/* ── Needs your response ── */}
      {pending.length > 0 && (
        <section className="mb-8">
          <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-[0_4px_16px_rgba(15,27,60,0.06)]">
            <div className="px-6 pt-5 pb-4 border-b border-border">
              <h2 className="font-display text-lg font-bold text-navy">
                Needs your response
              </h2>
              <p className="text-sm text-body-grey mt-0.5">
                {pending.length === 1 ? '1 request' : `${pending.length} requests`} waiting.
              </p>
            </div>
            <div className="divide-y divide-border">
              {pending.map(r => <IntroCard key={r.id} row={r} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── Section 3: Suggest an intro ── */}
      <div className="bg-white border border-border rounded-2xl p-6 mb-8 shadow-[0_4px_16px_rgba(15,27,60,0.06)] hover:shadow-[0_6px_20px_rgba(15,27,60,0.09)] transition-shadow">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-navy mb-1">Suggest an intro</h2>
            <p className="text-sm text-body-grey">
              Know two people who should meet? Introduce them.
            </p>
          </div>
          <Link
            href="/intro/suggest"
            className="shrink-0 text-sm font-medium bg-navy text-warm-white px-4 py-2 rounded-full hover:bg-navy/90 transition-colors mt-0.5"
          >
            Suggest
          </Link>
        </div>
      </div>

      {/* ── Sections 4 & 5, or empty state ── */}
      {isEmpty ? (
        <div className="bg-white border border-border rounded-2xl p-6 shadow-[0_4px_16px_rgba(15,27,60,0.06)]">
          <h2 className="font-display text-xl font-bold text-navy mb-3">How introductions work</h2>
          <p className="text-sm text-body-grey leading-relaxed mb-5">
            You can request a warm introduction to any member you share a mutual connection with.
            Your mutual connection gets asked if they&apos;re willing to facilitate — they write a short
            note putting you both in context, and the introduction is made. You have 3 intro credits
            per month. You earn one back each time you facilitate an intro for someone else. Cold
            connect buttons don&apos;t exist here.
          </p>
          <Link
            href="/members"
            className="inline-flex items-center gap-1.5 text-sm font-medium bg-navy text-warm-white px-5 py-2.5 rounded-full hover:bg-navy/90 transition-colors"
          >
            Browse members
          </Link>
        </div>
      ) : (
        <div className="space-y-8">

          {/* Section 4: Your requests */}
          {mine.length > 0 && (
            <section>
              <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-[0_4px_16px_rgba(15,27,60,0.06)]">
                <div className="px-6 pt-5 pb-4 border-b border-border">
                  <h2 className="font-display text-lg font-bold text-navy">Your requests</h2>
                  <p className="text-sm text-body-grey mt-0.5">
                    Intros you&apos;ve requested or set up.
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {mine.map(r => {
                    const headline    = r.type === 'open_door'
                      ? `Request to connect with ${name(r.target_id)}`
                      : `Intro request to ${name(r.target_id)}`
                    const subline     = r.type === 'warm_intro' && r.facilitator_id
                      ? `via ${name(r.facilitator_id)}`
                      : null
                    const isExpiredRow = r.status === 'pending' && new Date(r.expires_at) < new Date()
                    return (
                      <IntroCardDismissable
                        key={r.id}
                        id={r.id}
                        headline={headline}
                        subline={subline}
                        label={timeLabel(r.expires_at, r.status)}
                        status={r.status}
                        expiresAt={r.expires_at}
                        canResend={isExpiredRow && !r.resent_at}
                      />
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Section 5: Intros to you */}
          {asTarget.length > 0 && (
            <section>
              <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-[0_4px_16px_rgba(15,27,60,0.06)]">
                <div className="px-6 pt-5 pb-4 border-b border-border">
                  <h2 className="font-display text-lg font-bold text-navy">Intros to you</h2>
                  <p className="text-sm text-body-grey mt-0.5">
                    Connections others want to make with you.
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {asTarget.map(r => {
                    const headline = r.type === 'open_door'
                      ? `${name(r.requester_id)} wants to connect`
                      : `${name(r.requester_id)} → ${name(r.target_id)}`
                    const subline  = r.type === 'open_door' ? 'Open Door' : null
                    return (
                      <IntroCardDismissable
                        key={r.id}
                        id={r.id}
                        headline={headline}
                        subline={subline}
                        label={timeLabel(r.expires_at, r.status)}
                        status={r.status}
                        expiresAt={r.expires_at}
                      />
                    )
                  })}
                </div>
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  )
}
