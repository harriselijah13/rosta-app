'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AcceptForm({
  introId,
  otherName,
  hasAlreadyResponded,
  otherHasResponded,
}: {
  introId: string
  otherName: string
  hasAlreadyResponded: boolean
  otherHasResponded: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<'accepted' | 'declined' | null>(null)
  const [state, setState] = useState<'idle' | 'waiting' | 'connected' | 'declined'>(
    hasAlreadyResponded ? (otherHasResponded ? 'connected' : 'waiting') : 'idle'
  )
  const [error, setError] = useState('')

  async function respond(decision: 'accepted' | 'declined') {
    setLoading(decision)
    setError('')
    try {
      const res = await fetch(`/api/intros/facilitated/${introId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }

      if (decision === 'declined') { setState('declined'); return }

      if (data.status === 'accepted') {
        setState('connected')
        if (data.conversationId) {
          setTimeout(() => router.push(`/messages/${data.conversationId}`), 1500)
        }
      } else {
        setState('waiting')
      }
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(null)
    }
  }

  if (state === 'connected') {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-full bg-lime/20 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-semibold text-navy mb-1">You&apos;re now connected with {otherName}</p>
        <p className="text-sm text-body-grey">Opening your messages…</p>
      </div>
    )
  }

  if (state === 'waiting') {
    return (
      <div className="bg-surface border border-border rounded-xl px-5 py-4 text-center">
        <p className="text-sm font-medium text-navy mb-1">Introduction accepted</p>
        <p className="text-sm text-body-grey">
          Waiting for {otherName} to respond. You&apos;ll get an email when they accept.
        </p>
      </div>
    )
  }

  if (state === 'declined') {
    return (
      <div className="bg-surface border border-border rounded-xl px-5 py-4 text-center">
        <p className="text-sm text-body-grey">You declined this introduction.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}
      <button
        onClick={() => respond('accepted')}
        disabled={!!loading}
        className="w-full py-3 bg-navy text-warm-white text-sm font-semibold rounded-full hover:bg-navy/90 transition-colors disabled:opacity-40"
      >
        {loading === 'accepted' ? 'Accepting…' : 'Accept introduction'}
      </button>
      <button
        onClick={() => respond('declined')}
        disabled={!!loading}
        className="w-full py-3 border border-border text-body-grey text-sm font-medium rounded-full hover:border-navy hover:text-navy transition-colors disabled:opacity-40"
      >
        {loading === 'declined' ? 'Declining…' : 'Decline'}
      </button>
    </div>
  )
}
