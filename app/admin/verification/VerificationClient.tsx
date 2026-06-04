'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { approveVerification, rejectVerification, updatePricing } from './actions'

export type VerRequest = {
  id: string
  user_id: string
  statement: string | null
  status: string
  stripe_payment_status: string | null
  rejection_reason: string | null
  created_at: string
  tier: string | null
  price_aed: number | null
  first_name: string | null
  last_name: string | null
  username: string | null
  email: string
}

export type PricingRow = {
  tier: string
  price_aed: number
}

function relativeDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

function fullName(r: VerRequest) {
  return [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Unknown'
}

function StatusChip({ status, payStatus }: { status: string; payStatus: string | null }) {
  if (status === 'approved' && payStatus === 'paid') {
    return <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-lime/30 text-navy border border-lime/50">Verified</span>
  }
  if (status === 'approved') {
    return <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">Approved — awaiting payment</span>
  }
  if (status === 'rejected') {
    return <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">Rejected</span>
  }
  return <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Pending review</span>
}

function RejectModal({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  function submit() {
    if (!reason.trim()) return
    startTransition(async () => {
      await rejectVerification(requestId, reason.trim())
      setDone(true)
      setTimeout(onClose, 800)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="font-display text-lg font-bold text-navy mb-4">Reject request</h2>
        {done ? (
          <p className="text-sm text-green-700">Rejected and email sent.</p>
        ) : (
          <>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Give a brief reason (sent to the applicant)"
              rows={4}
              className="w-full px-4 py-3 border border-border rounded-xl text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={submit}
                disabled={!reason.trim() || pending}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-full text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40"
              >
                {pending ? 'Rejecting…' : 'Reject & notify'}
              </button>
              <button
                onClick={onClose}
                className="flex-1 border border-border text-body-grey py-2.5 rounded-full text-sm font-medium hover:text-navy hover:border-navy transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function RequestRow({ req }: { req: VerRequest }) {
  const [approving, startApprove] = useTransition()
  const [approved, setApproved] = useState(false)
  const [showReject, setShowReject] = useState(false)

  function handleApprove() {
    startApprove(async () => {
      await approveVerification(req.id)
      setApproved(true)
    })
  }

  const isPending = req.status === 'pending'

  return (
    <>
      {showReject && <RejectModal requestId={req.id} onClose={() => setShowReject(false)} />}
      <div className="bg-white border border-border rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-navy text-sm">{fullName(req)}</p>
              <StatusChip status={approved ? 'approved' : req.status} payStatus={req.stripe_payment_status} />
            </div>
            <p className="text-xs text-body-grey mt-0.5">{req.email}</p>
          </div>
          <p className="text-xs text-body-grey shrink-0">{relativeDate(req.created_at)}</p>
        </div>

        {req.statement && (
          <blockquote className="border-l-2 border-lime pl-3 text-sm text-navy italic mb-3 leading-relaxed">
            {req.statement}
          </blockquote>
        )}

        <div className="flex items-center gap-4 text-xs text-body-grey mb-4">
          {req.tier && (
            <span>Tier: <span className="font-medium text-navy capitalize">{req.tier}</span></span>
          )}
          {req.price_aed != null && (
            <span>Price: <span className="font-medium text-navy">AED {Number(req.price_aed).toFixed(2)}</span></span>
          )}
          <Link href={`/profile/${req.username ?? req.user_id}`} target="_blank" className="hover:text-navy transition-colors underline underline-offset-2">
            View profile
          </Link>
        </div>

        {req.rejection_reason && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">
            Rejection reason: {req.rejection_reason}
          </p>
        )}

        {isPending && !approved && (
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={approving}
              className="flex-1 bg-navy text-warm-white py-2 rounded-full text-sm font-medium hover:bg-navy/90 transition-colors disabled:opacity-40"
            >
              {approving ? 'Approving…' : 'Approve'}
            </button>
            <button
              onClick={() => setShowReject(true)}
              className="flex-1 border border-border text-body-grey py-2 rounded-full text-sm font-medium hover:border-red-300 hover:text-red-600 transition-colors"
            >
              Reject
            </button>
          </div>
        )}

        {approved && (
          <p className="text-sm text-green-700 font-medium">Approved — payment link sent.</p>
        )}
      </div>
    </>
  )
}

function PricingEditor({ pricing }: { pricing: PricingRow[] }) {
  const [rows, setRows] = useState<PricingRow[]>(pricing)
  const [saving, startSave] = useTransition()
  const [saved, setSaved] = useState(false)

  function update(tier: string, value: string) {
    setRows(prev => prev.map(r => r.tier === tier ? { ...r, price_aed: parseFloat(value) || 0 } : r))
    setSaved(false)
  }

  function save() {
    startSave(async () => {
      await Promise.all(rows.map(r => updatePricing(r.tier, r.price_aed)))
      setSaved(true)
    })
  }

  return (
    <div className="bg-white border border-border rounded-2xl p-6">
      <h2 className="font-display text-lg font-bold text-navy mb-4">Verification Pricing</h2>
      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.tier} className="flex items-center gap-4">
            <p className="w-32 text-sm font-medium text-navy capitalize">{r.tier}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-body-grey">AED</span>
              <input
                type="number"
                value={r.price_aed}
                min={0}
                step={1}
                onChange={e => update(r.tier, e.target.value)}
                className="w-28 px-3 py-2 border border-border rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={save}
          disabled={saving}
          className="bg-navy text-warm-white px-5 py-2 rounded-full text-sm font-medium hover:bg-navy/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save prices'}
        </button>
        {saved && <p className="text-sm text-green-700">Saved.</p>}
      </div>
    </div>
  )
}

const TABS = ['Pending', 'Approved', 'Verified', 'Rejected'] as const
type Tab = typeof TABS[number]

function filterByTab(reqs: VerRequest[], tab: Tab): VerRequest[] {
  if (tab === 'Pending')  return reqs.filter(r => r.status === 'pending')
  if (tab === 'Approved') return reqs.filter(r => r.status === 'approved' && r.stripe_payment_status !== 'paid')
  if (tab === 'Verified') return reqs.filter(r => r.stripe_payment_status === 'paid')
  if (tab === 'Rejected') return reqs.filter(r => r.status === 'rejected')
  return reqs
}

export default function VerificationClient({
  requests,
  pricing,
}: {
  requests: VerRequest[]
  pricing: PricingRow[]
}) {
  const [tab, setTab] = useState<Tab>('Pending')
  const shown = filterByTab(requests, tab)
  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors relative ${
              tab === t ? 'bg-navy text-warm-white' : 'text-body-grey border border-border hover:text-navy hover:border-navy'
            }`}
          >
            {t}
            {t === 'Pending' && pendingCount > 0 && (
              <span className={`ml-1.5 text-xs font-bold ${tab === t ? 'text-lime' : 'text-red-500'}`}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {shown.length === 0 ? (
        <p className="text-sm text-body-grey py-8 text-center">No {tab.toLowerCase()} requests.</p>
      ) : (
        <div className="space-y-3">
          {shown.map(r => <RequestRow key={r.id} req={r} />)}
        </div>
      )}

      {/* Pricing */}
      <PricingEditor pricing={pricing} />
    </div>
  )
}
