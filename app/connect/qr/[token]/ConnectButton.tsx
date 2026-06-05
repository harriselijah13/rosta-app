'use client'

import { useState } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'

type Props = {
  token: string
  ownerName: string
}

export default function ConnectButton({ token, ownerName }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState<{ slug: string; name: string } | null>(null)

  async function handleConnect() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/qr/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      setConnected({ slug: data.ownerSlug, name: data.ownerName })
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (connected) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-lime/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-bold text-navy mb-2">Connected!</h2>
        <p className="text-body-grey text-sm mb-6">You&apos;re now connected with {connected.name}.</p>
        <Link
          href={`/profile/${connected.slug}`}
          className="inline-block text-sm font-medium bg-navy text-warm-white px-6 py-3 rounded-full hover:bg-navy/90 transition-colors"
        >
          View profile
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl text-center">{error}</p>
      )}
      <p className="text-center text-xs text-body-grey leading-relaxed">
        By connecting you agree to our{' '}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-navy transition-colors">Privacy Policy</Link>.
      </p>
      <Button onClick={handleConnect} loading={loading} size="lg" className="w-full">
        Connect with {ownerName}
      </Button>
      <p className="text-center text-xs text-body-grey">
        You&apos;ll both receive a confirmation.
      </p>
    </div>
  )
}
