import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const LABEL_DISPLAY: Record<string, string> = {
  led_to_call:          'Led to a call',
  led_to_collaboration: 'Led to collaboration',
  led_to_client:        'Led to a client relationship',
  led_to_hire:          'Led to a hire',
  introduced_elsewhere: 'Introduced to someone else',
  no_outcome:           'No outcome yet',
  not_a_fit:            'Not a fit',
}

const LABEL_ORDER = Object.keys(LABEL_DISPLAY)

function monthStart() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

export default async function ConversationOutcomesPage() {
  const admin = createAdminClient()
  const monthStartIso = monthStart()

  const { data: rows } = await admin
    .from('conversation_outcomes')
    .select('label, created_at')

  const allTime:   Record<string, number> = {}
  const thisMonth: Record<string, number> = {}

  for (const label of LABEL_ORDER) {
    allTime[label]   = 0
    thisMonth[label] = 0
  }

  for (const row of rows ?? []) {
    if (allTime[row.label] !== undefined) {
      allTime[row.label]++
      if (row.created_at >= monthStartIso) thisMonth[row.label]++
    }
  }

  const total          = (rows ?? []).length
  const totalThisMonth = (rows ?? []).filter(r => r.created_at >= monthStartIso).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy mb-1">Conversation Outcomes</h1>
        <p className="text-sm text-body-grey max-w-prose">
          Each participant labels their own conversation independently. Counts reflect individual labels,
          not unique conversations. Aggregate only — no message content is shown.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-xs">
        <div className="bg-white border border-border rounded-2xl px-5 py-4">
          <p className="font-display text-3xl font-bold text-navy leading-none mb-1">
            {total.toLocaleString()}
          </p>
          <p className="text-xs text-body-grey">Labels set (all time)</p>
        </div>
        <div className="bg-white border border-border rounded-2xl px-5 py-4">
          <p className="font-display text-3xl font-bold text-navy leading-none mb-1">
            {totalThisMonth.toLocaleString()}
          </p>
          <p className="text-xs text-body-grey">Labels set this month</p>
        </div>
      </div>

      <div className="bg-white border border-border rounded-2xl overflow-hidden max-w-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="text-left px-5 py-3 font-medium text-body-grey text-xs tracking-wide uppercase">
                Label
              </th>
              <th className="text-right px-5 py-3 font-medium text-body-grey text-xs tracking-wide uppercase">
                All time
              </th>
              <th className="text-right px-5 py-3 font-medium text-body-grey text-xs tracking-wide uppercase">
                This month
              </th>
            </tr>
          </thead>
          <tbody>
            {LABEL_ORDER.map((key, i) => (
              <tr key={key} className={i < LABEL_ORDER.length - 1 ? 'border-b border-border' : ''}>
                <td className="px-5 py-3 text-navy font-medium">{LABEL_DISPLAY[key]}</td>
                <td className="px-5 py-3 text-right font-display font-bold text-navy text-lg">
                  {allTime[key].toLocaleString()}
                </td>
                <td className="px-5 py-3 text-right text-body-grey">
                  {thisMonth[key].toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-body-grey">Updates on page refresh.</p>
    </div>
  )
}
