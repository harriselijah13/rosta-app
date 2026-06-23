import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeConnectorScore } from '@/lib/connector-score'

function currentPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function formatExpiry(lastAwarded: string): string {
  const expiry = new Date(new Date(lastAwarded).getTime() + 7 * 24 * 60 * 60 * 1000)
  return expiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function ChevronRight() {
  return (
    <svg className="w-4 h-4 text-border group-hover:text-navy/40 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

const HOW_IT_WORKS = [
  { pts: '+5', event: 'Invite redeemed',                note: 'A member you invited joined ROSTA.' },
  { pts: '+1', event: 'Accepted intro request',         note: 'Your warm intro request was accepted by the recipient.' },
  { pts: '+3', event: 'Deep conversation from intro',   note: 'Two members you introduced exchanged 3 or more messages each — a real conversation.' },
  { pts: '+8', event: 'Outcome from facilitated intro', note: 'A connection you facilitated marked an outcome — something real came from it.' },
  { pts: '+5', event: 'QR connection',                  note: 'You connected with someone in person via QR scan.' },
  { pts: '+2', event: 'Thank you received',             note: 'Someone thanked you for an introduction you made for them.' },
  { pts: '+1', event: 'Open Table completed',           note: 'You participated in a monthly Open Table group conversation.' },
  { pts: '+2', event: 'Signal update bonus',            note: 'Signals updated within the last 7 days. The bonus renews with each update.' },
]

export default async function ScorePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const period = currentPeriod()

  const [score, { data: profileRow }, { data: creditsRow }] = await Promise.all([
    computeConnectorScore(user.id),
    admin.from('profiles')
      .select('signal_score_last_awarded')
      .eq('id', user.id)
      .single(),
    admin.from('intro_credits')
      .select('balance, period')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const lastAwarded    = profileRow?.signal_score_last_awarded ?? null
  const creditBalance  = !creditsRow || creditsRow.period !== period ? 3 : creditsRow.balance
  const fiveDaysAgo    = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  const signalStale    = score.signalBonus === 0 ||
    (lastAwarded !== null && new Date(lastAwarded) < fiveDaysAgo)

  // Section B — breakdown rows, only non-zero components
  type BreakdownItem = { label: string; detail: string; points: number }
  const breakdown: BreakdownItem[] = []
  if (score.invitesRedeemed > 0) breakdown.push({
    label: 'Invites redeemed',
    detail: `${score.invitesRedeemed} × 5 pts`,
    points: score.invitesRedeemed * 5,
  })
  if (score.introRequests > 0) breakdown.push({
    label: 'Warm intro requests accepted',
    detail: `${score.introRequests} × 1 pt`,
    points: score.introRequests * 1,
  })
  if (score.deepConvos > 0) breakdown.push({
    label: 'Deep conversations from your introductions',
    detail: `${score.deepConvos} × 3 pts`,
    points: score.deepConvos * 3,
  })
  if (score.outcomes > 0) breakdown.push({
    label: 'Outcomes from your introductions',
    detail: `${score.outcomes} × 8 pts`,
    points: score.outcomes * 8,
  })
  if (score.qrConnections > 0) breakdown.push({
    label: 'In-person QR connections',
    detail: `${score.qrConnections} × 5 pts`,
    points: score.qrConnections * 5,
  })
  if (score.thankYous > 0) breakdown.push({
    label: 'Thank-yous received',
    detail: `${score.thankYous} × 2 pts`,
    points: score.thankYous * 2,
  })
  if (score.openTables > 0) breakdown.push({
    label: 'Open Tables completed',
    detail: `${score.openTables} × 1 pt`,
    points: score.openTables * 1,
  })
  if (score.signalBonus > 0) breakdown.push({
    label: 'Signal update bonus',
    detail: lastAwarded ? `expires ${formatExpiry(lastAwarded)}` : 'active this week',
    points: score.signalBonus,
  })

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">

      {/* Back */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-body-grey hover:text-navy transition-colors mb-10"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Dashboard
      </Link>

      {/* ── Section A — Hero ── */}
      <div className="text-center py-10 mb-10">
        <p
          className="font-display font-black text-navy leading-none"
          style={{ fontSize: 'clamp(80px, 20vw, 120px)' }}
        >
          {score.total}
        </p>
        <p className="text-sm font-medium text-body-grey mt-3 tracking-widest uppercase">
          Your Connector Score
        </p>
        <p
          className="font-display italic mt-5 text-lg leading-relaxed"
          style={{ color: 'rgba(15,27,60,0.50)' }}
        >
          Rewards what you do for others, not what you accumulate.
        </p>
      </div>

      {/* ── Section B — Where this came from ── */}
      {breakdown.length > 0 && (
        <section className="mb-12">
          <h2 className="font-display text-xl font-bold text-navy mb-4">Where this came from</h2>
          <div className="bg-white border border-border rounded-2xl divide-y divide-border overflow-hidden">
            {breakdown.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy">{item.label}</p>
                  <p className="text-xs text-body-grey mt-0.5">{item.detail}</p>
                </div>
                <span className="text-sm font-semibold text-navy shrink-0">+{item.points}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 px-5 py-4 bg-surface">
              <p className="text-sm font-semibold text-navy">Total</p>
              <span className="text-sm font-bold text-navy">{score.total}</span>
            </div>
          </div>
        </section>
      )}

      {/* ── Section B — Zero state ── */}
      {breakdown.length === 0 && (
        <section className="mb-12">
          <h2 className="font-display text-xl font-bold text-navy mb-4">Where this came from</h2>
          <div className="bg-white border border-border rounded-2xl px-5 py-8 text-center">
            <p className="text-sm text-body-grey">No points earned yet — see below for how to start.</p>
          </div>
        </section>
      )}

      {/* ── Section C — How it works ── */}
      <section className="mb-12">
        <h2 className="font-display text-xl font-bold text-navy mb-4">How the score is earned</h2>
        <div className="bg-white border border-border rounded-2xl divide-y divide-border overflow-hidden">
          {HOW_IT_WORKS.map(row => (
            <div key={row.event} className="flex items-start gap-4 px-5 py-4">
              <span
                className="shrink-0 inline-flex items-center justify-center text-[13px] font-semibold leading-none"
                style={{
                  backgroundColor: '#C8F53C',
                  color: '#0F1B3C',
                  padding: '4px 10px',
                  borderRadius: '100px',
                  minWidth: '44px',
                  marginTop: '1px',
                }}
              >
                {row.pts}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-navy">{row.event}</p>
                <p className="text-xs text-body-grey mt-0.5 leading-relaxed">{row.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section D — Why it may drop ── */}
      <section className="mb-12">
        <h2 className="font-display text-xl font-bold text-navy mb-3">Why your score can change</h2>
        <p className="text-[15px] text-body-grey leading-relaxed">
          The signal update bonus rewards keeping your network informed about what you&apos;re working on right now.
          It expires 7 days after your last signal update — keeping signals current keeps the bonus active.
        </p>
      </section>

      {/* ── Section E — Quick wins ── */}
      <section className="mb-16">
        <h2 className="font-display text-xl font-bold text-navy mb-4">Earn more this week</h2>
        <div className="space-y-3">
          {signalStale && (
            <Link
              href="/settings#signals"
              className="flex items-center justify-between gap-4 bg-white border border-border rounded-2xl px-5 py-5 hover:border-navy/30 hover:shadow-sm transition-all group"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy">Update your signals</p>
                <p className="text-xs text-body-grey mt-1 leading-relaxed">
                  Keep your network informed about what you&apos;re building. The +2 weekly bonus resets with each update.
                </p>
              </div>
              <ChevronRight />
            </Link>
          )}
          <Link
            href="/intro/suggest"
            className="flex items-center justify-between gap-4 bg-white border border-border rounded-2xl px-5 py-5 hover:border-navy/30 hover:shadow-sm transition-all group"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-navy">Suggest an intro</p>
              <p className="text-xs text-body-grey mt-1 leading-relaxed">
                Facilitated intros are where the biggest points are. +3 for a deep conversation, +8 when they mark an outcome.
              </p>
            </div>
            <ChevronRight />
          </Link>
          {creditBalance > 0 && (
            <Link
              href="/members"
              className="flex items-center justify-between gap-4 bg-white border border-border rounded-2xl px-5 py-5 hover:border-navy/30 hover:shadow-sm transition-all group"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy">Use your intro credits</p>
                <p className="text-xs text-body-grey mt-1 leading-relaxed">
                  You have {creditBalance} intro credit{creditBalance !== 1 ? 's' : ''} this month.
                  Accepted requests earn you +1.
                </p>
              </div>
              <ChevronRight />
            </Link>
          )}
        </div>
      </section>

      {/* ── Section F — Closing ── */}
      <p
        className="font-display italic text-center text-lg pb-4"
        style={{ color: 'rgba(15,27,60,0.35)' }}
      >
        Generosity is the metric.
      </p>

    </div>
  )
}
