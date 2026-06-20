'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function JoinForm() {
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref') ?? ''

  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [why,     setWhy]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !why.trim()) {
      setError('All fields are required.')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch('/api/join/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), why: why.trim(), ref }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      setError(d?.error ?? 'Something went wrong. Try again.')
      setLoading(false)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-warm-white flex flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-xl font-bold text-navy mb-6">
          ROSTA<span className="text-lime">.</span>
        </p>
        <h1 className="font-display text-2xl font-bold text-navy mb-3">Request received.</h1>
        <p className="text-body-grey text-sm max-w-xs leading-relaxed">
          We review every request personally. You&apos;ll hear from us if there&apos;s a spot.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-warm-white">
      <div className="bg-white border-b border-border px-6 py-4 sticky top-0 z-10">
        <p className="font-display text-xl font-bold text-navy">
          ROSTA<span className="text-lime">.</span>
        </p>
      </div>

      <div className="max-w-sm mx-auto px-6 py-8">
        <h1 className="font-display text-2xl font-bold text-navy mb-1">Request an invite</h1>
        <p className="text-body-grey text-sm mb-8 leading-relaxed">
          ROSTA is invite-only. Tell us a little about yourself and why you&apos;re interested.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Your name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Why are you interested?</label>
            <textarea
              value={why}
              onChange={e => setWhy(e.target.value)}
              placeholder="What brings you here, and what do you work on?"
              rows={3}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy bg-white resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-lime text-navy font-semibold text-sm rounded-full hover:bg-lime/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send request'}
          </button>
        </form>

        <p className="text-center text-xs text-body-grey mt-6">
          Already have an invite code?{' '}
          <Link href="/signup" className="text-navy hover:underline">
            Sign up here
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  )
}
