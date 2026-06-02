'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

type Props = {
  targetId: string
  targetName: string
}

export default function OpenDoorForm({ targetId, targetName }: Props) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) { setError('Add a note so they know why you want to connect.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/connections/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, note }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      setSent(true)
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="bg-white border border-border rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-lime/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-navy mb-2">Request sent</h2>
        <p className="text-body-grey text-sm mb-6">
          {targetName} has 48 hours to accept or decline.
        </p>
        <button
          onClick={() => router.push('/members')}
          className="text-sm font-medium text-navy hover:underline"
        >
          Back to members
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white border border-border rounded-2xl p-6">
        <label htmlFor="note" className="block font-display text-lg font-bold text-navy mb-1">
          Why do you want to connect?
        </label>
        <p className="text-sm text-body-grey mb-4">
          Give {targetName} enough context to say yes.
        </p>
        <textarea
          id="note"
          rows={4}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="I came across your work on X and think we could explore Y together..."
          className="w-full px-4 py-3 bg-white border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors text-sm resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      <Button type="submit" loading={loading} size="lg" className="w-full">
        Send connection request
      </Button>
    </form>
  )
}
