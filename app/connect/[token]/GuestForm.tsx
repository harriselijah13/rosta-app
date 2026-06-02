'use client'

import { useState } from 'react'

type Props = {
  token: string
  hostName: string
}

export default function GuestForm({ token, hostName }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatIDo, setWhatIDo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<'sent' | 'already' | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/guest/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, email, whatIDo }),
      })
      const data = await res.json()

      if (res.status === 409) { setDone('already'); return }
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      setDone('sent')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done === 'sent') {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-lime/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-display text-xl font-bold text-navy mb-2">All done!</p>
        <p className="text-body-grey text-sm">
          We&apos;ve sent you an email so you can stay connected with {hostName}.
        </p>
      </div>
    )
  }

  if (done === 'already') {
    return (
      <div className="text-center py-4">
        <p className="font-medium text-navy mb-1">Already got you</p>
        <p className="text-sm text-body-grey">Check your inbox for the email we sent earlier.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="guest-name" className="block text-sm font-medium text-navy mb-1.5">
          Your name
        </label>
        <input
          id="guest-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Alex Morgan"
          required
          className="w-full px-4 py-3.5 bg-white border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors text-base"
        />
      </div>

      <div>
        <label htmlFor="guest-email" className="block text-sm font-medium text-navy mb-1.5">
          Email address
        </label>
        <input
          id="guest-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="alex@example.com"
          required
          className="w-full px-4 py-3.5 bg-white border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors text-base"
        />
      </div>

      <div>
        <label htmlFor="guest-what" className="block text-sm font-medium text-navy mb-1.5">
          What do you do?
        </label>
        <input
          id="guest-what"
          type="text"
          value={whatIDo}
          onChange={e => setWhatIDo(e.target.value)}
          placeholder="Building a fintech startup for SMEs"
          required
          maxLength={120}
          className="w-full px-4 py-3.5 bg-white border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors text-base"
        />
        <p className="mt-1 text-xs text-body-grey">One sentence is enough.</p>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-navy text-warm-white py-4 rounded-full font-semibold text-base hover:bg-navy/90 transition-colors disabled:opacity-60 mt-2"
      >
        {loading ? 'Sending…' : 'Stay connected'}
      </button>
    </form>
  )
}
