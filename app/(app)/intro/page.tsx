import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import InvitePanel from './InvitePanel'
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
    pending:  'bg-amber-50 text-amber-700 border-amber-200',
    accepted: 'bg-green-50 text-green-700 border-green-200',
    declined: 'bg-red-50 text-red-600 border-red-200',
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

function CreditsCard({ balance, lifetimeEarned }: { balance: number; lifetimeEarned: number }) {
  const pillColor =
    balance === 0 ? 'bg-red-50 text-red-600 border-red-200'
    : balance === 1 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-green-50 text-green-700 border-green-200'

  const barFilled = Math.min(balance, 3)

  return (
    <div className="bg-white border border-border rounded-2xl p-5 mb-8">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="font-display text-base font-bold text-navy">Intro Credits</h2>
          <p className="text-xs text-body-grey mt-0.5">
            Resets {nextResetDate()}
            {lifetimeEarned > 0 && (
              <span className="ml-2 text-body-grey">
                · {lifetimeEarned} earned lifetime
              </span>
            )}
          </p>
        </div>
        <span className={`shrink-0 text-sm font-bold px-3 py-1 rounded-full border ${pillColor}`}>
          {balance} {balance === 1 ? 'credit' : 'credits'}
        </span>
      </div>

      {/* Bar visualisation — 3 segments for monthly allocation */}
      <div className="flex gap-1.5 mb-3">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < barFilled ? 'bg-navy' : 'bg-border'
            }`}
          />
        ))}
      </div>
      {balance > 3 && (
        <p className="text-xs text-body-grey mb-2">
          +{balance - 3} bonus from facilitations
        </p>
      )}

      <p className="text-xs text-body-grey">
        {balance === 0
          ? 'Out of credits — facilitate an intro for someone to earn one back.'
          : 'Each warm intro request costs 1 credit. Earn one back by facilitating an intro.'}
      </p>
    </div>
  )
}

export default async function IntroInboxPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const period = currentPeriod()

  const lastIntroVisit = cookies().get('intro-last-visited')?.value ?? new Date(0).toISOString()

  // Fetch intro requests, credits, invite codes, and conversations in parallel
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
    id: c.id as string,
    token: c.token as string,
    used_at: c.used_at as string | null,
    reserved_for_email: (c as Record<string, unknown>).reserved_for_email as string | null ?? null,
  }))

  // Lazy monthly reset: if no row or period changed, balance is 3
  const isNewPeriod = !creditsRow || creditsRow.period !== period
  const balance = isNewPeriod ? 3 : creditsRow.balance
  const lifetimeEarned = creditsRow?.lifetime_earned ?? 0

  const allRows = (rows ?? []) as IntroRow[]

  // Conversations keyed by the other participant's ID
  const convByPartner = Object.fromEntries(
    (userConvs ?? []).map(c => [c.user_a === user.id ? c.user_b : c.user_a, c.id])
  )

  // Accepted requests the viewer initiated, not yet seen (responded after last /intro visit)
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
      (r.type === 'open_door' && r.target_id === user.id) ||
      (r.type === 'warm_intro' && r.facilitator_id === user.id)
    )
  )
  const mine = allRows.filter(r =>
    r.requester_id === user.id && !r.dismissed_by_requester_at
  )
  const asTarget = allRows.filter(r =>
    r.target_id === user.id && r.type !== 'warm_intro' && !r.dismissed_by_recipient_at
  )

  function IntroCard({ row, outgoing = false }: { row: IntroRow; outgoing?: boolean }) {
    const label = timeLabel(row.expires_at, row.status)

    let headline: string
    let subline: string | null = null

    if (outgoing) {
      // Current user is the requester — name the recipient
      headline = row.type === 'open_door'
        ? `Request to connect with ${name(row.target_id)}`
        : `Intro request to ${name(row.target_id)}`
      if (row.type === 'warm_intro' && row.facilitator_id) {
        subline = `via ${name(row.facilitator_id)}`
      }
    } else {
      // Current user is responding (facilitator/target) or viewing intros directed at them
      headline = row.type === 'open_door'
        ? `${name(row.requester_id)} wants to connect`
        : `${name(row.requester_id)} → ${name(row.target_id)}`
      if (row.type === 'warm_intro' && row.facilitator_id) {
        subline = `via ${name(row.facilitator_id)}`
      }
      if (row.type === 'open_door') {
        subline = 'Open Door'
      }
    }

    return (
      <Link
        href={`/intro/${row.id}`}
        className="flex items-start justify-between gap-4 p-4 rounded-xl border border-border hover:border-navy/30 hover:bg-surface/50 transition-all"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-navy">{headline}</p>
          {subline && <p className="text-xs text-body-grey mt-0.5">{subline}</p>}
          {label && <p className="text-xs text-body-grey mt-1">{label}</p>}
        </div>
        <StatusPill status={row.status} expiresAt={row.expires_at} />
      </Link>
    )
  }

  const isEmpty = allRows.length === 0

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="font-display text-4xl font-bold text-navy mb-8">Intros</h1>

      <CreditsCard balance={balance} lifetimeEarned={lifetimeEarned} />

      <InvitePanel codes={inviteCodes} />

      {/* Accepted-unseen banners — clears on next visit via MarkVisited cookie action */}
      {acceptedUnseen.length > 0 && (
        <div className="mb-6 space-y-2">
          {acceptedUnseen.map(r => {
            const connectedName = name(r.target_id)
            const convId = convByPartner[r.target_id]
            return (
              <div key={r.id} className="flex items-center justify-between gap-4 bg-lime/10 border border-lime/40 rounded-xl px-5 py-3.5">
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

      {/* Suggest an intro CTA */}
      <div className="mb-8 bg-white border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-navy">Suggest an intro</h2>
            <p className="text-sm text-body-grey mt-0.5">Know two people who should meet? Introduce them.</p>
          </div>
          <Link
            href="/intro/suggest"
            className="shrink-0 text-sm font-medium bg-navy text-warm-white px-4 py-2 rounded-full hover:bg-navy/90 transition-colors"
          >
            Suggest
          </Link>
        </div>
      </div>

      {isEmpty ? (
        <div className="bg-white border border-border rounded-2xl p-8">
          <h2 className="font-display text-xl font-bold text-navy mb-3">How introductions work</h2>
          <p className="text-sm text-body-grey leading-relaxed mb-5">
            You can request a warm introduction to any member you share a mutual connection with. Your mutual connection gets asked if they&apos;re willing to facilitate — they write a short note putting you both in context, and the introduction is made. You have 3 intro credits per month. You earn one back each time you facilitate an intro for someone else. Cold connect buttons don&apos;t exist here.
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
          {pending.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-bold text-navy mb-3">
                Needs your response <span className="text-navy">({pending.length})</span>
              </h2>
              <div className="bg-white border border-border rounded-2xl divide-y divide-border overflow-hidden">
                {pending.map(r => <IntroCard key={r.id} row={r} />)}
              </div>
            </section>
          )}

          {mine.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-bold text-navy mb-3">Your requests</h2>
              <div className="bg-white border border-border rounded-2xl divide-y divide-border overflow-hidden">
                {mine.map(r => {
                  const headline = r.type === 'open_door'
                    ? `Request to connect with ${name(r.target_id)}`
                    : `Intro request to ${name(r.target_id)}`
                  const subline = r.type === 'warm_intro' && r.facilitator_id
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
            </section>
          )}

          {asTarget.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-bold text-navy mb-3">Intros to you</h2>
              <div className="bg-white border border-border rounded-2xl divide-y divide-border overflow-hidden">
                {asTarget.map(r => {
                  const headline = r.type === 'open_door'
                    ? `${name(r.requester_id)} wants to connect`
                    : `${name(r.requester_id)} → ${name(r.target_id)}`
                  const subline = r.type === 'open_door' ? 'Open Door' : null
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
            </section>
          )}
        </div>
      )}
    </div>
  )
}
