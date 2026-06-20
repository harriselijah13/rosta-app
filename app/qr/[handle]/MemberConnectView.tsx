'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  handle: string
  name: string
  initials: string
  avatarUrl: string | null
  whatIDo: string | null
}

export default function MemberConnectView({
  handle,
  name,
  initials,
  avatarUrl,
  whatIDo,
}: Props) {
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [connected, setConnected] = useState<{ slug: string } | null>(null)

  async function handleConnect() {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/qr/${encodeURIComponent(handle)}/connect`, {
      method: 'POST',
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.')
      setLoading(false)
      return
    }
    setConnected({ slug: data.ownerSlug })
  }

  if (connected) {
    return (
      <div className="min-h-screen bg-warm-white flex flex-col">
        <div className="bg-white border-b border-border px-6 py-4">
          <p className="font-display text-xl font-bold text-navy">
            ROSTA<span className="text-lime">.</span>
          </p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-navy mb-2">
            You&apos;re connected with {name}.
          </h1>
          <p className="text-body-grey text-sm mb-8">
            You can now message each other on ROSTA.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <Link
              href={`/profile/${connected.slug}`}
              className="flex-1 py-3 bg-navy text-warm-white font-semibold text-sm rounded-full text-center hover:bg-navy/90 transition-colors"
            >
              View profile
            </Link>
            <Link
              href="/messages"
              className="flex-1 py-3 border border-navy text-navy font-semibold text-sm rounded-full text-center hover:bg-navy hover:text-warm-white transition-colors"
            >
              Messages
            </Link>
          </div>
        </div>
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
        {/* Profile card */}
        <div className="bg-white border border-border rounded-2xl p-8 text-center mb-4">
          <div className="mb-5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name}
                className="w-20 h-20 rounded-full object-cover mx-auto"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-navy/10 text-navy text-xl font-semibold flex items-center justify-center mx-auto">
                {initials}
              </div>
            )}
          </div>
          <h1 className="font-display text-2xl font-bold text-navy mb-1">{name}</h1>
          {whatIDo && <p className="text-body-grey text-sm mb-4">{whatIDo}</p>}
          <span className="inline-flex items-center gap-1.5 text-xs text-body-grey px-3 py-1 rounded-full bg-surface border border-border">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            ROSTA member
          </span>
        </div>

        {/* Connect action */}
        <div className="bg-white border border-border rounded-2xl p-6 flex flex-col gap-3">
          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl text-center">{error}</p>
          )}
          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full py-3.5 bg-navy text-warm-white font-semibold text-sm rounded-full hover:bg-navy/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Connecting…' : `Connect with ${name}`}
          </button>
          <p className="text-center text-xs text-body-grey">
            You&apos;re both here in person. No intro required.
          </p>
        </div>
      </div>
    </div>
  )
}
