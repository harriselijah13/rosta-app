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
}

export function IntroCardDismissable({ id, headline, subline, label, status, expiresAt }: Props) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const canDismiss = status === 'accepted' || status === 'declined'

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

  return (
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
      {canDismiss && (
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="self-start p-3 text-body-grey/40 hover:text-navy transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
