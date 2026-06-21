'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'

type Props = {
  requestId: string
  requesterName: string
  targetName: string
  isOpenDoor?: boolean
  isFacilitated?: boolean
}

export default function RespondForm({ requestId, requesterName, targetName, isOpenDoor, isFacilitated }: Props) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<'accepted' | 'waiting' | 'declined' | null>(null)

  async function respond(decision: 'accepted' | 'declined') {
    setLoading(true)
    setError('')
    try {
      const endpoint = isFacilitated
        ? `/api/intros/facilitated/${requestId}/respond`
        : `/api/intros/${requestId}/respond`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      // Facilitated intros return { status: 'waiting' } if one party has accepted but not both
      if (decision === 'accepted' && data.status === 'waiting') {
        setResult('waiting')
      } else {
        setResult(decision)
      }
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (result === 'accepted') {
    return (
      <div className="bg-white border border-border rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-lime/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-navy mb-2">Intro facilitated</h2>
        <p className="text-body-grey text-sm mb-1">
          {requesterName} and {targetName} have been connected.
        </p>
        {!isFacilitated && (
          <p className="text-body-grey text-sm">You&apos;ve earned an intro credit.</p>
        )}
      </div>
    )
  }

  if (result === 'waiting') {
    return (
      <div className="bg-white border border-border rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-lime/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-navy mb-2">You&apos;re in</h2>
        <p className="text-body-grey text-sm">
          Waiting for the other person to respond. When both accept, you&apos;ll be connected.
        </p>
      </div>
    )
  }

  if (result === 'declined') {
    return (
      <div className="bg-white border border-border rounded-2xl p-8 text-center">
        <p className="font-medium text-navy mb-1">Request declined</p>
        <p className="text-sm text-body-grey">{requesterName} has been notified.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-2xl p-6">
        <label htmlFor="note" className="block text-sm font-medium text-navy mb-1">
          Add a note <span className="text-body-grey font-normal">(optional)</span>
        </label>
        <textarea
          id="note"
          rows={3}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="I think you two will hit it off because..."
          className="w-full px-4 py-3 bg-white border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors text-sm resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      <div className="flex gap-3">
        <Button
          onClick={() => respond('accepted')}
          loading={loading}
          size="lg"
          className="flex-1"
        >
          {isOpenDoor ? 'Accept connection' : 'Accept and facilitate'}
        </Button>
        <button
          type="button"
          onClick={() => respond('declined')}
          disabled={loading}
          className="flex-1 px-5 py-3 rounded-full border border-border text-sm font-medium text-body-grey hover:border-navy hover:text-navy transition-colors disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  )
}
