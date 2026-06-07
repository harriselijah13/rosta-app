'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createEventQR, revokeEventCode, type CreateEventInput } from './actions'

export type EventCode = {
  id:              string
  token:           string
  label:           string | null
  event_name:      string | null
  event_date:      string | null
  event_location:  string | null
  organiser_name:  string | null
  organiser_email: string | null
  event_notes:     string | null
  created_at:      string
  expires_at:      string
  is_expired:      boolean
  stats: {
    scans:       number
    members:     number
    connections: number
    outcomes:    number
  }
  connections: {
    id:              string
    guest_name:      string
    guest_email:     string
    guest_what_i_do: string
    created_at:      string
    became_member:   boolean
  }[]
}

const BASE = 'https://app.onrosta.com'
function qrUrl(token: string) { return `${BASE}/connect/${token}` }
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtEventDate(dateStr: string | null) {
  if (!dateStr) return '—'
  // date-only string — parse as UTC to avoid timezone shifts
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

const EMPTY: CreateEventInput = {
  eventName: '', eventDate: '', eventLocation: '',
  organiserName: '', organiserEmail: '', eventNotes: '', expiryDays: 30,
}

export default function EventToolsClient({ codes }: { codes: EventCode[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm]         = useState<CreateEventInput>(EMPTY)
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied]     = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  function setField<K extends keyof CreateEventInput>(k: K, v: CreateEventInput[K]) {
    setForm(f => ({ ...f, [k]: v }))
    setFormError('')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.eventName.trim())      { setFormError('Event name is required.'); return }
    if (!form.eventDate)             { setFormError('Event date is required.'); return }
    if (!form.eventLocation.trim())  { setFormError('Location / venue is required.'); return }
    if (!form.organiserName.trim())  { setFormError('Organiser name is required.'); return }
    if (!form.organiserEmail.trim()) { setFormError('Organiser email is required.'); return }

    setCreating(true)
    setNewToken(null)
    try {
      const { token } = await createEventQR(form)
      setNewToken(token)
      setForm(EMPTY)
    } catch {
      setFormError('Failed to create event — please try again.')
    } finally {
      setCreating(false)
      router.refresh()
    }
  }

  function handleRevoke(code: EventCode) {
    const label = code.event_name ?? code.label ?? code.token
    if (!confirm(`Revoke QR for "${label}"? The link will stop working. Guest records are kept.`)) return
    startTransition(async () => {
      await revokeEventCode(code.id)
      router.refresh()
    })
  }

  function copyUrl(token: string) {
    navigator.clipboard.writeText(qrUrl(token))
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold text-navy">Event Tools</h1>

      {/* ── Create event form ── */}
      <section>
        <h2 className="font-display text-lg font-bold text-navy mb-3">Create a new event QR code</h2>
        <div className="bg-white border border-border rounded-2xl p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Row 1: Event name + date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-body-grey mb-1.5">
                  Event name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="RAK Founders Dinner"
                  value={form.eventName}
                  onChange={e => setField('eventName', e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-body-grey mb-1.5">
                  Event date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={form.eventDate}
                  onChange={e => setField('eventDate', e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
                />
              </div>
            </div>

            {/* Row 2: Location */}
            <div>
              <label className="block text-xs font-medium text-body-grey mb-1.5">
                Location / venue <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="The Loft, Dubai Marina"
                value={form.eventLocation}
                onChange={e => setField('eventLocation', e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
              />
            </div>

            {/* Row 3: Organiser name + email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-body-grey mb-1.5">
                  Organiser name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Harris"
                  value={form.organiserName}
                  onChange={e => setField('organiserName', e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-body-grey mb-1.5">
                  Organiser email <span className="text-red-400">*</span>
                  <span className="ml-1 text-body-grey font-normal">(post-event report recipient)</span>
                </label>
                <input
                  type="email"
                  placeholder="harris@example.com"
                  value={form.organiserEmail}
                  onChange={e => setField('organiserEmail', e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
                />
              </div>
            </div>

            {/* Row 4: Notes + expiry */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-body-grey mb-1.5">Notes (optional)</label>
                <textarea
                  placeholder="Private dinner for 20 founders..."
                  value={form.eventNotes}
                  onChange={e => setField('eventNotes', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-body-grey mb-1.5">QR expires in</label>
                <select
                  value={form.expiryDays}
                  onChange={e => setField('expiryDays', Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
            </div>

            {formError && (
              <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">{formError}</p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-2.5 bg-navy text-warm-white text-sm font-medium rounded-full hover:bg-navy/90 transition-colors disabled:opacity-40"
              >
                {creating ? 'Generating...' : 'Generate QR code'}
              </button>
            </div>
          </form>

          {/* New code result */}
          {newToken && (
            <div className="mt-5 p-4 bg-lime/10 border border-lime/40 rounded-xl">
              <p className="text-xs font-medium text-navy mb-2">QR code created — share this URL or print the QR</p>
              <div className="flex items-center gap-3 flex-wrap">
                <code className="text-sm font-mono text-navy bg-white border border-border px-3 py-1.5 rounded-lg flex-1 min-w-0 truncate">
                  {qrUrl(newToken)}
                </code>
                <button
                  onClick={() => copyUrl(newToken)}
                  className="text-xs font-medium border border-border px-3 py-1.5 rounded-full hover:border-navy transition-colors shrink-0"
                >
                  {copied === newToken ? 'Copied' : 'Copy URL'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Event list ── */}
      <section>
        <h2 className="font-display text-lg font-bold text-navy mb-3">
          All events
          <span className="ml-2 text-base font-sans font-normal text-body-grey">({codes.length})</span>
        </h2>

        {codes.length === 0 ? (
          <div className="bg-white border border-border rounded-2xl px-6 py-10 text-center">
            <p className="text-sm text-body-grey">No events created yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {codes.map(code => (
              <div key={code.id} className="bg-white border border-border rounded-2xl overflow-hidden">
                {/* Event header row */}
                <div className="px-6 py-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      {/* Title + status */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-base font-semibold text-navy">
                          {code.event_name ?? code.label ?? 'Unnamed event'}
                        </p>
                        {code.is_expired ? (
                          <span className="text-[10px] font-medium text-body-grey border border-border px-1.5 py-0.5 rounded-full">Expired</span>
                        ) : (
                          <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-green-500 shrink-0" />
                            Active
                          </span>
                        )}
                      </div>

                      {/* Event meta */}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                        {code.event_date && (
                          <span className="text-xs text-body-grey">{fmtEventDate(code.event_date)}</span>
                        )}
                        {code.event_location && (
                          <span className="text-xs text-body-grey">{code.event_location}</span>
                        )}
                        {code.organiser_name && (
                          <span className="text-xs text-body-grey">Organiser: {code.organiser_name}</span>
                        )}
                      </div>

                      {/* QR URL */}
                      <p className="text-xs text-body-grey font-mono truncate mt-1.5">{qrUrl(code.token)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        onClick={() => copyUrl(code.token)}
                        className="text-xs border border-border px-3 py-1.5 rounded-full hover:border-navy transition-colors"
                      >
                        {copied === code.token ? 'Copied' : 'Copy URL'}
                      </button>
                      <Link
                        href={`/admin/event-tools/report/${code.id}`}
                        className="text-xs font-medium border border-navy text-navy px-3 py-1.5 rounded-full hover:bg-navy hover:text-warm-white transition-colors"
                      >
                        Report
                      </Link>
                      <button
                        disabled={isPending}
                        onClick={() => handleRevoke(code)}
                        className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatPill label="Scans"       value={code.stats.scans} />
                    <StatPill label="Joined ROSTA" value={code.stats.members} />
                    <StatPill label="Connections"  value={code.stats.connections} />
                    <StatPill label="Outcomes"     value={code.stats.outcomes} />
                  </div>
                </div>

                {/* Expandable guest list */}
                <div className="border-t border-border">
                  <button
                    onClick={() => setExpanded(expanded === code.id ? null : code.id)}
                    className="w-full px-6 py-3 text-left text-xs font-medium text-body-grey hover:text-navy transition-colors flex items-center justify-between"
                  >
                    <span>
                      {code.stats.scans} guest{code.stats.scans !== 1 ? 's' : ''}
                      {code.stats.scans > 0 && ` · ${code.stats.members} joined ROSTA`}
                    </span>
                    <span>{expanded === code.id ? '▲' : '▼'}</span>
                  </button>
                </div>

                {expanded === code.id && (
                  <div className="border-t border-border bg-surface/40">
                    {code.connections.length === 0 ? (
                      <p className="px-6 py-4 text-sm text-body-grey">No guests have scanned this QR yet.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="px-6 py-2.5 text-left text-xs font-medium text-body-grey uppercase tracking-wide">Name</th>
                            <th className="px-6 py-2.5 text-left text-xs font-medium text-body-grey uppercase tracking-wide">Email</th>
                            <th className="px-6 py-2.5 text-left text-xs font-medium text-body-grey uppercase tracking-wide hidden sm:table-cell">What they do</th>
                            <th className="px-6 py-2.5 text-left text-xs font-medium text-body-grey uppercase tracking-wide">Scanned</th>
                            <th className="px-6 py-2.5 text-left text-xs font-medium text-body-grey uppercase tracking-wide">Member</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {code.connections.map(gc => (
                            <tr key={gc.id}>
                              <td className="px-6 py-3 font-medium text-navy whitespace-nowrap">{gc.guest_name}</td>
                              <td className="px-6 py-3 text-body-grey">{gc.guest_email}</td>
                              <td className="px-6 py-3 text-body-grey hidden sm:table-cell max-w-[200px] truncate">{gc.guest_what_i_do}</td>
                              <td className="px-6 py-3 text-body-grey whitespace-nowrap">{fmtDate(gc.created_at)}</td>
                              <td className="px-6 py-3">
                                {gc.became_member ? (
                                  <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">Yes</span>
                                ) : (
                                  <span className="text-[10px] text-body-grey">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface rounded-xl px-4 py-3 text-center">
      <p className="font-display text-2xl font-bold text-navy leading-none">{value}</p>
      <p className="text-[11px] text-body-grey mt-0.5">{label}</p>
    </div>
  )
}
