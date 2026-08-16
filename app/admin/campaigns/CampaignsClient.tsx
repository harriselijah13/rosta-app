'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCampaign,
  pauseCampaign,
  resumeCampaign,
  deleteCampaign,
  type CreateCampaignInput,
  type NewPromoScreen,
} from './actions'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Member = {
  id:         string
  first_name: string
  last_name:  string
}

export type Campaign = {
  id:               string
  title:            string
  message:          string
  status:           'draft' | 'scheduled' | 'active' | 'paused' | 'completed'
  recipient_mode:   'all' | 'specific'
  recipient_ids:    string[] | null
  send_mode:        'immediate' | 'scheduled' | 'recurring'
  recurrence_rule:  string | null
  scheduled_at:     string | null
  recurrence_end:   string | null
  next_send_at:     string | null
  last_sent_at:     string | null
  destination_type: 'route' | 'promo_screen'
  destination_route: string | null
  promo_screen_id:  string | null
  created_at:       string
  delivery_count:   number
}

export type PromoScreen = {
  id:         string
  headline:   string
  status:     string
  expires_at: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const APP_ROUTES = [
  { value: '/(app)/(tabs)/notifications', label: 'Notifications' },
  { value: '/(app)/(tabs)/matchmaking',   label: 'Matchmaking'   },
  { value: '/(app)/(tabs)/profile',       label: 'Profile'       },
  { value: '/(app)/(tabs)/network',       label: 'Network feed'  },
  { value: '/(app)/lend-a-hand',          label: 'Lend a Hand'   },
]

const MASCOT_POSES = [
  { value: '',          label: 'None'      },
  { value: 'wave',      label: 'Wave'      },
  { value: 'point',     label: 'Point'     },
  { value: 'think',     label: 'Think'     },
  { value: 'rest',      label: 'Rest'      },
  { value: 'nod',       label: 'Nod'       },
  { value: 'celebrate', label: 'Celebrate' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fullName(m: Member): string {
  return [m.first_name, m.last_name].filter(Boolean).join(' ') || '—'
}

function fmtDt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function scheduleLabel(c: Campaign): string {
  if (c.send_mode === 'immediate')  return 'One-off (immediate)'
  if (c.send_mode === 'scheduled')  return `Scheduled — ${fmtDt(c.scheduled_at)}`
  const rule = c.recurrence_rule ?? 'weekly'
  return `Recurring ${rule} from ${fmtDt(c.scheduled_at)}`
}

const STATUS_PILL: Record<Campaign['status'], string> = {
  draft:     'bg-surface text-body-grey border-border',
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  active:    'bg-lime/20 text-navy border-lime/50',
  paused:    'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-surface text-body-grey border-border',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium text-body-grey uppercase tracking-widest mb-3">
      {children}
    </p>
  )
}

function OptionCard({
  active, onClick, title, sub,
}: { active: boolean; onClick: () => void; title: string; sub?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-3 rounded-xl border text-left transition-colors ${
        active ? 'border-navy bg-navy text-warm-white' : 'border-border text-navy hover:border-navy'
      }`}
    >
      <span className="block text-sm font-medium">{title}</span>
      {sub && (
        <span className={`block text-xs mt-0.5 ${active ? 'text-warm-white/70' : 'text-body-grey'}`}>
          {sub}
        </span>
      )}
    </button>
  )
}

function TextInput({
  label, value, onChange, placeholder, required, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-body-grey mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy
                   placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20
                   focus:border-navy transition-colors"
      />
    </div>
  )
}

// ── Member picker ─────────────────────────────────────────────────────────────

function MemberPicker({
  members, selected, onChange,
}: { members: Member[]; selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return members
    return members.filter(m => fullName(m).toLowerCase().includes(q))
  }, [members, search])

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  function toggleAll() {
    if (selected.size === members.length) onChange(new Set())
    else onChange(new Set(members.map(m => m.id)))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <input
          type="text"
          placeholder="Search members…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 mr-3 px-3 py-2 bg-white border border-border rounded-xl text-sm text-navy
                     placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20
                     focus:border-navy transition-colors"
        />
        <button
          type="button"
          onClick={toggleAll}
          className="shrink-0 text-xs font-medium text-body-grey hover:text-navy transition-colors"
        >
          {selected.size === members.length ? 'Clear all' : 'Select all'}
        </button>
      </div>

      {selected.size > 0 && (
        <p className="text-xs text-body-grey">
          <span className="font-medium text-navy">{selected.size}</span> member{selected.size !== 1 ? 's' : ''} selected
        </p>
      )}

      <div className="max-h-56 overflow-y-auto border border-border rounded-xl divide-y divide-border bg-white">
        {filtered.length === 0 && (
          <p className="px-4 py-3 text-sm text-body-grey">No members match that search.</p>
        )}
        {filtered.map(m => (
          <label
            key={m.id}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.has(m.id)}
              onChange={() => toggle(m.id)}
              className="rounded border-border text-navy focus:ring-navy/30"
            />
            <span className="text-sm text-navy">{fullName(m)}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Composer ──────────────────────────────────────────────────────────────────

function CampaignComposer({
  members, promoScreens, onClose,
}: { members: Member[]; promoScreens: PromoScreen[]; onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Recipients
  const [recipientMode, setRecipientMode] = useState<'all' | 'specific'>('all')
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())

  // Content
  const [title,   setTitle]   = useState('')
  const [message, setMessage] = useState('')

  // Scheduling
  const [sendMode,        setSendMode]        = useState<'immediate' | 'scheduled' | 'recurring'>('immediate')
  const [scheduledAt,     setScheduledAt]     = useState('')
  const [recurrenceRule,  setRecurrenceRule]  = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [recurrenceEnd,   setRecurrenceEnd]   = useState('')

  // Destination
  const [destType,        setDestType]        = useState<'route' | 'promo_screen'>('route')
  const [destRoute,       setDestRoute]       = useState(APP_ROUTES[0].value)
  const [promoMode,       setPromoMode]       = useState<'create' | 'select'>('create')
  const [promoScreenId,   setPromoScreenId]   = useState('')

  // New promo screen fields
  const [promoHeadline, setPromoHeadline] = useState('')
  const [promoBody,     setPromoBody]     = useState('')
  const [promoMascot,   setPromoMascot]   = useState('')
  const [promoCtaLabel, setPromoCtaLabel] = useState('Got it')
  const [promoCtaAction,setPromoCtaAction]= useState('')
  const [promoExpiry,   setPromoExpiry]   = useState('')

  const [error, setError] = useState<string | null>(null)

  const needsDateTime = sendMode !== 'immediate'
  const canSubmit = (
    title.trim() &&
    message.trim() &&
    (recipientMode === 'all' || selectedIds.size > 0) &&
    (sendMode === 'immediate' || scheduledAt) &&
    (destType === 'route'
      ? destRoute
      : promoMode === 'select'
        ? promoScreenId
        : promoHeadline.trim() && promoBody.trim()
    )
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    let newPromo: NewPromoScreen | null = null
    if (destType === 'promo_screen' && promoMode === 'create') {
      newPromo = {
        headline:    promoHeadline.trim(),
        body:        promoBody.trim(),
        mascot_pose: promoMascot,
        cta_label:   promoCtaLabel.trim() || 'Got it',
        cta_action:  promoCtaAction.trim(),
        expires_at:  promoExpiry ? new Date(promoExpiry).toISOString() : '',
      }
    }

    const input: CreateCampaignInput = {
      title:            title.trim(),
      message:          message.trim(),
      recipient_mode:   recipientMode,
      recipient_ids:    Array.from(selectedIds),
      send_mode:        sendMode,
      scheduled_at:     scheduledAt ? new Date(scheduledAt).toISOString() : '',
      recurrence_rule:  sendMode === 'recurring' ? recurrenceRule : '',
      recurrence_end:   recurrenceEnd ? new Date(recurrenceEnd).toISOString() : '',
      destination_type: destType,
      destination_route: destType === 'route' ? destRoute : '',
      promo_screen_id:  destType === 'promo_screen' && promoMode === 'select' ? promoScreenId : '',
      new_promo:        newPromo,
    }

    startTransition(async () => {
      const result = await createCampaign(input)
      if (!result.ok) {
        setError(result.error ?? 'Something went wrong.')
        return
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-border rounded-2xl p-6 space-y-7">

      {/* ── Recipients ────────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Recipients</SectionLabel>
        <div className="flex gap-2 mb-4">
          <OptionCard
            active={recipientMode === 'all'}
            onClick={() => setRecipientMode('all')}
            title="All members"
            sub="Every onboarded member with a push token"
          />
          <OptionCard
            active={recipientMode === 'specific'}
            onClick={() => setRecipientMode('specific')}
            title="Specific members"
            sub={selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Pick from the list below'}
          />
        </div>
        {recipientMode === 'specific' && (
          <MemberPicker members={members} selected={selectedIds} onChange={setSelectedIds} />
        )}
      </div>

      <hr className="border-border" />

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <SectionLabel>Notification content</SectionLabel>
        <TextInput
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="What the push notification says at the top"
          required
        />
        <div>
          <label className="block text-xs font-medium text-body-grey mb-1.5">Message</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="The notification body — one or two sentences"
            required
            rows={3}
            className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy
                       placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20
                       focus:border-navy transition-colors resize-none"
          />
        </div>
      </div>

      <hr className="border-border" />

      {/* ── Scheduling ────────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>When to send</SectionLabel>
        <div className="flex gap-2 mb-4">
          <OptionCard
            active={sendMode === 'immediate'}
            onClick={() => setSendMode('immediate')}
            title="Send now"
            sub="Queued within 10 minutes"
          />
          <OptionCard
            active={sendMode === 'scheduled'}
            onClick={() => setSendMode('scheduled')}
            title="Schedule"
            sub="One-off at a specific date and time"
          />
          <OptionCard
            active={sendMode === 'recurring'}
            onClick={() => setSendMode('recurring')}
            title="Repeat"
            sub="Daily, weekly, or monthly"
          />
        </div>

        {needsDateTime && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-body-grey mb-1.5">
                {sendMode === 'recurring' ? 'Start date and time' : 'Send at'}
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy
                           focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
              />
            </div>

            {sendMode === 'recurring' && (
              <div>
                <label className="block text-xs font-medium text-body-grey mb-1.5">Repeat every</label>
                <div className="flex gap-2">
                  {(['daily', 'weekly', 'monthly'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRecurrenceRule(r)}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                        recurrenceRule === r
                          ? 'border-navy bg-navy text-warm-white'
                          : 'border-border text-navy hover:border-navy'
                      }`}
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {sendMode === 'recurring' && (
          <div className="mt-4">
            <label className="block text-xs font-medium text-body-grey mb-1.5">
              End date{' '}
              <span className="font-normal text-body-grey">(optional — leave blank to repeat indefinitely)</span>
            </label>
            <input
              type="datetime-local"
              value={recurrenceEnd}
              onChange={e => setRecurrenceEnd(e.target.value)}
              className="w-full max-w-xs px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy
                         focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
            />
          </div>
        )}
      </div>

      <hr className="border-border" />

      {/* ── Destination ───────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Where it goes</SectionLabel>
        <div className="flex gap-2 mb-4">
          <OptionCard
            active={destType === 'route'}
            onClick={() => setDestType('route')}
            title="App screen"
            sub="Opens an existing screen in the app"
          />
          <OptionCard
            active={destType === 'promo_screen'}
            onClick={() => setDestType('promo_screen')}
            title="Promo screen"
            sub="A custom campaign landing page"
          />
        </div>

        {destType === 'route' && (
          <div>
            <label className="block text-xs font-medium text-body-grey mb-1.5">Screen</label>
            <select
              value={destRoute}
              onChange={e => setDestRoute(e.target.value)}
              className="w-full max-w-xs px-3 py-2.5 bg-white border border-border rounded-xl text-sm
                         text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy
                         transition-colors"
            >
              {APP_ROUTES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        )}

        {destType === 'promo_screen' && (
          <div className="space-y-4">
            {/* Create vs. select toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPromoMode('create')}
                className={`text-sm font-medium px-4 py-2 rounded-full border transition-colors ${
                  promoMode === 'create'
                    ? 'bg-navy text-warm-white border-navy'
                    : 'border-border text-navy hover:border-navy'
                }`}
              >
                Create new
              </button>
              <button
                type="button"
                onClick={() => setPromoMode('select')}
                disabled={promoScreens.length === 0}
                className={`text-sm font-medium px-4 py-2 rounded-full border transition-colors disabled:opacity-40 ${
                  promoMode === 'select'
                    ? 'bg-navy text-warm-white border-navy'
                    : 'border-border text-navy hover:border-navy'
                }`}
              >
                Use existing
                {promoScreens.length > 0 && (
                  <span className="ml-1.5 text-xs opacity-70">({promoScreens.length})</span>
                )}
              </button>
            </div>

            {promoMode === 'select' && (
              <div>
                <label className="block text-xs font-medium text-body-grey mb-1.5">Select screen</label>
                <select
                  value={promoScreenId}
                  onChange={e => setPromoScreenId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy
                             focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
                >
                  <option value="">Choose a screen…</option>
                  {promoScreens.map(s => (
                    <option key={s.id} value={s.id}>{s.headline}</option>
                  ))}
                </select>
              </div>
            )}

            {promoMode === 'create' && (
              <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
                <TextInput
                  label="Headline"
                  value={promoHeadline}
                  onChange={setPromoHeadline}
                  placeholder="Short heading shown on the screen"
                  required
                />
                <div>
                  <label className="block text-xs font-medium text-body-grey mb-1.5">Body</label>
                  <textarea
                    value={promoBody}
                    onChange={e => setPromoBody(e.target.value)}
                    placeholder="One or two sentences of supporting copy"
                    required
                    rows={3}
                    className="w-full px-3 py-2.5 bg-white border border-border rounded-xl text-sm text-navy
                               placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20
                               focus:border-navy transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-body-grey mb-1.5">
                    Mascot pose{' '}
                    <span className="font-normal">(art slots — illustration comes later)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {MASCOT_POSES.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPromoMascot(p.value)}
                        className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                          promoMascot === p.value
                            ? 'border-navy bg-navy text-warm-white'
                            : 'border-border text-navy hover:border-navy'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <TextInput
                    label="CTA label"
                    value={promoCtaLabel}
                    onChange={setPromoCtaLabel}
                    placeholder="Got it"
                  />
                  <TextInput
                    label="CTA action (optional)"
                    value={promoCtaAction}
                    onChange={setPromoCtaAction}
                    placeholder="Leave blank to dismiss"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-body-grey mb-1.5">
                    Expires{' '}
                    <span className="font-normal">(optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={promoExpiry}
                    onChange={e => setPromoExpiry(e.target.value)}
                    className="w-full max-w-xs px-3 py-2.5 bg-white border border-border rounded-xl
                               text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20
                               focus:border-navy transition-colors"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={!canSubmit || isPending}
          className="px-6 py-2.5 bg-navy text-warm-white text-sm font-medium rounded-full
                     hover:bg-navy/90 transition-colors disabled:opacity-40"
        >
          {isPending ? 'Saving…' : sendMode === 'immediate' ? 'Queue campaign' : 'Save campaign'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="px-5 py-2.5 border border-border text-navy text-sm font-medium rounded-full
                     hover:border-navy transition-colors disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Campaign list ─────────────────────────────────────────────────────────────

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handlePause() {
    if (!confirm(`Pause "${campaign.title}"?`)) return
    startTransition(async () => { await pauseCampaign(campaign.id); router.refresh() })
  }

  function handleResume() {
    startTransition(async () => { await resumeCampaign(campaign.id); router.refresh() })
  }

  function handleDelete() {
    if (!confirm(`Delete "${campaign.title}"? This cannot be undone.`)) return
    startTransition(async () => { await deleteCampaign(campaign.id); router.refresh() })
  }

  const canPause  = campaign.status === 'active' || campaign.status === 'scheduled'
  const canResume = campaign.status === 'paused'
  const canDelete = campaign.status === 'draft' || campaign.status === 'completed'

  const recipientSummary = campaign.recipient_mode === 'all'
    ? 'All members'
    : `${campaign.recipient_ids?.length ?? 0} specific`

  return (
    <tr className="hover:bg-surface/50 transition-colors">
      {/* Title + status */}
      <td className="px-4 py-3 max-w-[220px]">
        <p className="text-sm font-medium text-navy truncate">{campaign.title}</p>
        <span
          className={`inline-flex mt-1 text-[10px] font-semibold border px-2 py-0.5 rounded-full ${
            STATUS_PILL[campaign.status]
          }`}
        >
          {campaign.status}
        </span>
      </td>
      {/* Recipients */}
      <td className="px-4 py-3 text-sm text-body-grey whitespace-nowrap">{recipientSummary}</td>
      {/* Schedule */}
      <td className="px-4 py-3 text-xs text-body-grey max-w-[180px]">
        {scheduleLabel(campaign)}
      </td>
      {/* Next send */}
      <td className="px-4 py-3 text-xs text-body-grey whitespace-nowrap">
        {campaign.status === 'completed' ? (
          <span className="text-body-grey">Sent {fmtDt(campaign.last_sent_at)}</span>
        ) : campaign.next_send_at ? (
          fmtDt(campaign.next_send_at)
        ) : '—'}
      </td>
      {/* Deliveries */}
      <td className="px-4 py-3 text-sm text-body-grey text-right">{campaign.delivery_count}</td>
      {/* Actions */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {canPause && (
            <button
              onClick={handlePause}
              disabled={isPending}
              className="text-xs font-medium text-body-grey hover:text-navy transition-colors disabled:opacity-40"
            >
              Pause
            </button>
          )}
          {canResume && (
            <button
              onClick={handleResume}
              disabled={isPending}
              className="text-xs font-medium text-navy hover:text-navy/70 transition-colors disabled:opacity-40"
            >
              Resume
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
            >
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CampaignsClient({
  members, campaigns, promoScreens,
}: {
  members:      Member[]
  campaigns:    Campaign[]
  promoScreens: PromoScreen[]
}) {
  const [composerOpen, setComposerOpen] = useState(false)

  const activeCampaigns    = campaigns.filter(c => c.status === 'active')
  const scheduledCampaigns = campaigns.filter(c => c.status === 'scheduled')

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Campaigns</h1>
          <p className="text-sm text-body-grey mt-1">
            {activeCampaigns.length > 0 && (
              <span>{activeCampaigns.length} active</span>
            )}
            {activeCampaigns.length > 0 && scheduledCampaigns.length > 0 && (
              <span className="mx-1.5 text-border">·</span>
            )}
            {scheduledCampaigns.length > 0 && (
              <span>{scheduledCampaigns.length} scheduled</span>
            )}
            {activeCampaigns.length === 0 && scheduledCampaigns.length === 0 && (
              <span>No active campaigns</span>
            )}
          </p>
        </div>
        {!composerOpen && (
          <button
            onClick={() => setComposerOpen(true)}
            className="shrink-0 px-5 py-2.5 bg-navy text-warm-white text-sm font-medium rounded-full
                       hover:bg-navy/90 transition-colors"
          >
            New campaign
          </button>
        )}
      </div>

      {/* Composer */}
      {composerOpen && (
        <section>
          <h2 className="font-display text-lg font-bold text-navy mb-3">New campaign</h2>
          <CampaignComposer
            members={members}
            promoScreens={promoScreens}
            onClose={() => setComposerOpen(false)}
          />
        </section>
      )}

      {/* Campaign list */}
      <section>
        <h2 className="font-display text-lg font-bold text-navy mb-3">All campaigns</h2>
        {campaigns.length === 0 ? (
          <div className="bg-white border border-border rounded-2xl px-5 py-10 text-center">
            <p className="text-sm text-body-grey">No campaigns yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    {['Campaign', 'Recipients', 'Schedule', 'Next send', 'Deliveries', 'Actions'].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium text-body-grey uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {campaigns.map(c => (
                    <CampaignRow key={c.id} campaign={c} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
