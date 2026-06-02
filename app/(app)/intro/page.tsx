import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // Fetch intro requests + credits in parallel
  const [{ data: rows }, { data: creditsRow }] = await Promise.all([
    admin
      .from('intro_requests')
      .select('id, type, requester_id, target_id, facilitator_id, status, requester_note, expires_at, created_at')
      .or(`requester_id.eq.${user.id},facilitator_id.eq.${user.id},target_id.eq.${user.id}`)
      .order('created_at', { ascending: false }),
    admin
      .from('intro_credits')
      .select('balance, period, lifetime_earned')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  // Lazy monthly reset: if no row or period changed, balance is 3
  const isNewPeriod = !creditsRow || creditsRow.period !== period
  const balance = isNewPeriod ? 3 : creditsRow.balance
  const lifetimeEarned = creditsRow?.lifetime_earned ?? 0

  const allRows = (rows ?? []) as IntroRow[]

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
  const mine = allRows.filter(r => r.requester_id === user.id)
  const asTarget = allRows.filter(r => r.target_id === user.id && r.type !== 'warm_intro')

  function IntroCard({ row }: { row: IntroRow }) {
    const label = timeLabel(row.expires_at, row.status)
    return (
      <Link
        href={`/intro/${row.id}`}
        className="flex items-start justify-between gap-4 p-4 rounded-xl border border-border hover:border-navy/30 hover:bg-surface/50 transition-all"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-navy">
            {row.type === 'open_door'
              ? `${name(row.requester_id)} wants to connect`
              : `${name(row.requester_id)} → ${name(row.target_id)}`}
          </p>
          {row.type === 'warm_intro' && row.facilitator_id && (
            <p className="text-xs text-body-grey mt-0.5">via {name(row.facilitator_id)}</p>
          )}
          {row.type === 'open_door' && (
            <p className="text-xs text-body-grey mt-0.5">Open Door</p>
          )}
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

      {isEmpty ? (
        <div className="bg-white border border-border rounded-2xl p-10 text-center">
          <p className="text-navy font-medium mb-1">No intro requests yet</p>
          <p className="text-sm text-body-grey mb-4">
            Request an intro from a member&apos;s profile when you have a mutual connection.
          </p>
          <Link href="/members" className="text-sm font-medium text-navy hover:underline">
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
                {mine.map(r => <IntroCard key={r.id} row={r} />)}
              </div>
            </section>
          )}

          {asTarget.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-bold text-navy mb-3">Intros to you</h2>
              <div className="bg-white border border-border rounded-2xl divide-y divide-border overflow-hidden">
                {asTarget.map(r => <IntroCard key={r.id} row={r} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
