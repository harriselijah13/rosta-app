'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

type MutualProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  what_i_do: string | null
}

type Props = {
  requesterId: string
  targetId: string
  targetName: string
  mutuals: MutualProfile[]
  credits: number
}

function Initials({ name }: { name: string }) {
  const initials = name.trim().split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="w-9 h-9 rounded-full bg-navy/10 text-navy text-sm font-semibold flex items-center justify-center shrink-0">
      {initials || '?'}
    </div>
  )
}

export default function IntroRequestForm({ requesterId, targetId, targetName, mutuals, credits }: Props) {
  const router = useRouter()
  const [facilitatorId, setFacilitatorId] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleDraftWithAI() {
    setDrafting(true)
    try {
      const res = await fetch('/api/ai/draft-intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
      })
      if (res.ok) {
        const { draft } = await res.json()
        if (draft) setNote(draft)
      }
    } catch {
      // Silent fallback — leave note field empty
    } finally {
      setDrafting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!facilitatorId) { setError('Select a facilitator.'); return }
    if (!note.trim()) { setError('Add a note explaining why you want the intro.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/intros/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, facilitatorId, note }),
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
          Your facilitator has 48 hours to accept or decline.
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
      {/* Facilitator picker */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <h2 className="font-display text-lg font-bold text-navy mb-1">Who should make the intro?</h2>
        <p className="text-sm text-body-grey mb-4">
          Select a mutual connection who knows {targetName}.
        </p>
        <div className="space-y-2">
          {mutuals.map(m => {
            const fullName = [m.first_name, m.last_name].filter(Boolean).join(' ') || 'A member'
            const selected = facilitatorId === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setFacilitatorId(m.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  selected ? 'border-navy bg-navy/5' : 'border-border hover:border-navy/40'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  selected ? 'border-navy' : 'border-border'
                }`}>
                  {selected && <span className="w-2 h-2 rounded-full bg-navy block" />}
                </div>
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt={fullName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <Initials name={fullName} />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy">{fullName}</p>
                  {m.what_i_do && <p className="text-xs text-body-grey truncate">{m.what_i_do}</p>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Note */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <label htmlFor="note" className="font-display text-lg font-bold text-navy">
            Why do you want this intro?
          </label>
          <button
            type="button"
            onClick={handleDraftWithAI}
            disabled={drafting}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-navy border border-lime bg-lime/10 hover:bg-lime/20 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
          >
            {drafting ? (
              <>
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Drafting…
              </>
            ) : (
              <>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
                Draft with AI
              </>
            )}
          </button>
        </div>
        <p className="text-sm text-body-grey mb-4">
          This goes to your facilitator — give them enough context to make the ask.
        </p>
        <textarea
          id="note"
          rows={4}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="I've been following their work on X and would love to explore a collaboration around Y..."
          className="w-full px-4 py-3 bg-white border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors text-sm resize-none"
        />
      </div>

      {/* Credits */}
      <p className="text-xs text-body-grey text-right px-1">
        This will use 1 intro credit — you have <strong className="text-navy">{credits}</strong> remaining this month.
      </p>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      <Button type="submit" loading={loading} size="lg" className="w-full">
        Send intro request
      </Button>
    </form>
  )
}
