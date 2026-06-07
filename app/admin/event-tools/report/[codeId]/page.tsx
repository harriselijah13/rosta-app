import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import PrintButton from './PrintButton'

export const dynamic = 'force-dynamic'

function fmtEventDate(dateStr: string | null) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default async function EventReportPage({ params }: { params: { codeId: string } }) {
  const admin = createAdminClient()

  // ── Event code ────────────────────────────────────────────────────────────
  const { data: code } = await admin
    .from('invite_codes')
    .select('id, event_name, label, event_date, event_location, organiser_name, organiser_email')
    .eq('id', params.codeId)
    .eq('type', 'guest_qr')
    .single()

  if (!code) notFound()

  const eventName    = code.event_name ?? code.label ?? 'Unnamed event'
  const rawDate      = code.event_date as string | null
  const eventDateObj = rawDate ? new Date(rawDate + 'T00:00:00Z') : null
  const windowStart  = eventDateObj?.toISOString() ?? null
  const windowEnd    = eventDateObj
    ? new Date(eventDateObj.getTime() + 30 * 86400000).toISOString()
    : null

  // ── Guest connections (QR scans) ──────────────────────────────────────────
  const { data: guestConns } = await admin
    .from('guest_connections')
    .select('id, guest_email, created_at')
    .eq('invite_code_id', params.codeId)
    .order('created_at', { ascending: true })

  const totalScans = (guestConns ?? []).length

  // ── Resolve which guests became ROSTA members ─────────────────────────────
  const guestEmails = Array.from(new Set(
    (guestConns ?? []).map(gc => gc.guest_email?.toLowerCase()).filter(Boolean) as string[],
  ))

  const emailToUserId: Record<string, string> = {}
  if (guestEmails.length > 0) {
    const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 })
    for (const u of usersData?.users ?? []) {
      if (u.email && guestEmails.includes(u.email.toLowerCase())) {
        emailToUserId[u.email.toLowerCase()] = u.id
      }
    }
  }

  // Stable ordered list + privacy labels ("Member 1", "Member 2", …)
  const eventMemberIds: string[] = []
  const memberLabel: Record<string, string> = {}
  for (const gc of guestConns ?? []) {
    const uid = emailToUserId[gc.guest_email?.toLowerCase() ?? '']
    if (uid && !memberLabel[uid]) {
      eventMemberIds.push(uid)
      memberLabel[uid] = `Member ${eventMemberIds.length}`
    }
  }

  const eventMemberSet  = new Set(eventMemberIds)
  const newMembersJoined = eventMemberIds.length

  // ── Connections, outcomes, open tables ────────────────────────────────────
  type ConnRow = { id: string; user_a: string; user_b: string; created_at: string }
  let connections:     ConnRow[] = []
  let totalConnections = 0
  let totalOutcomes    = 0
  let openTableCount   = 0
  let networkGrowth    = 0

  if (eventMemberIds.length > 0) {
    const idList = eventMemberIds.join(',')

    // Connections involving any event member within the 30-day window
    let connQ = admin
      .from('connections')
      .select('id, user_a, user_b, created_at')
      .or(`user_a.in.(${idList}),user_b.in.(${idList})`)
      .order('created_at', { ascending: true })
    if (windowStart) connQ = connQ.gte('created_at', windowStart)
    if (windowEnd)   connQ = connQ.lte('created_at', windowEnd)
    const { data: connData } = await connQ
    connections      = connData ?? []
    totalConnections = connections.length

    // Network growth: distinct event members who made at least one connection
    const membersInConns = new Set<string>()
    for (const c of connections) {
      if (eventMemberSet.has(c.user_a)) membersInConns.add(c.user_a)
      if (eventMemberSet.has(c.user_b)) membersInConns.add(c.user_b)
    }
    networkGrowth = membersInConns.size

    // Outcomes via conversations involving event members
    const { data: convs } = await admin
      .from('conversations')
      .select('id')
      .or(`user_a.in.(${idList}),user_b.in.(${idList})`)

    if (convs?.length) {
      const { count } = await admin
        .from('outcomes')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convs.map(c => c.id))
      totalOutcomes = count ?? 0
    }

    // Open Table opt-ins (distinct members, any period)
    const { data: optIns } = await admin
      .from('open_table_optins')
      .select('user_id')
      .in('user_id', eventMemberIds)
    openTableCount = new Set(optIns?.map(o => o.user_id)).size
  }

  // ── Timeline (chronological, capped at 50) ────────────────────────────────
  const timeline = connections.slice(0, 50).map(c => ({
    date: fmtShort(c.created_at),
    label: `${memberLabel[c.user_a] ?? 'A ROSTA member'} connected with ${memberLabel[c.user_b] ?? 'a ROSTA member'}`,
  }))

  const displayDate    = fmtEventDate(rawDate)
  const reportCoverage = displayDate ? `30 days from ${displayDate}` : '30 days from event date'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Hide admin sidebar and navigation chrome when printing */}
      <style>{`@media print { aside, .admin-nav-wrapper { display: none !important; } main { padding: 0 !important; } }`}</style>

      <div className="max-w-4xl mx-auto">

        {/* Back + print controls */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link
            href="/admin/event-tools"
            className="inline-flex items-center gap-1.5 text-sm text-body-grey hover:text-navy transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back to Event Tools
          </Link>
          <PrintButton />
        </div>

        {/* ── Report card ─────────────────────────────────────────────────── */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden print:border-none print:rounded-none">

          {/* Header */}
          <div className="px-8 pt-8 pb-7 border-b border-border">
            <p className="font-display text-base font-bold text-navy mb-4">
              ROSTA<span className="text-lime">.</span>
            </p>
            <p className="text-xs font-semibold uppercase tracking-widest text-body-grey mb-3">
              Event Performance Report
            </p>
            <h1 className="font-display text-3xl font-bold text-navy mb-3 leading-tight">
              {eventName}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-body-grey">
              {displayDate && <span>{displayDate}</span>}
              {code.event_location && (
                <>
                  {displayDate && <span className="text-border">·</span>}
                  <span>{code.event_location}</span>
                </>
              )}
              {code.organiser_name && (
                <>
                  <span className="text-border">·</span>
                  <span>Organised by {code.organiser_name}</span>
                </>
              )}
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border border-b border-border">
            {[
              { label: 'Total QR scans',     value: totalScans },
              { label: 'New members joined', value: newMembersJoined },
              { label: 'Connections made',   value: totalConnections },
              { label: 'Outcomes marked',    value: totalOutcomes },
            ].map(({ label, value }) => (
              <div key={label} className="px-6 py-6">
                <p className="font-display text-4xl font-bold text-navy mb-1">{value}</p>
                <p className="text-xs text-body-grey leading-snug">{label}</p>
              </div>
            ))}
          </div>

          <div className="px-8 py-8 space-y-10">

            {/* Connection timeline */}
            <section>
              <h2 className="font-display text-lg font-bold text-navy mb-1">Connection Timeline</h2>
              <p className="text-xs text-body-grey mb-4">
                Anonymised — member identities are hidden for privacy.
              </p>
              {timeline.length === 0 ? (
                <p className="text-sm text-body-grey">No connections made in the 30-day window.</p>
              ) : (
                <ul className="space-y-0 border border-border rounded-xl overflow-hidden">
                  {timeline.map((row, i) => (
                    <li
                      key={i}
                      className={`flex items-baseline gap-4 px-5 py-3 text-sm ${
                        i % 2 === 0 ? 'bg-white' : 'bg-surface'
                      }`}
                    >
                      <span className="shrink-0 text-xs text-body-grey w-14">{row.date}</span>
                      <span className="text-navy">{row.label}</span>
                    </li>
                  ))}
                  {connections.length > 50 && (
                    <li className="px-5 py-3 text-xs text-body-grey bg-surface border-t border-border">
                      + {connections.length - 50} more connections not shown
                    </li>
                  )}
                </ul>
              )}
            </section>

            {/* Outcome highlights */}
            <section>
              <h2 className="font-display text-lg font-bold text-navy mb-4">Outcome Highlights</h2>
              {totalOutcomes === 0 ? (
                <p className="text-sm text-body-grey">
                  No outcomes marked yet — outcomes are tracked when members mark a connection as
                  &ldquo;This led to something.&rdquo;
                </p>
              ) : (
                <div className="inline-flex items-center gap-3 bg-lime/20 border border-lime/40 rounded-xl px-5 py-4">
                  <span className="font-display text-3xl font-bold text-navy">{totalOutcomes}</span>
                  <span className="text-sm text-navy leading-snug">
                    outcome{totalOutcomes !== 1 ? 's' : ''} marked by connections from this event
                  </span>
                </div>
              )}
            </section>

            {/* Open Table participation */}
            <section>
              <h2 className="font-display text-lg font-bold text-navy mb-4">Open Table Participation</h2>
              {newMembersJoined === 0 ? (
                <p className="text-sm text-body-grey">No members joined from this event yet.</p>
              ) : (
                <p className="text-sm text-navy">
                  <span className="font-display text-2xl font-bold">{openTableCount}</span>
                  {' '}of {newMembersJoined} joined member{newMembersJoined !== 1 ? 's' : ''} opted into Open Tables.
                </p>
              )}
            </section>

            {/* Network growth */}
            <section>
              <h2 className="font-display text-lg font-bold text-navy mb-4">Network Growth</h2>
              {newMembersJoined === 0 ? (
                <p className="text-sm text-body-grey">No members joined from this event yet.</p>
              ) : (
                <>
                  <p className="text-sm text-navy mb-2">
                    <span className="font-display text-2xl font-bold">{networkGrowth}</span>
                    {' '}of {newMembersJoined} event guest{newMembersJoined !== 1 ? 's' : ''} went on to make
                    connections on ROSTA.
                  </p>
                  {networkGrowth > 0 && (
                    <div className="mt-3 h-2 bg-border rounded-full overflow-hidden max-w-xs">
                      <div
                        className="h-full bg-lime rounded-full"
                        style={{ width: `${Math.round((networkGrowth / newMembersJoined) * 100)}%` }}
                      />
                    </div>
                  )}
                </>
              )}
            </section>

          </div>

          {/* Footer */}
          <div className="px-8 py-5 border-t border-border bg-surface">
            <p className="text-xs text-body-grey">
              Report generated by ROSTA&nbsp;·&nbsp;onrosta.com&nbsp;·&nbsp;Data covers {reportCoverage}
            </p>
          </div>

        </div>
      </div>
    </>
  )
}
