'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { approveInviteRequest, declineInviteRequest } from './actions'

export type InviteRequest = {
  id: string
  full_name: string
  email: string
  url: string | null
  what_building: string
  city: string | null
  knows_member: boolean | null
  member_name: string | null
  status: 'pending' | 'approved' | 'declined'
  created_at: string
  approved_at: string | null
  declined_at: string | null
  invite_code_token: string | null
  invite_code_used_at: string | null
  approved_by_name: string | null
  declined_by_name: string | null
}

type Tab = 'pending' | 'approved' | 'declined'

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 2)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function knowsMemberDisplay(knows: boolean | null, memberName: string | null): string {
  if (knows === null) return '—'
  if (knows && memberName) return `Yes: ${memberName}`
  if (knows) return 'Yes'
  return 'No'
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-navy text-warm-white border-navy'
          : 'bg-white text-navy border-border hover:border-navy'
      }`}
    >
      {children}
    </Link>
  )
}

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

function DeclineModal({
  request,
  onConfirm,
  onCancel,
  isPending,
}: {
  request: InviteRequest
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 backdrop-blur-sm p-4"
        onClick={e => { if (e.target === e.currentTarget) onCancel() }}
      >
        <div className="bg-warm-white rounded-2xl shadow-xl max-w-sm w-full p-6">
          <h2 className="font-display text-lg font-bold text-navy mb-2">
            Decline this request?
          </h2>
          <p className="text-sm text-body-grey mb-1">
            <span className="font-medium text-navy">{request.full_name}</span> won&apos;t be notified.
          </p>
          <p className="text-xs text-body-grey mb-6">{request.email}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-body-grey hover:text-navy transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="px-4 py-2 bg-navy text-warm-white text-sm font-medium rounded-full hover:bg-navy/90 transition-colors disabled:opacity-40"
            >
              {isPending ? 'Declining…' : 'Decline'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}

function ViewCodeModal({
  request,
  onClose,
}: {
  request: InviteRequest
  onClose: () => void
}) {
  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 backdrop-blur-sm p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className="bg-warm-white rounded-2xl shadow-xl max-w-sm w-full p-6">
          <h2 className="font-display text-lg font-bold text-navy mb-1">Invite code issued</h2>
          <p className="text-xs text-body-grey mb-5">
            Sent to {request.email} on {fmtDate(request.approved_at)}
          </p>
          <div className="flex items-center justify-center mb-5">
            <span className="font-mono text-base font-bold tracking-widest bg-lime text-navy px-5 py-3 rounded-full">
              {request.invite_code_token ?? '—'}
            </span>
          </div>
          <p className="text-xs text-center text-body-grey mb-6">
            {request.invite_code_used_at
              ? `Used on ${fmtDate(request.invite_code_used_at)}`
              : 'Not yet used'}
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-border rounded-full text-sm font-medium text-navy hover:bg-surface transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Portal>
  )
}

const EMPTY: Record<Tab, string> = {
  pending:  'No pending requests right now.',
  approved: 'No approved requests yet.',
  declined: 'No declined requests yet.',
}

export default function InviteRequestsClient({
  requests,
  tab,
  pendingCount,
}: {
  requests: InviteRequest[]
  tab: Tab
  pendingCount: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [gone,          setGone]          = useState<Set<string>>(new Set())
  const [declineTarget, setDeclineTarget] = useState<InviteRequest | null>(null)
  const [viewCodeTarget, setViewCodeTarget] = useState<InviteRequest | null>(null)
  const [actionTarget,  setActionTarget]  = useState<string | null>(null)
  const [toast,         setToast]         = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const visible = requests.filter(r => !gone.has(r.id))

  function addGone(id: string) {
    setGone(s => { const n = new Set(s); n.add(id); return n })
  }
  function removeGone(id: string) {
    setGone(s => { const n = new Set(s); n.delete(id); return n })
  }

  function handleApprove(r: InviteRequest) {
    setActionTarget(r.id)
    addGone(r.id)
    startTransition(async () => {
      const result = await approveInviteRequest(r.id)
      if ('error' in result) {
        removeGone(r.id)
        setToast(`Failed to approve: ${result.error}`)
      } else {
        setToast(`Approved — invite code sent to ${r.email}`)
        router.refresh()
      }
      setActionTarget(null)
    })
  }

  function handleDeclineConfirm() {
    if (!declineTarget) return
    const r = declineTarget
    setDeclineTarget(null)
    setActionTarget(r.id)
    addGone(r.id)
    startTransition(async () => {
      const result = await declineInviteRequest(r.id)
      if ('error' in result) {
        removeGone(r.id)
        setToast(`Failed to decline: ${result.error}`)
      } else {
        router.refresh()
      }
      setActionTarget(null)
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-navy">Invite requests</h1>
        {pendingCount > 0 && (
          <p className="text-sm text-body-grey mt-1">{pendingCount} pending</p>
        )}
      </div>

      {/* Tab pills */}
      <div className="flex gap-1.5 mb-6 flex-wrap">
        <FilterPill href="?tab=pending" active={tab === 'pending'}>
          Pending ({pendingCount})
        </FilterPill>
        <FilterPill href="?tab=approved" active={tab === 'approved'}>
          Approved
        </FilterPill>
        <FilterPill href="?tab=declined" active={tab === 'declined'}>
          Declined
        </FilterPill>
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl px-6 py-12 text-center">
          <p className="text-sm font-medium text-navy/60">{EMPTY[tab]}</p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left">
                  {['Requester', 'Building', 'City', 'Knows a member', 'URL', 'Received', 'Actions'].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-medium text-body-grey uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map(r => (
                  <tr
                    key={r.id}
                    className={`hover:bg-surface/50 transition-colors ${
                      actionTarget === r.id ? 'opacity-40' : ''
                    }`}
                  >
                    {/* Requester */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium text-navy">{r.full_name}</p>
                      <p className="text-xs text-body-grey">{r.email}</p>
                    </td>

                    {/* Building */}
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="text-navy line-clamp-2 leading-snug">{r.what_building}</p>
                    </td>

                    {/* City */}
                    <td className="px-4 py-3 text-body-grey whitespace-nowrap">
                      {r.city ?? '—'}
                    </td>

                    {/* Knows a member */}
                    <td className="px-4 py-3 whitespace-nowrap text-body-grey">
                      {knowsMemberDisplay(r.knows_member, r.member_name)}
                    </td>

                    {/* URL */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-navy underline underline-offset-2 hover:text-body-grey transition-colors"
                        >
                          Link
                        </a>
                      ) : (
                        <span className="text-body-grey">—</span>
                      )}
                    </td>

                    {/* Received */}
                    <td className="px-4 py-3 text-body-grey whitespace-nowrap text-xs">
                      {relativeTime(r.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {tab === 'pending' && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleApprove(r)}
                            disabled={isPending}
                            className="px-3 py-1.5 bg-lime text-navy text-xs font-medium rounded-full hover:opacity-80 transition-opacity disabled:opacity-40"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setDeclineTarget(r)}
                            disabled={isPending}
                            className="text-xs text-body-grey hover:text-navy transition-colors disabled:opacity-40"
                          >
                            Decline
                          </button>
                        </div>
                      )}

                      {tab === 'approved' && (
                        <div>
                          <p className="text-xs text-body-grey">
                            Approved by {r.approved_by_name ?? 'Admin'} on {fmtDate(r.approved_at)}
                          </p>
                          <button
                            onClick={() => setViewCodeTarget(r)}
                            className="text-xs text-navy underline underline-offset-2 hover:text-body-grey transition-colors mt-0.5"
                          >
                            View code
                          </button>
                        </div>
                      )}

                      {tab === 'declined' && (
                        <p className="text-xs text-body-grey">
                          Declined by {r.declined_by_name ?? 'Admin'} on {fmtDate(r.declined_at)}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Decline confirmation modal */}
      {declineTarget && (
        <DeclineModal
          request={declineTarget}
          onConfirm={handleDeclineConfirm}
          onCancel={() => setDeclineTarget(null)}
          isPending={isPending}
        />
      )}

      {/* View code modal */}
      {viewCodeTarget && (
        <ViewCodeModal
          request={viewCodeTarget}
          onClose={() => setViewCodeTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Portal>
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-navy text-warm-white text-sm font-medium px-5 py-3 rounded-full shadow-lg">
            {toast}
          </div>
        </Portal>
      )}
    </div>
  )
}
