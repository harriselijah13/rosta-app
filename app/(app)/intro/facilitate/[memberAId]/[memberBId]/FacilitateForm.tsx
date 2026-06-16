'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Member = {
  id: string
  name: string
  avatarUrl: string | null
  whatIDo: string | null
}

function Initials({ name }: { name: string }) {
  const i = name.trim().split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="w-12 h-12 rounded-full bg-navy/10 text-navy text-base font-semibold flex items-center justify-center shrink-0">
      {i || '?'}
    </div>
  )
}

function MemberCard({ member }: { member: Member }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface flex-1">
      {member.avatarUrl ? (
        <img src={member.avatarUrl} alt={member.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
      ) : (
        <Initials name={member.name} />
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-navy truncate">{member.name}</p>
        {member.whatIDo && (
          <p className="text-xs text-body-grey mt-0.5 line-clamp-2">{member.whatIDo}</p>
        )}
      </div>
    </div>
  )
}

export default function FacilitateForm({
  memberA,
  memberB,
}: {
  memberA: Member
  memberB: Member
}) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [sendToA, setSendToA] = useState(true)
  const [sendToB, setSendToB] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) { setError('Add a note explaining why these two should meet.'); return }
    if (!sendToA && !sendToB) { setError('At least one member must be notified.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/intros/facilitate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberAId: memberA.id, memberBId: memberB.id, note }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      setDone(true)
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="bg-white border border-border rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-lime/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-navy mb-2">Introduction suggested</h2>
        <p className="text-body-grey text-sm mb-6">
          Both {memberA.name} and {memberB.name} have been emailed and can now accept or decline.
          You&apos;ll be notified once they&apos;ve both responded.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm font-medium text-navy hover:underline"
        >
          Back to dashboard
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Member cards */}
      <div className="flex gap-3 flex-col sm:flex-row">
        <MemberCard member={memberA} />
        <div className="hidden sm:flex items-center shrink-0 text-body-grey">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </div>
        <MemberCard member={memberB} />
      </div>

      {/* Note */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <label htmlFor="note" className="font-display text-lg font-bold text-navy block mb-1">
          Why should these two meet?
        </label>
        <p className="text-sm text-body-grey mb-4">
          Write a short note explaining why you&apos;re making this introduction. Both people will see this.
        </p>
        <textarea
          id="note"
          rows={4}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Write a short note explaining why you're making this introduction. Both people will see this."
          className="w-full px-4 py-3 bg-white border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors text-sm resize-none"
        />
      </div>

      {/* Notify checkboxes */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <p className="font-display text-base font-bold text-navy mb-3">Notify</p>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendToA}
              onChange={e => setSendToA(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-navy"
            />
            <span className="text-sm text-navy">Send to {memberA.name}</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendToB}
              onChange={e => setSendToB(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-navy"
            />
            <span className="text-sm text-navy">Send to {memberB.name}</span>
          </label>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !note.trim()}
        className="w-full py-3 bg-navy text-warm-white text-sm font-semibold rounded-full hover:bg-navy/90 transition-colors disabled:opacity-40"
      >
        {loading ? 'Making the introduction…' : 'Make the introduction'}
      </button>
    </form>
  )
}
