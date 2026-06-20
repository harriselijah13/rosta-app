'use client'

import { useState } from 'react'
import Link from 'next/link'

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
    <span className={`shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full border ${map[effective] ?? map.expired}`}>
      {labels[effective] ?? effective}
    </span>
  )
}

type Props = {
  id: string
  headline: string
  subline?: string | null
  label?: string
  status: string
  expiresAt: string
  canResend?: boolean
}

export function IntroCardDismissable({ id, headline, subline, label, status, expiresAt, canResend }: Props) {
  const [dismissed, setDismissed]   = useState(false)
  const [resending, setResending]   = useState(false)
  const [toast, setToast]           = useState<string | null>(null)

  if (dismissed) return null

  const isExpiredRow = status === 'pending' && new Date(expiresAt) < new Date()
  const canDismiss   = status === 'accepted' || status === 'declined' || isExpiredRow

  async function handleDismiss(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDismissed(true)
    try {
      const res = await fetch(`/api/intros/${id}/dismiss`, { method: 'POST' })
      if (!res.ok) throw new Error('dismiss failed')
    } catch {
      setDismissed(false)
    }
  }

  async function handleResend(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (resending) return
    setResending(true)
    try {
      const res = await fetch(`/api/intros/${id}/resend`, { method: 'POST' })
      if (!res.ok) throw new Error('resend failed')
      setToast('Request resent. They have 7 days to respond.')
      setTimeout(() => setDismissed(true), 3000)
    } catch {
      setResending(false)
    }
  }

  return (
    <>
      <div className="flex items-stretch rounded-xl border border-border hover:border-navy/30 hover:bg-surface/50 transition-all">
        <Link
          href={`/intro/${id}`}
          className="flex flex-1 items-start justify-between gap-4 p-4 min-w-0"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-navy">{headline}</p>
            {subline && <p className="text-xs text-body-grey mt-0.5">{subline}</p>}
            {label && <p className="text-xs text-body-grey mt-1">{label}</p>}
          </div>
          <StatusPill status={status} expiresAt={expiresAt} />
        </Link>

        <div className="flex items-start gap-1 px-2 pt-3 shrink-0">
          {canResend && (
            <button
              onClick={handleResend}
              disabled={resending}
              aria-label="Resend request"
              className="px-3 py-1 text-xs font-medium bg-navy text-warm-white rounded-full hover:bg-navy/80 transition-colors disabled:opacity-50"
            >
              {resending ? '…' : 'Resend'}
            </button>
          )}
          {canDismiss && (
            <button
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="p-1.5 text-body-grey/40 hover:text-navy transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-navy text-warm-white text-sm font-medium px-5 py-3 rounded-full shadow-lg whitespace-nowrap pointer-events-none">
          {toast}
        </div>
      )}
    </>
  )
}
